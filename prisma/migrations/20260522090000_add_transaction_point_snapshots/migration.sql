-- AlterTable
ALTER TABLE "transactions"
ADD COLUMN "pointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- Best-effort legacy backfill. Historical redeemed points were not persisted,
-- so only earned points can be recovered for older customer transactions.
UPDATE "transactions" tx
SET "pointsEarned" = FLOOR(tx."total" / COALESCE(NULLIF(t."pointsPerAmount", 0), 10000))::INTEGER
FROM "tenants" t
WHERE tx."tenantId" = t.id
  AND tx."customerId" IS NOT NULL;
