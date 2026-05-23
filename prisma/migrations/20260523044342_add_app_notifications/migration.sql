-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'NEW_TRANSACTION', 'SYSTEM');

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_notifications_tenantId_isRead_idx" ON "app_notifications"("tenantId", "isRead");

-- CreateIndex
CREATE INDEX "app_notifications_tenantId_createdAt_idx" ON "app_notifications"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
