-- CreateTable
CREATE TABLE "RpRatingModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lob" TEXT NOT NULL,
    "jurisdictions" TEXT NOT NULL,
    "engineOfRecord" TEXT NOT NULL DEFAULT 'tb-reference',
    "lifecycle" TEXT NOT NULL DEFAULT 'draft',
    "ownerRoleId" TEXT,
    "valueStreamNodeId" TEXT,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpRatingModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpModelVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "semver" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "provenance" TEXT NOT NULL DEFAULT 'human',
    "spec" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpModelRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "riskInput" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "premium" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "batchId" TEXT,
    "traceEventId" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RpModelRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpTestBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'regression',
    "versionIds" JSONB NOT NULL,
    "datasetRef" TEXT NOT NULL,
    "tolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "checkpoint" JSONB,
    "passFailMatrix" JSONB,
    "disruptionDeciles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpTestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpJurisdictionRuleSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "jurisdictionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "optimizationRestricted" BOOLEAN NOT NULL DEFAULT false,
    "constraints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpJurisdictionRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpOptimizationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "constraints" JSONB,
    "ruleSetId" TEXT NOT NULL,
    "scenarioCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "complianceAckBy" TEXT,
    "complianceAckAt" TIMESTAMP(3),
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpOptimizationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpRateProgram" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "lob" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "filingStatus" TEXT NOT NULL DEFAULT 'drafting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpRateProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpProgramModel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,

    CONSTRAINT "RpProgramModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpFilingPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "serffTrackingNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sections" JSONB NOT NULL,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "disposition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpFilingPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpFilingCompliance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filingPacketId" TEXT NOT NULL,
    "complianceItemId" TEXT NOT NULL,

    CONSTRAINT "RpFilingCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpLegacyRater" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lob" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "discoveredVia" TEXT,
    "complexityScore" DOUBLE PRECISION,
    "definition" JSONB,
    "status" TEXT NOT NULL DEFAULT 'INVENTORIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpLegacyRater_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpCanonicalSpec" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "legacyRaterId" TEXT NOT NULL,
    "specVersion" INTEGER NOT NULL DEFAULT 1,
    "spec" JSONB NOT NULL,
    "extractionConfidence" TEXT NOT NULL,
    "humanConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpCanonicalSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpDivergenceMatrix" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "targetVersionId" TEXT NOT NULL,
    "portfolioRef" TEXT NOT NULL,
    "maxDivergencePct" DOUBLE PRECISION NOT NULL,
    "cells" JSONB NOT NULL,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RpDivergenceMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpMigrationWave" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "cutoverDate" TIMESTAMP(3),
    "rollbackPlan" TEXT,
    "tolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "targetModelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpMigrationWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpWaveMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "legacyRaterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "RpWaveMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RpRatingModel_companyId_lifecycle_idx" ON "RpRatingModel"("companyId", "lifecycle");

-- CreateIndex
CREATE INDEX "RpRatingModel_ownerRoleId_idx" ON "RpRatingModel"("ownerRoleId");

-- CreateIndex
CREATE INDEX "RpRatingModel_valueStreamNodeId_idx" ON "RpRatingModel"("valueStreamNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "RpRatingModel_companyId_ref_key" ON "RpRatingModel"("companyId", "ref");

-- CreateIndex
CREATE INDEX "RpModelVersion_companyId_status_idx" ON "RpModelVersion"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RpModelVersion_modelId_semver_key" ON "RpModelVersion"("modelId", "semver");

-- CreateIndex
CREATE INDEX "RpModelRun_versionId_executedAt_idx" ON "RpModelRun"("versionId", "executedAt");

-- CreateIndex
CREATE INDEX "RpModelRun_batchId_idx" ON "RpModelRun"("batchId");

-- CreateIndex
CREATE INDEX "RpModelRun_traceEventId_idx" ON "RpModelRun"("traceEventId");

-- CreateIndex
CREATE INDEX "RpModelRun_companyId_idx" ON "RpModelRun"("companyId");

-- CreateIndex
CREATE INDEX "RpTestBatch_companyId_status_idx" ON "RpTestBatch"("companyId", "status");

-- CreateIndex
CREATE INDEX "RpJurisdictionRuleSet_companyId_idx" ON "RpJurisdictionRuleSet"("companyId");

-- CreateIndex
CREATE INDEX "RpJurisdictionRuleSet_jurisdictionId_idx" ON "RpJurisdictionRuleSet"("jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "RpJurisdictionRuleSet_companyId_code_version_key" ON "RpJurisdictionRuleSet"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "RpOptimizationJob_versionId_idx" ON "RpOptimizationJob"("versionId");

-- CreateIndex
CREATE INDEX "RpOptimizationJob_companyId_status_idx" ON "RpOptimizationJob"("companyId", "status");

-- CreateIndex
CREATE INDEX "RpOptimizationJob_ruleSetId_idx" ON "RpOptimizationJob"("ruleSetId");

-- CreateIndex
CREATE INDEX "RpRateProgram_companyId_filingStatus_idx" ON "RpRateProgram"("companyId", "filingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RpRateProgram_companyId_ref_key" ON "RpRateProgram"("companyId", "ref");

-- CreateIndex
CREATE INDEX "RpProgramModel_programId_idx" ON "RpProgramModel"("programId");

-- CreateIndex
CREATE INDEX "RpProgramModel_modelId_idx" ON "RpProgramModel"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "RpProgramModel_programId_modelId_key" ON "RpProgramModel"("programId", "modelId");

-- CreateIndex
CREATE INDEX "RpFilingPacket_programId_idx" ON "RpFilingPacket"("programId");

-- CreateIndex
CREATE INDEX "RpFilingPacket_modelVersionId_idx" ON "RpFilingPacket"("modelVersionId");

-- CreateIndex
CREATE INDEX "RpFilingPacket_companyId_status_idx" ON "RpFilingPacket"("companyId", "status");

-- CreateIndex
CREATE INDEX "RpFilingCompliance_filingPacketId_idx" ON "RpFilingCompliance"("filingPacketId");

-- CreateIndex
CREATE INDEX "RpFilingCompliance_complianceItemId_idx" ON "RpFilingCompliance"("complianceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RpFilingCompliance_filingPacketId_complianceItemId_key" ON "RpFilingCompliance"("filingPacketId", "complianceItemId");

-- CreateIndex
CREATE INDEX "RpLegacyRater_companyId_status_idx" ON "RpLegacyRater"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RpLegacyRater_companyId_ref_key" ON "RpLegacyRater"("companyId", "ref");

-- CreateIndex
CREATE INDEX "RpCanonicalSpec_companyId_idx" ON "RpCanonicalSpec"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RpCanonicalSpec_legacyRaterId_specVersion_key" ON "RpCanonicalSpec"("legacyRaterId", "specVersion");

-- CreateIndex
CREATE INDEX "RpDivergenceMatrix_specId_idx" ON "RpDivergenceMatrix"("specId");

-- CreateIndex
CREATE INDEX "RpDivergenceMatrix_targetVersionId_idx" ON "RpDivergenceMatrix"("targetVersionId");

-- CreateIndex
CREATE INDEX "RpDivergenceMatrix_companyId_idx" ON "RpDivergenceMatrix"("companyId");

-- CreateIndex
CREATE INDEX "RpMigrationWave_companyId_status_idx" ON "RpMigrationWave"("companyId", "status");

-- CreateIndex
CREATE INDEX "RpMigrationWave_targetModelId_idx" ON "RpMigrationWave"("targetModelId");

-- CreateIndex
CREATE UNIQUE INDEX "RpMigrationWave_companyId_ref_key" ON "RpMigrationWave"("companyId", "ref");

-- CreateIndex
CREATE INDEX "RpWaveMember_waveId_idx" ON "RpWaveMember"("waveId");

-- CreateIndex
CREATE INDEX "RpWaveMember_legacyRaterId_idx" ON "RpWaveMember"("legacyRaterId");

-- CreateIndex
CREATE UNIQUE INDEX "RpWaveMember_waveId_legacyRaterId_key" ON "RpWaveMember"("waveId", "legacyRaterId");

-- AddForeignKey
ALTER TABLE "RpRatingModel" ADD CONSTRAINT "RpRatingModel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpRatingModel" ADD CONSTRAINT "RpRatingModel_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpRatingModel" ADD CONSTRAINT "RpRatingModel_valueStreamNodeId_fkey" FOREIGN KEY ("valueStreamNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpModelVersion" ADD CONSTRAINT "RpModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "RpRatingModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpModelRun" ADD CONSTRAINT "RpModelRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RpModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpModelRun" ADD CONSTRAINT "RpModelRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RpTestBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpModelRun" ADD CONSTRAINT "RpModelRun_traceEventId_fkey" FOREIGN KEY ("traceEventId") REFERENCES "UwGovernanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpTestBatch" ADD CONSTRAINT "RpTestBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpJurisdictionRuleSet" ADD CONSTRAINT "RpJurisdictionRuleSet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpJurisdictionRuleSet" ADD CONSTRAINT "RpJurisdictionRuleSet_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpOptimizationJob" ADD CONSTRAINT "RpOptimizationJob_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RpModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpOptimizationJob" ADD CONSTRAINT "RpOptimizationJob_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RpJurisdictionRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpRateProgram" ADD CONSTRAINT "RpRateProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpProgramModel" ADD CONSTRAINT "RpProgramModel_programId_fkey" FOREIGN KEY ("programId") REFERENCES "RpRateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpProgramModel" ADD CONSTRAINT "RpProgramModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "RpRatingModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpFilingPacket" ADD CONSTRAINT "RpFilingPacket_programId_fkey" FOREIGN KEY ("programId") REFERENCES "RpRateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpFilingPacket" ADD CONSTRAINT "RpFilingPacket_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "RpModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpFilingCompliance" ADD CONSTRAINT "RpFilingCompliance_filingPacketId_fkey" FOREIGN KEY ("filingPacketId") REFERENCES "RpFilingPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpFilingCompliance" ADD CONSTRAINT "RpFilingCompliance_complianceItemId_fkey" FOREIGN KEY ("complianceItemId") REFERENCES "ComplianceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpLegacyRater" ADD CONSTRAINT "RpLegacyRater_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpCanonicalSpec" ADD CONSTRAINT "RpCanonicalSpec_legacyRaterId_fkey" FOREIGN KEY ("legacyRaterId") REFERENCES "RpLegacyRater"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpDivergenceMatrix" ADD CONSTRAINT "RpDivergenceMatrix_specId_fkey" FOREIGN KEY ("specId") REFERENCES "RpCanonicalSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpDivergenceMatrix" ADD CONSTRAINT "RpDivergenceMatrix_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "RpModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpMigrationWave" ADD CONSTRAINT "RpMigrationWave_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpMigrationWave" ADD CONSTRAINT "RpMigrationWave_targetModelId_fkey" FOREIGN KEY ("targetModelId") REFERENCES "RpRatingModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpWaveMember" ADD CONSTRAINT "RpWaveMember_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "RpMigrationWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpWaveMember" ADD CONSTRAINT "RpWaveMember_legacyRaterId_fkey" FOREIGN KEY ("legacyRaterId") REFERENCES "RpLegacyRater"("id") ON DELETE CASCADE ON UPDATE CASCADE;

