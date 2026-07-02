-- Regulations module (Phase 1): Jurisdiction, IntegrationSystem, JurisdictionIntegration,
-- RegulatoryRequirement, RequirementValueStream, RegulatoryBulletin, ComplianceRule, RegulatorySource.
-- Purely additive — generated via prisma migrate diff against the regulations DB branch and
-- filtered to the new tables only (the live DB carries known benign drift that must not be dropped).
CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regulatorName" TEXT NOT NULL,
    "regulatorWebsite" TEXT,
    "regulatorType" TEXT NOT NULL DEFAULT 'STATE_INSURANCE_REGULATOR',
    "filingPortal" TEXT NOT NULL,
    "filingPortalDetail" TEXT,
    "compactStatus" TEXT NOT NULL,
    "autoVerification" TEXT NOT NULL,
    "autoVerificationDetail" TEXT,
    "workersCompModel" TEXT NOT NULL,
    "workersCompDetail" TEXT,
    "apcd" TEXT NOT NULL,
    "sbs" TEXT NOT NULL,
    "statutoryAuthority" TEXT,
    "summaryRegulator" TEXT,
    "summaryStatutes" TEXT,
    "summaryIntegration" TEXT,
    "executiveSummary" TEXT,
    "operatingModel" TEXT,
    "signalsJson" JSONB,
    "priorityTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "profileDepth" TEXT NOT NULL DEFAULT 'NARRATIVE',
    "lastReviewedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "baselineVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationSystem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "apiAvailability" TEXT NOT NULL DEFAULT 'PORTAL_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSystem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JurisdictionIntegration" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "usage" TEXT NOT NULL DEFAULT 'REQUIRED',
    "scope" TEXT NOT NULL DEFAULT 'all lines',
    "notes" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisdictionIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryRequirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "lineOfBusiness" TEXT NOT NULL DEFAULT 'ALL',
    "citation" TEXT,
    "citationUrl" TEXT,
    "obligationType" TEXT NOT NULL DEFAULT 'ONGOING',
    "frequency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" TIMESTAMP(3),
    "supersededById" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'BASELINE',
    "sourceNote" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequirementValueStream" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "valueStreamId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'GOVERNS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementValueStream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryBulletin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT,
    "issuedDate" TIMESTAMP(3),
    "discoveredVia" TEXT NOT NULL DEFAULT 'BASELINE',
    "requirementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryBulletin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "ruleJson" JSONB NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatorySource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jurisdictionId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "authority" TEXT NOT NULL DEFAULT 'OFFICIAL_REGULATOR',
    "monitor" BOOLEAN NOT NULL DEFAULT true,
    "checkTier" TEXT NOT NULL DEFAULT 'WEEKLY',
    "lastCheckedAt" TIMESTAMP(3),
    "lastContentHash" TEXT,
    "lastChangedAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "healthStatus" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatorySource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Jurisdiction_companyId_idx" ON "Jurisdiction"("companyId");

CREATE UNIQUE INDEX "Jurisdiction_companyId_code_key" ON "Jurisdiction"("companyId", "code");

CREATE INDEX "IntegrationSystem_companyId_idx" ON "IntegrationSystem"("companyId");

CREATE UNIQUE INDEX "IntegrationSystem_companyId_name_key" ON "IntegrationSystem"("companyId", "name");

CREATE INDEX "JurisdictionIntegration_jurisdictionId_idx" ON "JurisdictionIntegration"("jurisdictionId");

CREATE INDEX "JurisdictionIntegration_systemId_idx" ON "JurisdictionIntegration"("systemId");

CREATE UNIQUE INDEX "JurisdictionIntegration_jurisdictionId_systemId_scope_key" ON "JurisdictionIntegration"("jurisdictionId", "systemId", "scope");

CREATE INDEX "RegulatoryRequirement_companyId_idx" ON "RegulatoryRequirement"("companyId");

CREATE INDEX "RegulatoryRequirement_jurisdictionId_idx" ON "RegulatoryRequirement"("jurisdictionId");

CREATE INDEX "RegulatoryRequirement_companyId_category_idx" ON "RegulatoryRequirement"("companyId", "category");

CREATE INDEX "RegulatoryRequirement_companyId_status_idx" ON "RegulatoryRequirement"("companyId", "status");

CREATE INDEX "RequirementValueStream_requirementId_idx" ON "RequirementValueStream"("requirementId");

CREATE INDEX "RequirementValueStream_valueStreamId_idx" ON "RequirementValueStream"("valueStreamId");

CREATE UNIQUE INDEX "RequirementValueStream_requirementId_valueStreamId_key" ON "RequirementValueStream"("requirementId", "valueStreamId");

CREATE INDEX "RegulatoryBulletin_companyId_idx" ON "RegulatoryBulletin"("companyId");

CREATE INDEX "RegulatoryBulletin_jurisdictionId_idx" ON "RegulatoryBulletin"("jurisdictionId");

CREATE INDEX "ComplianceRule_companyId_idx" ON "ComplianceRule"("companyId");

CREATE INDEX "ComplianceRule_jurisdictionId_idx" ON "ComplianceRule"("jurisdictionId");

CREATE UNIQUE INDEX "ComplianceRule_companyId_ruleCode_key" ON "ComplianceRule"("companyId", "ruleCode");

CREATE INDEX "RegulatorySource_companyId_idx" ON "RegulatorySource"("companyId");

CREATE INDEX "RegulatorySource_jurisdictionId_idx" ON "RegulatorySource"("jurisdictionId");

ALTER TABLE "Jurisdiction" ADD CONSTRAINT "Jurisdiction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationSystem" ADD CONSTRAINT "IntegrationSystem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JurisdictionIntegration" ADD CONSTRAINT "JurisdictionIntegration_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JurisdictionIntegration" ADD CONSTRAINT "JurisdictionIntegration_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatoryRequirement" ADD CONSTRAINT "RegulatoryRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatoryRequirement" ADD CONSTRAINT "RegulatoryRequirement_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementValueStream" ADD CONSTRAINT "RequirementValueStream_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequirementValueStream" ADD CONSTRAINT "RequirementValueStream_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatoryBulletin" ADD CONSTRAINT "RegulatoryBulletin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatoryBulletin" ADD CONSTRAINT "RegulatoryBulletin_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatoryBulletin" ADD CONSTRAINT "RegulatoryBulletin_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
