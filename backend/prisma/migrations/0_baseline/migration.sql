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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "dbValue" TEXT,
    "displayValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dashboardConfig" JSONB,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgLevelType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgLevelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgLevelTypeId" TEXT NOT NULL,
    "parentId" TEXT,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnitClosure" (
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "OrgUnitClosure_pkey" PRIMARY KEY ("ancestorId","descendantId")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "managerRoleId" TEXT,
    "jobDescription" TEXT,
    "roleType" TEXT,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleDottedLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "managerRoleId" TEXT NOT NULL,

    CONSTRAINT "RoleDottedLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleOrgAssignment" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoleOrgAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessLevelType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessLevelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processLevelTypeId" TEXT NOT NULL,
    "parentId" TEXT,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "description" TEXT,
    "isTask" BOOLEAN NOT NULL DEFAULT false,
    "automatability" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessNodeClosure" (
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "ProcessNodeClosure_pkey" PRIMARY KEY ("ancestorId","descendantId")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "automatability" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "roleId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestingTemplate" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "taskNodeId" TEXT,
    "system" TEXT,
    "location" TEXT,
    "checkType" TEXT,
    "expected" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isArea" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "department" TEXT,
    "category" TEXT,
    "description" TEXT,
    "buildRun" TEXT,
    "ownerRoleId" TEXT,
    "appliesToValueStreams" TEXT,
    "link" TEXT,
    "mission" TEXT,
    "scope" TEXT,
    "charterIncluded" BOOLEAN,
    "ownerLabel" TEXT,
    "relatedRole" TEXT,
    "relatedCategory" TEXT,
    "agentSkill" TEXT,
    "sdlcGates" TEXT,
    "regCitation" TEXT,
    "testProcedure" TEXT,
    "evidence" TEXT,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'Tool',
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "ownershipModel" TEXT,
    "licenseCost" DOUBLE PRECISION,
    "laborCost" DOUBLE PRECISION,
    "vendorServicesCost" DOUBLE PRECISION,
    "infraCost" DOUBLE PRECISION,
    "depreciationCost" DOUBLE PRECISION,
    "overheadCost" DOUBLE PRECISION,
    "totalTco" DOUBLE PRECISION,
    "code" TEXT,
    "systemOfRecord" BOOLEAN,
    "criticality" TEXT NOT NULL DEFAULT 'Medium',
    "category" TEXT,
    "vendor" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "syncDirection" TEXT DEFAULT 'in',
    "changeDetection" TEXT DEFAULT 'delta',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeDeliverable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,

    CONSTRAINT "NodeDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleDeliverable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "role_" TEXT NOT NULL,

    CONSTRAINT "RoleDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeRole" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "role_" TEXT NOT NULL,
    "ownerLevel" TEXT,

    CONSTRAINT "NodeRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeAppUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "usageType" TEXT NOT NULL,

    CONSTRAINT "NodeAppUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeChecklist" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,

    CONSTRAINT "NodeChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeStandard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NodeStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleStandard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,

    CONSTRAINT "RoleStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardDeliverable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,

    CONSTRAINT "StandardDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeRegulation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'GOVERNS',
    "notes" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationApplication" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "evidenceRef" TEXT,

    CONSTRAINT "RegulationApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleRegulation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "role_" TEXT NOT NULL,

    CONSTRAINT "RoleRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationDeliverable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,

    CONSTRAINT "RegulationDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTemplateKey" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guidance" TEXT,
    "valueKind" TEXT NOT NULL DEFAULT 'TEXT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkTemplateKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeWorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "NodeWorkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardWorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "StandardWorkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationWorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "RegulationWorkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeTemplateAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "templateKeyId" TEXT,
    "customKey" TEXT,
    "kind" TEXT,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeTemplateAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardTemplateAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "templateKeyId" TEXT,
    "customKey" TEXT,
    "kind" TEXT,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandardTemplateAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationTemplateAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "templateKeyId" TEXT,
    "customKey" TEXT,
    "kind" TEXT,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulationTemplateAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeStandardEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeStandardEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeRegulationEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeRegulationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeInitiative" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,

    CONSTRAINT "NodeInitiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT,
    "orgUnitId" TEXT,
    "roleId" TEXT,
    "applicationId" TEXT,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "period" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalParty" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalInteraction" (
    "id" TEXT NOT NULL,
    "roleId" TEXT,
    "externalPartyId" TEXT NOT NULL,
    "processNodeId" TEXT,
    "nature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "taskNodeId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Terminology" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terminology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorRoleId" TEXT,
    "processNodeId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "diff" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "roleId" TEXT,
    "scope" TEXT NOT NULL,
    "prefsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeAiAdoption" (
    "id" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "aiAssist" TEXT NOT NULL DEFAULT 'not_used',
    "aiAugment" TEXT NOT NULL DEFAULT 'not_used',
    "aiWorkflow" TEXT NOT NULL DEFAULT 'not_used',
    "aiAutonomous" TEXT NOT NULL DEFAULT 'not_used',
    "useCases" JSONB,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeAiAdoption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetrySignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "frequency" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'up',
    "origin" TEXT,
    "queryType" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemetrySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "changeType" TEXT,
    "impactScope" TEXT,
    "orgUnitId" TEXT,
    "processNodeId" TEXT,
    "application" TEXT,
    "roleImpact" TEXT,
    "oneTimeCost" DOUBLE PRECISION,
    "annualBenefit" DOUBLE PRECISION,
    "annualAddedCost" DOUBLE PRECISION,
    "annualNetImpact" DOUBLE PRECISION,
    "confidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisStatus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "plannedDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "statusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workstream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "statusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioInitiative" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'IDEA',
    "workflowAction" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PLANNING',
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "statusNote" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "valueStreamNodeId" TEXT,
    "orgUnitId" TEXT,
    "ownerRoleId" TEXT,
    "sponsorRoleId" TEXT,
    "cumulativeBenefit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cumulativeCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cumulativeNetBenefit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "complexityScore" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "valueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioInitiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "raisedBy" TEXT NOT NULL,
    "costImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scheduleImpactDays" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitLine" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenefitLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostLine" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricValue" (
    "id" TEXT NOT NULL,
    "benefitLineId" TEXT,
    "costLineId" TEXT,
    "dataset" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MetricValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScoringBand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskScoringBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicObjective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategicObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeObjective" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitiativeObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeResource" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "roleId" TEXT,
    "name" TEXT NOT NULL,
    "allocationPct" INTEGER NOT NULL DEFAULT 50,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitiativeResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkplanActivity" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "assignedTo" TEXT,
    "dependsOnId" TEXT,
    "dependencyType" TEXT,
    "dependencyRefId" TEXT,
    "dependencyLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkplanActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "isGate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidItem" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "severity" INTEGER NOT NULL DEFAULT 9,
    "mitigation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerRoleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RationalizationWorkspace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "application" TEXT,
    "stageOrder" INTEGER NOT NULL DEFAULT 0,
    "businessProcess" TEXT,
    "description" TEXT,
    "northstar" TEXT,
    "valueStreamNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "layout" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RationalizationApp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'Refactor',
    "techStack" TEXT,
    "vendor" TEXT,
    "hosting" TEXT,
    "criticality" TEXT,
    "ageYears" INTEGER,
    "annualCost" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RationalizationComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "principle" TEXT,
    "pattern" TEXT,
    "targetTech" TEXT,
    "destination" TEXT,
    "microserviceId" TEXT,
    "migrationStatus" TEXT NOT NULL DEFAULT 'Identified',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RationalizationCapability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "capdan" TEXT NOT NULL DEFAULT 'Common',
    "targetLayer" TEXT,
    "treatment" TEXT NOT NULL DEFAULT 'Retain',
    "migrationStatus" TEXT NOT NULL DEFAULT 'Identified',
    "componentId" TEXT,
    "codeRef" TEXT,
    "migrationApproach" TEXT,
    "targetTech" TEXT,
    "rationale" TEXT,
    "effort" TEXT,
    "complexity" TEXT,
    "notes" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RationalizationMicroservice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'Microservice',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "techStack" TEXT,
    "ownerRoleId" TEXT,
    "repo" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationMicroservice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RationalizationPlanStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "wave" INTEGER NOT NULL DEFAULT 1,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "ownerRoleId" TEXT,
    "targetWindow" TEXT,
    "effortWeeks" INTEGER,
    "dependsOn" TEXT,
    "deliverables" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
    "regime" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'BASELINE',
    "sourceNote" TEXT,
    "agentSkill" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_tenantId_slug_key" ON "Company"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "OrgLevelType_companyId_idx" ON "OrgLevelType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgLevelType_companyId_levelNumber_key" ON "OrgLevelType"("companyId", "levelNumber");

-- CreateIndex
CREATE INDEX "OrgUnit_companyId_orgLevelTypeId_idx" ON "OrgUnit"("companyId", "orgLevelTypeId");

-- CreateIndex
CREATE INDEX "OrgUnit_parentId_idx" ON "OrgUnit"("parentId");

-- CreateIndex
CREATE INDEX "OrgUnitClosure_descendantId_depth_idx" ON "OrgUnitClosure"("descendantId", "depth");

-- CreateIndex
CREATE INDEX "OrgUnitClosure_ancestorId_depth_idx" ON "OrgUnitClosure"("ancestorId", "depth");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE INDEX "Role_orgUnitId_idx" ON "Role"("orgUnitId");

-- CreateIndex
CREATE INDEX "Role_managerRoleId_idx" ON "Role"("managerRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_dbValue_key" ON "Role"("companyId", "dbValue");

-- CreateIndex
CREATE INDEX "RoleDottedLine_roleId_idx" ON "RoleDottedLine"("roleId");

-- CreateIndex
CREATE INDEX "RoleDottedLine_managerRoleId_idx" ON "RoleDottedLine"("managerRoleId");

-- CreateIndex
CREATE INDEX "RoleDottedLine_companyId_roleId_idx" ON "RoleDottedLine"("companyId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDottedLine_roleId_managerRoleId_key" ON "RoleDottedLine"("roleId", "managerRoleId");

-- CreateIndex
CREATE INDEX "RoleOrgAssignment_roleId_idx" ON "RoleOrgAssignment"("roleId");

-- CreateIndex
CREATE INDEX "RoleOrgAssignment_orgUnitId_idx" ON "RoleOrgAssignment"("orgUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleOrgAssignment_roleId_orgUnitId_key" ON "RoleOrgAssignment"("roleId", "orgUnitId");

-- CreateIndex
CREATE INDEX "ProcessLevelType_companyId_idx" ON "ProcessLevelType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessLevelType_companyId_levelNumber_key" ON "ProcessLevelType"("companyId", "levelNumber");

-- CreateIndex
CREATE INDEX "ProcessNode_companyId_processLevelTypeId_idx" ON "ProcessNode"("companyId", "processLevelTypeId");

-- CreateIndex
CREATE INDEX "ProcessNode_parentId_idx" ON "ProcessNode"("parentId");

-- CreateIndex
CREATE INDEX "ProcessNodeClosure_descendantId_depth_idx" ON "ProcessNodeClosure"("descendantId", "depth");

-- CreateIndex
CREATE INDEX "ProcessNodeClosure_ancestorId_depth_idx" ON "ProcessNodeClosure"("ancestorId", "depth");

-- CreateIndex
CREATE INDEX "Deliverable_companyId_idx" ON "Deliverable"("companyId");

-- CreateIndex
CREATE INDEX "Checklist_companyId_idx" ON "Checklist"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "ChecklistItem_roleId_idx" ON "ChecklistItem"("roleId");

-- CreateIndex
CREATE INDEX "TestingTemplate_deliverableId_idx" ON "TestingTemplate"("deliverableId");

-- CreateIndex
CREATE INDEX "TestingTemplate_taskNodeId_idx" ON "TestingTemplate"("taskNodeId");

-- CreateIndex
CREATE INDEX "Standard_companyId_idx" ON "Standard"("companyId");

-- CreateIndex
CREATE INDEX "Standard_companyId_isArea_idx" ON "Standard"("companyId", "isArea");

-- CreateIndex
CREATE INDEX "Standard_parentId_idx" ON "Standard"("parentId");

-- CreateIndex
CREATE INDEX "Standard_ownerRoleId_idx" ON "Standard"("ownerRoleId");

-- CreateIndex
CREATE INDEX "Application_companyId_idx" ON "Application"("companyId");

-- CreateIndex
CREATE INDEX "Application_orgUnitId_idx" ON "Application"("orgUnitId");

-- CreateIndex
CREATE INDEX "Application_sourceId_idx" ON "Application"("sourceId");

-- CreateIndex
CREATE INDEX "IntegrationSource_companyId_idx" ON "IntegrationSource"("companyId");

-- CreateIndex
CREATE INDEX "NodeDeliverable_processNodeId_idx" ON "NodeDeliverable"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeDeliverable_deliverableId_idx" ON "NodeDeliverable"("deliverableId");

-- CreateIndex
CREATE INDEX "NodeDeliverable_companyId_processNodeId_idx" ON "NodeDeliverable"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeDeliverable_processNodeId_deliverableId_key" ON "NodeDeliverable"("processNodeId", "deliverableId");

-- CreateIndex
CREATE INDEX "RoleDeliverable_roleId_idx" ON "RoleDeliverable"("roleId");

-- CreateIndex
CREATE INDEX "RoleDeliverable_deliverableId_idx" ON "RoleDeliverable"("deliverableId");

-- CreateIndex
CREATE INDEX "RoleDeliverable_companyId_roleId_idx" ON "RoleDeliverable"("companyId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDeliverable_roleId_deliverableId_role__key" ON "RoleDeliverable"("roleId", "deliverableId", "role_");

-- CreateIndex
CREATE INDEX "NodeRole_processNodeId_idx" ON "NodeRole"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeRole_roleId_idx" ON "NodeRole"("roleId");

-- CreateIndex
CREATE INDEX "NodeRole_companyId_processNodeId_idx" ON "NodeRole"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeRole_processNodeId_roleId_role__key" ON "NodeRole"("processNodeId", "roleId", "role_");

-- CreateIndex
CREATE INDEX "NodeAppUsage_processNodeId_idx" ON "NodeAppUsage"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeAppUsage_applicationId_idx" ON "NodeAppUsage"("applicationId");

-- CreateIndex
CREATE INDEX "NodeAppUsage_companyId_processNodeId_idx" ON "NodeAppUsage"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeAppUsage_processNodeId_applicationId_usageType_key" ON "NodeAppUsage"("processNodeId", "applicationId", "usageType");

-- CreateIndex
CREATE INDEX "NodeChecklist_processNodeId_idx" ON "NodeChecklist"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeChecklist_checklistItemId_idx" ON "NodeChecklist"("checklistItemId");

-- CreateIndex
CREATE INDEX "NodeChecklist_companyId_processNodeId_idx" ON "NodeChecklist"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeChecklist_processNodeId_checklistItemId_key" ON "NodeChecklist"("processNodeId", "checklistItemId");

-- CreateIndex
CREATE INDEX "NodeStandard_processNodeId_idx" ON "NodeStandard"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeStandard_standardId_idx" ON "NodeStandard"("standardId");

-- CreateIndex
CREATE INDEX "NodeStandard_companyId_processNodeId_idx" ON "NodeStandard"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeStandard_processNodeId_standardId_key" ON "NodeStandard"("processNodeId", "standardId");

-- CreateIndex
CREATE INDEX "RoleStandard_roleId_idx" ON "RoleStandard"("roleId");

-- CreateIndex
CREATE INDEX "RoleStandard_standardId_idx" ON "RoleStandard"("standardId");

-- CreateIndex
CREATE INDEX "RoleStandard_companyId_roleId_idx" ON "RoleStandard"("companyId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleStandard_roleId_standardId_key" ON "RoleStandard"("roleId", "standardId");

-- CreateIndex
CREATE INDEX "StandardDeliverable_standardId_idx" ON "StandardDeliverable"("standardId");

-- CreateIndex
CREATE INDEX "StandardDeliverable_deliverableId_idx" ON "StandardDeliverable"("deliverableId");

-- CreateIndex
CREATE INDEX "StandardDeliverable_companyId_standardId_idx" ON "StandardDeliverable"("companyId", "standardId");

-- CreateIndex
CREATE UNIQUE INDEX "StandardDeliverable_standardId_deliverableId_key" ON "StandardDeliverable"("standardId", "deliverableId");

-- CreateIndex
CREATE INDEX "NodeRegulation_processNodeId_idx" ON "NodeRegulation"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeRegulation_regId_idx" ON "NodeRegulation"("regId");

-- CreateIndex
CREATE INDEX "NodeRegulation_companyId_processNodeId_idx" ON "NodeRegulation"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeRegulation_processNodeId_regId_key" ON "NodeRegulation"("processNodeId", "regId");

-- CreateIndex
CREATE INDEX "RegulationApplication_regId_idx" ON "RegulationApplication"("regId");

-- CreateIndex
CREATE INDEX "RegulationApplication_applicationId_idx" ON "RegulationApplication"("applicationId");

-- CreateIndex
CREATE INDEX "RegulationApplication_companyId_regId_idx" ON "RegulationApplication"("companyId", "regId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationApplication_regId_applicationId_key" ON "RegulationApplication"("regId", "applicationId");

-- CreateIndex
CREATE INDEX "RoleRegulation_roleId_idx" ON "RoleRegulation"("roleId");

-- CreateIndex
CREATE INDEX "RoleRegulation_regId_idx" ON "RoleRegulation"("regId");

-- CreateIndex
CREATE INDEX "RoleRegulation_companyId_regId_idx" ON "RoleRegulation"("companyId", "regId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleRegulation_roleId_regId_role__key" ON "RoleRegulation"("roleId", "regId", "role_");

-- CreateIndex
CREATE INDEX "RegulationDeliverable_regId_idx" ON "RegulationDeliverable"("regId");

-- CreateIndex
CREATE INDEX "RegulationDeliverable_deliverableId_idx" ON "RegulationDeliverable"("deliverableId");

-- CreateIndex
CREATE INDEX "RegulationDeliverable_companyId_regId_idx" ON "RegulationDeliverable"("companyId", "regId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationDeliverable_regId_deliverableId_key" ON "RegulationDeliverable"("regId", "deliverableId");

-- CreateIndex
CREATE INDEX "WorkTemplate_companyId_kind_idx" ON "WorkTemplate"("companyId", "kind");

-- CreateIndex
CREATE INDEX "WorkTemplateKey_templateId_idx" ON "WorkTemplateKey"("templateId");

-- CreateIndex
CREATE INDEX "NodeWorkTemplate_processNodeId_idx" ON "NodeWorkTemplate"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeWorkTemplate_templateId_idx" ON "NodeWorkTemplate"("templateId");

-- CreateIndex
CREATE INDEX "NodeWorkTemplate_companyId_processNodeId_idx" ON "NodeWorkTemplate"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeWorkTemplate_processNodeId_templateId_key" ON "NodeWorkTemplate"("processNodeId", "templateId");

-- CreateIndex
CREATE INDEX "StandardWorkTemplate_standardId_idx" ON "StandardWorkTemplate"("standardId");

-- CreateIndex
CREATE INDEX "StandardWorkTemplate_templateId_idx" ON "StandardWorkTemplate"("templateId");

-- CreateIndex
CREATE INDEX "StandardWorkTemplate_companyId_standardId_idx" ON "StandardWorkTemplate"("companyId", "standardId");

-- CreateIndex
CREATE UNIQUE INDEX "StandardWorkTemplate_standardId_templateId_key" ON "StandardWorkTemplate"("standardId", "templateId");

-- CreateIndex
CREATE INDEX "RegulationWorkTemplate_regId_idx" ON "RegulationWorkTemplate"("regId");

-- CreateIndex
CREATE INDEX "RegulationWorkTemplate_templateId_idx" ON "RegulationWorkTemplate"("templateId");

-- CreateIndex
CREATE INDEX "RegulationWorkTemplate_companyId_regId_idx" ON "RegulationWorkTemplate"("companyId", "regId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationWorkTemplate_regId_templateId_key" ON "RegulationWorkTemplate"("regId", "templateId");

-- CreateIndex
CREATE INDEX "NodeTemplateAnswer_processNodeId_idx" ON "NodeTemplateAnswer"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeTemplateAnswer_templateKeyId_idx" ON "NodeTemplateAnswer"("templateKeyId");

-- CreateIndex
CREATE INDEX "NodeTemplateAnswer_companyId_processNodeId_idx" ON "NodeTemplateAnswer"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeTemplateAnswer_processNodeId_templateKeyId_key" ON "NodeTemplateAnswer"("processNodeId", "templateKeyId");

-- CreateIndex
CREATE INDEX "StandardTemplateAnswer_standardId_idx" ON "StandardTemplateAnswer"("standardId");

-- CreateIndex
CREATE INDEX "StandardTemplateAnswer_templateKeyId_idx" ON "StandardTemplateAnswer"("templateKeyId");

-- CreateIndex
CREATE INDEX "StandardTemplateAnswer_companyId_standardId_idx" ON "StandardTemplateAnswer"("companyId", "standardId");

-- CreateIndex
CREATE UNIQUE INDEX "StandardTemplateAnswer_standardId_templateKeyId_key" ON "StandardTemplateAnswer"("standardId", "templateKeyId");

-- CreateIndex
CREATE INDEX "RegulationTemplateAnswer_regId_idx" ON "RegulationTemplateAnswer"("regId");

-- CreateIndex
CREATE INDEX "RegulationTemplateAnswer_templateKeyId_idx" ON "RegulationTemplateAnswer"("templateKeyId");

-- CreateIndex
CREATE INDEX "RegulationTemplateAnswer_companyId_regId_idx" ON "RegulationTemplateAnswer"("companyId", "regId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulationTemplateAnswer_regId_templateKeyId_key" ON "RegulationTemplateAnswer"("regId", "templateKeyId");

-- CreateIndex
CREATE INDEX "NodeStandardEvidence_processNodeId_idx" ON "NodeStandardEvidence"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeStandardEvidence_standardId_idx" ON "NodeStandardEvidence"("standardId");

-- CreateIndex
CREATE INDEX "NodeStandardEvidence_companyId_processNodeId_idx" ON "NodeStandardEvidence"("companyId", "processNodeId");

-- CreateIndex
CREATE INDEX "NodeRegulationEvidence_processNodeId_idx" ON "NodeRegulationEvidence"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeRegulationEvidence_regId_idx" ON "NodeRegulationEvidence"("regId");

-- CreateIndex
CREATE INDEX "NodeRegulationEvidence_companyId_processNodeId_idx" ON "NodeRegulationEvidence"("companyId", "processNodeId");

-- CreateIndex
CREATE INDEX "Initiative_companyId_idx" ON "Initiative"("companyId");

-- CreateIndex
CREATE INDEX "NodeInitiative_processNodeId_idx" ON "NodeInitiative"("processNodeId");

-- CreateIndex
CREATE INDEX "NodeInitiative_initiativeId_idx" ON "NodeInitiative"("initiativeId");

-- CreateIndex
CREATE INDEX "NodeInitiative_companyId_processNodeId_idx" ON "NodeInitiative"("companyId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeInitiative_processNodeId_initiativeId_key" ON "NodeInitiative"("processNodeId", "initiativeId");

-- CreateIndex
CREATE INDEX "Metric_companyId_idx" ON "Metric"("companyId");

-- CreateIndex
CREATE INDEX "Metric_processNodeId_idx" ON "Metric"("processNodeId");

-- CreateIndex
CREATE INDEX "Metric_orgUnitId_idx" ON "Metric"("orgUnitId");

-- CreateIndex
CREATE INDEX "Metric_roleId_idx" ON "Metric"("roleId");

-- CreateIndex
CREATE INDEX "Metric_applicationId_idx" ON "Metric"("applicationId");

-- CreateIndex
CREATE INDEX "ExternalParty_companyId_idx" ON "ExternalParty"("companyId");

-- CreateIndex
CREATE INDEX "ExternalInteraction_roleId_idx" ON "ExternalInteraction"("roleId");

-- CreateIndex
CREATE INDEX "ExternalInteraction_externalPartyId_idx" ON "ExternalInteraction"("externalPartyId");

-- CreateIndex
CREATE INDEX "ExternalInteraction_processNodeId_idx" ON "ExternalInteraction"("processNodeId");

-- CreateIndex
CREATE INDEX "KnowledgeBase_companyId_idx" ON "KnowledgeBase"("companyId");

-- CreateIndex
CREATE INDEX "AgentSkill_knowledgeBaseId_idx" ON "AgentSkill"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "AgentSkill_taskNodeId_idx" ON "AgentSkill"("taskNodeId");

-- CreateIndex
CREATE INDEX "SkillFile_companyId_skill_idx" ON "SkillFile"("companyId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "SkillFile_companyId_skill_path_key" ON "SkillFile"("companyId", "skill", "path");

-- CreateIndex
CREATE INDEX "Terminology_companyId_idx" ON "Terminology"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Terminology_companyId_entity_dbValue_key" ON "Terminology"("companyId", "entity", "dbValue");

-- CreateIndex
CREATE INDEX "AuditEntry_entityType_entityId_idx" ON "AuditEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEntry_actorRoleId_idx" ON "AuditEntry"("actorRoleId");

-- CreateIndex
CREATE INDEX "AuditEntry_processNodeId_idx" ON "AuditEntry"("processNodeId");

-- CreateIndex
CREATE INDEX "UserPreference_roleId_idx" ON "UserPreference"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeAiAdoption_processNodeId_key" ON "NodeAiAdoption"("processNodeId");

-- CreateIndex
CREATE INDEX "TelemetrySignal_companyId_idx" ON "TelemetrySignal"("companyId");

-- CreateIndex
CREATE INDEX "Scenario_companyId_idx" ON "Scenario"("companyId");

-- CreateIndex
CREATE INDEX "Scenario_orgUnitId_idx" ON "Scenario"("orgUnitId");

-- CreateIndex
CREATE INDEX "Scenario_processNodeId_idx" ON "Scenario"("processNodeId");

-- CreateIndex
CREATE INDEX "AnalysisStatus_companyId_idx" ON "AnalysisStatus"("companyId");

-- CreateIndex
CREATE INDEX "AnalysisStatus_subjectId_idx" ON "AnalysisStatus"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisStatus_companyId_subjectType_subjectId_key" ON "AnalysisStatus"("companyId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "Program_companyId_idx" ON "Program"("companyId");

-- CreateIndex
CREATE INDEX "Workstream_companyId_idx" ON "Workstream"("companyId");

-- CreateIndex
CREATE INDEX "Workstream_programId_idx" ON "Workstream"("programId");

-- CreateIndex
CREATE INDEX "PortfolioInitiative_companyId_idx" ON "PortfolioInitiative"("companyId");

-- CreateIndex
CREATE INDEX "PortfolioInitiative_workstreamId_idx" ON "PortfolioInitiative"("workstreamId");

-- CreateIndex
CREATE INDEX "PortfolioInitiative_companyId_valueStreamNodeId_idx" ON "PortfolioInitiative"("companyId", "valueStreamNodeId");

-- CreateIndex
CREATE INDEX "PortfolioInitiative_companyId_orgUnitId_idx" ON "PortfolioInitiative"("companyId", "orgUnitId");

-- CreateIndex
CREATE INDEX "PortfolioInitiative_ownerRoleId_idx" ON "PortfolioInitiative"("ownerRoleId");

-- CreateIndex
CREATE INDEX "PortfolioInitiative_sponsorRoleId_idx" ON "PortfolioInitiative"("sponsorRoleId");

-- CreateIndex
CREATE INDEX "ChangeRequest_initiativeId_idx" ON "ChangeRequest"("initiativeId");

-- CreateIndex
CREATE INDEX "BenefitLine_initiativeId_idx" ON "BenefitLine"("initiativeId");

-- CreateIndex
CREATE INDEX "CostLine_initiativeId_idx" ON "CostLine"("initiativeId");

-- CreateIndex
CREATE INDEX "MetricValue_benefitLineId_dataset_periodStart_idx" ON "MetricValue"("benefitLineId", "dataset", "periodStart");

-- CreateIndex
CREATE INDEX "MetricValue_costLineId_dataset_periodStart_idx" ON "MetricValue"("costLineId", "dataset", "periodStart");

-- CreateIndex
CREATE INDEX "RiskScoringBand_companyId_idx" ON "RiskScoringBand"("companyId");

-- CreateIndex
CREATE INDEX "StrategicObjective_companyId_idx" ON "StrategicObjective"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeObjective_initiativeId_objectiveId_key" ON "InitiativeObjective"("initiativeId", "objectiveId");

-- CreateIndex
CREATE INDEX "InitiativeResource_initiativeId_idx" ON "InitiativeResource"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeResource_roleId_idx" ON "InitiativeResource"("roleId");

-- CreateIndex
CREATE INDEX "WorkplanActivity_initiativeId_idx" ON "WorkplanActivity"("initiativeId");

-- CreateIndex
CREATE INDEX "Milestone_initiativeId_idx" ON "Milestone"("initiativeId");

-- CreateIndex
CREATE INDEX "RaidItem_initiativeId_idx" ON "RaidItem"("initiativeId");

-- CreateIndex
CREATE INDEX "RaidItem_ownerRoleId_idx" ON "RaidItem"("ownerRoleId");

-- CreateIndex
CREATE INDEX "RationalizationWorkspace_companyId_idx" ON "RationalizationWorkspace"("companyId");

-- CreateIndex
CREATE INDEX "RationalizationWorkspace_valueStreamNodeId_idx" ON "RationalizationWorkspace"("valueStreamNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "RationalizationWorkspace_tenantId_companyId_name_key" ON "RationalizationWorkspace"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "RationalizationApp_companyId_idx" ON "RationalizationApp"("companyId");

-- CreateIndex
CREATE INDEX "RationalizationApp_workspaceId_idx" ON "RationalizationApp"("workspaceId");

-- CreateIndex
CREATE INDEX "RationalizationComponent_companyId_idx" ON "RationalizationComponent"("companyId");

-- CreateIndex
CREATE INDEX "RationalizationComponent_workspaceId_idx" ON "RationalizationComponent"("workspaceId");

-- CreateIndex
CREATE INDEX "RationalizationComponent_microserviceId_idx" ON "RationalizationComponent"("microserviceId");

-- CreateIndex
CREATE INDEX "RationalizationCapability_companyId_idx" ON "RationalizationCapability"("companyId");

-- CreateIndex
CREATE INDEX "RationalizationCapability_workspaceId_idx" ON "RationalizationCapability"("workspaceId");

-- CreateIndex
CREATE INDEX "RationalizationCapability_appId_idx" ON "RationalizationCapability"("appId");

-- CreateIndex
CREATE INDEX "RationalizationCapability_componentId_idx" ON "RationalizationCapability"("componentId");

-- CreateIndex
CREATE INDEX "RationalizationMicroservice_companyId_idx" ON "RationalizationMicroservice"("companyId");

-- CreateIndex
CREATE INDEX "RationalizationMicroservice_workspaceId_idx" ON "RationalizationMicroservice"("workspaceId");

-- CreateIndex
CREATE INDEX "RationalizationMicroservice_ownerRoleId_idx" ON "RationalizationMicroservice"("ownerRoleId");

-- CreateIndex
CREATE INDEX "RationalizationPlanStep_companyId_idx" ON "RationalizationPlanStep"("companyId");

-- CreateIndex
CREATE INDEX "RationalizationPlanStep_workspaceId_idx" ON "RationalizationPlanStep"("workspaceId");

-- CreateIndex
CREATE INDEX "RationalizationPlanStep_workspaceId_wave_sequence_idx" ON "RationalizationPlanStep"("workspaceId", "wave", "sequence");

-- CreateIndex
CREATE INDEX "RationalizationPlanStep_ownerRoleId_idx" ON "RationalizationPlanStep"("ownerRoleId");

-- CreateIndex
CREATE INDEX "Jurisdiction_companyId_idx" ON "Jurisdiction"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_companyId_code_key" ON "Jurisdiction"("companyId", "code");

-- CreateIndex
CREATE INDEX "IntegrationSystem_companyId_idx" ON "IntegrationSystem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSystem_companyId_name_key" ON "IntegrationSystem"("companyId", "name");

-- CreateIndex
CREATE INDEX "JurisdictionIntegration_jurisdictionId_idx" ON "JurisdictionIntegration"("jurisdictionId");

-- CreateIndex
CREATE INDEX "JurisdictionIntegration_systemId_idx" ON "JurisdictionIntegration"("systemId");

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionIntegration_jurisdictionId_systemId_scope_key" ON "JurisdictionIntegration"("jurisdictionId", "systemId", "scope");

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_companyId_idx" ON "RegulatoryRequirement"("companyId");

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_jurisdictionId_idx" ON "RegulatoryRequirement"("jurisdictionId");

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_companyId_category_idx" ON "RegulatoryRequirement"("companyId", "category");

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_companyId_status_idx" ON "RegulatoryRequirement"("companyId", "status");

-- CreateIndex
CREATE INDEX "RegulatoryBulletin_companyId_idx" ON "RegulatoryBulletin"("companyId");

-- CreateIndex
CREATE INDEX "RegulatoryBulletin_jurisdictionId_idx" ON "RegulatoryBulletin"("jurisdictionId");

-- CreateIndex
CREATE INDEX "ComplianceRule_companyId_idx" ON "ComplianceRule"("companyId");

-- CreateIndex
CREATE INDEX "ComplianceRule_jurisdictionId_idx" ON "ComplianceRule"("jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRule_companyId_ruleCode_key" ON "ComplianceRule"("companyId", "ruleCode");

-- CreateIndex
CREATE INDEX "RegulatorySource_companyId_idx" ON "RegulatorySource"("companyId");

-- CreateIndex
CREATE INDEX "RegulatorySource_jurisdictionId_idx" ON "RegulatorySource"("jurisdictionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgLevelType" ADD CONSTRAINT "OrgLevelType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_orgLevelTypeId_fkey" FOREIGN KEY ("orgLevelTypeId") REFERENCES "OrgLevelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnitClosure" ADD CONSTRAINT "OrgUnitClosure_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnitClosure" ADD CONSTRAINT "OrgUnitClosure_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_managerRoleId_fkey" FOREIGN KEY ("managerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDottedLine" ADD CONSTRAINT "RoleDottedLine_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDottedLine" ADD CONSTRAINT "RoleDottedLine_managerRoleId_fkey" FOREIGN KEY ("managerRoleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleOrgAssignment" ADD CONSTRAINT "RoleOrgAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleOrgAssignment" ADD CONSTRAINT "RoleOrgAssignment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessLevelType" ADD CONSTRAINT "ProcessLevelType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessNode" ADD CONSTRAINT "ProcessNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessNode" ADD CONSTRAINT "ProcessNode_processLevelTypeId_fkey" FOREIGN KEY ("processLevelTypeId") REFERENCES "ProcessLevelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessNode" ADD CONSTRAINT "ProcessNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessNodeClosure" ADD CONSTRAINT "ProcessNodeClosure_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessNodeClosure" ADD CONSTRAINT "ProcessNodeClosure_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestingTemplate" ADD CONSTRAINT "TestingTemplate_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestingTemplate" ADD CONSTRAINT "TestingTemplate_taskNodeId_fkey" FOREIGN KEY ("taskNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standard" ADD CONSTRAINT "Standard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standard" ADD CONSTRAINT "Standard_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standard" ADD CONSTRAINT "Standard_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntegrationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSource" ADD CONSTRAINT "IntegrationSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeDeliverable" ADD CONSTRAINT "NodeDeliverable_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeDeliverable" ADD CONSTRAINT "NodeDeliverable_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDeliverable" ADD CONSTRAINT "RoleDeliverable_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDeliverable" ADD CONSTRAINT "RoleDeliverable_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRole" ADD CONSTRAINT "NodeRole_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRole" ADD CONSTRAINT "NodeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeAppUsage" ADD CONSTRAINT "NodeAppUsage_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeAppUsage" ADD CONSTRAINT "NodeAppUsage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeChecklist" ADD CONSTRAINT "NodeChecklist_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeChecklist" ADD CONSTRAINT "NodeChecklist_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeStandard" ADD CONSTRAINT "NodeStandard_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeStandard" ADD CONSTRAINT "NodeStandard_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleStandard" ADD CONSTRAINT "RoleStandard_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleStandard" ADD CONSTRAINT "RoleStandard_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardDeliverable" ADD CONSTRAINT "StandardDeliverable_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardDeliverable" ADD CONSTRAINT "StandardDeliverable_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRegulation" ADD CONSTRAINT "NodeRegulation_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRegulation" ADD CONSTRAINT "NodeRegulation_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationApplication" ADD CONSTRAINT "RegulationApplication_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationApplication" ADD CONSTRAINT "RegulationApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRegulation" ADD CONSTRAINT "RoleRegulation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRegulation" ADD CONSTRAINT "RoleRegulation_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationDeliverable" ADD CONSTRAINT "RegulationDeliverable_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationDeliverable" ADD CONSTRAINT "RegulationDeliverable_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTemplate" ADD CONSTRAINT "WorkTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTemplateKey" ADD CONSTRAINT "WorkTemplateKey_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeWorkTemplate" ADD CONSTRAINT "NodeWorkTemplate_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeWorkTemplate" ADD CONSTRAINT "NodeWorkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardWorkTemplate" ADD CONSTRAINT "StandardWorkTemplate_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardWorkTemplate" ADD CONSTRAINT "StandardWorkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationWorkTemplate" ADD CONSTRAINT "RegulationWorkTemplate_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationWorkTemplate" ADD CONSTRAINT "RegulationWorkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeTemplateAnswer" ADD CONSTRAINT "NodeTemplateAnswer_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeTemplateAnswer" ADD CONSTRAINT "NodeTemplateAnswer_templateKeyId_fkey" FOREIGN KEY ("templateKeyId") REFERENCES "WorkTemplateKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeTemplateAnswer" ADD CONSTRAINT "NodeTemplateAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeTemplateAnswer" ADD CONSTRAINT "NodeTemplateAnswer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeTemplateAnswer" ADD CONSTRAINT "NodeTemplateAnswer_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardTemplateAnswer" ADD CONSTRAINT "StandardTemplateAnswer_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardTemplateAnswer" ADD CONSTRAINT "StandardTemplateAnswer_templateKeyId_fkey" FOREIGN KEY ("templateKeyId") REFERENCES "WorkTemplateKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardTemplateAnswer" ADD CONSTRAINT "StandardTemplateAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardTemplateAnswer" ADD CONSTRAINT "StandardTemplateAnswer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardTemplateAnswer" ADD CONSTRAINT "StandardTemplateAnswer_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationTemplateAnswer" ADD CONSTRAINT "RegulationTemplateAnswer_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationTemplateAnswer" ADD CONSTRAINT "RegulationTemplateAnswer_templateKeyId_fkey" FOREIGN KEY ("templateKeyId") REFERENCES "WorkTemplateKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationTemplateAnswer" ADD CONSTRAINT "RegulationTemplateAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationTemplateAnswer" ADD CONSTRAINT "RegulationTemplateAnswer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationTemplateAnswer" ADD CONSTRAINT "RegulationTemplateAnswer_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeStandardEvidence" ADD CONSTRAINT "NodeStandardEvidence_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeStandardEvidence" ADD CONSTRAINT "NodeStandardEvidence_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeStandardEvidence" ADD CONSTRAINT "NodeStandardEvidence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeStandardEvidence" ADD CONSTRAINT "NodeStandardEvidence_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeStandardEvidence" ADD CONSTRAINT "NodeStandardEvidence_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRegulationEvidence" ADD CONSTRAINT "NodeRegulationEvidence_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRegulationEvidence" ADD CONSTRAINT "NodeRegulationEvidence_regId_fkey" FOREIGN KEY ("regId") REFERENCES "RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRegulationEvidence" ADD CONSTRAINT "NodeRegulationEvidence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRegulationEvidence" ADD CONSTRAINT "NodeRegulationEvidence_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRegulationEvidence" ADD CONSTRAINT "NodeRegulationEvidence_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeInitiative" ADD CONSTRAINT "NodeInitiative_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeInitiative" ADD CONSTRAINT "NodeInitiative_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalParty" ADD CONSTRAINT "ExternalParty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalInteraction" ADD CONSTRAINT "ExternalInteraction_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalInteraction" ADD CONSTRAINT "ExternalInteraction_externalPartyId_fkey" FOREIGN KEY ("externalPartyId") REFERENCES "ExternalParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalInteraction" ADD CONSTRAINT "ExternalInteraction_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_taskNodeId_fkey" FOREIGN KEY ("taskNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillFile" ADD CONSTRAINT "SkillFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminology" ADD CONSTRAINT "Terminology_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorRoleId_fkey" FOREIGN KEY ("actorRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeAiAdoption" ADD CONSTRAINT "NodeAiAdoption_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetrySignal" ADD CONSTRAINT "TelemetrySignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisStatus" ADD CONSTRAINT "AnalysisStatus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_valueStreamNodeId_fkey" FOREIGN KEY ("valueStreamNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_sponsorRoleId_fkey" FOREIGN KEY ("sponsorRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitLine" ADD CONSTRAINT "BenefitLine_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_benefitLineId_fkey" FOREIGN KEY ("benefitLineId") REFERENCES "BenefitLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_costLineId_fkey" FOREIGN KEY ("costLineId") REFERENCES "CostLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoringBand" ADD CONSTRAINT "RiskScoringBand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeObjective" ADD CONSTRAINT "InitiativeObjective_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeObjective" ADD CONSTRAINT "InitiativeObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "StrategicObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeResource" ADD CONSTRAINT "InitiativeResource_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeResource" ADD CONSTRAINT "InitiativeResource_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkplanActivity" ADD CONSTRAINT "WorkplanActivity_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkplanActivity" ADD CONSTRAINT "WorkplanActivity_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "WorkplanActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidItem" ADD CONSTRAINT "RaidItem_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidItem" ADD CONSTRAINT "RaidItem_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationWorkspace" ADD CONSTRAINT "RationalizationWorkspace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationWorkspace" ADD CONSTRAINT "RationalizationWorkspace_valueStreamNodeId_fkey" FOREIGN KEY ("valueStreamNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationApp" ADD CONSTRAINT "RationalizationApp_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationComponent" ADD CONSTRAINT "RationalizationComponent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationComponent" ADD CONSTRAINT "RationalizationComponent_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "RationalizationMicroservice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationCapability" ADD CONSTRAINT "RationalizationCapability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationCapability" ADD CONSTRAINT "RationalizationCapability_appId_fkey" FOREIGN KEY ("appId") REFERENCES "RationalizationApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationCapability" ADD CONSTRAINT "RationalizationCapability_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "RationalizationComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationMicroservice" ADD CONSTRAINT "RationalizationMicroservice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationMicroservice" ADD CONSTRAINT "RationalizationMicroservice_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationPlanStep" ADD CONSTRAINT "RationalizationPlanStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RationalizationPlanStep" ADD CONSTRAINT "RationalizationPlanStep_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jurisdiction" ADD CONSTRAINT "Jurisdiction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSystem" ADD CONSTRAINT "IntegrationSystem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionIntegration" ADD CONSTRAINT "JurisdictionIntegration_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisdictionIntegration" ADD CONSTRAINT "JurisdictionIntegration_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "IntegrationSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryRequirement" ADD CONSTRAINT "RegulatoryRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryRequirement" ADD CONSTRAINT "RegulatoryRequirement_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryBulletin" ADD CONSTRAINT "RegulatoryBulletin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryBulletin" ADD CONSTRAINT "RegulatoryBulletin_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryBulletin" ADD CONSTRAINT "RegulatoryBulletin_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RegulatoryRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

