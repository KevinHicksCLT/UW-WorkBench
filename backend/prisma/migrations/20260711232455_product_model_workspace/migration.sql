-- AlterTable
ALTER TABLE "RationalizationCapability" ADD COLUMN     "deadCode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "normalizationEntryId" TEXT,
ADD COLUMN     "whyThisMoves" JSONB;

-- AlterTable
ALTER TABLE "RationalizationWorkspace" ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'APPLICATION';

-- CreateTable
CREATE TABLE "NormalizationEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "notation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchStatus" TEXT NOT NULL DEFAULT 'AUTO',
    "matchBasis" TEXT,
    "differenceNote" TEXT,
    "proposedResolution" TEXT,
    "componentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormalizationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceVocabulary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "WorkspaceVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModelWorkspace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "northstar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "layout" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModelWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyProductModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceSystem" TEXT,
    "segment" TEXT,
    "geography" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'Refactor',
    "position" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModelComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "principle" TEXT,
    "canonicalModelId" TEXT,
    "migrationStatus" TEXT NOT NULL DEFAULT 'Identified',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModelComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModelAnatomyCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "view" TEXT NOT NULL DEFAULT 'COMPONENT',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendedComponent" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductModelAnatomyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModelFinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "legacyModelId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'Common',
    "segmentValue" TEXT,
    "geographyValue" TEXT,
    "sourceRef" TEXT,
    "anatomyCategoryId" TEXT,
    "targetComponentId" TEXT,
    "migrationStatus" TEXT NOT NULL DEFAULT 'Identified',
    "normalizationEntryId" TEXT,
    "deadCode" BOOLEAN NOT NULL DEFAULT false,
    "whyThisMoves" JSONB,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModelFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModelNormalizationEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "notation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchStatus" TEXT NOT NULL DEFAULT 'AUTO',
    "matchBasis" TEXT,
    "differenceNote" TEXT,
    "proposedResolution" TEXT,
    "componentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModelNormalizationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalProductModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lineOfBusiness" TEXT,
    "ownerRoleId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NormalizationEntry_companyId_idx" ON "NormalizationEntry"("companyId");

-- CreateIndex
CREATE INDEX "NormalizationEntry_workspaceId_idx" ON "NormalizationEntry"("workspaceId");

-- CreateIndex
CREATE INDEX "NormalizationEntry_componentId_idx" ON "NormalizationEntry"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizationEntry_workspaceId_notation_key" ON "NormalizationEntry"("workspaceId", "notation");

-- CreateIndex
CREATE INDEX "WorkspaceVocabulary_companyId_idx" ON "WorkspaceVocabulary"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceVocabulary_companyId_domain_kind_token_key" ON "WorkspaceVocabulary"("companyId", "domain", "kind", "token");

-- CreateIndex
CREATE INDEX "ProductModelWorkspace_companyId_idx" ON "ProductModelWorkspace"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModelWorkspace_tenantId_companyId_name_key" ON "ProductModelWorkspace"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "LegacyProductModel_companyId_idx" ON "LegacyProductModel"("companyId");

-- CreateIndex
CREATE INDEX "LegacyProductModel_workspaceId_idx" ON "LegacyProductModel"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyProductModel_workspaceId_name_key" ON "LegacyProductModel"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ProductModelComponent_companyId_idx" ON "ProductModelComponent"("companyId");

-- CreateIndex
CREATE INDEX "ProductModelComponent_workspaceId_idx" ON "ProductModelComponent"("workspaceId");

-- CreateIndex
CREATE INDEX "ProductModelComponent_canonicalModelId_idx" ON "ProductModelComponent"("canonicalModelId");

-- CreateIndex
CREATE INDEX "ProductModelAnatomyCategory_companyId_component_idx" ON "ProductModelAnatomyCategory"("companyId", "component");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModelAnatomyCategory_companyId_slug_key" ON "ProductModelAnatomyCategory"("companyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModelAnatomyCategory_companyId_component_scope_view__key" ON "ProductModelAnatomyCategory"("companyId", "component", "scope", "view", "name");

-- CreateIndex
CREATE INDEX "ProductModelFinding_companyId_idx" ON "ProductModelFinding"("companyId");

-- CreateIndex
CREATE INDEX "ProductModelFinding_workspaceId_idx" ON "ProductModelFinding"("workspaceId");

-- CreateIndex
CREATE INDEX "ProductModelFinding_legacyModelId_idx" ON "ProductModelFinding"("legacyModelId");

-- CreateIndex
CREATE INDEX "ProductModelFinding_anatomyCategoryId_idx" ON "ProductModelFinding"("anatomyCategoryId");

-- CreateIndex
CREATE INDEX "ProductModelFinding_targetComponentId_idx" ON "ProductModelFinding"("targetComponentId");

-- CreateIndex
CREATE INDEX "ProductModelFinding_normalizationEntryId_idx" ON "ProductModelFinding"("normalizationEntryId");

-- CreateIndex
CREATE INDEX "ProductModelNormalizationEntry_companyId_idx" ON "ProductModelNormalizationEntry"("companyId");

-- CreateIndex
CREATE INDEX "ProductModelNormalizationEntry_workspaceId_idx" ON "ProductModelNormalizationEntry"("workspaceId");

-- CreateIndex
CREATE INDEX "ProductModelNormalizationEntry_componentId_idx" ON "ProductModelNormalizationEntry"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModelNormalizationEntry_workspaceId_notation_key" ON "ProductModelNormalizationEntry"("workspaceId", "notation");

-- CreateIndex
CREATE INDEX "CanonicalProductModel_companyId_idx" ON "CanonicalProductModel"("companyId");

-- CreateIndex
CREATE INDEX "CanonicalProductModel_workspaceId_idx" ON "CanonicalProductModel"("workspaceId");

-- CreateIndex
CREATE INDEX "CanonicalProductModel_ownerRoleId_idx" ON "CanonicalProductModel"("ownerRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalProductModel_workspaceId_name_key" ON "CanonicalProductModel"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "RationalizationCapability_normalizationEntryId_idx" ON "RationalizationCapability"("normalizationEntryId");

-- AddForeignKey
ALTER TABLE "RationalizationCapability" ADD CONSTRAINT "RationalizationCapability_normalizationEntryId_fkey" FOREIGN KEY ("normalizationEntryId") REFERENCES "NormalizationEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizationEntry" ADD CONSTRAINT "NormalizationEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormalizationEntry" ADD CONSTRAINT "NormalizationEntry_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "RationalizationComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceVocabulary" ADD CONSTRAINT "WorkspaceVocabulary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelWorkspace" ADD CONSTRAINT "ProductModelWorkspace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyProductModel" ADD CONSTRAINT "LegacyProductModel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProductModelWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelComponent" ADD CONSTRAINT "ProductModelComponent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProductModelWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelComponent" ADD CONSTRAINT "ProductModelComponent_canonicalModelId_fkey" FOREIGN KEY ("canonicalModelId") REFERENCES "CanonicalProductModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelAnatomyCategory" ADD CONSTRAINT "ProductModelAnatomyCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelFinding" ADD CONSTRAINT "ProductModelFinding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProductModelWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelFinding" ADD CONSTRAINT "ProductModelFinding_legacyModelId_fkey" FOREIGN KEY ("legacyModelId") REFERENCES "LegacyProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelFinding" ADD CONSTRAINT "ProductModelFinding_anatomyCategoryId_fkey" FOREIGN KEY ("anatomyCategoryId") REFERENCES "ProductModelAnatomyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelFinding" ADD CONSTRAINT "ProductModelFinding_targetComponentId_fkey" FOREIGN KEY ("targetComponentId") REFERENCES "ProductModelComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelFinding" ADD CONSTRAINT "ProductModelFinding_normalizationEntryId_fkey" FOREIGN KEY ("normalizationEntryId") REFERENCES "ProductModelNormalizationEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelNormalizationEntry" ADD CONSTRAINT "ProductModelNormalizationEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProductModelWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelNormalizationEntry" ADD CONSTRAINT "ProductModelNormalizationEntry_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ProductModelComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalProductModel" ADD CONSTRAINT "CanonicalProductModel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProductModelWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalProductModel" ADD CONSTRAINT "CanonicalProductModel_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
