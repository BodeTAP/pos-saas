-- AlterTable
ALTER TABLE "users" ADD COLUMN     "offlinePinExpiresAt" TIMESTAMP(3),
ADD COLUMN     "offlinePinHash" TEXT;
