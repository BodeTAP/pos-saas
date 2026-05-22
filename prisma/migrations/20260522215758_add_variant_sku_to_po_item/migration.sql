-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "variantSkuId" TEXT;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variantSkuId_fkey" FOREIGN KEY ("variantSkuId") REFERENCES "product_variant_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
