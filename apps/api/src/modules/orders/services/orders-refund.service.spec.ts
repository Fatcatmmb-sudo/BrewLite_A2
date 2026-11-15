import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import { OrderStatus } from '../../../generated/prisma/client.js';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const BARISTA_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('OrdersService - Refund & Loyalty Points (UC-14 & UC-15)', () => {
  let repository: any;
  let users: any;
  let tx: any;
  let prisma: any;
  let service: OrdersService;

  beforeEach(() => {
    tx = {
      order: {
        findUnique: vi.fn(),
      },
      refundRequest: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      loyaltyTransaction: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      inventoryReservation: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      ingredient: {
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn(),
      },
    };

    repository = {
      lockById: vi.fn(),
      updateStatusWithHistory: vi.fn().mockResolvedValue(undefined),
    };

    users = {
      assertActiveBarista: vi.fn().mockResolvedValue(undefined),
    };

    prisma = {
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };

    service = new OrdersService(
      repository,
      prisma,
      {} as any,
      {} as any,
      {} as any,
      users,
    );
  });

  describe('UC-14: requestRefund (Khách hàng gửi yêu cầu hoàn tiền)', () => {
    it('thành công tạo RefundRequest khi đơn PAID và đúng chủ đơn', async () => {
      tx.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        userId: CUSTOMER_ID,
        status: OrderStatus.PAID,
      });
      tx.refundRequest.findUnique.mockResolvedValue(null);
      const createdAt = new Date();
      tx.refundRequest.create.mockResolvedValue({
        id: 'refund-1',
        orderId: ORDER_ID,
        userId: CUSTOMER_ID,
        reason: 'Khách muốn đổi món',
        status: 'PENDING',
        processedByUserId: null,
        processedAt: null,
        rejectReason: null,
        createdAt,
        updatedAt: createdAt,
      });

      const result = await service.requestRefund(ORDER_ID, CUSTOMER_ID, 'Khách muốn đổi món');

      expect(result).toMatchObject({
        id: 'refund-1',
        orderId: ORDER_ID,
        userId: CUSTOMER_ID,
        reason: 'Khách muốn đổi món',
        status: 'PENDING',
      });
      expect(tx.refundRequest.create).toHaveBeenCalledWith({
        data: {
          orderId: ORDER_ID,
          userId: CUSTOMER_ID,
          reason: 'Khách muốn đổi món',
          status: 'PENDING',
        },
      });
    });

    it('từ chối khi đơn không tồn tại hoặc không đúng chủ sở hữu (404 ORDER_NOT_FOUND)', async () => {
      tx.order.findUnique.mockResolvedValue(null);

      await expect(
        service.requestRefund(ORDER_ID, CUSTOMER_ID, 'Lý do'),
      ).rejects.toThrow(NotFoundException);

      tx.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        userId: OTHER_CUSTOMER_ID,
        status: OrderStatus.PAID,
      });

      await expect(
        service.requestRefund(ORDER_ID, CUSTOMER_ID, 'Lý do'),
      ).rejects.toThrow(NotFoundException);
    });

    it('từ chối khi đơn không ở trạng thái PAID (ví dụ PREPARING, COMPLETED, CANCELLED) (409)', async () => {
      tx.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        userId: CUSTOMER_ID,
        status: OrderStatus.PREPARING,
      });

      await expect(
        service.requestRefund(ORDER_ID, CUSTOMER_ID, 'Lý do'),
      ).rejects.toThrow(ConflictException);
    });

    it('Khách hàng không thể gửi 2 yêu cầu hoàn tiền trên cùng một đơn (Chống tạo trùng)', async () => {
      tx.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        userId: CUSTOMER_ID,
        status: OrderStatus.PAID,
      });
      tx.refundRequest.findUnique.mockResolvedValue({
        id: 'existing-refund',
        orderId: ORDER_ID,
        status: 'PENDING',
      });

      await expect(
        service.requestRefund(ORDER_ID, CUSTOMER_ID, 'Lần gửi thứ hai'),
      ).rejects.toThrow(ConflictException);

      expect(tx.refundRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('UC-15: approveRefund (Barista duyệt hoàn tiền)', () => {
    const mockOrderPaid = {
      id: ORDER_ID,
      orderNumber: 'ORD-REFUND-01',
      userId: CUSTOMER_ID,
      status: OrderStatus.PAID,
      total: 55000n,
    };

    const mockPendingRefundReq = {
      id: 'refund-req-1',
      orderId: ORDER_ID,
      userId: CUSTOMER_ID,
      reason: 'Khách bận đột xuất',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('Barista duyệt hoàn tiền thành công: chuyển CANCELLED, hoàn kho, cộng Loyalty Points đúng bằng total', async () => {
      repository.lockById.mockResolvedValue(mockOrderPaid);
      tx.refundRequest.findUnique.mockResolvedValue(mockPendingRefundReq);
      tx.loyaltyTransaction.findFirst.mockResolvedValue(null);

      // Giả lập có reservation nguyên liệu cần hoàn tồn
      tx.inventoryReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          items: [{ ingredientId: 'ing-coffee', quantity: 20 }],
        },
      ]);

      tx.user.update.mockResolvedValue({
        id: CUSTOMER_ID,
        loyaltyBalance: 65000,
      });

      const now = new Date();
      tx.refundRequest.update.mockResolvedValue({
        ...mockPendingRefundReq,
        status: 'APPROVED',
        processedByUserId: BARISTA_ID,
        processedAt: now,
        updatedAt: now,
      });

      const result = await service.approveRefund(ORDER_ID, BARISTA_ID);

      expect(users.assertActiveBarista).toHaveBeenCalledWith(tx, BARISTA_ID);
      expect(repository.lockById).toHaveBeenCalledWith(ORDER_ID, tx);

      // Đơn bị chuyển sang CANCELLED
      expect(repository.updateStatusWithHistory).toHaveBeenCalledWith(
        ORDER_ID,
        OrderStatus.PAID,
        OrderStatus.CANCELLED,
        BARISTA_ID,
        expect.any(String),
        tx,
      );

      // Hoàn kho nguyên liệu
      expect(tx.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'ing-coffee' },
        data: {
          stockQuantity: { increment: 20 },
          version: { increment: 1 },
        },
      });
      expect(tx.inventoryReservation.updateMany).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID },
        data: { status: 'RELEASED' },
      });

      // Cộng loyaltyBalance đúng 55000 điểm (= total)
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: CUSTOMER_ID },
        data: {
          loyaltyBalance: { increment: 55000 },
        },
      });

      // Ghi nhận LoyaltyTransaction loại REFUND
      expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: CUSTOMER_ID,
          orderId: ORDER_ID,
          type: 'REFUND',
          points: 55000,
          balanceAfter: 65000,
          reason: `Hoàn tiền đơn hàng ORD-REFUND-01 vào điểm tích lũy`,
        },
      });

      expect(result.status).toBe('APPROVED');
      expect(result.processedByUserId).toBe(BARISTA_ID);
    });

    it('Chống duyệt trùng (Double-approval): Bấm duyệt 2 lần không cộng điểm 2 lần', async () => {
      repository.lockById.mockResolvedValue(mockOrderPaid);
      tx.refundRequest.findUnique.mockResolvedValue({
        ...mockPendingRefundReq,
        status: 'APPROVED', // đã duyệt trước đó
      });

      await expect(
        service.approveRefund(ORDER_ID, BARISTA_ID),
      ).rejects.toThrow(ConflictException);

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('Chống duyệt trùng bảo vệ tầng 2: Nếu đã có LoyaltyTransaction REFUND thì từ chối ngay', async () => {
      repository.lockById.mockResolvedValue(mockOrderPaid);
      tx.refundRequest.findUnique.mockResolvedValue(mockPendingRefundReq);
      tx.loyaltyTransaction.findFirst.mockResolvedValue({
        id: 'lt-already-refunded',
        type: 'REFUND',
      });

      await expect(
        service.approveRefund(ORDER_ID, BARISTA_ID),
      ).rejects.toThrow(ConflictException);

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('Barista duyệt hoàn tiền phải chạy trong atomic transaction: nếu tạo LoyaltyTransaction lỗi thì rollback toàn bộ', async () => {
      repository.lockById.mockResolvedValue(mockOrderPaid);
      tx.refundRequest.findUnique.mockResolvedValue(mockPendingRefundReq);
      tx.loyaltyTransaction.findFirst.mockResolvedValue(null);

      tx.user.update.mockResolvedValue({
        id: CUSTOMER_ID,
        loyaltyBalance: 65000,
      });

      // Bắn lỗi khi ghi LoyaltyTransaction
      tx.loyaltyTransaction.create.mockRejectedValue(new Error('DB loyalty error'));

      await expect(
        service.approveRefund(ORDER_ID, BARISTA_ID),
      ).rejects.toThrow('DB loyalty error');

      // Trong transaction thực tế của Prisma, toàn bộ update trước đó bị rollback
      expect(tx.refundRequest.update).not.toHaveBeenCalled();
    });

    it('Từ chối duyệt hoàn tiền nếu đơn hàng không còn ở trạng thái PAID (ví dụ đã sang PREPARING)', async () => {
      repository.lockById.mockResolvedValue({
        ...mockOrderPaid,
        status: OrderStatus.PREPARING,
      });

      await expect(
        service.approveRefund(ORDER_ID, BARISTA_ID),
      ).rejects.toThrow(ConflictException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('Từ chối duyệt nếu barista không còn active', async () => {
      users.assertActiveBarista.mockRejectedValue(new UnauthorizedException());

      await expect(
        service.approveRefund(ORDER_ID, BARISTA_ID),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('UC-15: rejectRefund (Barista từ chối yêu cầu hoàn tiền)', () => {
    const mockOrderPaid = {
      id: ORDER_ID,
      orderNumber: 'ORD-REFUND-01',
      userId: CUSTOMER_ID,
      status: OrderStatus.PAID,
    };

    const mockPendingRefundReq = {
      id: 'refund-req-1',
      orderId: ORDER_ID,
      userId: CUSTOMER_ID,
      reason: 'Khách muốn hủy',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('từ chối hoàn tiền thành công và ghi rejectReason', async () => {
      repository.lockById.mockResolvedValue(mockOrderPaid);
      tx.refundRequest.findUnique.mockResolvedValue(mockPendingRefundReq);

      const now = new Date();
      tx.refundRequest.update.mockResolvedValue({
        ...mockPendingRefundReq,
        status: 'REJECTED',
        processedByUserId: BARISTA_ID,
        processedAt: now,
        rejectReason: 'Quán đã chuẩn bị nguyên liệu',
        updatedAt: now,
      });

      const result = await service.rejectRefund(
        ORDER_ID,
        BARISTA_ID,
        'Quán đã chuẩn bị nguyên liệu',
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectReason).toBe('Quán đã chuẩn bị nguyên liệu');
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('không thể từ chối nếu yêu cầu đã được xử lý trước đó', async () => {
      repository.lockById.mockResolvedValue(mockOrderPaid);
      tx.refundRequest.findUnique.mockResolvedValue({
        ...mockPendingRefundReq,
        status: 'REJECTED',
      });

      await expect(
        service.rejectRefund(ORDER_ID, BARISTA_ID, 'Lý do từ chối'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
