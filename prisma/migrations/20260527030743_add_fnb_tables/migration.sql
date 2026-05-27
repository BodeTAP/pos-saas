-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('EMPTY', 'OCCUPIED', 'BILL', 'RESERVED');

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "area" TEXT,
    "status" "TableStatus" NOT NULL DEFAULT 'EMPTY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "outletId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_orders" (
    "id" TEXT NOT NULL,
    "note" TEXT,
    "tableId" TEXT NOT NULL,
    "transactionId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "table_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tables_tenantId_idx" ON "tables"("tenantId");

-- CreateIndex
CREATE INDEX "tables_outletId_idx" ON "tables"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "tables_number_outletId_key" ON "tables"("number", "outletId");

-- CreateIndex
CREATE UNIQUE INDEX "table_orders_transactionId_key" ON "table_orders"("transactionId");

-- CreateIndex
CREATE INDEX "table_orders_tableId_idx" ON "table_orders"("tableId");

-- CreateIndex
CREATE INDEX "table_orders_tenantId_idx" ON "table_orders"("tenantId");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_orders" ADD CONSTRAINT "table_orders_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_orders" ADD CONSTRAINT "table_orders_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_orders" ADD CONSTRAINT "table_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
