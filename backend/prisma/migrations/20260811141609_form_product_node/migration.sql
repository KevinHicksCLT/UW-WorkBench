-- CreateTable
CREATE TABLE "FormProductNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "productNodeId" TEXT NOT NULL,
    "role_" TEXT NOT NULL DEFAULT 'baseForm',

    CONSTRAINT "FormProductNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormProductNode_formId_idx" ON "FormProductNode"("formId");

-- CreateIndex
CREATE INDEX "FormProductNode_productNodeId_idx" ON "FormProductNode"("productNodeId");

-- CreateIndex
CREATE INDEX "FormProductNode_companyId_formId_idx" ON "FormProductNode"("companyId", "formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormProductNode_formId_productNodeId_role__key" ON "FormProductNode"("formId", "productNodeId", "role_");

-- AddForeignKey
ALTER TABLE "FormProductNode" ADD CONSTRAINT "FormProductNode_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PolicyForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormProductNode" ADD CONSTRAINT "FormProductNode_productNodeId_fkey" FOREIGN KEY ("productNodeId") REFERENCES "ProductNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
