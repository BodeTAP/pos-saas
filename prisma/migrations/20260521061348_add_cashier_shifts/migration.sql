-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "cashier_shifts" (
    "id" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCash" DOUBLE PRECISION,
    "note" TEXT,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNonCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashierId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cashier_shifts_cashierId_idx" ON "cashier_shifts"("cashierId");

-- CreateIndex
CREATE INDEX "cashier_shifts_tenantId_idx" ON "cashier_shifts"("tenantId");

-- CreateIndex
CREATE INDEX "cashier_shifts_outletId_idx" ON "cashier_shifts"("outletId");

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
