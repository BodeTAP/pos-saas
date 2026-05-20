/*
  Warnings:

  - Added the required column `outletId` to the `stock_mutations` table without a default value. This is not possible if the table is not empty.
  - Made the column `outletId` on table `transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_outletId_fkey";

-- AlterTable
ALTER TABLE "stock_mutations" ADD COLUMN     "outletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "outletId" SET NOT NULL;

-- CreateTable
CREATE TABLE "outlet_stocks" (
    "id" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "outletId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outlet_stocks_tenantId_idx" ON "outlet_stocks"("tenantId");

-- CreateIndex
CREATE INDEX "outlet_stocks_productId_idx" ON "outlet_stocks"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stocks_outletId_productId_key" ON "outlet_stocks"("outletId", "productId");

-- CreateIndex
CREATE INDEX "stock_mutations_outletId_idx" ON "stock_mutations"("outletId");

-- CreateIndex
CREATE INDEX "transactions_outletId_idx" ON "transactions"("outletId");

-- AddForeignKey
ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stocks" ADD CONSTRAINT "outlet_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_mutations" ADD CONSTRAINT "stock_mutations_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
