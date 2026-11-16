
-- CreateTable
CREATE TABLE "inventory_receipts" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "received_by_user_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_receipts_ingredient_id_created_at_idx"
ON "inventory_receipts"("ingredient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_receipts_received_by_user_id_created_at_idx"
ON "inventory_receipts"("received_by_user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "inventory_receipts"
ADD CONSTRAINT "inventory_receipts_ingredient_id_fkey"
FOREIGN KEY ("ingredient_id")
REFERENCES "ingredients"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipts"
ADD CONSTRAINT "inventory_receipts_received_by_user_id_fkey"
FOREIGN KEY ("received_by_user_id")
REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
