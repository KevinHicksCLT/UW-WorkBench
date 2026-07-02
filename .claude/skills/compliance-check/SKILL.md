---
name: compliance-check
description: Run every quality gate for this repo and report pass/fail compliance status — lint, typecheck, unit tests + coverage, build, and (when servers are running) the E2E smoke + API-body baseline diff. Use when asked to "check compliance", "run the gates", "is this ready to merge", or before any PR/push.
---

# Compliance check

Run the gates IN THIS ORDER (fail fast), from the repo root. Report each as ✅/❌ with
the failure output quoted exactly; never claim a gate passed without running it.

## Static gates (always runnable)

```bash
npm run lint             # eslint . --max-warnings 0 — zero errors AND zero warnings
npm run typecheck        # tsc --noEmit, backend + frontend (strict, covers tests/)
npm run test:coverage    # vitest both workspaces — green + thresholds met
npm run build -w cascade-frontend   # vite production build succeeds
```

If the backend dev server is running, `prisma generate` (part of the root `build`
script) fails on a locked query-engine DLL on Windows — build the frontend workspace
directly as above and note it, don't report a false failure.

## Runtime gates (need backend :4000 + frontend :5173 + seeded Neon branch)

```bash
npx playwright test      # 18-route smoke: every route renders, no 5xx, no blank screens
cd documents/refactor-baseline && bash capture-api.sh api-after && node diff-api.mjs
                         # every captured API body deep-equal to the committed baseline
```

Skip (and say so) if servers aren't running — don't start destructive infrastructure
to satisfy a report.

## Standards conformance (spot checks, on the diff being reviewed)

- No file over 500 lines: `git diff --stat` targets, or a line-count sweep.
- No `any` / `@ts-ignore` introduced (lint catches, but check suppressions).
- Frontend: new UI composed from `components/ui/` (see **frontend-standards**).
- Backend: feature-module routes, tenant scoping, resolvers, no per-row fan-out
  (see **backend-standards**).
- Tests mirrored under `tests/`, not colocated (see **testing-standards**).
- Schema touched? Migration present + erd_v5.mmd updated (see **db-migrations-workflow**).

## Report format

One table: gate → status → evidence (time, counts, or exact error). End with a single
verdict: COMPLIANT / NOT COMPLIANT (+ blocking items).
