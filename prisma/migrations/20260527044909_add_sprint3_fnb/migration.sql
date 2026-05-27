-- AlterTable
ALTER TABLE "products" ADD COLUMN     "availableToday" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_options" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_modifier_groups" (
    "productId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_modifier_groups_pkey" PRIMARY KEY ("productId","groupId")
);

-- CreateTable
CREATE TABLE "transaction_item_modifiers" (
    "id" TEXT NOT NULL,
    "transactionItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "modifierGroupName" TEXT NOT NULL,
    "modifierOptionId" TEXT NOT NULL,
    "modifierOptionName" TEXT NOT NULL,
    "extraPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "transaction_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modifier_groups_tenantId_idx" ON "modifier_groups"("tenantId");

-- CreateIndex
CREATE INDEX "modifier_options_groupId_idx" ON "modifier_options"("groupId");

-- CreateIndex
CREATE INDEX "product_modifier_groups_productId_idx" ON "product_modifier_groups"("productId");

-- CreateIndex
CREATE INDEX "transaction_item_modifiers_transactionItemId_idx" ON "transaction_item_modifiers"("transactionItemId");

-- AddForeignKey
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_item_modifiers" ADD CONSTRAINT "transaction_item_modifiers_transactionItemId_fkey" FOREIGN KEY ("transactionItemId") REFERENCES "transaction_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
