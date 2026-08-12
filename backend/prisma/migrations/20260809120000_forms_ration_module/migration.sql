-- CreateTable
CREATE TABLE "PolicyForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lob" TEXT,
    "states" JSONB,
    "editionDate" TEXT,
    "filingStatus" TEXT NOT NULL DEFAULT 'Draft',
    "provenance" TEXT NOT NULL DEFAULT 'client',
    "ownerRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyFormVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "sourceUri" TEXT,
    "sourceText" TEXT NOT NULL,
    "segConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "PolicyFormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormClause" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "heading" TEXT,
    "text" TEXT NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "textHash" TEXT NOT NULL,
    "segConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "FormClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormWorkingSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modeOverride" TEXT,
    "clusterThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
    "clusterStatus" TEXT NOT NULL DEFAULT 'none',
    "clusteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormWorkingSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormWorkingSetMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workingSetId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,

    CONSTRAINT "FormWorkingSetMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClauseCluster" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workingSetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "representativeClauseId" TEXT,
    "divergenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClauseCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClauseClusterMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "outlier" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClauseClusterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormFinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workingSetId" TEXT,
    "clusterId" TEXT,
    "formVersionId" TEXT,
    "subjectKind" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "agentSkill" TEXT NOT NULL DEFAULT 'lexical-cluster-v1',
    "traceRef" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormDisposition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "formId" TEXT,
    "clusterId" TEXT,
    "type" TEXT NOT NULL,
    "targetFormId" TEXT,
    "ownerRoleId" TEXT,
    "rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormDispositionEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dispositionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL DEFAULT 'user',
    "actorId" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormDispositionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferredWording" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "sourceClauseId" TEXT,
    "clauseText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreferredWording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dataSetType" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "acordRef" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'tenant',
    "stability" TEXT NOT NULL DEFAULT 'stable',
    "compositionParts" JSONB,
    "compositionFormat" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "label" TEXT,
    "page" INTEGER NOT NULL DEFAULT 1,
    "widgetType" TEXT NOT NULL DEFAULT 'text',
    "options" JSONB,
    "selectMode" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "formatRule" TEXT,
    "instance" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formFieldId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "nameSim" DOUBLE PRECISION NOT NULL,
    "labelSim" DOUBLE PRECISION NOT NULL,
    "optionOverlap" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "reviewerId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormApplication" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "role_" TEXT NOT NULL DEFAULT 'implementedBy',

    CONSTRAINT "FormApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormProcessNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "role_" TEXT NOT NULL DEFAULT 'servesValueStream',

    CONSTRAINT "FormProcessNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyForm_companyId_idx" ON "PolicyForm"("companyId");

-- CreateIndex
CREATE INDEX "PolicyForm_ownerRoleId_idx" ON "PolicyForm"("ownerRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyForm_companyId_formNumber_key" ON "PolicyForm"("companyId", "formNumber");

-- CreateIndex
CREATE INDEX "PolicyFormVersion_companyId_idx" ON "PolicyFormVersion"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyFormVersion_formId_versionNo_key" ON "PolicyFormVersion"("formId", "versionNo");

-- CreateIndex
CREATE INDEX "FormClause_companyId_idx" ON "FormClause"("companyId");

-- CreateIndex
CREATE INDEX "FormClause_textHash_idx" ON "FormClause"("textHash");

-- CreateIndex
CREATE UNIQUE INDEX "FormClause_formVersionId_ordinal_key" ON "FormClause"("formVersionId", "ordinal");

-- CreateIndex
CREATE INDEX "FormWorkingSet_companyId_idx" ON "FormWorkingSet"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FormWorkingSet_companyId_name_key" ON "FormWorkingSet"("companyId", "name");

-- CreateIndex
CREATE INDEX "FormWorkingSetMember_workingSetId_idx" ON "FormWorkingSetMember"("workingSetId");

-- CreateIndex
CREATE INDEX "FormWorkingSetMember_formVersionId_idx" ON "FormWorkingSetMember"("formVersionId");

-- CreateIndex
CREATE INDEX "FormWorkingSetMember_companyId_workingSetId_idx" ON "FormWorkingSetMember"("companyId", "workingSetId");

-- CreateIndex
CREATE UNIQUE INDEX "FormWorkingSetMember_workingSetId_formVersionId_key" ON "FormWorkingSetMember"("workingSetId", "formVersionId");

-- CreateIndex
CREATE INDEX "ClauseCluster_workingSetId_idx" ON "ClauseCluster"("workingSetId");

-- CreateIndex
CREATE INDEX "ClauseCluster_companyId_idx" ON "ClauseCluster"("companyId");

-- CreateIndex
CREATE INDEX "ClauseCluster_representativeClauseId_idx" ON "ClauseCluster"("representativeClauseId");

-- CreateIndex
CREATE INDEX "ClauseClusterMember_clusterId_idx" ON "ClauseClusterMember"("clusterId");

-- CreateIndex
CREATE INDEX "ClauseClusterMember_clauseId_idx" ON "ClauseClusterMember"("clauseId");

-- CreateIndex
CREATE UNIQUE INDEX "ClauseClusterMember_clusterId_clauseId_key" ON "ClauseClusterMember"("clusterId", "clauseId");

-- CreateIndex
CREATE INDEX "FormFinding_companyId_idx" ON "FormFinding"("companyId");

-- CreateIndex
CREATE INDEX "FormFinding_workingSetId_idx" ON "FormFinding"("workingSetId");

-- CreateIndex
CREATE INDEX "FormFinding_clusterId_idx" ON "FormFinding"("clusterId");

-- CreateIndex
CREATE INDEX "FormFinding_companyId_status_idx" ON "FormFinding"("companyId", "status");

-- CreateIndex
CREATE INDEX "FormDisposition_companyId_idx" ON "FormDisposition"("companyId");

-- CreateIndex
CREATE INDEX "FormDisposition_formId_idx" ON "FormDisposition"("formId");

-- CreateIndex
CREATE INDEX "FormDisposition_clusterId_idx" ON "FormDisposition"("clusterId");

-- CreateIndex
CREATE INDEX "FormDisposition_ownerRoleId_idx" ON "FormDisposition"("ownerRoleId");

-- CreateIndex
CREATE INDEX "FormDispositionEvent_dispositionId_idx" ON "FormDispositionEvent"("dispositionId");

-- CreateIndex
CREATE INDEX "FormDispositionEvent_companyId_idx" ON "FormDispositionEvent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferredWording_clusterId_key" ON "PreferredWording"("clusterId");

-- CreateIndex
CREATE INDEX "PreferredWording_companyId_idx" ON "PreferredWording"("companyId");

-- CreateIndex
CREATE INDEX "PreferredWording_sourceClauseId_idx" ON "PreferredWording"("sourceClauseId");

-- CreateIndex
CREATE INDEX "FieldDefinition_companyId_dataSetType_idx" ON "FieldDefinition"("companyId", "dataSetType");

-- CreateIndex
CREATE UNIQUE INDEX "FieldDefinition_companyId_key_key" ON "FieldDefinition"("companyId", "key");

-- CreateIndex
CREATE INDEX "FormField_companyId_idx" ON "FormField"("companyId");

-- CreateIndex
CREATE INDEX "FormField_formVersionId_idx" ON "FormField"("formVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_formVersionId_sourceName_instance_key" ON "FormField"("formVersionId", "sourceName", "instance");

-- CreateIndex
CREATE INDEX "FieldMapping_formFieldId_idx" ON "FieldMapping"("formFieldId");

-- CreateIndex
CREATE INDEX "FieldMapping_fieldDefinitionId_idx" ON "FieldMapping"("fieldDefinitionId");

-- CreateIndex
CREATE INDEX "FieldMapping_companyId_status_idx" ON "FieldMapping"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FieldMapping_formFieldId_fieldDefinitionId_key" ON "FieldMapping"("formFieldId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "FormApplication_formId_idx" ON "FormApplication"("formId");

-- CreateIndex
CREATE INDEX "FormApplication_applicationId_idx" ON "FormApplication"("applicationId");

-- CreateIndex
CREATE INDEX "FormApplication_companyId_formId_idx" ON "FormApplication"("companyId", "formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormApplication_formId_applicationId_role__key" ON "FormApplication"("formId", "applicationId", "role_");

-- CreateIndex
CREATE INDEX "FormProcessNode_formId_idx" ON "FormProcessNode"("formId");

-- CreateIndex
CREATE INDEX "FormProcessNode_processNodeId_idx" ON "FormProcessNode"("processNodeId");

-- CreateIndex
CREATE INDEX "FormProcessNode_companyId_formId_idx" ON "FormProcessNode"("companyId", "formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormProcessNode_formId_processNodeId_role__key" ON "FormProcessNode"("formId", "processNodeId", "role_");

-- AddForeignKey
ALTER TABLE "PolicyForm" ADD CONSTRAINT "PolicyForm_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyForm" ADD CONSTRAINT "PolicyForm_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyFormVersion" ADD CONSTRAINT "PolicyFormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PolicyForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormClause" ADD CONSTRAINT "FormClause_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "PolicyFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormWorkingSet" ADD CONSTRAINT "FormWorkingSet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormWorkingSetMember" ADD CONSTRAINT "FormWorkingSetMember_workingSetId_fkey" FOREIGN KEY ("workingSetId") REFERENCES "FormWorkingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormWorkingSetMember" ADD CONSTRAINT "FormWorkingSetMember_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "PolicyFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClauseCluster" ADD CONSTRAINT "ClauseCluster_workingSetId_fkey" FOREIGN KEY ("workingSetId") REFERENCES "FormWorkingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClauseCluster" ADD CONSTRAINT "ClauseCluster_representativeClauseId_fkey" FOREIGN KEY ("representativeClauseId") REFERENCES "FormClause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClauseClusterMember" ADD CONSTRAINT "ClauseClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClauseCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClauseClusterMember" ADD CONSTRAINT "ClauseClusterMember_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "FormClause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormFinding" ADD CONSTRAINT "FormFinding_workingSetId_fkey" FOREIGN KEY ("workingSetId") REFERENCES "FormWorkingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormFinding" ADD CONSTRAINT "FormFinding_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClauseCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormFinding" ADD CONSTRAINT "FormFinding_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "PolicyFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDisposition" ADD CONSTRAINT "FormDisposition_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PolicyForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDisposition" ADD CONSTRAINT "FormDisposition_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClauseCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDisposition" ADD CONSTRAINT "FormDisposition_targetFormId_fkey" FOREIGN KEY ("targetFormId") REFERENCES "PolicyForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDisposition" ADD CONSTRAINT "FormDisposition_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDispositionEvent" ADD CONSTRAINT "FormDispositionEvent_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "FormDisposition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferredWording" ADD CONSTRAINT "PreferredWording_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ClauseCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferredWording" ADD CONSTRAINT "PreferredWording_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "FormClause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefinition" ADD CONSTRAINT "FieldDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "PolicyFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldMapping" ADD CONSTRAINT "FieldMapping_formFieldId_fkey" FOREIGN KEY ("formFieldId") REFERENCES "FormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldMapping" ADD CONSTRAINT "FieldMapping_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "FieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormApplication" ADD CONSTRAINT "FormApplication_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PolicyForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormApplication" ADD CONSTRAINT "FormApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormProcessNode" ADD CONSTRAINT "FormProcessNode_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PolicyForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormProcessNode" ADD CONSTRAINT "FormProcessNode_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

