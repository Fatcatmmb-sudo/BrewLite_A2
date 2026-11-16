
import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../../../../src/database/prisma.service.js';
import type { Prisma } from '../../../../../src/generated/prisma/client.js';
import { UsersService } from '../../../../../src/modules/users/users.service.js';
import { InventoryRepository } from '../../../../../src/modules/inventory/repositories/inventory.repository.js';
import { InventoryService } from '../../../../../src/modules/inventory/services/inventory.service.js';

describe('InventoryService', () => {
  let service: InventoryService;

  const prisma = {
    $transaction: vi.fn(),
  };

  const repository = {
    findVariantWithRecipe: vi.fn(),
    reserveIngredient: vi.fn(),
    createReservation: vi.fn(),
    findReservation: vi.fn(),
    transitionActiveReservation: vi.fn(),
    restoreIngredient: vi.fn(),

    // Các hàm phục vụ nghiệp vụ nhập kho.
    findIngredient: vi.fn(),
    receiveIngredientStock: vi.fn(),
    createInventoryReceipt: vi.fn(),
    listInventoryReceipts: vi.fn(),
  };

  const users = {
    assertActiveBarista: vi.fn(),
  };

  // Transaction giả dùng chung cho unit test.
  const tx = {} as Prisma.TransactionClient;

  // Công thức: mỗi ly dùng 10g cà phê.
  const variantWithRecipe = (stockQuantity: number) => ({
    id: 'variant-1',
    isActive: true,
    recipeItems: [
      {
        ingredientId: 'bean',
        quantity: 10,
        ingredient: {
          id: 'bean',
          stockQuantity,
          version: 0,
          isActive: true,
        },
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    service = new InventoryService(
      prisma as unknown as PrismaService,
      repository as unknown as InventoryRepository,
      users as unknown as UsersService,
    );

    prisma.$transaction.mockImplementation(async (callback) =>
      callback(tx),
    );

    users.assertActiveBarista.mockResolvedValue(undefined);

    repository.findReservation.mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      productVariantId: 'variant-1',
      quantity: 2,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      items: [
        { ingredientId: 'bean', quantity: 20 },
        { ingredientId: 'cup', quantity: 2 },
      ],
    });

    repository.transitionActiveReservation.mockResolvedValue({ count: 1 });
    repository.restoreIngredient.mockResolvedValue({});

    repository.findVariantWithRecipe.mockResolvedValue(
      variantWithRecipe(50),
    );

    repository.reserveIngredient.mockResolvedValue({ count: 1 });

    repository.createReservation.mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      productVariantId: 'variant-1',
      quantity: 2,
      status: 'ACTIVE',
    });
  });

  // ============================================================
  // 1. RESERVE - GIỮ NGUYÊN LIỆU CHO ĐƠN HÀNG
  // ============================================================

  describe('reserve', () => {
    it('giữ nguyên liệu thành công khi tồn kho nguyên liệu đủ', async () => {
      const result = await service.reserve(
        tx,
        'order-1',
        [{ productVariantId: 'variant-1', quantity: 2 }],
        new Date(Date.now() + 15 * 60 * 1000),
      );

      // 2 ly x 10g = 20g cà phê.
      expect(repository.reserveIngredient).toHaveBeenCalledWith(
        tx,
        'bean',
        0,
        20,
      );

      expect(repository.createReservation).toHaveBeenCalledTimes(1);

      expect(repository.createReservation).toHaveBeenCalledWith(
        tx,
        'order-1',
        'variant-1',
        2,
        expect.any(Date),
        [{ ingredientId: 'bean', quantity: 20 }],
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('reservation-1');
    });

    it('từ chối khi tồn kho nguyên liệu không đủ', async () => {
      // Còn 15g nhưng cần 20g.
      repository.findVariantWithRecipe.mockResolvedValue(
        variantWithRecipe(15),
      );

      await expect(
        service.reserve(
          tx,
          'order-1',
          [{ productVariantId: 'variant-1', quantity: 2 }],
          new Date(Date.now() + 15 * 60 * 1000),
        ),
      ).rejects.toThrow(ConflictException);

      expect(repository.reserveIngredient).not.toHaveBeenCalled();
      expect(repository.createReservation).not.toHaveBeenCalled();
    });

    it('từ chối variant chưa có công thức', async () => {
      repository.findVariantWithRecipe.mockResolvedValue({
        id: 'variant-1',
        isActive: true,
        recipeItems: [],
      });

      await expect(
        service.reserve(
          tx,
          'order-1',
          [{ productVariantId: 'variant-1', quantity: 1 }],
          new Date(Date.now() + 15 * 60 * 1000),
        ),
      ).rejects.toThrow(ConflictException);

      expect(repository.reserveIngredient).not.toHaveBeenCalled();
    });

    it('từ chối khi version nguyên liệu thay đổi', async () => {
      repository.reserveIngredient.mockResolvedValue({ count: 0 });

      await expect(
        service.reserve(
          tx,
          'order-1',
          [{ productVariantId: 'variant-1', quantity: 2 }],
          new Date(Date.now() + 15 * 60 * 1000),
        ),
      ).rejects.toThrow(ConflictException);

      expect(repository.createReservation).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 2. CONSUME - XÁC NHẬN ĐÃ SỬ DỤNG NGUYÊN LIỆU
  // ============================================================

  describe('consume', () => {
    it('chỉ chuyển trạng thái, không hoàn nguyên liệu', async () => {
      const result = await service.consume('reservation-1');

      expect(repository.transitionActiveReservation).toHaveBeenCalledWith(
        tx,
        'reservation-1',
        'CONSUMED',
        'NOT_EXPIRED',
      );

      expect(repository.restoreIngredient).not.toHaveBeenCalled();
      expect(result.status).toBe('CONSUMED');
    });
  });

  // ============================================================
  // 3. RELEASE - HOÀN NGUYÊN LIỆU ĐÃ GIỮ
  // ============================================================

  describe('release', () => {
    it('hoàn đúng lượng nguyên liệu đã giữ', async () => {
      const result = await service.release('reservation-1');

      expect(result.status).toBe('RELEASED');

      expect(repository.restoreIngredient).toHaveBeenCalledTimes(2);

      expect(repository.restoreIngredient).toHaveBeenCalledWith(
        tx,
        'bean',
        20,
      );

      expect(repository.restoreIngredient).toHaveBeenCalledWith(
        tx,
        'cup',
        2,
      );
    });

    it('không hoàn nguyên liệu nếu reservation đã bị xử lý trước', async () => {
      repository.transitionActiveReservation.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.release('reservation-1'),
      ).rejects.toThrow(ConflictException);

      expect(repository.restoreIngredient).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 4. RECEIVE STOCK - NHẬP KHO NHIỀU NGUYÊN LIỆU
  // ============================================================

  describe('receiveStock', () => {
    const userId = 'barista-1';
    const createdAt = new Date('2026-11-15T10:00:00.000Z');

    const ingredients = {
      bean: {
        id: 'bean',
        code: 'BEAN',
        name: 'Cà phê',
        unit: 'G' as const,
        stockQuantity: 1000,
        version: 2,
        isActive: true,
      },
      milk: {
        id: 'milk',
        code: 'MILK',
        name: 'Sữa',
        unit: 'ML' as const,
        stockQuantity: 2000,
        version: 4,
        isActive: true,
      },
    };

    beforeEach(() => {
      repository.findIngredient.mockImplementation(
        async (id: string) =>
          ingredients[id as keyof typeof ingredients] ?? null,
      );

      repository.receiveIngredientStock.mockResolvedValue({
        count: 1,
      });
repository.createInventoryReceipt.mockImplementation(
  async (
    _tx,
    data: {
      receivedByUserId: string;
      note: string | null;
      items: Array<{
        ingredientId: string;
        quantityAdded: number;
        stockBefore: number;
        stockAfter: number;
      }>;
    },
  ) => ({
    id: 'receipt-1',
    receivedByUserId: data.receivedByUserId,
    receivedBy: {
      id: data.receivedByUserId,
      username: 'barista_test',
    },
    note: data.note,
    createdAt,
    items: data.items.map((item) => ({
      ...item,
      ingredient:
        ingredients[item.ingredientId as keyof typeof ingredients],
    })),
  }),
);

    });

    it('nhập nhiều nguyên liệu trong cùng một phiếu', async () => {
      const result = await service.receiveStock(userId, {
        items: [
          { ingredientId: 'bean', quantity: 500 },
          { ingredientId: 'milk', quantity: 1000 },
        ],
        note: 'Nhập hàng buổi sáng',
      });

      expect(users.assertActiveBarista).toHaveBeenCalledWith(
        tx,
        userId,
      );

      expect(repository.receiveIngredientStock).toHaveBeenCalledTimes(2);

      expect(repository.receiveIngredientStock).toHaveBeenCalledWith(
        tx,
        'bean',
        2,
        500,
      );

      expect(repository.receiveIngredientStock).toHaveBeenCalledWith(
        tx,
        'milk',
        4,
        1000,
      );

      expect(repository.createInventoryReceipt).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          receivedByUserId: userId,
          note: 'Nhập hàng buổi sáng',
          items: [
            {
              ingredientId: 'bean',
              quantityAdded: 500,
              stockBefore: 1000,
              stockAfter: 1500,
            },
            {
              ingredientId: 'milk',
              quantityAdded: 1000,
              stockBefore: 2000,
              stockAfter: 3000,
            },
          ],
        }),
      );

      expect(result.receiptId).toBe('receipt-1');
      expect(result.items).toHaveLength(2);

      expect(result.items[0]).toMatchObject({
        ingredientId: 'bean',
        quantityAdded: 500,
        stockBefore: 1000,
        stockAfter: 1500,
      });

      expect(result.items[1]).toMatchObject({
        ingredientId: 'milk',
        quantityAdded: 1000,
        stockBefore: 2000,
        stockAfter: 3000,
      });
    });

    it('từ chối số lượng bằng 0', async () => {
      await expect(
        service.receiveStock(userId, {
          items: [{ ingredientId: 'bean', quantity: 0 }],
        }),
      ).rejects.toThrow();

      expect(repository.receiveIngredientStock).not.toHaveBeenCalled();
      expect(repository.createInventoryReceipt).not.toHaveBeenCalled();
    });

    it('từ chối số lượng âm', async () => {
      await expect(
        service.receiveStock(userId, {
          items: [{ ingredientId: 'bean', quantity: -10 }],
        }),
      ).rejects.toThrow();

      expect(repository.receiveIngredientStock).not.toHaveBeenCalled();
      expect(repository.createInventoryReceipt).not.toHaveBeenCalled();
    });

    it('từ chối nguyên liệu bị trùng trong cùng phiếu', async () => {
      await expect(
        service.receiveStock(userId, {
          items: [
            { ingredientId: 'bean', quantity: 100 },
            { ingredientId: 'bean', quantity: 200 },
          ],
        }),
      ).rejects.toThrow();

      expect(repository.findIngredient).not.toHaveBeenCalled();
      expect(repository.receiveIngredientStock).not.toHaveBeenCalled();
      expect(repository.createInventoryReceipt).not.toHaveBeenCalled();
    });

    it('từ chối nguyên liệu không tồn tại', async () => {
      repository.findIngredient.mockResolvedValue(null);

      await expect(
        service.receiveStock(userId, {
          items: [{ ingredientId: 'unknown', quantity: 100 }],
        }),
      ).rejects.toThrow();

      expect(repository.receiveIngredientStock).not.toHaveBeenCalled();
      expect(repository.createInventoryReceipt).not.toHaveBeenCalled();
    });

    it('dừng khi version thay đổi và không tạo phiếu nhập', async () => {
      repository.receiveIngredientStock
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(
        service.receiveStock(userId, {
          items: [
            { ingredientId: 'bean', quantity: 100 },
            { ingredientId: 'milk', quantity: 200 },
          ],
        }),
      ).rejects.toThrow(ConflictException);

      expect(repository.receiveIngredientStock).toHaveBeenCalledTimes(2);
      expect(repository.createInventoryReceipt).not.toHaveBeenCalled();
    });

    it('từ chối khi tài khoản không còn là Barista hoạt động', async () => {
      users.assertActiveBarista.mockRejectedValue(
        new Error('Unauthorized'),
      );

      await expect(
        service.receiveStock(userId, {
          items: [{ ingredientId: 'bean', quantity: 100 }],
        }),
      ).rejects.toThrow('Unauthorized');

      expect(repository.findIngredient).not.toHaveBeenCalled();
      expect(repository.receiveIngredientStock).not.toHaveBeenCalled();
      expect(repository.createInventoryReceipt).not.toHaveBeenCalled();
    });
  });
});
