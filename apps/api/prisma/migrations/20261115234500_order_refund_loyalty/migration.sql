-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "LoyaltyTransactionType" ADD VALUE 'REFUND';

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "processed_by_user_id" UUID,
    "processed_at" TIMESTAMPTZ(6),
    "reject_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_order_id_key" ON "refund_requests"("order_id");

-- CreateIndex
CREATE INDEX "refund_requests_user_id_status_idx" ON "refund_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "refund_requests_status_created_at_idx" ON "refund_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index to guarantee idempotency: only one REFUND loyalty transaction per order
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_transactions_order_refund_unique"
  ON "loyalty_transactions" ("order_id")
  WHERE ("type" = 'REFUND' AND "order_id" IS NOT NULL);
