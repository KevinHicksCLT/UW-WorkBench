-- ProgramResource + PortfolioInitiative.charter.
-- Written idempotently: earlier `[promote-data]` promotions restored datasets
-- (pg_dump/pg_restore) that already carried these objects into develop, so on
-- some environments they pre-exist; this migration must succeed both there
-- and on branches where they don't.

-- AlterTable
ALTER TABLE "PortfolioInitiative" ADD COLUMN IF NOT EXISTS "charter" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProgramResource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleType" TEXT,
    "rate" DOUBLE PRECISION,
    "rollOn" TIMESTAMP(3),
    "rollOff" TIMESTAMP(3),
    "monthAmounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProgramResource_companyId_programId_idx" ON "ProgramResource"("companyId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramResource_programId_name_key" ON "ProgramResource"("programId", "name");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgramResource_programId_fkey') THEN
        ALTER TABLE "ProgramResource" ADD CONSTRAINT "ProgramResource_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
