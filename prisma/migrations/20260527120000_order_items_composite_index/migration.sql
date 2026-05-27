-- Composite index untuk Kitchen Display takeaway (filter status + transactionId)
CREATE INDEX "order_items_tenantId_status_transactionId_idx" ON "order_items"("tenantId", "status", "transactionId");
