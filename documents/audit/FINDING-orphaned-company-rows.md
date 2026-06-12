# Finding: orphaned rows from deleted companies (Data Admin ↔ DB mismatch)

**Branch:** defect-fixes_01 (Neon br-autumn-star, forked from production). **Date:** 2026-06-09.
**Status:** root-caused; fix not yet applied.

## Symptom
Verifying every Data Admin entity's reported `total` against the DB row count
(`audit/verify-admin-scoping.mjs`), 36 of 41 entities reconcile exactly. **5 do not** —
the DB holds 2×–4× the rows the admin shows:

| Entity | DB rows | Admin (active company) |
|---|---|---|
| program | 12 | 3 |
| workstream | 20 | 5 |
| portfolioInitiative | 20 | 5 |
| deliverable | 882 | 441 |
| task | 10908 | 5454 |

The admin numbers match the live app (Meridian, company `cmpzuwu2900045mhswa9k8j3y`).
**The admin is faithful; the DB carries ghosts.**

## Root cause
The extra rows carry `companyId` values that **don't exist in the Company table**
(all under tenant `cmptzuq0m0000l648mf9cf093`):

- `cmpyu5w520004xs9ygrin80li` — full set incl. deliverables+tasks
- `cmpys7nme00049u8f2k7qpbdi` — program/workstream/portfolioInitiative only
- `cmpytllb60004i6hh49g4eh5r` — program/workstream/portfolioInitiative only

Every company-scoped model declares `company Company @relation(fields:[companyId],
references:[id], onDelete: Cascade)` — **except** `Program` (schema:1078), `Workstream`
(1096), `PortfolioInitiative` (1115), `Deliverable` (1241), `Task` (1261), where
`companyId` is a **bare scalar with no relation and no DB FK**. So when earlier demo
companies were deleted / re-seeded (audit ARCH-12: `company.deleteMany` each run), the
FK-cascade tables cleaned up but these 5 orphaned. Identical per-company counts
(3/5/5/441/5454) are the re-seed fingerprint. **These orphans also exist in production**
(this branch forked from it).

## Fix (two parts, to apply on the dev branch via a versioned migration)
1. **Clean up** the orphaned rows (companyId not in Company). Deleting orphan
   PortfolioInitiatives cascades their BenefitLine/CostLine/MetricValue/Milestone/RaidItem
   (those FKs do cascade).
2. **Prevent recurrence**: add `company Company @relation(..., onDelete: Cascade)` (+ the
   Company back-relations) to all 5 models and a migration adding the FK constraints. The
   constraint add must run **after** the orphan cleanup (orphans would violate the new FK).

Ties to audit A4 (unguarded cascade delete), ARCH-12 (destructive seed), A2 (orphan-row
validation check). Prod stays untouched; migration promoted later via `migrate deploy`.
