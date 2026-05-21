-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "activePaymentMethods" TEXT NOT NULL DEFAULT '["CASH","QRIS","TRANSFER"]',
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
ADD COLUMN     "pointValue" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "pointsPerAmount" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "receiptHeader" TEXT;

-- CreateTable
CREATE TABLE "platform_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_configs_key_key" ON "platform_configs"("key");
