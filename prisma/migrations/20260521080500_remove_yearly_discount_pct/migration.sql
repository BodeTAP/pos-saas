-- AlterTable: remove yearlyDiscountPct column (now computed from monthlyPrice and yearlyPrice)
ALTER TABLE "pricing_plans" DROP COLUMN IF EXISTS "yearly_discount_pct";
