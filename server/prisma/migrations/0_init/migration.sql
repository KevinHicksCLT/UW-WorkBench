-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "operatingRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "managerRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SystemOfRecord',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifiers" JSONB,
    "domicile" TEXT,
    "industry" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'PORTAL',
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "lob" TEXT NOT NULL,
    "brokerName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "tivTotal" DOUBLE PRECISION,
    "description" TEXT,
    "appetiteVerdict" TEXT,
    "appetiteCitations" JSONB,
    "extractedFields" JSONB,
    "assignedRoleId" TEXT,
    "valueStreamNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwRiskObject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LOCATION',
    "name" TEXT NOT NULL,
    "situs" TEXT,
    "tiv" DOUBLE PRECISION,
    "exposureData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwRiskObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwCoverageRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "lob" TEXT NOT NULL,
    "limitAmount" DOUBLE PRECISION,
    "deductible" DOUBLE PRECISION,
    "terms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UwCoverageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwClearanceCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "verdict" TEXT NOT NULL DEFAULT 'CLEAR',
    "matchEvidence" JSONB,
    "firstReleaseBy" TEXT,
    "firstReleaseRole" TEXT,
    "firstReleaseAt" TIMESTAMP(3),
    "secondReleaseBy" TEXT,
    "secondReleaseRole" TEXT,
    "secondReleaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwClearanceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwEnrichmentSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "costClass" TEXT NOT NULL DEFAULT 'LOW',
    "ttlHours" INTEGER NOT NULL DEFAULT 720,
    "jurisdictions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwEnrichmentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwEnrichmentRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "riskObjectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UwEnrichmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwTriageScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "appetiteFit" DOUBLE PRECISION NOT NULL,
    "winnability" DOUBLE PRECISION NOT NULL,
    "expectedValue" DOUBLE PRECISION NOT NULL,
    "effort" DOUBLE PRECISION NOT NULL,
    "composite" DOUBLE PRECISION NOT NULL,
    "weightsVersion" TEXT NOT NULL DEFAULT 'w1',
    "rationale" JSONB,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UwTriageScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwAppetiteStatement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "stance" TEXT NOT NULL,
    "lob" TEXT NOT NULL,
    "segment" TEXT,
    "naicsCodes" TEXT,
    "geographies" TEXT,
    "tivMax" DOUBLE PRECISION,
    "capacityLimit" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ownerOrgUnitId" TEXT,
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwAppetiteStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwGuidelineRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DECISION_TABLE',
    "definition" JSONB NOT NULL,
    "inputsSchema" JSONB,
    "stpPath" BOOLEAN NOT NULL DEFAULT false,
    "stpApprovedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwGuidelineRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwAuthorityGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "roleId" TEXT NOT NULL,
    "premiumMax" DOUBLE PRECISION NOT NULL,
    "tivMax" DOUBLE PRECISION NOT NULL,
    "lineSize" DOUBLE PRECISION,
    "lobs" TEXT NOT NULL,
    "territories" TEXT NOT NULL,
    "delegable" BOOLEAN NOT NULL DEFAULT false,
    "bordereauxAttached" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "breachCount90d" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwAuthorityGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwReferralCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "decisionId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "escalatedToRoleId" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolvedByRole" TEXT,
    "resolutionNote" TEXT,
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "UwReferralCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "premium" DOUBLE PRECISION,
    "sublimits" JSONB,
    "rationale" TEXT NOT NULL,
    "authorityGrantId" TEXT,
    "authorityResult" TEXT NOT NULL,
    "authorityDetail" JSONB,
    "dispositionedBy" TEXT NOT NULL,
    "viaStpRuleId" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UwDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwQuoteProposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "decisionId" TEXT,
    "premium" DOUBLE PRECISION NOT NULL,
    "terms" JSONB,
    "modelRef" TEXT,
    "formSetRef" TEXT,
    "pricedResolved" BOOLEAN NOT NULL DEFAULT false,
    "documentedResolved" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwQuoteProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwBindEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "pasPolicyRef" TEXT NOT NULL,
    "executedBy" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UwBindEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwPasBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UwPasBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwAgentAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "modelRef" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "proposal" JSONB,
    "disposition" TEXT NOT NULL DEFAULT 'PENDING',
    "dispositionedBy" TEXT,
    "dispositionedAt" TIMESTAMP(3),
    "submissionId" TEXT,
    "governanceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UwAgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwGovernanceEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB,
    "correlationId" TEXT NOT NULL,
    "submissionId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UwGovernanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UwDivergencePair" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "leftRef" TEXT NOT NULL,
    "leftEstate" TEXT,
    "rightRef" TEXT NOT NULL,
    "rightEstate" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "proposal" TEXT,
    "impactPreview" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actionedBy" TEXT,
    "actionNote" TEXT,
    "actionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UwDivergencePair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_tenantId_slug_key" ON "Company"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "OrgUnit_companyId_idx" ON "OrgUnit"("companyId");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE INDEX "Role_managerRoleId_idx" ON "Role"("managerRoleId");

-- CreateIndex
CREATE INDEX "ProcessNode_companyId_idx" ON "ProcessNode"("companyId");

-- CreateIndex
CREATE INDEX "Application_companyId_idx" ON "Application"("companyId");

-- CreateIndex
CREATE INDEX "UwAccount_companyId_idx" ON "UwAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UwAccount_companyId_name_key" ON "UwAccount"("companyId", "name");

-- CreateIndex
CREATE INDEX "UwSubmission_companyId_status_idx" ON "UwSubmission"("companyId", "status");

-- CreateIndex
CREATE INDEX "UwSubmission_companyId_slaDueAt_idx" ON "UwSubmission"("companyId", "slaDueAt");

-- CreateIndex
CREATE INDEX "UwSubmission_accountId_idx" ON "UwSubmission"("accountId");

-- CreateIndex
CREATE INDEX "UwSubmission_assignedRoleId_idx" ON "UwSubmission"("assignedRoleId");

-- CreateIndex
CREATE INDEX "UwSubmission_valueStreamNodeId_idx" ON "UwSubmission"("valueStreamNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "UwSubmission_companyId_ref_key" ON "UwSubmission"("companyId", "ref");

-- CreateIndex
CREATE INDEX "UwRiskObject_submissionId_idx" ON "UwRiskObject"("submissionId");

-- CreateIndex
CREATE INDEX "UwRiskObject_companyId_idx" ON "UwRiskObject"("companyId");

-- CreateIndex
CREATE INDEX "UwCoverageRequest_submissionId_idx" ON "UwCoverageRequest"("submissionId");

-- CreateIndex
CREATE INDEX "UwCoverageRequest_companyId_idx" ON "UwCoverageRequest"("companyId");

-- CreateIndex
CREATE INDEX "UwClearanceCheck_submissionId_idx" ON "UwClearanceCheck"("submissionId");

-- CreateIndex
CREATE INDEX "UwClearanceCheck_companyId_verdict_idx" ON "UwClearanceCheck"("companyId", "verdict");

-- CreateIndex
CREATE INDEX "UwEnrichmentSource_companyId_idx" ON "UwEnrichmentSource"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UwEnrichmentSource_companyId_name_key" ON "UwEnrichmentSource"("companyId", "name");

-- CreateIndex
CREATE INDEX "UwEnrichmentRecord_riskObjectId_idx" ON "UwEnrichmentRecord"("riskObjectId");

-- CreateIndex
CREATE INDEX "UwEnrichmentRecord_sourceId_idx" ON "UwEnrichmentRecord"("sourceId");

-- CreateIndex
CREATE INDEX "UwEnrichmentRecord_companyId_idx" ON "UwEnrichmentRecord"("companyId");

-- CreateIndex
CREATE INDEX "UwTriageScore_submissionId_scoredAt_idx" ON "UwTriageScore"("submissionId", "scoredAt");

-- CreateIndex
CREATE INDEX "UwTriageScore_companyId_idx" ON "UwTriageScore"("companyId");

-- CreateIndex
CREATE INDEX "UwAppetiteStatement_companyId_status_idx" ON "UwAppetiteStatement"("companyId", "status");

-- CreateIndex
CREATE INDEX "UwAppetiteStatement_ownerOrgUnitId_idx" ON "UwAppetiteStatement"("ownerOrgUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "UwAppetiteStatement_companyId_ref_version_key" ON "UwAppetiteStatement"("companyId", "ref", "version");

-- CreateIndex
CREATE INDEX "UwGuidelineRule_companyId_status_idx" ON "UwGuidelineRule"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UwGuidelineRule_companyId_ref_version_key" ON "UwGuidelineRule"("companyId", "ref", "version");

-- CreateIndex
CREATE INDEX "UwAuthorityGrant_companyId_status_idx" ON "UwAuthorityGrant"("companyId", "status");

-- CreateIndex
CREATE INDEX "UwAuthorityGrant_roleId_idx" ON "UwAuthorityGrant"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UwAuthorityGrant_companyId_ref_version_key" ON "UwAuthorityGrant"("companyId", "ref", "version");

-- CreateIndex
CREATE INDEX "UwReferralCase_submissionId_idx" ON "UwReferralCase"("submissionId");

-- CreateIndex
CREATE INDEX "UwReferralCase_companyId_status_idx" ON "UwReferralCase"("companyId", "status");

-- CreateIndex
CREATE INDEX "UwReferralCase_escalatedToRoleId_idx" ON "UwReferralCase"("escalatedToRoleId");

-- CreateIndex
CREATE INDEX "UwDecision_submissionId_idx" ON "UwDecision"("submissionId");

-- CreateIndex
CREATE INDEX "UwDecision_companyId_outcome_idx" ON "UwDecision"("companyId", "outcome");

-- CreateIndex
CREATE INDEX "UwDecision_authorityGrantId_idx" ON "UwDecision"("authorityGrantId");

-- CreateIndex
CREATE INDEX "UwQuoteProposal_submissionId_idx" ON "UwQuoteProposal"("submissionId");

-- CreateIndex
CREATE INDEX "UwQuoteProposal_companyId_status_idx" ON "UwQuoteProposal"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UwBindEvent_quoteId_key" ON "UwBindEvent"("quoteId");

-- CreateIndex
CREATE INDEX "UwBindEvent_applicationId_idx" ON "UwBindEvent"("applicationId");

-- CreateIndex
CREATE INDEX "UwBindEvent_companyId_idx" ON "UwBindEvent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UwBindEvent_companyId_correlationId_key" ON "UwBindEvent"("companyId", "correlationId");

-- CreateIndex
CREATE INDEX "UwPasBinding_companyId_idx" ON "UwPasBinding"("companyId");

-- CreateIndex
CREATE INDEX "UwPasBinding_applicationId_idx" ON "UwPasBinding"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "UwPasBinding_submissionId_applicationId_key" ON "UwPasBinding"("submissionId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "UwAgentAction_governanceEventId_key" ON "UwAgentAction"("governanceEventId");

-- CreateIndex
CREATE INDEX "UwAgentAction_companyId_disposition_idx" ON "UwAgentAction"("companyId", "disposition");

-- CreateIndex
CREATE INDEX "UwAgentAction_submissionId_idx" ON "UwAgentAction"("submissionId");

-- CreateIndex
CREATE INDEX "UwGovernanceEvent_companyId_at_idx" ON "UwGovernanceEvent"("companyId", "at");

-- CreateIndex
CREATE INDEX "UwGovernanceEvent_companyId_eventType_idx" ON "UwGovernanceEvent"("companyId", "eventType");

-- CreateIndex
CREATE INDEX "UwGovernanceEvent_correlationId_idx" ON "UwGovernanceEvent"("correlationId");

-- CreateIndex
CREATE INDEX "UwGovernanceEvent_submissionId_idx" ON "UwGovernanceEvent"("submissionId");

-- CreateIndex
CREATE INDEX "UwDivergencePair_companyId_kind_status_idx" ON "UwDivergencePair"("companyId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UwDivergencePair_companyId_ref_key" ON "UwDivergencePair"("companyId", "ref");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_operatingRoleId_fkey" FOREIGN KEY ("operatingRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_managerRoleId_fkey" FOREIGN KEY ("managerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessNode" ADD CONSTRAINT "ProcessNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwAccount" ADD CONSTRAINT "UwAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwSubmission" ADD CONSTRAINT "UwSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwSubmission" ADD CONSTRAINT "UwSubmission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UwAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwSubmission" ADD CONSTRAINT "UwSubmission_assignedRoleId_fkey" FOREIGN KEY ("assignedRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwSubmission" ADD CONSTRAINT "UwSubmission_valueStreamNodeId_fkey" FOREIGN KEY ("valueStreamNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwRiskObject" ADD CONSTRAINT "UwRiskObject_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwCoverageRequest" ADD CONSTRAINT "UwCoverageRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwClearanceCheck" ADD CONSTRAINT "UwClearanceCheck_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwEnrichmentSource" ADD CONSTRAINT "UwEnrichmentSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwEnrichmentRecord" ADD CONSTRAINT "UwEnrichmentRecord_riskObjectId_fkey" FOREIGN KEY ("riskObjectId") REFERENCES "UwRiskObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwEnrichmentRecord" ADD CONSTRAINT "UwEnrichmentRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "UwEnrichmentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwTriageScore" ADD CONSTRAINT "UwTriageScore_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwAppetiteStatement" ADD CONSTRAINT "UwAppetiteStatement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwAppetiteStatement" ADD CONSTRAINT "UwAppetiteStatement_ownerOrgUnitId_fkey" FOREIGN KEY ("ownerOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwGuidelineRule" ADD CONSTRAINT "UwGuidelineRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwAuthorityGrant" ADD CONSTRAINT "UwAuthorityGrant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwAuthorityGrant" ADD CONSTRAINT "UwAuthorityGrant_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwReferralCase" ADD CONSTRAINT "UwReferralCase_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwReferralCase" ADD CONSTRAINT "UwReferralCase_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "UwDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwReferralCase" ADD CONSTRAINT "UwReferralCase_escalatedToRoleId_fkey" FOREIGN KEY ("escalatedToRoleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwDecision" ADD CONSTRAINT "UwDecision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwDecision" ADD CONSTRAINT "UwDecision_authorityGrantId_fkey" FOREIGN KEY ("authorityGrantId") REFERENCES "UwAuthorityGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwDecision" ADD CONSTRAINT "UwDecision_viaStpRuleId_fkey" FOREIGN KEY ("viaStpRuleId") REFERENCES "UwGuidelineRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwQuoteProposal" ADD CONSTRAINT "UwQuoteProposal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwQuoteProposal" ADD CONSTRAINT "UwQuoteProposal_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "UwDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwBindEvent" ADD CONSTRAINT "UwBindEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "UwQuoteProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwBindEvent" ADD CONSTRAINT "UwBindEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwPasBinding" ADD CONSTRAINT "UwPasBinding_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwPasBinding" ADD CONSTRAINT "UwPasBinding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwAgentAction" ADD CONSTRAINT "UwAgentAction_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwAgentAction" ADD CONSTRAINT "UwAgentAction_governanceEventId_fkey" FOREIGN KEY ("governanceEventId") REFERENCES "UwGovernanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwGovernanceEvent" ADD CONSTRAINT "UwGovernanceEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwGovernanceEvent" ADD CONSTRAINT "UwGovernanceEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "UwSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UwDivergencePair" ADD CONSTRAINT "UwDivergencePair_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

