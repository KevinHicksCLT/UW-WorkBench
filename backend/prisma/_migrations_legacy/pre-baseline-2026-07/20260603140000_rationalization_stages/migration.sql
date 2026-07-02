-- Value-stream stages + CAPDAN finding classification — additive only.
-- (Unrelated DB drift is intentionally NOT touched here.)

-- AlterTable: workspace becomes a value-stream stage in an application's chevron flow
ALTER TABLE "RationalizationWorkspace" ADD COLUMN     "application" TEXT,
ADD COLUMN     "stageOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: capability becomes a classified finding (CAPDAN + relocation + code)
ALTER TABLE "RationalizationCapability" ADD COLUMN     "capdan" TEXT NOT NULL DEFAULT 'Common',
ADD COLUMN     "category" TEXT,
ADD COLUMN     "codeRef" TEXT,
ADD COLUMN     "migrationApproach" TEXT,
ADD COLUMN     "targetLayer" TEXT;
