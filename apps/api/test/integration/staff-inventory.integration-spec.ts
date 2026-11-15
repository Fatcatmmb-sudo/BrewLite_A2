
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
  // 5. Kiểm tra BARISTA nhập một phiếu gồm nhiều nguyên liệu
  // --------------------------------------------------

  it('BARISTA nhập nhiều nguyên liệu thành công và ghi lịch sử chính xác', async () => {
    const item1 = await create(1000);
    const item2 = await create(2000);

    const result = await request(app.getHttpServer())
      .post('/api/v1/staff/inventory/receipts')
      .set(bearer(staff))
      .send({
        supplier: 'Nhà cung cấp kiểm thử',
        note: 'Phiếu nhập nhiều nguyên liệu',
        items: [
          { ingredientId: item1.id, quantity: 10 },
          { ingredientId: item2.id, quantity: 50 },
        ],
      })
      .expect(201);

    expect(result.body.data).toMatchObject({
      receivedByUserId: staffId,
      supplier: 'Nhà cung cấp kiểm thử',
      note: 'Phiếu nhập nhiều nguyên liệu',
    });

    expect(result.body.data.receiptId).toBeDefined();
    expect(result.body.data.createdAt).toBeDefined();
    expect(result.body.data.items).toHaveLength(2);

    expect(result.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ingredientId: item1.id,
          quantityAdded: 10,
          stockBefore: 1000,
          stockAfter: 1010,
        }),
        expect.objectContaining({
          ingredientId: item2.id,
          quantityAdded: 50,
          stockBefore: 2000,
          stockAfter: 2050,
        }),
      ]),
    );

    const updated1 = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item1.id },
    });

    const updated2 = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item2.id },
    });

    expect(updated1.stockQuantity).toBe(1010);
    expect(updated1.version).toBe(1);
    expect(updated2.stockQuantity).toBe(2050);
    expect(updated2.version).toBe(1);

    // Kiểm tra phiếu cha và hai dòng chi tiết trong database.
    const receipt = await prisma.inventoryReceipt.findUniqueOrThrow({
      where: { id: result.body.data.receiptId },
      include: { items: true },
    });

    expect(receipt.receivedByUserId).toBe(staffId);
    expect(receipt.items).toHaveLength(2);
  });

  // --------------------------------------------------
  // 6. Kiểm tra số lượng nhập không hợp lệ
  // --------------------------------------------------

  it('Từ chối số lượng nhập không hợp lệ và không thay đổi tồn kho', async () => {
    const item = await create(1000);

    for (const quantity of [0, -1, 1.5, 2147483648]) {
      await request(app.getHttpServer())
        .post('/api/v1/staff/inventory/receipts')
        .set(bearer(staff))
        .send({
          items: [{ ingredientId: item.id, quantity }],
        })
        .expect(400);
    }

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1000);
    expect(updated.version).toBe(0);

    const receiptItems = await prisma.inventoryReceiptItem.findMany({
      where: { ingredientId: item.id },
    });

    expect(receiptItems).toHaveLength(0);
  });

  // --------------------------------------------------
  // 7. Kiểm tra tràn giới hạn tồn kho
  // --------------------------------------------------

  it('Từ chối nhập kho nếu cộng thêm làm tồn kho vượt giới hạn Int', async () => {
    const item = await create(2147483640);

    await request(app.getHttpServer())
      .post('/api/v1/staff/inventory/receipts')
      .set(bearer(staff))
      .send({
        items: [{ ingredientId: item.id, quantity: 10 }],
      })
      .expect(400);

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(2147483640);
    expect(updated.version).toBe(0);

    const receiptItems = await prisma.inventoryReceiptItem.findMany({
      where: { ingredientId: item.id },
    });

    expect(receiptItems).toHaveLength(0);
  });

  // --------------------------------------------------
  // 8. Kiểm tra quyền nhập kho
  // --------------------------------------------------

  it('Từ chối CUSTOMER và yêu cầu đăng nhập khi nhập kho', async () => {
    const item = await create(1000);

    const payload = {
      items: [{ ingredientId: item.id, quantity: 10 }],
    };

    const path = '/api/v1/staff/inventory/receipts';

    await request(app.getHttpServer())
      .post(path)
      .send(payload)
      .expect(401);

    await request(app.getHttpServer())
      .post(path)
      .set(bearer(customer))
      .send(payload)
      .expect(403);

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1000);
    expect(updated.version).toBe(0);

    const receiptItems = await prisma.inventoryReceiptItem.findMany({
      where: { ingredientId: item.id },
    });

    expect(receiptItems).toHaveLength(0);
  });

  // --------------------------------------------------
  // 9. Kiểm tra nguyên liệu không tồn tại hoặc ngừng hoạt động
  // --------------------------------------------------

  it('Từ chối nhập kho khi nguyên liệu không tồn tại hoặc đã ngừng hoạt động', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/inventory/receipts')
      .set(bearer(staff))
      .send({
        items: [{ ingredientId: randomUUID(), quantity: 10 }],
      })
      .expect(404);

    const inactive = await create(1000);

    await prisma.ingredient.update({
      where: { id: inactive.id },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .post('/api/v1/staff/inventory/receipts')
      .set(bearer(staff))
      .send({
        items: [{ ingredientId: inactive.id, quantity: 10 }],
      })
      .expect(404);

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: inactive.id },
    });

    expect(updated.stockQuantity).toBe(1000);
    expect(updated.version).toBe(0);

    const receiptItems = await prisma.inventoryReceiptItem.findMany({
      where: { ingredientId: inactive.id },
    });

    expect(receiptItems).toHaveLength(0);
  });

  // --------------------------------------------------
  // 10. Kiểm tra rollback khi ghi lịch sử nhập kho thất bại
  // --------------------------------------------------

  it('Rollback toàn bộ tồn kho nếu ghi phiếu nhập thất bại', async () => {
    const item1 = await create(1000);
    const item2 = await create(2000);

    const repository = app.get(InventoryRepository);

    const receiptSpy = vi
      .spyOn(repository, 'createInventoryReceipt')
      .mockRejectedValueOnce(
        new Error('Simulated inventory receipt failure'),
      );

    try {
      await request(app.getHttpServer())
        .post('/api/v1/staff/inventory/receipts')
        .set(bearer(staff))
        .send({
          items: [
            { ingredientId: item1.id, quantity: 50 },
            { ingredientId: item2.id, quantity: 100 },
          ],
        })
        .expect(500);
    } finally {
      receiptSpy.mockRestore();
    }

    const updated1 = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item1.id },
    });

    const updated2 = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item2.id },
    });

    // Cả hai nguyên liệu phải được rollback.
    expect(updated1.stockQuantity).toBe(1000);
    expect(updated1.version).toBe(0);

    expect(updated2.stockQuantity).toBe(2000);
    expect(updated2.version).toBe(0);

    const receiptItems = await prisma.inventoryReceiptItem.findMany({
      where: {
        ingredientId: { in: [item1.id, item2.id] },
      },
    });

    expect(receiptItems).toHaveLength(0);
  });

  // --------------------------------------------------
  // 11. Kiểm tra hai yêu cầu nhập kho đồng thời
  // --------------------------------------------------

  it('Xử lý chính xác hai yêu cầu nhập kho đồng thời', async () => {
    const item = await create(1000);

    const quantities = [10, 20];

    const results = await Promise.all(
      quantities.map((quantity) =>
        request(app.getHttpServer())
          .post('/api/v1/staff/inventory/receipts')
          .set(bearer(staff))
          .send({
            items: [{ ingredientId: item.id, quantity }],
          }),
      ),
    );

    for (const result of results) {
      expect([201, 409]).toContain(result.status);
    }

    const successfulResults = results.filter(
      (result) => result.status === 201,
    );

    expect(successfulResults.length).toBeGreaterThanOrEqual(1);

    const expectedAdded = successfulResults.reduce(
      (total, result) =>
        total + result.body.data.items[0].quantityAdded,
      0,
    );

    const updated = await prisma.ingredient.findUniqueOrThrow({
      where: { id: item.id },
    });

    expect(updated.stockQuantity).toBe(1000 + expectedAdded);
    expect(updated.version).toBe(successfulResults.length);

    const receipts = await prisma.inventoryReceipt.findMany({
      where: {
        items: {
          some: { ingredientId: item.id },
        },
      },
      include: { items: true },
    });

    expect(receipts).toHaveLength(successfulResults.length);

    const actualAdded = receipts.reduce(
      (total, receipt) =>
        total +
        receipt.items.reduce(
          (itemTotal, receiptItem) =>
            itemTotal + receiptItem.quantityAdded,
          0,
        ),
      0,
    );

    expect(actualAdded).toBe(expectedAdded);

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
      await request(app.getHttpServer())
        .get('/api/v1/staff/inventory')
        .set(bearer(staff))
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/staff/orders')
        .set(bearer(staff))
        .expect(401);

      const item = await create(1000);

      await request(app.getHttpServer())
        .post('/api/v1/staff/inventory/receipts')
        .set(bearer(staff))
        .send({
          items: [{ ingredientId: item.id, quantity: 10 }],
        })
        .expect(401);

      const unchanged = await prisma.ingredient.findUniqueOrThrow({
        where: { id: item.id },
      });

      expect(unchanged.stockQuantity).toBe(1000);
      expect(unchanged.version).toBe(0);
    } finally {
      await prisma.user.update({
        where: { id: staffId },
        data: { isActive: true },
      });
    }
  });
});