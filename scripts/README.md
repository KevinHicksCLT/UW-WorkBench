# scripts — pipeline & verification helpers

Repo-level helper scripts (Node `.mjs`, no dependencies beyond `fetch`). Like
`backend/scripts/`, this directory is lint-exempt in `eslint.config.js` — operational
tooling, not application code.

## Promotion pipeline (charter Task 21 — used by `.github/workflows/promote.yml`)

| Script | Purpose |
| --- | --- |
| `deploy-smoke.mjs <url>` | Polls a deployment until the SPA shell and `/api/health` answer; exits non-zero (failing the pipeline) if unhealthy within 5 min. |
| `neon-branch-create.mjs <branch>` | Creates the Neon DB branch for a new git feature branch (same name, forked from `develop` with data + migration ledger) and prints the `backend/.env` connection strings. Needs `NEON_API_KEY` + `NEON_PROJECT_ID`. |
| `neon-branch-cleanup.mjs [branch]` | Deletes the Neon branch matching a just-merged feature branch (name parsed from the merge commit when run in CI). Protected names are never deleted. |
| `neon-prune-branches.mjs [--apply]` | Hygiene: prunes Neon branches down to the canonical keepers (`production`, `develop`, open-PR previews), leaf-first. Dry-run by default. |

Neon branch lifecycle rules (what may be created/promoted/deleted, and in what order)
are documented in `docs/DB-GIT-FLOW.md`.

## Browser verification one-offs

`check-*.mjs` are Playwright-driven spot checks written to verify specific past fixes
(sidebar behavior, deep-link filters, org list/map sync, dead cells). Each file's
header comment says what it asserts and how to run it (`node scripts/<name>.mjs`,
app running locally). They are point-in-time tools — prefer adding coverage to
`e2e/smoke.spec.ts` for anything that should stay verified.

`mark-defects-complete.py` — one-off updater for the defect-tracker workbook in
`documents/`.
