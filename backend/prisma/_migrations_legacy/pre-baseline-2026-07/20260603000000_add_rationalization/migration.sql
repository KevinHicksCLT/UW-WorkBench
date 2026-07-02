-- "Evergreen" Portfolio Rationalization — additive only. (Unrelated DB drift —
-- the orphaned RoleDeliverable table / Role + SubValueStream columns not in the
-- current schema — is intentionally NOT touched here.)

-- CreateTable
CREATE TABLE "RationalizationWorkspace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessProcess" TEXT,
    "description" TEXT,
    "northstar" TEXT,
    "valueStreamId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
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
    "treatment" TEXT NOT NULL DEFAULT 'Retain',
    "migrationStatus" TEXT NOT NULL DEFAULT 'Identified',
    "componentId" TEXT,
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
    "position" INTEGER NOT NULL DEFAULT 0,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationMicroservice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RationalizationWorkspace_companyId_idx" ON "RationalizationWorkspace"("companyId");

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

-- AddForeignKey
ALTER TABLE "RationalizationWorkspace" ADD CONSTRAINT "RationalizationWorkspace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

