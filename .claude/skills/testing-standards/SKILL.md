---
name: testing-standards
description: Testing standards for this repo — mirrored tests/ tree (never colocated), meaningful behavior assertions, coverage thresholds as a gate, which suites to run for which change. Use whenever writing/modifying tests, adding source files that need coverage, or deciding how to verify a change.
---

# Testing standards (established by the 2026-07 refactor)

## Layout — mirrored, never colocated

Tests live in a separate tree mirroring the source path exactly:

```
backend/src/lib/resolvers/ancestorNames.ts → backend/tests/lib/resolvers/ancestorNames.test.ts
frontend/src/components/ui/Button.tsx      → frontend/tests/components/ui/Button.test.tsx
```

`*.test.ts(x)` files inside `src/` are a defect. Both `tsconfig.json`s include
`tests/`, so the strict typecheck gate covers test code too.

## What to test (and what not)

- **Meaningful behavior assertions only** — no coverage-padding. A test that would
  still pass after the bug you're guarding against is not a test.
- Backend unit scope: `src/lib/**` + `src/middleware/**` — prisma is ALWAYS mocked
  (`vi.mock`); unit tests never touch the network or DB.
- Frontend unit scope: `src/lib/**` + `src/components/ui/**`. The ui suites freeze the
  byte-identical class-string contract — assert EXACT `className` output.
- Route handlers, pages, seeds: covered by the E2E smoke suite (`npm run e2e`, needs
  both dev servers + seeded DB) and the API-body baseline diff
  (`documents/refactor-baseline/capture-api.sh` + `diff-api.mjs`) — not by unit tests.
- Pure static data files (glossary, admin catalogs) are excluded from coverage with a
  rationale comment — keep it that way; don't "test" data.

## Gates

- `npm run test:coverage` (both workspaces) must stay green — thresholds live in the
  `vitest.config.ts` files (80% lines/functions/statements, 70% branches on the
  measured scope). **Never lower thresholds** to pass; write tests or honestly adjust
  the measured scope with a comment.
- New module in a measured scope → mirrored test file in the same PR.
- CI runs lint → typecheck → test:coverage → build on every push (`ci.yml`); a red
  gate blocks merge. Don't bypass hooks (`--no-verify` is banned).

## Verifying app behavior beyond units

Behavior-affecting changes are verified against the running app: log in
(kevin.hicks@capgemini.com / demo1234), curl the endpoint or drive the browser, and for
UI changes run `npx playwright test` (18-route smoke). If an endpoint is in the
baseline capture list, its body must stay deep-equal.
