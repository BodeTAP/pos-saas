/*
  Warnings:

  - A unique constraint covering the columns `[tripayReference]` on the table `billing_invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone,tenantId]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_tripayReference_key" ON "billing_invoices"("tripayReference");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_tenantId_key" ON "customers"("phone", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_invoiceNumber_key" ON "transactions"("invoiceNumber");
