-- AlterTable
ALTER TABLE "RegulatoryRequirement" ADD COLUMN     "complianceRegulationId" TEXT,
ADD COLUMN     "complianceRequired" BOOLEAN,
ADD COLUMN     "notRequiredReason" TEXT;

-- CreateTable
CREATE TABLE "ComplianceRegulation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lineOfBusiness" TEXT NOT NULL DEFAULT 'ALL',
    "jurisdictionScope" TEXT NOT NULL,
    "productImpact" BOOLEAN NOT NULL DEFAULT false,
    "processImpact" BOOLEAN NOT NULL DEFAULT false,
    "systemImpact" BOOLEAN NOT NULL DEFAULT false,
    "ownerTeam" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL DEFAULT 'Not Yet Determined',
    "evidenceRequired" TEXT NOT NULL,
    "auditStatus" TEXT NOT NULL DEFAULT 'Not started',
    "representativeRequirement" TEXT NOT NULL,
    "sampleCitations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerTeam" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "jurisdictionScope" TEXT NOT NULL,
    "auditStatus" TEXT NOT NULL DEFAULT 'Not started',
    "supportingReqRows" INTEGER NOT NULL DEFAULT 0,
    "groundingBasis" TEXT NOT NULL,
    "officialSourceRows" INTEGER NOT NULL DEFAULT 0,
    "jurisdictionsCovered" INTEGER NOT NULL DEFAULT 0,
    "representativeRequirement" TEXT NOT NULL,
    "repJurisdiction" TEXT NOT NULL,
    "supportingCitations" TEXT NOT NULL,
    "frequencyDerived" TEXT NOT NULL,
    "frequencyAlignment" TEXT NOT NULL,
    "deadlineSignals" TEXT NOT NULL,
    "determinationStatus" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "signOff" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewer" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceItemRequirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "complianceItemId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceItemRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceJurisdictionVariant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "deadlineVariant" TEXT NOT NULL,
    "requirementTitle" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "promotedItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceJurisdictionVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceSignOffEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "complianceItemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceSignOffEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceRegulation_companyId_category_idx" ON "ComplianceRegulation"("companyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRegulation_companyId_regCode_key" ON "ComplianceRegulation"("companyId", "regCode");

-- CreateIndex
CREATE INDEX "ComplianceItem_regulationId_idx" ON "ComplianceItem"("regulationId");

-- CreateIndex
CREATE INDEX "ComplianceItem_companyId_confidence_idx" ON "ComplianceItem"("companyId", "confidence");

-- CreateIndex
CREATE INDEX "ComplianceItem_companyId_signOff_idx" ON "ComplianceItem"("companyId", "signOff");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItem_companyId_itemCode_key" ON "ComplianceItem"("companyId", "itemCode");

-- CreateIndex
CREATE INDEX "ComplianceItemRequirement_complianceItemId_idx" ON "ComplianceItemRequirement"("complianceItemId");

-- CreateIndex
CREATE INDEX "ComplianceItemRequirement_requirementId_idx" ON "ComplianceItemRequirement"("requirementId");

-- CreateIndex
CREATE INDEX "ComplianceItemRequirement_companyId_complianceItemId_idx" ON "ComplianceItemRequirement"("companyId", "complianceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItemRequirement_complianceItemId_requirementId_key" ON "ComplianceItemRequirement"("complianceItemId", "requirementId");

-- CreateIndex
CREATE INDEX "ComplianceJurisdictionVariant_regulationId_idx" ON "ComplianceJurisdictionVariant"("regulationId");

-- CreateIndex
CREATE INDEX "ComplianceJurisdictionVariant_companyId_regulationId_idx" ON "ComplianceJurisdictionVariant"("companyId", "regulationId");

-- CreateIndex
CREATE INDEX "ComplianceJurisdictionVariant_promotedItemId_idx" ON "ComplianceJurisdictionVariant"("promotedItemId");

-- CreateIndex
CREATE INDEX "ComplianceSignOffEvent_complianceItemId_idx" ON "ComplianceSignOffEvent"("complianceItemId");

-- CreateIndex
CREATE INDEX "ComplianceSignOffEvent_companyId_createdAt_idx" ON "ComplianceSignOffEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_complianceRegulationId_idx" ON "RegulatoryRequirement"("complianceRegulationId");

-- AddForeignKey
ALTER TABLE "RegulatoryRequirement" ADD CONSTRAINT "RegulatoryRequirement_complianceRegulationId_fkey" FOREIGN KEY ("complianceRegulationId") REFERENCES "ComplianceRegulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRegulation" ADD CONSTRAINT "ComplianceRegulation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "ComplianceRegulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemRequirement" ADD CONSTRAINT "ComplianceItemRequirement_complianceItemId_fkey" FOREIGN KEY ("complianceItemId") REFERENCES "ComplianceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemRequirement" ADD CONSTRAINT "ComplianceItemRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceJurisdictionVariant" ADD CONSTRAINT "ComplianceJurisdictionVariant_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "ComplianceRegulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceJurisdictionVariant" ADD CONSTRAINT "ComplianceJurisdictionVariant_promotedItemId_fkey" FOREIGN KEY ("promotedItemId") REFERENCES "ComplianceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceSignOffEvent" ADD CONSTRAINT "ComplianceSignOffEvent_complianceItemId_fkey" FOREIGN KEY ("complianceItemId") REFERENCES "ComplianceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
