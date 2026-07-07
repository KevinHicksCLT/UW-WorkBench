-- AlterTable
ALTER TABLE "RationalizationCapability" ADD COLUMN     "plainSummary" TEXT,
ADD COLUMN     "recommendedLayer" TEXT,
ADD COLUMN     "screenRef" TEXT,
ADD COLUMN     "view" TEXT NOT NULL DEFAULT 'COMPONENT';

-- CreateTable
CREATE TABLE "AnatomyCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendedLayer" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnatomyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SCREEN',
    "url" TEXT,
    "processNodeId" TEXT,

    CONSTRAINT "ScreenAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnatomyCategory_companyId_layer_idx" ON "AnatomyCategory"("companyId", "layer");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyCategory_companyId_layer_view_name_key" ON "AnatomyCategory"("companyId", "layer", "view", "name");

-- CreateIndex
CREATE INDEX "ScreenAsset_companyId_idx" ON "ScreenAsset"("companyId");

-- CreateIndex
CREATE INDEX "ScreenAsset_appId_idx" ON "ScreenAsset"("appId");

-- CreateIndex
CREATE INDEX "ScreenAsset_processNodeId_idx" ON "ScreenAsset"("processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenAsset_workspaceId_name_key" ON "ScreenAsset"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "AnatomyCategory" ADD CONSTRAINT "AnatomyCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenAsset" ADD CONSTRAINT "ScreenAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenAsset" ADD CONSTRAINT "ScreenAsset_appId_fkey" FOREIGN KEY ("appId") REFERENCES "RationalizationApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenAsset" ADD CONSTRAINT "ScreenAsset_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
