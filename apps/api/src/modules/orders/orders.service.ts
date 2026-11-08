import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OrderStatus } from '../../generated/prisma/client.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import { canTransition } from './order-state.js';

const RESERVATION_TTL_SEC = () => parseInt(process.env.RESERVATION_TTL_SECONDS ?? '900');
const MAX_RETRY = 3;

// Unique order number generator: timestamp + random suffix
function generateOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateOrderDto): Promise<Record<string, unknown>> {
    // Normalise: trim notes, null empty strings
    const items = dto.items.map(item => ({
      ...item,
      note: item.note?.trim() || null,
      toppings: item.toppings ?? [],
    }));

    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      try {
        return await this.prisma.$transaction(
          tx => this.#executeCreate(tx, userId, items, dto.couponCode),
          { isolationLevel: 'Serializable' },
        );
      } catch (err: unknown) {
        const isRetryable = err instanceof Error && (
          err.message.includes('could not serialize') ||
          err.message.includes('deadlock') ||
          (err as unknown as Record<string, unknown>)['code'] === 'P2034'
        );
        if (isRetryable && attempt < MAX_RETRY - 1) continue;
        throw err;
      }
    }
    throw new ConflictException('INVENTORY_CONFLICT');
  }

  async #executeCreate(
    tx: Prisma.TransactionClient,
    userId: string,
    items: Array<{ productVariantId: string; quantity: number; sugarLevel?: number | null; iceLevel?: number | null; note?: string | null; toppings: Array<{ toppingId: string }> }>,
    couponCode?: string,
  ): Promise<Record<string, unknown>> {
    // 1. Aggregate ingredient demand across all lines (BOM)
    const ingredientDemand = new Map<string, { need: number; version: number; stock: number }>();

    const variantData = await Promise.all(items.map(async item => {
      const variant = await tx.productVariant.findFirst({
        where: { id: item.productVariantId, isActive: true, product: { isActive: true } },
        include: {
          product: { select: { id: true, name: true } },
          recipeItems: { include: { ingredient: true } },
        },
      });
      if (!variant) throw new ConflictException(`Variant ${item.productVariantId} not available`);

      // Aggregate variant BOM
      for (const r of variant.recipeItems) {
        const need = r.quantity * item.quantity;
        const cur = ingredientDemand.get(r.ingredientId);
        if (cur) {
          cur.need += need;
        } else {
          if (!r.ingredient.isActive) throw new ConflictException('OUT_OF_STOCK');
          ingredientDemand.set(r.ingredientId, {
            need,
            version: r.ingredient.version,
            stock: r.ingredient.stockQuantity,
          });
        }
      }

      // Aggregate topping BOM
      const toppingData: Array<{ id: string; name: string; price: bigint }> = [];
      for (const t of item.toppings) {
        const topping = await tx.topping.findFirst({
          where: { id: t.toppingId, isActive: true },
          include: { recipeItems: { include: { ingredient: true } } },
        });
        if (!topping) throw new ConflictException(`Topping ${t.toppingId} not available`);
        for (const r of topping.recipeItems) {
          const need = r.quantity * item.quantity;
          const cur = ingredientDemand.get(r.ingredientId);
          if (cur) {
            cur.need += need;
          } else {
            if (!r.ingredient.isActive) throw new ConflictException('OUT_OF_STOCK');
            ingredientDemand.set(r.ingredientId, {
              need,
              version: r.ingredient.version,
              stock: r.ingredient.stockQuantity,
            });
          }
        }
        toppingData.push({ id: topping.id, name: topping.name, price: topping.price });
      }
      return { variant, toppingData };
    }));

    // 2. Check total demand vs stock
    for (const [ingredientId, { need, stock }] of ingredientDemand) {
      if (stock < need) throw new ConflictException(`OUT_OF_STOCK: ingredient ${ingredientId}`);
    }

    // 3. Reserve inventory: conditional UPDATE by version
    for (const [ingredientId, { need, version }] of ingredientDemand) {
      const updated = await tx.$executeRaw`
        UPDATE ingredients
        SET stock_quantity = stock_quantity - ${need}, version = version + 1
        WHERE id = ${ingredientId}::uuid
          AND version = ${version}
          AND stock_quantity >= ${need}
      `;
      if (updated === 0) throw new ConflictException('INVENTORY_CONFLICT');
    }

    // 4. Compute pricing
    let subtotal = BigInt(0);
    const orderItems = items.map((item, idx) => {
      const { variant, toppingData } = variantData[idx];
      const toppingTotal = toppingData.reduce((s, t) => s + t.price, BigInt(0));
      const lineTotal = (variant.price + toppingTotal) * BigInt(item.quantity);
      subtotal += lineTotal;
      return { item, variant, toppingData, lineTotal };
    });

    // 5. Coupon (optional)
    let discountAmount = BigInt(0);
    let couponRedemptionData: { couponId: string; discountAmount: bigint } | null = null;
    if (couponCode) {
      const coupon = await tx.coupon.findFirst({
        where: {
          code: couponCode, isActive: true,
          startsAt: { lte: new Date() }, endsAt: { gte: new Date() },
          minOrderValue: { lte: subtotal },
        },
      });
      if (!coupon) throw new ConflictException('COUPON_NOT_APPLICABLE');
      // Check user quota
      const used = await tx.couponRedemption.count({
        where: { couponId: coupon.id, userId, status: { in: ['RESERVED', 'CONSUMED'] } },
      });
      if (coupon.perUserLimit !== null && used >= coupon.perUserLimit) {
        throw new ConflictException('COUPON_NOT_APPLICABLE');
      }
      if (coupon.usageLimit !== null) {
        const totalUsed = await tx.couponRedemption.count({
          where: { couponId: coupon.id, status: { in: ['RESERVED', 'CONSUMED'] } },
        });
        if (totalUsed >= coupon.usageLimit) throw new ConflictException('COUPON_NOT_APPLICABLE');
      }
      discountAmount = coupon.discountType === 'FIXED_AMOUNT'
        ? coupon.discountValue
        : (subtotal * coupon.discountValue) / BigInt(100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) discountAmount = coupon.maxDiscount;
      if (discountAmount > subtotal) discountAmount = subtotal;
      couponRedemptionData = { couponId: coupon.id, discountAmount };
    }
    const total = subtotal - discountAmount;

    // 6. Create order
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_SEC() * 1000);
    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        subtotal,
        discountAmount,
        total,
        couponCodeSnapshot: couponCode ?? null,
        reservationExpiresAt: expiresAt,
        statusHistories: { create: { fromStatus: null, toStatus: 'PENDING', changedByUserId: userId } },
        items: {
          create: orderItems.map(({ item, variant, toppingData }) => ({
            productVariantId: variant.id,
            productNameSnapshot: variant.product.name,
            variantNameSnapshot: `Size ${variant.size}`,
            unitPrice: variant.price,
            quantity: item.quantity,
            sugarLevel: item.sugarLevel ?? null,
            iceLevel: item.iceLevel ?? null,
            note: item.note ?? null,
            orderItemToppings: {
              create: toppingData.map(t => ({
                toppingId: t.id,
                toppingNameSnapshot: t.name,
                unitPrice: t.price,
                quantity: 1,
              })),
            },
          })),
        },
      },
      include: { items: { include: { orderItemToppings: true } } },
    });

    // 7. Create inventory reservations (snapshot per order/variant)
    for (const { item, variant } of orderItems) {
      await tx.inventoryReservation.create({
        data: {
          orderId: order.id,
          productVariantId: variant.id,
          quantity: item.quantity,
          expiresAt,
          items: {
            create: [...ingredientDemand.entries()].map(([ingredientId, { need }]) => ({
              ingredientId,
              quantity: need,
            })),
          },
        },
      });
    }

    // 8. Reserve coupon
    if (couponRedemptionData) {
      await tx.couponRedemption.create({
        data: {
          couponId: couponRedemptionData.couponId,
          userId,
          orderId: order.id,
          discountAmount: couponRedemptionData.discountAmount,
          expiresAt,
        },
      });
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: Number(subtotal),
      discountAmount: Number(discountAmount),
      total: Number(total),
      reservationExpiresAt: expiresAt,
    };
  }

  async getMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { orderItemToppings: true } }, payments: { orderBy: { createdAt: 'desc' } } },
    });
    return orders.map(o => this.#mapOrder(o));
  }

  async getOrderById(orderId: string, requestingUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { orderItemToppings: true } },
        statusHistories: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== requestingUserId) throw new ForbiddenException('Access denied');
    return this.#mapOrder(order);
  }

  async cancelOrder(orderId: string, userId: string): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({ where: { id: orderId }, select: { id: true, userId: true, status: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.userId !== userId) throw new ForbiddenException('Access denied');
      if (!canTransition(order.status, OrderStatus.CANCELLED)) {
        throw new ConflictException('ORDER_INVALID_TRANSITION');
      }
      // Check no unresolved payment
      const processing = await tx.payment.count({ where: { orderId, status: 'PROCESSING' } });
      if (processing > 0) throw new ConflictException('PAYMENT_IN_PROGRESS');

      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: 'CANCELLED', changedByUserId: userId },
      });
      // Release reservations
      await this.#releaseReservations(tx, orderId);
      return { id: orderId, status: 'CANCELLED' };
    });
  }

  async updateStatus(orderId: string, toStatus: OrderStatus, actorId: string): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({ where: { id: orderId }, select: { id: true, status: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (!canTransition(order.status, toStatus)) throw new ConflictException('ORDER_INVALID_TRANSITION');

      await tx.order.update({ where: { id: orderId }, data: { status: toStatus } });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus, changedByUserId: actorId },
      });
      return { id: orderId, status: toStatus };
    });
  }

  async #releaseReservations(tx: Prisma.TransactionClient, orderId: string) {
    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
      include: { items: true },
    });
    for (const reservation of reservations) {
      for (const item of reservation.items) {
        await tx.$executeRaw`UPDATE ingredients SET stock_quantity = stock_quantity + ${item.quantity} WHERE id = ${item.ingredientId}::uuid`;
      }
      await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: 'RELEASED' } });
    }
  }

  #mapOrder(order: Record<string, unknown>) {
    return {
      ...order,
      subtotal: Number((order as { subtotal: bigint }).subtotal),
      discountAmount: Number((order as { discountAmount: bigint }).discountAmount),
      total: Number((order as { total: bigint }).total),
    };
  }
}
