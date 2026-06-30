-- Additive-only: bring new-data-model DB up to the merged (FB-57-62) schema so
-- the backfill scripts can run. ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
-- EXISTS — never drops a column, table, or row. Safe to re-run.
ALTER TABLE "Standard" ADD COLUMN IF NOT EXISTS "testProcedure" TEXT;
ALTER TABLE "Standard" ADD COLUMN IF NOT EXISTS "evidence" TEXT;
ALTER TABLE "RegulatoryRequirement" ADD COLUMN IF NOT EXISTS "agentSkill" TEXT;

CREATE TABLE IF NOT EXISTS "SkillFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SkillFile_companyId_skill_idx" ON "SkillFile"("companyId", "skill");
CREATE UNIQUE INDEX IF NOT EXISTS "SkillFile_companyId_skill_path_key" ON "SkillFile"("companyId", "skill", "path");
