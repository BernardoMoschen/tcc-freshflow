-- CreateIndex: Composite index for Product queries filtered by tenant and category
CREATE INDEX "Product_tenantId_category_idx" ON "Product"("tenantId", "category");

-- CreateIndex: Composite index for Order queries filtered by account and status
CREATE INDEX "Order_accountId_status_idx" ON "Order"("accountId", "status");

-- CreateIndex: Composite index for Order queries filtered by status and sorted by creation date
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
