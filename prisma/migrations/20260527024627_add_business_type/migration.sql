-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RETAIL', 'FNB', 'SERVICE', 'OTHER');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'RETAIL';
