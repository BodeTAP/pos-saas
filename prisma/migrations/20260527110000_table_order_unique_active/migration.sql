-- Partial unique index: 1 active TableOrder per Table (cegah race condition multi-cashier)
CREATE UNIQUE INDEX "table_orders_one_active_per_table" ON "table_orders"("tableId") WHERE "closedAt" IS NULL;
