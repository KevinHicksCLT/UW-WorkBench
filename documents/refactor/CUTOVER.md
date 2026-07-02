# Refactor Cutover Runbook (Charter Task 19)

Big-bang cutover of the `refactor` branch. The old system stays deployable throughout;
rollback is a redeploy of the previous `develop`/`master` commit plus (only if a
migration ran) a Neon point-in-time restore.

## Pre-merge verification gate (must all pass)

1. `npm run lint` — zero errors/warnings.
2. `npm run typecheck` — clean.
3. `npm run test:coverage` — green, thresholds met.
4. `npm run build` — succeeds.
5. Behavioral baseline diff:
   - Backend + frontend running locally against the `refactor` Neon branch.
   - `cd documents/refactor-baseline && bash capture-api.sh api-after && node diff-api.mjs`
     → every endpoint body deep-equal to `api-before/`.
   - `npx playwright test` → 18/18 routes render, no 5xx.
   - Screenshots in `screens-after/` visually match `screens-before/`.

## Cutover: refactor → develop

1. Open a PR `refactor` → `develop`; review; CI green.
2. **One-time baseline resolve** on the Neon `develop` branch (it has no
   `_prisma_migrations` ledger — the repo's migration history was squashed to
   `0_baseline`, see ADR-001):
   ```bash
   cd backend
   DATABASE_URL=<develop-direct-url> DIRECT_URL=<develop-direct-url> \
     npx prisma migrate resolve --applied 0_baseline
   ```
   (The `develop` schema is identical to the baseline — verified by
   `prisma migrate diff` returning empty during the refactor.)
3. Merge. Vercel builds the develop deployment (`vercel-build` runs
   `prisma migrate deploy`, a no-op after step 2). The `Promote` workflow smoke-checks
   `/api/health` and the SPA shell.
4. Verify the develop URL manually against the baseline screenshots.
5. Delete the `refactor` git branch and the `refactor` Neon branch
   (`node scripts/neon-branch-cleanup.mjs refactor`).

## Cutover: develop → master (production)

1. Repeat the baseline-resolve one-time step against the Neon `production` branch.
2. PR `develop` → `master`; CI green; merge.
3. `Promote` workflow migrates + smoke-checks production.
4. Watch `/api/health` and error logs for the first hour.

## Rollback

- **Code:** redeploy the previous commit from Vercel's deployment list (instant), or
  `git revert` the merge commit and push.
- **Database:** the baseline resolve writes only to `_prisma_migrations` (no schema
  change) — nothing to roll back. If a future migration misbehaves: Neon point-in-time
  restore of the branch to the pre-deploy timestamp (Console → branch → Restore), then
  redeploy the previous commit.
- The old application remains deployable at all times because no destructive schema
  change ships in this refactor (verified: `prisma migrate diff` between the refactor
  schema and develop/production is empty apart from bookkeeping).

## Feature freeze

While `refactor` is open, changes to `develop` must be logged in
`documents/refactor/DRIFT-LOG.md` and replicated onto `refactor` before merge.
(As of 2026-07-02 there are none — `refactor` was cut from `develop` HEAD `5d75e81`.)
