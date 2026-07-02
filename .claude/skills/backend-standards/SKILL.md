---
name: backend-standards
description: Backend coding standards for this repo — routes/<feature>/ module pattern, resolvers as the only derivation layer, tenant scoping on every query, pino structured logging, zod validation, no any, no per-row query fan-out. Use whenever creating or modifying anything under backend/src (routes, services, lib, middleware).
---

# Backend standards (established by the 2026-07 refactor)

Violating any of these is a review-blocking defect.

## 1. Router layout

Big features are directories: `routes/<feature>/index.ts` applies the middleware stack
(`requireAuth`, `cacheResponses(ms)`, `requireRole` where needed) and calls
`register*Routes(router)` from sibling modules. Existing examples: `portfolio/`,
`explorer/`, `inspector/`, `work-library/`, `admin/`, `regulations/`.

- New endpoint → the matching module; shared logic → `<feature>/helpers.ts` or `lib/`.
- **No file over 500 lines.** Registration ORDER matters (specific routes before
  `/:param` catch-alls) — preserve it when moving handlers.
- Handler pattern: zod-validate the body inline, tenant-scope every query,
  `try/catch (e) { next(e) }` — the central handler in `app.ts` formats errors.

## 2. Queries — batch, never fan out

- Derivations (location strings, ancestry, role/app rollups) come ONLY from
  `lib/resolvers/` (`ancestorNames`, `streamAncestry`, `rolesForNodes` — note its
  opt-in `withOrgUnit` — `appsForNodes`, `processSubtree`, `structureCounts`,
  `linkNames`). Never re-walk closures by hand, never denormalize onto rows.
- Batch junctions with one `{ id: { in: ids } }` query, aggregate in memory.
  **Per-row `await` inside a loop is a defect.** Parallelize independent queries with
  `Promise.all`. Every `findMany` carries a minimal `select` projection.
- Raw SQL only where the ORM genuinely can't express it (closure CTEs, batch rollups);
  always parameterized (`Prisma.sql` / `$queryRaw` template).

## 3. Tenancy

`requireAuth` sets `req.tenantId` from the JWT — never trust the body. Every query
walks to the tenant (`company: { tenantId }` or deeper traversal). Cross-tenant or
missing → **404, not 403**.

## 4. Observability

Structured logging via pino (`lib/logger.ts`) — **never `console.log` in backend/src**.
Requests are auto-logged with tenantId + request id (echoed as `X-Request-Id`). Errors
reach the central handler with full context; response error shape stays `{ error }`.

## 5. Type safety, lint, tests

- TS strict; **no `any`**, no `@ts-ignore`. ESM imports keep the `.js` extension.
- `npm run lint` (zero warnings) + `npm run typecheck` must pass.
- Logic in `lib/`/`middleware/` requires mirrored tests in `backend/tests/**`
  (prisma mocked — unit tests never hit the DB); coverage thresholds enforced.
- API response bodies are contract: if an endpoint is covered by
  `documents/refactor-baseline/`, verify bodies stay deep-equal
  (`capture-api.sh` + `diff-api.mjs`) after touching it.
