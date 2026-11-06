import { OrderStatus } from '../../generated/prisma/client.js';

/** Allowed state transitions per the SRS FR-09 */
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
  PAID: ['CANCELLED', 'PREPARING'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const FINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];
