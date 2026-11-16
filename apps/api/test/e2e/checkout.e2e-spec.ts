// Kiểm tra báo giá coupon, tạo đơn, thanh toán và thử lại qua API với PostgreSQL.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { CouponRedemptionStatus, OrderStatus, PaymentStatus } from '../../src/generated/prisma/client.js';
import { MockGatewayService } from '../../src/modules/payments/services/mock-gateway.service.js';

const connectionString = process.env.SMOKE_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.slice(1).startsWith('brewlite_foundation_smoke')) {
  throw new Error('Checkout E2E requires a disposable brewlite_foundation_smoke* database.');
}

describe('Checkout E2E: coupon, thanh toán lỗi và thử lại', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousGatewayMode = process.env.MOCK_PAYMENT_MODE;

  const auth = (test: request.Test) => test.set('Authorization', `Bearer ${token}`);

  async function createVariant(price = 50000n) {
    const ingredient = await prisma.ingredient.create({
      data: {
        code: `CHECKOUT-BEAN-${randomUUID()}`,
        name: 'Checkout beans',
        unit: 'G',
        stockQuantity: 500,
      },
    });
    const product = await prisma.product.create({
      data: {
        sku: `CHECKOUT-${randomUUID()}`,
        name: 'Checkout coffee',
        imageUrl: '/checkout.png',
        variants: {
          create: {
            size: 'M',
            price,
            recipeItems: { create: { ingredientId: ingredient.id, quantity: 10 } },
          },
        },
      },
      include: { variants: true },
    });
    return { ...product.variants[0], ingredientId: ingredient.id };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = connectionString;
    process.env.MOCK_PAYMENT_MODE = 'deterministic';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const user = await prisma.user.create({
      data: { username: `checkout-${randomUUID()}`, passwordHash: 'test-only', role: 'CUSTOMER' },
    });
    userId = user.id;
    token = app.get(JwtService).sign({ sub: user.id, username: user.username, role: user.role });
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await app?.close();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousGatewayMode === undefined) delete process.env.MOCK_PAYMENT_MODE;
    else process.env.MOCK_PAYMENT_MODE = previousGatewayMode;
  });

  it('TC-FR-06-B / TC-FR-07-A: tính tiền size, topping và coupon rồi thanh toán theo giá đã chốt', async () => {
    const variant = await createVariant();
    const topping = await prisma.topping.create({
      data: {
        code: `TOPPING-${randomUUID()}`,
        name: 'Checkout topping',
        price: 7000n,
        recipeItems: { create: { ingredientId: variant.ingredientId, quantity: 5 } },
      },
    });
    await prisma.productTopping.create({
      data: { productId: variant.productId, toppingId: topping.id },
    });
    const coupon = await prisma.coupon.create({
      data: {
        code: `SAVE-${randomUUID().slice(0, 8)}`,
        discountType: 'FIXED_AMOUNT',
        discountValue: 10000n,
        minOrderValue: 30000n,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 3_600_000),
      },
    });

    const quote = await auth(request(app.getHttpServer()).post('/api/v1/coupons/validate'))
      .send({ code: coupon.code, subtotal: 114000 })
      .expect(200);
    expect(quote.body.data).toEqual({ code: coupon.code, discountAmount: 10000 });

    const orderResponse = await auth(request(app.getHttpServer()).post('/api/v1/orders'))
      .send({
        items: [{ productVariantId: variant.id, quantity: 2, toppingIds: [topping.id], sugarLevel: 0, iceLevel: 100 }],
        couponCode: coupon.code,
      })
      .expect(201);
    const orderId = orderResponse.body.data.id as string;
    expect(orderResponse.body.data).toMatchObject({ subtotal: 114000, discountAmount: 10000, total: 104000, status: 'PENDING' });

    await prisma.productVariant.update({ where: { id: variant.id }, data: { price: 60000n } });
    await prisma.topping.update({ where: { id: topping.id }, data: { price: 9000n } });
    await prisma.coupon.update({ where: { id: coupon.id }, data: { discountValue: 5000n } });

    const charge = vi.spyOn(app.get(MockGatewayService), 'charge');
    const key = randomUUID();
    const pay = (body: Record<string, unknown>) =>
      auth(request(app.getHttpServer()).post('/api/v1/payments'))
        .set('Idempotency-Key', key)
        .send({ orderId, method: 'E_WALLET', ...body });

    await pay({ amount: 1 }).expect(400);
    expect(charge).not.toHaveBeenCalled();
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId } })).toBe(0);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
      status: OrderStatus.PENDING,
      total: 104000n,
    });
    expect(await prisma.inventoryReservation.findMany({ where: { orderId } }))
      .toMatchObject([{ status: 'ACTIVE' }]);
    expect(await prisma.couponRedemption.findFirstOrThrow({ where: { orderId } }))
      .toMatchObject({ status: CouponRedemptionStatus.RESERVED, discountAmount: 10000n });

    const payment = await pay({}).expect(200);
    expect(payment.body.data).toMatchObject({ success: true, isRetried: false, status: 'SUCCEEDED' });
    expect(charge).toHaveBeenCalledExactlyOnceWith(104000, 'E_WALLET');

    const detail = await auth(request(app.getHttpServer()).get(`/api/v1/orders/${orderId}`)).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'PAID', total: 104000 });
    expect(detail.body.data.items).toMatchObject([{
      unitPrice: 50000,
      quantity: 2,
      lineTotal: 114000,
      toppings: [{ unitPrice: 7000 }],
    }]);
    expect(detail.body.data.paymentSummary).toMatchObject({ status: 'SUCCEEDED', amount: 104000 });
    expect(await prisma.couponRedemption.findFirstOrThrow({ where: { orderId } })).toMatchObject({
      status: CouponRedemptionStatus.CONSUMED,
      discountAmount: 10000n,
    });
  });

  it('FR-16 / UC-15: hai lượt duyệt đồng thời chỉ hoàn điểm và tồn kho một lần', async () => {
    const variant = await createVariant();
    const barista = await prisma.user.create({
      data: { username: `checkout-barista-${randomUUID()}`, passwordHash: 'test-only', role: 'BARISTA' },
    });
    const baristaToken = app.get(JwtService).sign({ sub: barista.id, username: barista.username, role: barista.role });
    const created = await auth(request(app.getHttpServer()).post('/api/v1/orders'))
      .send({ items: [{ productVariantId: variant.id, quantity: 1 }] })
      .expect(201);
    const orderId = created.body.data.id as string;
    await auth(request(app.getHttpServer()).post('/api/v1/payments'))
      .set('Idempotency-Key', randomUUID())
      .send({ orderId, method: 'E_WALLET' })
      .expect(200);
    await auth(request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/refund-request`))
      .send({ reason: 'Đổi ý trước khi pha chế' })
      .expect(201);

    const approvePath = `/api/v1/staff/orders/${orderId}/refund/approve`;
    await auth(request(app.getHttpServer()).patch(approvePath)).expect(403);
    const { loyaltyBalance } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await prisma.ingredient.findUniqueOrThrow({ where: { id: variant.ingredientId } }))
      .toMatchObject({ stockQuantity: 490 });

    const approve = () => request(app.getHttpServer()).patch(approvePath)
      .set('Authorization', `Bearer ${baristaToken}`);
    const results = await Promise.all([approve(), approve()]);
    expect(results.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 409]);

    expect(await prisma.refundRequest.findUniqueOrThrow({ where: { orderId } }))
      .toMatchObject({ status: 'APPROVED', processedByUserId: barista.id });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: 'CANCELLED' });
    expect(await prisma.orderStatusHistory.count({ where: { orderId, toStatus: 'CANCELLED' } })).toBe(1);
    expect(await prisma.inventoryReservation.findMany({ where: { orderId } }))
      .toMatchObject([{ status: 'RELEASED' }]);
    expect(await prisma.ingredient.findUniqueOrThrow({ where: { id: variant.ingredientId } }))
      .toMatchObject({ stockQuantity: 500 });
    expect(await prisma.loyaltyTransaction.findMany({ where: { orderId, type: 'REFUND' } }))
      .toMatchObject([{ userId, points: 50000, balanceAfter: loyaltyBalance + 50000 }]);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
      .toMatchObject({ loyaltyBalance: loyaltyBalance + 50000 });
    expect(await prisma.payment.findMany({ where: { orderId } }))
      .toMatchObject([{ status: 'SUCCEEDED', amount: 50000n }]);
  });

  it('TC-FR-07-C / TC-NFR-05: 20 yêu cầu cùng khóa chỉ thanh toán và cộng điểm một lần', async () => {
    const variant = await createVariant();
    const created = await auth(request(app.getHttpServer()).post('/api/v1/orders'))
      .send({ items: [{ productVariantId: variant.id, quantity: 1 }] })
      .expect(201);
    const orderId = created.body.data.id as string;
    const key = randomUUID();
    const pay = () => auth(request(app.getHttpServer()).post('/api/v1/payments'))
      .set('Idempotency-Key', key)
      .send({ orderId, method: 'E_WALLET' });
    const charge = vi.spyOn(app.get(MockGatewayService), 'charge');
    const { loyaltyBalance } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const results = await Promise.all(Array.from({ length: 20 }, () => pay()));
    const completed = results.filter((result) => result.status === 200);
    const pending = results.filter((result) => result.status === 409);
    expect(completed.length + pending.length).toBe(20);
    expect(completed.filter((result) => result.body.data.isRetried === false)).toHaveLength(1);
    for (const result of completed) {
      expect(result.body.data).toMatchObject({ success: true, status: 'SUCCEEDED' });
    }
    for (const result of pending) {
      expect(result.body.code).toBe('PAYMENT_IN_PROGRESS');
    }

    const replay = await pay().expect(200);
    expect(replay.body.data).toMatchObject({ success: true, status: 'SUCCEEDED', isRetried: true });
    expect(charge).toHaveBeenCalledExactlyOnceWith(50000, 'E_WALLET');
    expect(await prisma.payment.findMany({ where: { orderId } }))
      .toMatchObject([{ status: 'SUCCEEDED', amount: 50000n }]);
    expect(await prisma.orderStatusHistory.count({ where: { orderId, toStatus: 'PAID' } })).toBe(1);
    expect(await prisma.inventoryReservation.findMany({ where: { orderId } }))
      .toMatchObject([{ status: 'CONSUMED' }]);
    expect(await prisma.loyaltyTransaction.findMany({ where: { orderId } }))
      .toMatchObject([{ type: 'EARN', points: 5000, balanceAfter: loyaltyBalance + 5000 }]);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
      .toMatchObject({ loyaltyBalance: loyaltyBalance + 5000 });
  });

  it('Giữ nguyên đơn sau thất bại và thử lại với khóa mới', async () => {
    const variant = await createVariant();
    const orderResponse = await auth(request(app.getHttpServer()).post('/api/v1/orders'))
      .send({ items: [{ productVariantId: variant.id, quantity: 1 }] })
      .expect(201);
    const orderId = orderResponse.body.data.id as string;
    const failedKey = randomUUID();

    const failed = await auth(request(app.getHttpServer()).post('/api/v1/payments'))
      .set('Idempotency-Key', failedKey)
      .send({ orderId, method: 'CARD' })
      .expect(200);
    expect(failed.body.data).toMatchObject({ success: false, isRetried: false, status: 'FAILED', errorCode: 'INSUFFICIENT_FUNDS' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(OrderStatus.PAYMENT_FAILED);

    const replay = await auth(request(app.getHttpServer()).post('/api/v1/payments'))
      .set('Idempotency-Key', failedKey)
      .send({ orderId, method: 'CARD' })
      .expect(200);
    expect(replay.body.data).toMatchObject({ success: false, isRetried: true, status: 'FAILED', errorCode: 'INSUFFICIENT_FUNDS' });

    const retried = await auth(request(app.getHttpServer()).post('/api/v1/payments'))
      .set('Idempotency-Key', randomUUID())
      .send({ orderId, method: 'E_WALLET' })
      .expect(200);
    expect(retried.body.data).toMatchObject({ success: true, isRetried: false, status: 'SUCCEEDED' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(OrderStatus.PAID);
    expect(await prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' }, select: { status: true } })).toEqual([
      { status: PaymentStatus.FAILED },
      { status: PaymentStatus.SUCCEEDED },
    ]);
    expect(await prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' }, select: { toStatus: true } })).toEqual([
      { toStatus: OrderStatus.PENDING },
      { toStatus: OrderStatus.PAYMENT_FAILED },
      { toStatus: OrderStatus.PENDING },
      { toStatus: OrderStatus.PAID },
    ]);
  });
});
