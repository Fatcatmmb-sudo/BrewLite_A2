
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { UsersService } from '../../users/users.service.js';
import {
    stockStatus,
    type ReceiveStockDto,
    type StaffInventoryQueryDto,
} from '../dto/staff-inventory.dto.js';
import { InventoryRepository } from '../repositories/inventory.repository.js';

// Lỗi riêng khi version tồn kho đã thay đổi.
export class InventoryVersionConflict extends Error {
  constructor() {
    super('Inventory version changed; please retry');
    this.name = 'InventoryVersionConflict';
  }
}

/** Nhu cầu nguyên liệu đã báo giá, gồm cả công thức món và topping. */
export interface InventoryNeeds {
  ingredients: Map<string, { quantity: number; version: number }>;
  variants: Map<string, { quantity: number; ingredients: Map<string, number> }>;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: InventoryRepository,
    private readonly users: UsersService = new UsersService(),
  ) {}

  async listIngredients(userId: string, query: StaffInventoryQueryDto) {
    await this.users.assertActiveBarista(this.prisma, userId);
    const rows = await this.repository.listIngredients(query);
    const limit = query.limit ?? 50;
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    return {
      data: page.map((row) => this.ingredientResponse(row)),
      meta: { nextCursor: hasMore ? page.at(-1)!.id : null },
    };
  }

  async getIngredient(userId: string, id: string) {
    await this.users.assertActiveBarista(this.prisma, userId);
    const row = await this.repository.findIngredient(id);

    if (!row) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Nguyên liệu không tồn tại.',
        },
      });
    }

    return this.ingredientResponse(row);
  }

  private ingredientResponse(row: {
    id: string;
    code: string;
    name: string;
    unit: 'G' | 'ML' | 'PCS';
    stockQuantity: number;
    version: number;
    isActive: boolean;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      unit: row.unit,
      stockQuantity: row.stockQuantity,
      version: row.version,
      isActive: row.isActive,
      status: stockStatus(row.stockQuantity, row.unit),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Barista nhập kho một phiếu gồm nhiều nguyên liệu.
   * Cập nhật tồn kho và ghi lịch sử trong cùng transaction.
   * Nếu bất kỳ dòng nào thất bại, toàn bộ phiếu được rollback.
   */
  async receiveStock(userId: string, dto: ReceiveStockDto) {
    if (!dto.items?.length) {
      throw new BadRequestException({
        error: {
          code: 'EMPTY_RECEIPT',
          message: 'Phiếu nhập kho phải có ít nhất một nguyên liệu.',
        },
      });
    }

    const ingredientIds = dto.items.map((item) => item.ingredientId);

    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException({
        error: {
          code: 'DUPLICATE_INGREDIENT',
          message: 'Không được nhập trùng nguyên liệu trong một phiếu.',
        },
      });
    }

    const sortedItems = [...dto.items].sort((a, b) =>
      a.ingredientId.localeCompare(b.ingredientId),
    );

    return this.prisma.$transaction(async (tx) => {
      await this.users.assertActiveBarista(tx, userId);

      const receiptItems: Array<{
        ingredientId: string;
        quantityAdded: number;
        stockBefore: number;
        stockAfter: number;
      }> = [];

      const MAX_STOCK = 2147483647;

      for (const item of sortedItems) {
        const { ingredientId, quantity } = item;

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException({
            error: {
              code: 'INVALID_STOCK_QUANTITY',
              message: 'Số lượng nhập phải là số nguyên dương.',
            },
          });
        }

        const ingredient = await this.repository.findIngredient(
          ingredientId,
          tx,
        );

        if (!ingredient || !ingredient.isActive) {
          throw new NotFoundException({
            error: {
              code: 'INGREDIENT_NOT_FOUND',
              message: 'Nguyên liệu không tồn tại hoặc đã ngừng hoạt động.',
            },
          });
        }

        if (ingredient.stockQuantity > MAX_STOCK - quantity) {
          throw new BadRequestException({
            error: {
              code: 'STOCK_QUANTITY_OVERFLOW',
              message: `Số lượng nhập của nguyên liệu ${ingredient.name} vượt giới hạn tồn kho.`,
            },
          });
        }

        const stockBefore = ingredient.stockQuantity;
        const stockAfter = stockBefore + quantity;

        // Cập nhật theo version để phát hiện tồn kho vừa bị thay đổi.
        const updated = await this.repository.receiveIngredientStock(
          tx,
          ingredientId,
          ingredient.version,
          quantity,
        );

        if (updated.count !== 1) {
          throw new ConflictException({
            error: {
              code: 'INVENTORY_VERSION_CONFLICT',
              message: `Tồn kho nguyên liệu ${ingredient.name} vừa thay đổi. Vui lòng thử lại.`,
            },
          });
        }

        receiptItems.push({
          ingredientId,
          quantityAdded: quantity,
          stockBefore,
          stockAfter,
        });
      }

      // Chỉ tạo phiếu sau khi tất cả nguyên liệu đã cập nhật thành công.
      const receipt = await this.repository.createInventoryReceipt(tx, {
        receivedByUserId: userId,
        note: dto.note?.trim() || null,
        items: receiptItems,
      });

      return {
        receiptId: receipt.id,
        receivedByUserId: receipt.receivedByUserId,
        receivedByUsername: receipt.receivedBy.username,
        note: receipt.note,
        createdAt: receipt.createdAt.toISOString(),
        items: receipt.items.map((item) => ({
          ingredientId: item.ingredientId,
          code: item.ingredient.code,
          name: item.ingredient.name,
          unit: item.ingredient.unit,
          quantityAdded: item.quantityAdded,
          stockBefore: item.stockBefore,
          stockAfter: item.stockAfter,
        })),
      };
    });
  }

  /**
   * Lấy lịch sử 50 phiếu nhập kho mới nhất.
   */
  async listReceipts(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.users.assertActiveBarista(tx, userId);

      const receipts = await this.repository.listInventoryReceipts(tx);

      return receipts.map((receipt) => ({
        receiptId: receipt.id,
        receivedByUserId: receipt.receivedByUserId,
        receivedByUsername: receipt.receivedBy.username,
        note: receipt.note,
        createdAt: receipt.createdAt.toISOString(),
        items: receipt.items.map((item) => ({
          ingredientId: item.ingredientId,
          code: item.ingredient.code,
          name: item.ingredient.name,
          unit: item.ingredient.unit,
          quantityAdded: item.quantityAdded,
          stockBefore: item.stockBefore,
          stockAfter: item.stockAfter,
        })),
      }));
    });
  }

  /**
   * Giữ hàng cho đơn hàng.
   * Phải được gọi bên trong transaction tạo Order.
   *
   * needs lấy từ OrdersService.validateAndPriceItems().
   */
  // OrdersService trừ tồn nguyên tử dựa trên số lượng hiện tại.
  async reserve(
    tx: Prisma.TransactionClient,
    orderId: string,
    expiresAt: Date,
    needs: InventoryNeeds,
  ): Promise<void>;

  // Cách gọi cũ từ các test/integration: tự đọc version hiện tại.
  async reserve(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: Array<{
      productVariantId: string;
      quantity: number;
    }>,
    expiresAt: Date,
  ): Promise<Awaited<ReturnType<InventoryRepository['createReservation']>>[]>;

  async reserve(
    tx: Prisma.TransactionClient,
    orderId: string,
    third: Date | Array<{ productVariantId: string; quantity: number }>,
    fourth: InventoryNeeds | Date,
  ): Promise<
    void | Awaited<ReturnType<InventoryRepository['createReservation']>>[]
  > {
    // Giữ đúng snapshot nguyên liệu của món và topping trong Orders transaction.
    if (third instanceof Date) {
      const expiresAt = third;
      const needs = fourth as InventoryNeeds;

      if (expiresAt <= new Date()) {
        throw new ConflictException('Reservation expiry must be in the future');
      }

      const sortedNeeds = [...needs.ingredients.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );

      for (const [ingredientId, need] of sortedNeeds) {
        if (!Number.isInteger(need.quantity) || need.quantity <= 0) {
          throw new ConflictException('Invalid reservation quantity');
        }

        const updated = await this.repository.reserveIngredient(
          tx,
          ingredientId,
          undefined,
          need.quantity,
        );

        if (updated.count !== 1) {
          throw new InventoryVersionConflict();
        }
      }

      for (const [variantId, need] of [...needs.variants].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        await this.repository.createReservation(
          tx,
          orderId,
          variantId,
          need.quantity,
          expiresAt,
          [...need.ingredients]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ingredientId, quantity]) => ({ ingredientId, quantity })),
        );
      }

      return;
    }

    // Trường hợp mảng items trước, Date sau.
    const items = third;
    const expiresAt = fourth as Date;

    if (expiresAt <= new Date()) {
      throw new ConflictException('Reservation expiry must be in the future');
    }

    // Gộp các dòng sản phẩm trùng variantId.
    const grouped = new Map<string, number>();

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ConflictException('Invalid reservation quantity');
      }

      grouped.set(
        item.productVariantId,
        (grouped.get(item.productVariantId) ?? 0) + item.quantity,
      );
    }

    const sortedItems = [...grouped.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    // Bước 1: quy đổi số ly thành nhu cầu nguyên liệu theo công thức (BOM).
    const plans: Array<{
      variantId: string;
      quantity: number;
      ingredients: Array<{ ingredientId: string; quantity: number }>;
    }> = [];

    const totals = new Map<
      string,
      { quantity: number; version: number; stockQuantity: number }
    >();

    for (const [variantId, quantity] of sortedItems) {
      const variant = await this.repository.findVariantWithRecipe(
        tx,
        variantId,
      );

      if (!variant || !variant.isActive) {
        throw new NotFoundException('Product variant not found or inactive');
      }

      // Món chưa có công thức không thể bán vì không tính được nguyên liệu.
      if (variant.recipeItems.length === 0) {
        throw new ConflictException('Product variant has no recipe');
      }

      const ingredients = variant.recipeItems.map((line) => {
        if (!line.ingredient.isActive) {
          throw new ConflictException('Ingredient is no longer available');
        }

        const amount = line.quantity * quantity;
        const total = totals.get(line.ingredientId);

        totals.set(line.ingredientId, {
          quantity: (total?.quantity ?? 0) + amount,
          version: line.ingredient.version,
          stockQuantity: line.ingredient.stockQuantity,
        });

        return { ingredientId: line.ingredientId, quantity: amount };
      });

      plans.push({ variantId, quantity, ingredients });
    }

    // Bước 2: kiểm tra tổng nhu cầu với tồn kho nguyên liệu.
    for (const total of totals.values()) {
      if (total.stockQuantity < total.quantity) {
        throw new ConflictException('Insufficient stock');
      }
    }

    // Bước 3: trừ nguyên liệu theo thứ tự ID với compare-and-set theo version.
    for (const [ingredientId, total] of [...totals].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const updated = await this.repository.reserveIngredient(
        tx,
        ingredientId,
        total.version,
        total.quantity,
      );

      if (updated.count !== 1) {
        throw new ConflictException(
          'Inventory changed concurrently; please retry',
        );
      }
    }

    // Bước 4: ghi reservation kèm lượng nguyên liệu để hoàn đúng khi hủy/hết hạn.
    const reservations = [];

    for (const plan of plans) {
      reservations.push(
        await this.repository.createReservation(
          tx,
          orderId,
          plan.variantId,
          plan.quantity,
          expiresAt,
          plan.ingredients,
        ),
      );
    }

    return reservations;
  }

  /**
   * Xác nhận hàng đã được sử dụng.
   * Không trừ kho lần nữa vì kho đã giảm lúc reserve.
   */
  async consume(reservationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await this.repository.findReservation(
        tx,
        reservationId,
      );

      if (!reservation) {
        throw new NotFoundException('Inventory reservation not found');
      }

      if (reservation.status !== 'ACTIVE') {
        throw new ConflictException('Reservation is no longer active');
      }

      if (reservation.expiresAt <= new Date()) {
        throw new ConflictException('Reservation has expired');
      }

      const updated = await this.repository.transitionActiveReservation(
        tx,
        reservationId,
        'CONSUMED',
        'NOT_EXPIRED',
      );

      if (updated.count !== 1) {
        throw new ConflictException(
          'Reservation changed concurrently; please retry',
        );
      }

      return {
        reservationId,
        status: 'CONSUMED' as const,
      };
    });
  }

  /**
   * Nhả kho bên trong transaction có sẵn.
   * Dùng cho OrderExpiryJob.
   */
  async releaseInTransaction(
    tx: Prisma.TransactionClient,
    reservationId: string,
    expired = false,
  ) {
    const reservation = await this.repository.findReservation(
      tx,
      reservationId,
    );

    if (!reservation) {
      throw new NotFoundException('Inventory reservation not found');
    }

    if (reservation.status !== 'ACTIVE') {
      throw new ConflictException('Reservation is no longer active');
    }

    const now = new Date();

    if (expired && reservation.expiresAt > now) {
      throw new ConflictException('Reservation has not expired');
    }

    if (!expired && reservation.expiresAt <= now) {
      throw new ConflictException('Reservation has expired');
    }

    // Chỉ reservation chuyển trạng thái thành công mới được hoàn kho.
    const updated = await this.repository.transitionActiveReservation(
      tx,
      reservationId,
      expired ? 'EXPIRED' : 'RELEASED',
      expired ? 'EXPIRED' : 'NOT_EXPIRED',
    );

    if (updated.count !== 1) {
      throw new ConflictException(
        'Reservation changed concurrently; please retry',
      );
    }

    // Hoàn snapshot đã giữ, kể cả nguyên liệu topping và khi công thức đã đổi.
    for (const item of [...reservation.items].sort((a, b) =>
      a.ingredientId.localeCompare(b.ingredientId),
    )) {
      await this.repository.restoreIngredient(
        tx,
        item.ingredientId,
        item.quantity,
      );
    }

    return {
      reservationId,
      status: expired ? ('EXPIRED' as const) : ('RELEASED' as const),
    };
  }

  /**
   * Nhả kho độc lập.
   * Những nơi đang sử dụng release() không cần thay đổi.
   */
  async release(reservationId: string, expired = false) {
    return this.prisma.$transaction((tx) =>
      this.releaseInTransaction(tx, reservationId, expired),
    );
  }
}
