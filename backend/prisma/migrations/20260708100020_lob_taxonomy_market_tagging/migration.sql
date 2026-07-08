-- AlterTable
ALTER TABLE "RegulatoryRequirement" ADD COLUMN     "markets" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "LineOfBusiness" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "segments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineOfBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementLineOfBusiness" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "lobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementLineOfBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineOfBusiness_companyId_idx" ON "LineOfBusiness"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LineOfBusiness_companyId_code_key" ON "LineOfBusiness"("companyId", "code");

-- CreateIndex
CREATE INDEX "RequirementLineOfBusiness_companyId_idx" ON "RequirementLineOfBusiness"("companyId");

-- CreateIndex
CREATE INDEX "RequirementLineOfBusiness_lobId_idx" ON "RequirementLineOfBusiness"("lobId");

-- CreateIndex
CREATE INDEX "RequirementLineOfBusiness_regId_idx" ON "RequirementLineOfBusiness"("regId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementLineOfBusiness_regId_lobId_key" ON "RequirementLineOfBusiness"("regId", "lobId");

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_companyId_status_regime_idx" ON "RegulatoryRequirement"("companyId", "status", "regime");

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_companyId_status_lineOfBusiness_idx" ON "RegulatoryRequirement"("companyId", "status", "lineOfBusiness");

-- AddForeignKey
ALTER TABLE "LineOfBusiness" ADD CONSTRAINT "LineOfBusiness_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementLineOfBusiness" ADD CONSTRAINT "RequirementLineOfBusiness_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementLineOfBusiness" ADD CONSTRAINT "RequirementLineOfBusiness_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementLineOfBusiness" ADD CONSTRAINT "RequirementLineOfBusiness_lobId_fkey" FOREIGN KEY ("lobId") REFERENCES "LineOfBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
