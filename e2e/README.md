# E2E smoke suite

Playwright suite that logs in as the seeded admin and walks **every top-level route**
of the app. Each route must render without console errors or failed API calls and must
produce a non-trivial DOM; a full-page screenshot is written per route. It is both the
regression smoke test and the **behavioral-baseline harness** from the refactor
charter (Task 19) — before/after screenshot sets are compared during big changes (see
`documents/refactor-baseline/BASELINE.md`).

## Prerequisites

The suite drives a **running app** — it does not start servers itself:

1. Backend on :4000 — `npm run dev:backend`
2. Frontend on :5173 — `npm run dev:frontend`
3. A **seeded database** (the Neon branch in `backend/.env`), so the demo login
   `kevin.hicks@capgemini.com` / `demo1234` works. Fresh DB:
   `npm run db:setup -w cascade-backend`.

## Run

```bash
npm run e2e                       # from the repo root — playwright test
SCREEN_DIR=e2e/screens-after npm run e2e    # redirect screenshot output
```

- Config: `playwright.config.ts` at the repo root (`testDir: ./e2e`, single worker,
  baseURL http://localhost:5173, 1600×900 viewport).
- Screenshots default to `e2e/screens/` (gitignored); baseline captures live under
  `documents/refactor-baseline/screens-before/`.

## Extending

New top-level page? Add it to the `ROUTES` array in `smoke.spec.ts` (path + name +
optional `readySelector` for pages whose content loads late). Deeper user journeys
(drill-downs, CRUD flows) belong in new `*.spec.ts` files in this directory — keep the
smoke spec fast and route-per-entry.
