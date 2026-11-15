BEGIN;

-- 1. Add the new header fields to the existing receipts table.
ALTER TABLE "inventory_receipts"
ADD COLUMN "supplier" VARCHAR(150),
ADD COLUMN "note" TEXT;

-- 2. Create the receipt detail table.
CREATE TABLE "inventory_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity_added" INTEGER NOT NULL,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,

    CONSTRAINT "inventory_receipt_items_pkey" PRIMARY KEY ("id")
);

-- 3. Migrate every old receipt row into one detail row.
-- Keep the original receipt ID, ingredient, quantity and stock snapshots.
INSERT INTO "inventory_receipt_items" (
    "id",
    "receipt_id",
    "ingredient_id",
    "quantity_added",
    "stock_before",
    "stock_after"
)
SELECT
    gen_random_uuid(),
    "id",
    "ingredient_id",
    "quantity",
    "stock_before",
    "stock_after"
FROM "inventory_receipts";

-- 4. Remove the old ingredient relation and index from the header.
ALTER TABLE "inventory_receipts"
DROP CONSTRAINT "inventory_receipts_ingredient_id_fkey";

DROP INDEX "inventory_receipts_ingredient_id_created_at_idx";

-- 5. Remove the old single-ingredient columns from the header.
ALTER TABLE "inventory_receipts"
DROP COLUMN "ingredient_id",
DROP COLUMN "quantity",
DROP COLUMN "stock_before",
DROP COLUMN "stock_after";

-- 6. Add indexes for receipt details.
CREATE INDEX "inventory_receipt_items_ingredient_id_idx"
ON "inventory_receipt_items"("ingredient_id");

CREATE INDEX "inventory_receipt_items_receipt_id_idx"
ON "inventory_receipt_items"("receipt_id");

-- 7. Add foreign keys for receipt details.
ALTER TABLE "inventory_receipt_items"
ADD CONSTRAINT "inventory_receipt_items_receipt_id_fkey"
FOREIGN KEY ("receipt_id")
REFERENCES "inventory_receipts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_receipt_items"
ADD CONSTRAINT "inventory_receipt_items_ingredient_id_fkey"
FOREIGN KEY ("ingredient_id")
REFERENCES "ingredients"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
