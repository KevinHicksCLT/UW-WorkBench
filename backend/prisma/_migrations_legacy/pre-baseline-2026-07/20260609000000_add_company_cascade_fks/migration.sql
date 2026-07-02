-- defect-fixes_01 / task #7 — reconcile Data Admin with the DB.
--
-- Program, Workstream, PortfolioInitiative, Deliverable and Task were the only
-- company-scoped tables WITHOUT a `company` FK (companyId was a bare scalar). So
-- when demo companies were deleted/re-seeded, their rows in these 5 tables were
-- never cascaded — leaving orphans referencing companies that no longer exist.
-- The Data Admin (which filters by the active company) hid them, but the DB held
-- 2x-4x the rows. This migration (1) removes the orphans and (2) adds the missing
-- company FKs with ON DELETE CASCADE so it cannot recur.
--
-- NOTE: applied to the dev branch via raw SQL (`prisma db execute`) rather than
-- `prisma migrate deploy`, because this branch's migration history is out of sync
-- with the repo (see audit/FINDING-orphaned-company-rows.md). Promote to prod the
-- same way after review.

BEGIN;

-- 1. Remove orphaned rows (companyId not present in Company).
--    Deleting orphan Programs cascades Workstream -> PortfolioInitiative ->
--    BenefitLine/CostLine/MetricValue/Milestone/RaidItem (those FKs already
--    cascade). Task.deliverableId is ON DELETE SET NULL, so Task/Deliverable are
--    removed by their own companyId.
DELETE FROM "Task"        WHERE "companyId" NOT IN (SELECT "id" FROM "Company");
DELETE FROM "Deliverable" WHERE "companyId" NOT IN (SELECT "id" FROM "Company");
DELETE FROM "Program"     WHERE "companyId" NOT IN (SELECT "id" FROM "Company");
-- Defensive: any orphan Workstream/PortfolioInitiative not under an orphan Program.
DELETE FROM "PortfolioInitiative" WHERE "companyId" NOT IN (SELECT "id" FROM "Company");
DELETE FROM "Workstream"          WHERE "companyId" NOT IN (SELECT "id" FROM "Company");

-- 2. Add the missing company FKs (ON DELETE CASCADE) so future company deletes
--    clean these tables too.
ALTER TABLE "Program"             ADD CONSTRAINT "Program_companyId_fkey"             FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workstream"          ADD CONSTRAINT "Workstream_companyId_fkey"          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deliverable"         ADD CONSTRAINT "Deliverable_companyId_fkey"         FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task"                ADD CONSTRAINT "Task_companyId_fkey"                FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
