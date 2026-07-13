-- CreateTable
CREATE TABLE "ProductNormalizationDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lobNodeId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductNormalizationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductNormalizationDecision_companyId_idx" ON "ProductNormalizationDecision"("companyId");

-- CreateIndex
CREATE INDEX "ProductNormalizationDecision_lobNodeId_idx" ON "ProductNormalizationDecision"("lobNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductNormalizationDecision_lobNodeId_groupKey_key" ON "ProductNormalizationDecision"("lobNodeId", "groupKey");
