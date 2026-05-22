-- AlterTable
ALTER TABLE "products" ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transaction_items" ADD COLUMN     "variantLabel" TEXT,
ADD COLUMN     "variantSkuId" TEXT;

-- CreateTable
CREATE TABLE "product_variant_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_options" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variantTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_skus" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_sku_options" (
    "skuId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "product_variant_sku_options_pkey" PRIMARY KEY ("skuId","optionId")
);

-- CreateTable
CREATE TABLE "outlet_stock_variants" (
    "id" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "outletId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_stock_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_mutation_variants" (
    "id" TEXT NOT NULL,
    "type" "StockMutationType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "note" TEXT,
    "tenantId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_mutation_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_variant_types_productId_idx" ON "product_variant_types"("productId");

-- CreateIndex
CREATE INDEX "product_variant_options_variantTypeId_idx" ON "product_variant_options"("variantTypeId");

-- CreateIndex
CREATE INDEX "product_variant_skus_productId_idx" ON "product_variant_skus"("productId");

-- CreateIndex
CREATE INDEX "outlet_stock_variants_tenantId_idx" ON "outlet_stock_variants"("tenantId");

-- CreateIndex
CREATE INDEX "outlet_stock_variants_skuId_idx" ON "outlet_stock_variants"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_stock_variants_outletId_skuId_key" ON "outlet_stock_variants"("outletId", "skuId");

-- CreateIndex
CREATE INDEX "stock_mutation_variants_tenantId_idx" ON "stock_mutation_variants"("tenantId");

-- CreateIndex
CREATE INDEX "stock_mutation_variants_skuId_idx" ON "stock_mutation_variants"("skuId");

-- CreateIndex
CREATE INDEX "stock_mutation_variants_outletId_idx" ON "stock_mutation_variants"("outletId");

-- AddForeignKey
ALTER TABLE "product_variant_types" ADD CONSTRAINT "product_variant_types_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_variantTypeId_fkey" FOREIGN KEY ("variantTypeId") REFERENCES "product_variant_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_skus" ADD CONSTRAINT "product_variant_skus_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_sku_options" ADD CONSTRAINT "product_variant_sku_options_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "product_variant_skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_sku_options" ADD CONSTRAINT "product_variant_sku_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "product_variant_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_variants" ADD CONSTRAINT "outlet_stock_variants_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_stock_variants" ADD CONSTRAINT "outlet_stock_variants_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "product_variant_skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_mutation_variants" ADD CONSTRAINT "stock_mutation_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_mutation_variants" ADD CONSTRAINT "stock_mutation_variants_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "product_variant_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_mutation_variants" ADD CONSTRAINT "stock_mutation_variants_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_variantSkuId_fkey" FOREIGN KEY ("variantSkuId") REFERENCES "product_variant_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
