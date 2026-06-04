-- Application-specific rationalization detail — additive only. (Unrelated DB
-- drift — orphaned RoleDeliverable table / Role + SubValueStream columns not in
-- the current schema — is intentionally NOT touched here.)

-- AlterTable: legacy-app profile
ALTER TABLE "RationalizationApp" ADD COLUMN     "ageYears" INTEGER,
ADD COLUMN     "annualCost" DOUBLE PRECISION,
ADD COLUMN     "criticality" TEXT,
ADD COLUMN     "hosting" TEXT,
ADD COLUMN     "techStack" TEXT,
ADD COLUMN     "vendor" TEXT;

-- AlterTable: capability decomposition detail
ALTER TABLE "RationalizationCapability" ADD COLUMN     "complexity" TEXT,
ADD COLUMN     "effort" TEXT,
ADD COLUMN     "rationale" TEXT,
ADD COLUMN     "targetTech" TEXT;

-- AlterTable: CAPDAN component target pattern/tech
ALTER TABLE "RationalizationComponent" ADD COLUMN     "pattern" TEXT,
ADD COLUMN     "targetTech" TEXT;

-- AlterTable: green-field service profile
ALTER TABLE "RationalizationMicroservice" ADD COLUMN     "ownerRole" TEXT,
ADD COLUMN     "repo" TEXT,
ADD COLUMN     "techStack" TEXT;

-- CreateTable: migration plan steps (waves)
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
    "ownerRole" TEXT,
    "targetWindow" TEXT,
    "effortWeeks" INTEGER,
    "dependsOn" TEXT,
    "deliverables" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RationalizationPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RationalizationPlanStep_companyId_idx" ON "RationalizationPlanStep"("companyId");

-- CreateIndex
CREATE INDEX "RationalizationPlanStep_workspaceId_idx" ON "RationalizationPlanStep"("workspaceId");

-- CreateIndex
CREATE INDEX "RationalizationPlanStep_workspaceId_wave_sequence_idx" ON "RationalizationPlanStep"("workspaceId", "wave", "sequence");

-- AddForeignKey
ALTER TABLE "RationalizationPlanStep" ADD CONSTRAINT "RationalizationPlanStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "RationalizationWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
