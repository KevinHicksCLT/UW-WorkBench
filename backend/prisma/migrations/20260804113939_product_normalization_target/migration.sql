-- AlterTable
ALTER TABLE "ProductNormalizationDecision" ADD COLUMN     "targetId" TEXT;

-- CreateTable
CREATE TABLE "ProductNormalizationTarget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "versionToken" TEXT,
    "filters" JSONB,
    "states" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductNormalizationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductNormalizationTarget_companyId_idx" ON "ProductNormalizationTarget"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductNormalizationTarget_companyId_name_key" ON "ProductNormalizationTarget"("companyId", "name");

-- CreateIndex
CREATE INDEX "ProductNormalizationDecision_targetId_idx" ON "ProductNormalizationDecision"("targetId");

-- AddForeignKey
ALTER TABLE "ProductNormalizationDecision" ADD CONSTRAINT "ProductNormalizationDecision_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ProductNormalizationTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
