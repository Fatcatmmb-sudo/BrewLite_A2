
// Kiểm tra quyền xem tồn kho, bộ lọc, phân trang,
// quyền nhập kho và ghi dữ liệu qua HTTP với PostgreSQL.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { InventoryRepository } from '../../src/modules/inventory/repositories/inventory.repository.js';

// Chỉ cho phép chạy trên database smoke test riêng.
// Không chạy nhầm vào database phát triển chính.
const url = process.env.SMOKE_DATABASE_URL;

if (
  !url ||
  !new URL(url).pathname.slice(1).startsWith('brewlite_foundation_smoke')
) {
  throw new Error('Use an isolated smoke database');
}

describe('Tồn kho nhân viên qua HTTP và PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let staff: string;
  let customer: string;
  let staffId: string;

  const previous = process.env.DATABASE_URL;
  const prefix = `INV-${randomUUID().slice(0, 8)}`;

  const bearer = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  // Tạo nguyên liệu riêng cho từng test.
  const create = (stockQuantity = 1000) =>
    prisma.ingredient.create({
      data: {
        code: `${prefix}-${randomUUID()}`,
        name: 'Audit coffee beans',
        unit: 'G',
        stockQuantity,
      },
    });

  beforeAll(async () => {
    // Chuyển kết nối Prisma sang database smoke test.
    process.env.DATABASE_URL = url;

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    const jwt = app.get(JwtService);

    // Tạo hai tài khoản kiểm thử: BARISTA và CUSTOMER.
    for (const role of ['BARISTA', 'CUSTOMER'] as const) {
      const user = await prisma.user.create({
        data: {
          username: randomUUID(),
          passwordHash: 'test-only',
          role,
        },
      });

      const token = jwt.sign({
        sub: user.id,
        role,
        username: user.username,
      });

      if (role === 'BARISTA') {
        staff = token;
        staffId = user.id;
      } else {
        customer = token;
      }
    }
  });

  afterAll(async () => {
    await app?.close();

    // Khôi phục DATABASE_URL ban đầu.
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  });

  // --------------------------------------------------
  // 1. Kiểm tra xác thực và phân quyền
  // --------------------------------------------------

  it('Yêu cầu JWT và chặn CUSTOMER đọc danh sách, chi tiết hoặc ghi tồn kho', async () => {
    const item = await create();

    for (const path of [
      '/staff/inventory',
      `/staff/inventory/${item.id}`,
    ]) {
      await request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .expect(401);

      await request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set(bearer(customer))
        .expect(403);
    }

    // CUSTOMER không được sử dụng API PATCH tồn kho.
    await request(app.getHttpServer())
      .patch(`/api/v1/staff/inventory/${item.id}/stock`)
      .send({
        stockQuantity: 0,
        version: 0,
      })
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/api/v1/staff/inventory/${item.id}/stock`)
      .set(bearer(customer))
      .send({
        stockQuantity: 0,
        version: 0,
      })
      .expect(403);

    const unchanged = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(unchanged.stockQuantity).toBe(1000);
  });

  // --------------------------------------------------
  // 2. Kiểm tra tìm kiếm, lọc và phân trang
  // --------------------------------------------------

  it('Tìm kiếm, lọc theo mức tồn và phân trang không trùng dòng', async () => {
    const items = await Promise.all([
      create(0),
      create(100),
      create(1000),
    ]);

    const first = await request(app.getHttpServer())
      .get(`/api/v1/staff/inventory?q=${prefix}&limit=2`)
      .set(bearer(staff))
      .expect(200);

    expect(first.body.data).toHaveLength(2);

    const second = await request(app.getHttpServer())
      .get(
        `/api/v1/staff/inventory?q=${prefix}&limit=2&cursor=${first.body.meta.nextCursor}`,
      )
      .set(bearer(staff))
      .expect(200);

    const ids = [
      ...first.body.data,
      ...second.body.data,
    ].map((item: { id: string }) => item.id);

    // Không có nguyên liệu nào xuất hiện trùng ở hai trang.
    expect(new Set(ids).size).toBe(ids.length);

    const statuses = [
      'OUT_OF_STOCK',
      'LOW_STOCK',
      'IN_STOCK',
    ] as const;

    for (const [index, status] of statuses.entries()) {
      const result = await request(app.getHttpServer())
        .get(`/api/v1/staff/inventory?q=${prefix}&status=${status}`)
        .set(bearer(staff))
        .expect(200);

      expect(
        result.body.data.every(
          (item: { status: string }) => item.status === status,
        ),
      ).toBe(true);

      expect(
        result.body.data.some(
          (item: { id: string }) => item.id === items[index].id,
        ),
      ).toBe(true);
    }
  });

  // --------------------------------------------------
  // 3. Kiểm tra API chi tiết nguyên liệu
  // --------------------------------------------------

  it('Chi tiết hiển thị đơn vị, phiên bản và xác thực mã định danh', async () => {
    const item = await create();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/staff/inventory/${item.id}`)
      .set(bearer(staff))
      .expect(200);

    expect(detail.body.data).toMatchObject({
      unit: 'G',
      version: 0,
      stockQuantity: 1000,
    });

    // UUID không hợp lệ.
    await request(app.getHttpServer())
      .get('/api/v1/staff/inventory/not-a-uuid')
      .set(bearer(staff))
      .expect(400);

    // UUID hợp lệ nhưng không tồn tại.
    await request(app.getHttpServer())
      .get(`/api/v1/staff/inventory/${randomUUID()}`)
      .set(bearer(staff))
      .expect(404);
  });

  // --------------------------------------------------
  // 4. Kiểm tra BARISTA không được sửa tồn kho bằng PATCH
  // --------------------------------------------------

  it('BARISTA được xem tồn nhưng không được đổi số lượng qua API PATCH', async () => {
    const item = await create();

    for (const data of [
      { stockQuantity: 0, version: 0 },
      { stockQuantity: 250, version: 0 },
      { stockQuantity: -1 },
      { role: 'MANAGER', stockQuantity: 0 },
    ]) {
      const result = await request(app.getHttpServer())
        .patch(`/api/v1/staff/inventory/${item.id}/stock`)
        .set(bearer(staff))
        .send(data)
        .expect(403);

      expect(result.body.error.code).toBe('FORBIDDEN_RESOURCE');
    }

    const row = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(row.stockQuantity).toBe(1000);
    expect(row.version).toBe(0);
  });

  // --------------------------------------------------
  // 5. Kiểm tra BARISTA nhập kho thành công
  // --------------------------------------------------

  it('BARISTA nhập kho thành công và ghi lịch sử chính xác', async () => {
    const item = await create(1000);

    const result = await request(app.getHttpServer())
      .post(`/api/v1/staff/inventory/${item.id}/receipts`)
      .set(bearer(staff))
      .send({ quantity: 10 })
      .expect(201);

    expect(result.body.data).toMatchObject({
      ingredientId: item.id,
      receivedByUserId: staffId,
      quantity: 10,
      stockBefore: 1000,
      stockAfter: 1010,
    });

    expect(result.body.data.receiptId).toBeDefined();
    expect(result.body.data.createdAt).toBeDefined();

    // Kiểm tra tồn kho thực tế trong PostgreSQL.
    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1010);
    expect(updated.version).toBe(1);

    // Kiểm tra lịch sử nhập kho thực tế.
    const receipts = await prisma.inventoryReceipt.findMany({
      where: { ingredientId: item.id },
    });

    expect(receipts).toHaveLength(1);

    expect(receipts[0]).toMatchObject({
      ingredientId: item.id,
      receivedByUserId: staffId,
      quantity: 10,
      stockBefore: 1000,
      stockAfter: 1010,
    });
  });

  // --------------------------------------------------
  // 6. Kiểm tra số lượng nhập không hợp lệ
  // --------------------------------------------------

  it('Từ chối số lượng nhập không hợp lệ và không thay đổi tồn kho', async () => {
    const item = await create(1000);

    for (const quantity of [
      0,
      -1,
      1.5,
      2147483648,
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/staff/inventory/${item.id}/receipts`)
        .set(bearer(staff))
        .send({ quantity })
        .expect(400);
    }

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1000);
    expect(updated.version).toBe(0);

    const receipts = await prisma.inventoryReceipt.findMany({
      where: { ingredientId: item.id },
    });

    expect(receipts).toHaveLength(0);
  });

  // --------------------------------------------------
  // 7. Kiểm tra tràn giới hạn tồn kho
  // --------------------------------------------------

  it('Từ chối nhập kho nếu cộng thêm làm tồn kho vượt giới hạn Int', async () => {
    const item = await create(2147483640);

    await request(app.getHttpServer())
      .post(`/api/v1/staff/inventory/${item.id}/receipts`)
      .set(bearer(staff))
      .send({ quantity: 10 })
      .expect(400);

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(2147483640);
    expect(updated.version).toBe(0);

    const receipts = await prisma.inventoryReceipt.findMany({
      where: { ingredientId: item.id },
    });

    expect(receipts).toHaveLength(0);
  });

  // --------------------------------------------------
  // 8. Kiểm tra quyền nhập kho
  // --------------------------------------------------

  it('Từ chối CUSTOMER và yêu cầu đăng nhập khi nhập kho', async () => {
    const item = await create(1000);

    const path = `/api/v1/staff/inventory/${item.id}/receipts`;

    // Không có JWT.
    await request(app.getHttpServer())
      .post(path)
      .send({ quantity: 10 })
      .expect(401);

    // Có JWT CUSTOMER nhưng không đủ quyền.
    await request(app.getHttpServer())
      .post(path)
      .set(bearer(customer))
      .send({ quantity: 10 })
      .expect(403);

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1000);
    expect(updated.version).toBe(0);

    const receipts = await prisma.inventoryReceipt.findMany({
      where: { ingredientId: item.id },
    });

    expect(receipts).toHaveLength(0);
  });

  // --------------------------------------------------
  // 9. Kiểm tra nguyên liệu không tồn tại hoặc ngừng hoạt động
  // --------------------------------------------------

  it('Từ chối nhập kho khi nguyên liệu không tồn tại hoặc đã ngừng hoạt động', async () => {
    // Nguyên liệu không tồn tại.
    await request(app.getHttpServer())
      .post(`/api/v1/staff/inventory/${randomUUID()}/receipts`)
      .set(bearer(staff))
      .send({ quantity: 10 })
      .expect(404);

    // Nguyên liệu đã ngừng hoạt động.
    const inactive = await create(1000);

    await prisma.ingredient.update({
      where: { id: inactive.id },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/staff/inventory/${inactive.id}/receipts`)
      .set(bearer(staff))
      .send({ quantity: 10 })
      .expect(404);

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: inactive.id },
    });

    expect(updated.stockQuantity).toBe(1000);
    expect(updated.version).toBe(0);

    const receipts = await prisma.inventoryReceipt.findMany({
      where: { ingredientId: inactive.id },
    });

    expect(receipts).toHaveLength(0);
  });

  // --------------------------------------------------
  // 10. Kiểm tra rollback khi ghi lịch sử nhập kho thất bại
  // --------------------------------------------------

  it('Rollback tồn kho nếu ghi lịch sử nhập kho thất bại', async () => {
    const item = await create(1000);

    const repository = app.get(InventoryRepository);

    // Giả lập lỗi khi ghi lịch sử nhập kho.
    const receiptSpy = vi
      .spyOn(repository, 'createInventoryReceipt')
      .mockRejectedValueOnce(
        new Error('Simulated inventory receipt failure'),
      );

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/staff/inventory/${item.id}/receipts`)
        .set(bearer(staff))
        .send({ quantity: 50 })
        .expect(500);
    } finally {
      receiptSpy.mockRestore();
    }

    // Kiểm tra transaction đã rollback cập nhật tồn kho.
    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1000);
    expect(updated.version).toBe(0);

    // Không được tồn tại lịch sử nhập kho.
    const receipts = await prisma.inventoryReceipt.findMany({
      where: { ingredientId: item.id },
    });

    expect(receipts).toHaveLength(0);
  });

  // --------------------------------------------------
  // 11. Kiểm tra hai yêu cầu nhập kho đồng thời
  // --------------------------------------------------

  it('Xử lý chính xác hai yêu cầu nhập kho đồng thời', async () => {
    const item = await create(1000);

    const quantities = [10, 20];

    // Gửi hai yêu cầu gần như đồng thời.
    const results = await Promise.all(
      quantities.map((quantity) =>
        request(app.getHttpServer())
          .post(`/api/v1/staff/inventory/${item.id}/receipts`)
          .set(bearer(staff))
          .send({ quantity }),
      ),
    );

    // Chỉ chấp nhận hai kết quả hợp lệ:
    // 201: nhập kho thành công.
    // 409: phiên bản tồn kho đã thay đổi.
    for (const result of results) {
      expect([201, 409]).toContain(result.status);
    }

    const successfulResults = results.filter(
      (result) => result.status === 201,
    );

    const expectedAdded = successfulResults.reduce(
      (total, result) => total + result.body.data.quantity,
      0,
    );

    // Phải có ít nhất một yêu cầu nhập kho thành công.
    expect(successfulResults.length).toBeGreaterThanOrEqual(1);

    // Kiểm tra tồn kho thực tế.
    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1000 + expectedAdded);
    expect(updated.version).toBe(successfulResults.length);

    // Kiểm tra lịch sử nhập kho.
    const receipts = await prisma.inventoryReceipt.findMany({
      where: { ingredientId: item.id },
    });

    expect(receipts).toHaveLength(successfulResults.length);

    const actualAdded = receipts.reduce(
      (total, receipt) => total + receipt.quantity,
      0,
    );

    expect(actualAdded).toBe(expectedAdded);

    // Tất cả lịch sử phải thuộc Barista đang đăng nhập.
    expect(
      receipts.every((receipt) => receipt.receivedByUserId === staffId),
    ).toBe(true);
  });

  // --------------------------------------------------
  // 12. Kiểm tra BARISTA bị vô hiệu hóa
  // --------------------------------------------------

  it('BARISTA bị thu quyền không xem được hoặc nhập kho dù JWT còn hạn', async () => {
    await prisma.user.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    try {
      // Không được xem danh sách tồn kho.
      await request(app.getHttpServer())
        .get('/api/v1/staff/inventory')
        .set(bearer(staff))
        .expect(401);

      // Không được xem hàng đợi.
      await request(app.getHttpServer())
        .get('/api/v1/staff/orders')
        .set(bearer(staff))
        .expect(401);

      // Không được nhập kho.
      const item = await create(1000);

      await request(app.getHttpServer())
        .post(`/api/v1/staff/inventory/${item.id}/receipts`)
        .set(bearer(staff))
        .send({ quantity: 10 })
        .expect(401);

      const unchanged = await prisma.ingredient.findUniqueOrThrow({
        where: { id: item.id },
      });

      expect(unchanged.stockQuantity).toBe(1000);
      expect(unchanged.version).toBe(0);
    } finally {
      // Luôn khôi phục tài khoản để không ảnh hưởng test khác.
      await prisma.user.update({
        where: { id: staffId },
        data: { isActive: true },
      });
    }
  });
});
