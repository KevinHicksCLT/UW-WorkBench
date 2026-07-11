---
name: db-migrations-workflow
description: Database schema-change workflow — migrations only (db push is banned), 0_baseline squash context, one-command environment setup, erd_v5.mmd sync. Use whenever changing backend/prisma/schema.prisma, applying schema to any Neon branch, or standing up a fresh database environment.
---

# DB migrations workflow (established by the 2026-07 refactor; see ADR-001)

## The one rule

**Schema changes happen ONLY through version-controlled migrations.**

```bash
# after editing backend/prisma/schema.prisma:
npm run db:migrate -w cascade-backend        # prisma migrate dev — generates + applies + commits a migration
```

`prisma db push` is **banned** (the npm script was removed): it bypasses the ledger and
silently DROPs columns under drift — documented incident history in this repo.

## Baseline context (do not re-learn this the hard way)

Migration history was **squashed to `backend/prisma/migrations/0_baseline/`** on
2026-07-02 (pre-squash history archived in `backend/prisma/_migrations_legacy/`).
Environments created BEFORE the squash have no `_prisma_migrations` ledger and need a
one-time resolve before their first `migrate deploy`:

```bash
cd backend
DATABASE_URL=<direct-url> DIRECT_URL=<direct-url> npx prisma migrate resolve --applied 0_baseline
```

Status per branch: `refactor` ✅ resolved · `develop` / `production` ⚠ pending — the
step is part of the cutover runbook (`documents/refactor/CUTOVER.md`). Neon branches
forked AFTER a resolved parent inherit the ledger automatically.

Vercel's `vercel-build` runs `prisma migrate deploy`; the `Promote` workflow applies
migrations to the target Neon branch on merge (see `.github/workflows/promote.yml`).

## Whole-dataset promotions (data, not schema)

Migrations move schema + SQL-encoded data changes. When a branch's **dataset** is the
deliverable (reseed, bulk enrichment), promote it through the pipeline by ENDING the merge commit title with `[promote-data]` (mid-sentence mentions do not trigger): the `data-promote` stage
(scripts/neon-data-promote.mjs) restores the target Neon branch from the source
(feature → develop on develop merges; develop → production on master merges), with the
prior state auto-preserved as `backup/<target>-<sha>`. Never restore branches by hand
in the console for promotions — use the marker so the operation is logged, backed up,
and ordered before migrate/deploy/smoke.

## Fresh environment / new developer

```bash
npm run db:setup -w cascade-backend   # prisma generate + migrate deploy + seed
```

## Every schema change also requires

1. `documents/value-streams/Master Documentation/erd_v5.mmd` updated in the same PR —
   schema and ERD stay in lockstep (the **db-data-model** skill governs HOW to model:
   generic typed graph, junctions not bespoke tables, FKs not free text).
2. Indexes for any new FK or hot where-clause column (`@@index`) — Postgres does not
   auto-index FKs.
3. For Neon branch operations (create/seed/promote/delete), use the
   **session-flow** skill and `scripts/neon-*.mjs` — data-loss footguns.
