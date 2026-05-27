/*
  Warnings:

  - A unique constraint covering the columns `[tableOrderId]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "serviceChargePct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "serviceChargePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tableOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tableOrderId_key" ON "transactions"("tableOrderId");
