import { createHash } from 'node:crypto';
import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { PaymentMethod } from '../../generated/prisma/client.js';
import { chargeOnce, lookupResult } from './mock-gateway.js';

const LOYALTY_RATE = (total: bigint) => Math.floor(Number(total) / 1000);

function buildRequestHash(orderId: string, method: string): string {
  return createHash('sha256').update(`${orderId}|${method}`).digest('hex');
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async pay(
    userId: string,
    orderId: string,
    method: PaymentMethod,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const requestHash = buildRequestHash(orderId, method);

    // ---- Phase 1: idempotency check & attempt serialisation ----
    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });

    if (existing) {
      // Same key — check hash matches (same request)
      if (existing.requestHash !== requestHash) {
        throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
      }
      if (existing.status === 'PROCESSING') {
        throw new ConflictException('PAYMENT_IN_PROGRESS');
      }
      // Completed — return stored result
      return { id: existing.id, status: existing.status, orderId: existing.orderId };
    }

    // ---- Phase 2: create PROCESSING attempt inside a short transaction ----
    const { order, attempt } = await this.prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({
        where: { id: orderId },
        select: { id: true, userId: true, status: true, total: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.userId !== userId) throw new ForbiddenException('Access denied');
      if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
        throw new ConflictException('ORDER_INVALID_TRANSITION');
      }
      // Block second PROCESSING attempt on same order (different key)
      const inFlight = await tx.payment.count({ where: { orderId, status: 'PROCESSING' } });
      if (inFlight > 0) throw new ConflictException('PAYMENT_IN_PROGRESS');
      // Prevent second success on a PAID order
      const succeeded = await tx.payment.count({ where: { orderId, status: 'SUCCEEDED' } });
      if (succeeded > 0) throw new ConflictException('ORDER_ALREADY_PAID');

      const attempt = await tx.payment.create({
        data: { orderId, idempotencyKey, requestHash, method, amount: order.total, status: 'PROCESSING' },
      });
      return { order, attempt };
    });

    // ---- Phase 3: call gateway OUTSIDE transaction ----
    let gatewayResult: Awaited<ReturnType<typeof chargeOnce>> | null = null;
    try {
      gatewayResult = await chargeOnce(idempotencyKey, order.total);
    } catch (err: unknown) {
      // GATEWAY_TIMEOUT — keep PROCESSING, caller must retry/reconcile
      if (err instanceof Error && err.message === 'GATEWAY_TIMEOUT') {
        throw new ServiceUnavailableException('GATEWAY_TIMEOUT');
      }
      throw err;
    }

    // ---- Phase 4: finalize ----
    if (gatewayResult.result === 'SUCCESS') {
      await this.prisma.$transaction(async tx => {
        // Re-verify order is still payable (race with cancel/expiry)
        const freshOrder = await tx.order.findFirst({
          where: { id: orderId },
          select: { id: true, status: true, total: true, userId: true },
        });
        if (!freshOrder || freshOrder.status === 'CANCELLED') {
          await tx.payment.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureCode: 'ORDER_CANCELLED' } });
          return;
        }
        // Check idempotency at DB level (unique partial index on succeeded+orderId would be in migration)
        const alreadySucceeded = await tx.payment.count({ where: { orderId, status: 'SUCCEEDED' } });
        if (alreadySucceeded > 0) {
          await tx.payment.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureCode: 'DUPLICATE_SUCCESS' } });
          return;
        }
        await tx.payment.update({
          where: { id: attempt.id },
          data: { status: 'SUCCEEDED', gatewayTransactionId: gatewayResult!.transactionId, processedAt: new Date() },
        });
        await tx.order.update({ where: { id: orderId }, data: { status: 'PAID' } });
        await tx.orderStatusHistory.create({ data: { orderId, fromStatus: 'PENDING', toStatus: 'PAID', changedByUserId: userId } });
        // Consume reservation
        await tx.inventoryReservation.updateMany({ where: { orderId, status: 'ACTIVE' }, data: { status: 'CONSUMED' } });
        // Consume coupon redemption if any
        await tx.couponRedemption.updateMany({
          where: { orderId, status: 'RESERVED' },
          data: { status: 'CONSUMED', consumedAt: new Date() },
        });
        // Loyalty EARN (one per order — DB unique index enforced in migration)
        const earnedPoints = LOYALTY_RATE(freshOrder.total);
        if (earnedPoints > 0) {
          const user = await tx.user.findUnique({ where: { id: userId }, select: { loyaltyBalance: true } });
          const newBalance = (user?.loyaltyBalance ?? 0) + earnedPoints;
          await tx.loyaltyTransaction.create({
            data: { userId, orderId, type: 'EARN', points: earnedPoints, balanceAfter: newBalance, reason: `Payment for order ${orderId}` },
          });
          await tx.user.update({ where: { id: userId }, data: { loyaltyBalance: newBalance } });
        }
      });
      return { id: attempt.id, status: 'SUCCEEDED', orderId };
    }

    // DECLINE
    await this.prisma.payment.update({
      where: { id: attempt.id },
      data: { status: 'FAILED', failureCode: 'GATEWAY_DECLINE', processedAt: new Date() },
    });
    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_FAILED' } });
    return { id: attempt.id, status: 'FAILED', orderId };
  }
}
