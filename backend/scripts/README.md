# backend/scripts — one-off operational scripts

Manually-run data operations against a live Neon branch: seed variants, backfills,
audits, migrations of data shape (not schema), enrichment runs, and verification
passes. They are **not part of the application runtime** — nothing in `src/` imports
them — and most are one-time jobs kept as a replayable record of how the data got to
its current state (several must be re-run when promoting data changes to another
branch).

## Running one

```bash
cd backend
npx tsx --env-file=.env scripts/<name>.ts     # runs against the branch in .env
```

They import the app's Prisma client as `../src/db/prisma.js` (the `.js` extension on
`.ts` source is the repo-wide ESM convention). Point `.env` at a **feature** Neon
branch first — many scripts write. `scripts/backups/` holds pre-run JSON snapshots
taken by the destructive ones.

## Lint exemption — why

This directory is excluded in `eslint.config.js` (alongside root `scripts/`). These
are historical, single-purpose ops tools: retrofitting hundreds of finished one-shot
scripts to application lint standards adds risk (behavior-altering "fixes" to code
that must replay byte-identically) and no value. The exemption is **only** for this
directory — anything imported by `src/` lives in `src/` and is fully linted. New
scripts should still follow the conventions by hand (typed, tenant-aware, idempotent
where possible, dry-run flag for destructive work).
