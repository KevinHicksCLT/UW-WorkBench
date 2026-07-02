# cascade-backend

Express + Prisma API for the Transformation Bridge platform. TypeScript, ESM, executed
directly by `tsx` (no build step). Serves on **:4000** in dev; on Vercel it runs as the
`/api` service (`vercel.json` `experimentalServices`, prefix stripped before Express —
so **all routers mount at the root**: `/roles`, not `/api/roles`).

## Run

```bash
npm run dev:backend                    # from the repo root — tsx watch src/index.ts
npm run db:setup   -w cascade-backend  # fresh DB: prisma generate → migrate deploy → seed
npm run db:migrate -w cascade-backend  # create/apply a migration (prisma migrate dev)
npm run db:seed    -w cascade-backend  # reseed only
npm run db:studio  -w cascade-backend  # Prisma Studio
```

Configuration comes from `backend/.env` (copy `.env.example`): `DATABASE_URL` (Neon
**pooled** host — app queries), `DIRECT_URL` (Neon **direct** host — required by
`schema.prisma` for migrations), `JWT_SECRET`, and optional white-label/AI-assistant
variables. There is no local database; the active environment is whichever Neon branch
`.env` points at.

## Layout

```
src/
  index.ts            entrypoint — loads env, starts the HTTP server
  app.ts              Express app: middleware stack, /health, router registration,
                      central error handler
  routes/             one file or one feature directory per API surface
    inspector/        feature module: index.ts (router) + detail.ts / mutations.ts / helpers.ts
    explorer/  portfolio/  work-library/  regulations/  admin/   (same pattern)
    roles.ts  work.ts  auth.ts  …                                 (single-file routers)
  middleware/auth.ts  requireAuth / requireRole — JWT → req.tenantId
  lib/                pure logic (unit-tested; coverage gate applies here)
    resolvers/        THE derivation layer — closure-table walks, ancestry, counts
    logger.ts         pino + pino-http; per-request UUID echoed as X-Request-Id
    responseCache.ts  short-TTL GET cache; any non-GET request clears it
    tenant.ts, workPlan.ts, roleMatch.ts, …
  services/           cross-route business logic (audit, portfolio rollup, chat DB)
  seed/               seed.ts orchestrates; deterministic demo data (SEED_* overrides)
  db/prisma.ts        the singleton PrismaClient
prisma/
  schema.prisma       94-model schema — mirror of documents/…/erd_v5.mmd
  migrations/         0_baseline + everything after (migrations-only workflow)
  _migrations_legacy/ archived pre-squash history (do not apply)
scripts/              one-off ops scripts — see scripts/README.md (lint-exempt)
```

## Conventions

- **ESM imports carry a `.js` extension even from `.ts` source** —
  `import { prisma } from '../db/prisma.js'`. Required by the tsx/ESM resolver;
  matching existing imports is not optional.
- **Route handler pattern:** `router.use(requireAuth)` at the top (some routers add
  `cacheResponses(ms)`); validate bodies with inline `zod`; tenant-scope every query;
  `try/catch (e) { next(e) }` and let the central error handler in `app.ts` format the
  response. Enums are plain uppercase strings (no Prisma enums) — match the exact
  tokens documented in `schema.prisma` comments.
- **Multi-tenancy is app-layer.** `requireAuth` sets `req.tenantId` from the JWT
  (never trust the body). Top-level entities filter
  `company: { tenantId: req.tenantId }`; deeper rows traverse relations to the tenant.
  Return **404, not 403**, on cross-tenant or not-found — don't leak existence.
- **Resolvers are the single derivation layer.** Location strings and cross-entity
  associations are never denormalized onto rows; they're computed from the closure
  tables at read time via `lib/resolvers/` (`ancestorNames`, `streamAncestry`,
  `rolesForNodes`, `appsForNodes`, `structureCounts`, `processSubtree`, `linkNames`).
  Batch-load junctions with one `{ in: ids }` query, resolve ancestry once, aggregate
  in memory — never per-row fan-out. Standards/regulations on an L5 task or a role are
  *inherited* from L2/L3 ancestors, nothing attaches directly to a task.
- **Logging:** structured pino via `lib/logger.ts` — method/url/status/duration/
  tenantId plus a per-request UUID echoed as `X-Request-Id`. No `console.log`.
- **Data model:** it's a generic typed graph. New concepts extend the graph (entity +
  junction to `ProcessNode`/`Role`) rather than becoming bespoke tables, and every
  association is a FK. Never add a process node without wiring its roles /
  deliverables / applications / tasks.

## How to extend

**Add a route module.** Create `src/routes/<feature>/` with an `index.ts` that builds
the router, applies `requireAuth`, and registers the sibling modules (`detail.ts`,
`mutations.ts`, `helpers.ts`, …). Mount it at the root in `app.ts`
(`app.use('/<feature>', featureRoutes)`). The frontend calls it as
`api.get('/<feature>/…')` — the `/api` prefix is added client-side and stripped by the
proxy. Single-file routers are fine while a surface is small; split into a directory
before the file passes ~500 lines.

**Add a migration.** Edit `prisma/schema.prisma`, update
`documents/value-streams/Master Documentation/erd_v5.mmd` to match, then
`npm run db:migrate -w cascade-backend` (runs `prisma migrate dev` against the Neon
branch in `.env` — use a feature branch, never `develop`/`production` directly). The
migration deploys to shared branches via the Promote workflow / `vercel-build`
(`prisma migrate deploy`). **Never `prisma db push`** — it silently drops drifted
columns (see `documents/adr/ADR-001-prisma.md`).

**Add derived data.** Put the computation in `lib/` or `lib/resolvers/` (pure,
unit-testable, covered by the coverage gate) and call it from the route — not inline
in the handler.
