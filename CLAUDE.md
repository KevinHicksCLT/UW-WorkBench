# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`README.md` describes the real system (rewritten in the 2026-07 refactor) — architecture overview, quickstart, and per-module READMEs are accurate. The refactor charter, behavioral baseline, and cutover runbook live in `documents/refactor/`.

## Commands

npm workspaces monorepo. Workspaces are `shared`, `backend`, `frontend`; their **package names** are `@cascade/shared`, `cascade-backend`, `cascade-frontend` (the `-w` / `--workspace` flag takes the package name, not the directory).

```bash
# Dev — two terminals (no combined script)
npm run dev:backend      # tsx watch src/index.ts → Express on :4000
npm run dev:frontend     # Vite on :5173, proxies /api → :4000

# Quality gates — ALL must pass; husky runs lint-staged + typecheck pre-commit
npm run typecheck        # tsc --noEmit for backend + frontend
npm run lint             # eslint . --max-warnings 0 (flat config at repo root)
npm test                 # vitest unit suites (backend + frontend workspaces)
npm run test:coverage    # + coverage thresholds (80% lines on measured scope)
npm run e2e              # Playwright route smoke — needs BOTH dev servers running
npm run build            # prisma generate (backend) + vite build (frontend) — what Vercel runs

# Database (against the backend workspace) — migrations only, never db push
npm run db:migrate -w cascade-backend    # prisma migrate dev (new migration)
npm run db:seed    -w cascade-backend    # tsx src/seed/seed.ts
npm run db:setup   -w cascade-backend    # generate + migrate deploy + seed (fresh env)
npm run db:studio  -w cascade-backend
```

Verify behavior-affecting changes by exercising the running app (log in via the API and curl the endpoint, or drive the browser) — unit tests cover the lib/resolver layer, not routes. The app runs entirely against a live Neon Postgres branch; there is no local DB.

**One-off scripts** (in `backend/scripts/`, all `.ts`) run with `npx tsx --env-file=.env scripts/<name>.ts` from the `backend/` dir. They import `../src/db/prisma.js` (note the `.js` — see conventions). `backend/scripts/`, `scripts/`, and `standards/` are exempt from the lint gate (documented in `eslint.config.js`).

Demo login after seeding: `kevin.hicks@capgemini.com` / `demo1234` (ADMIN). (CLAUDE-history logins `demo@cascade.io` / `demo@strata.io` no longer work.)

## Architecture

TypeScript throughout, ESM (`"type": "module"`). **Relative imports include a `.js` extension even though the source is `.ts`** (`import { prisma } from '../db/prisma.js'`) — this is required by the tsx/ESM resolver; matching existing imports is not optional. TS strict everywhere; **no `any`**, no `@ts-ignore` (lint enforces both).

### Request path & the `/api` prefix (subtle — read this)
The frontend api client prefixes every call with `/api`, and that prefix is **stripped before it reaches Express** in both environments, so **Express mounts routers at the root** (`/roles`, `/work`, `/inspector` — *not* `/api/roles`):
- **Dev:** the Vite proxy (`frontend/vite.config.ts`) rewrites `/api/*` → `http://localhost:4000/*`.
- **Prod:** `vercel.json` registers the backend service at `routePrefix: /api` and delivers paths without the prefix.

So frontend `api.get('/roles')` → `GET /api/roles` → reaches Express as `GET /roles`. Add a router at root in `backend/src/app.ts`; call it from the frontend with the `/api`-prefixed path.

### The data model is a generic typed graph (erd_v5)
This is the core of the system. Do not model new concepts as bespoke tables — extend the graph. The canonical schema doc is `documents/value-streams/Master Documentation/erd_v5.mmd`; **keep it in sync with `backend/prisma/schema.prisma` on every schema change** (the `db-data-model` skill enforces this).

- **Process spine:** `ProcessNode` self-nests via `parentId`; its depth is named by `ProcessLevelType.levelNumber` — **L1 domain · L2 value stream · L3 area · L4 sub-process · L5 task** (`isTask = true` leaves). `ProcessNodeClosure` is the ancestor/descendant closure table (with `depth`).
- **Org spine:** `OrgUnit` self-nests, depth named by `OrgLevelType.levelNumber` (**L2 division · L3 department**), closure in `OrgUnitClosure`. `Role` homes on an `OrgUnit`.
- **Entities:** `Role`, `Standard`, `RegulatoryRequirement`, `Application`, `Deliverable`, `Checklist`/`ChecklistItem`, `TestingTemplate`, `ExternalParty`.
- **Everything else is a junction** wiring an entity to a `ProcessNode` or a `Role`: `NodeRole` (role_ ∈ Owner/Participant), `NodeDeliverable`, `NodeChecklist`, `NodeStandard`, `NodeRegulation`, `NodeAppUsage`, plus role-direct links `RoleDeliverable`, `RoleStandard`, `RoleRegulation`. **No free-text cross-references** — associations are FKs. Adding a node without wiring its deliverables/roles/apps/tasks is considered a defect.

A **second, parallel portfolio (SPM) domain** also lives in the schema — `Program → Workstream → PortfolioInitiative`, `BenefitLine`/`CostLine`/`MetricValue`, `RaidItem`, `StrategicObjective`, `Rationalization*`. It backs the Initiatives/Portfolio tab and is largely independent of the operating-model graph. Know which domain a task belongs to before editing.

### Backend layout: feature-module routers
Big routers live as directories: `routes/<feature>/index.ts` applies the middleware stack (`requireAuth`, `cacheResponses`, …) and calls `register*Routes(router)` from sibling modules (`routes/portfolio/{programs,initiatives,…}.ts`, same for `explorer`, `inspector`, `work-library`, `admin`, `regulations`). Keep every file under ~500 lines; new endpoints go in the matching module, shared logic in `<feature>/helpers.ts` or `lib/`.

Structured logging is **pino** (`lib/logger.ts`): every request logs method/url/status/duration/tenantId plus a request id echoed as `X-Request-Id`. The central error handler in `app.ts` logs full context; never `console.log` in backend src.

### Resolvers are the single derivation layer (`backend/src/lib/resolvers/`)
Location strings and cross-entity associations are **never denormalized onto rows** — they are computed from the closures on read. Reuse these; do not re-walk the graph by hand:
- `ancestorNames(nodeIds)` — each node's `{ valueStreamName, domain, l3, l4, division, department }`. division/department come from the node's **Owner role's** `OrgUnit`, not the process tree.
- `streamAncestry(nodeIds)` — lean variant (value stream + domain only).
- `rolesForNodes` (opt-in `withOrgUnit`), `appsForNodes`, `structureCounts`, `processSubtree`, `linkNames`.

A recurring pattern (see `routes/roles.ts`, `routes/work.ts`): batch-load junctions with a single `{ in: ids }` query, resolve ancestry once via a resolver, then aggregate in memory — **never per-row fan-out**. Standards/regs applicable to an L5 task or a role are *inherited* from its L2/L3 ancestors (nothing attaches directly to a task); the Tasks list and the Inspector's Governance tab both derive them this way.

### Multi-tenancy (app-layer)
Tenancy is enforced in the API, not the DB. `requireAuth` sets `req.tenantId` from the JWT (never from the body). Scope every query by walking to the tenant — top-level entities filter `company: { tenantId: req.tenantId }`; deeper rows traverse the relation (e.g. `externalParty: { company: { tenantId } }`). Return **404, not 403**, on cross-tenant/not-found.

### Route handler pattern
`router.use(requireAuth)` at top; some routers add `cacheResponses(ms)`. Validate bodies with inline `zod`. Tenant-scope every query. `try/catch (e) { next(e) }` and let the central error handler in `app.ts` format it. Enums are plain uppercase strings (no Prisma enums) — match the exact tokens in `schema.prisma` comments.

### Frontend (`frontend/src/`)
Vite + React 18 + TypeScript, Tailwind, React Router. Routes are code-split: every page is `React.lazy` in `App.tsx` behind one `Suspense` boundary (Layout + Login eager) — keep new pages lazy.
- **`components/ui/` is the internal component library** — Button/LinkButton, Card, Input/Select/Textarea/Label, StatusPill, Chip, SkeletonLoader, EmptyState/LoadingState/ErrorMessage, DrawerShell. **Pages compose from it; never re-implement a shared component or hand-roll its class strings.** Components emit base class + verbatim `className` merge — preserve that contract.
- `lib/api.ts` — fetch wrapper; reads the JWT from `localStorage`, redirects to `/login` on 401. `lib/useApi` — typed GET hook.
- **`components/Sheet.tsx` is the canonical flat-list view** (combobox filters + grid). All list/spreadsheet tabs must use it — no hand-rolled filter bars or tables.
- **`components/Inspector.tsx` is the unified value-stream sidebar** (shared List + Map tabs) — a tabbed drill-down (Overview / Roles / Applications / Deliverables / Tasks / Checklist / Testing / Governance) over a single `ProcessNode`, fed by `/inspector/:nodeId`. This is *the* place a node's associations surface.
- Dialogs go through `lib/dialogs` (`useDialogs`) — never `window.confirm/alert/prompt`.

### Database & environments
`DATABASE_URL` (Neon pooled) powers app queries; `DIRECT_URL` (Neon direct) is required by `schema.prisma` for migrations — set both in `backend/.env` (see `.env.example`). The app runs against Neon **branches** (git-flow: `production` / `develop` / feature branches); the active branch is whatever `backend/.env` points at. Branch create/seed/promote/delete has data-loss footguns — use the **`neon-db-branch-ops`** skill and `scripts/neon-branch-*.mjs`.

**Schema changes happen ONLY through migrations** (`npm run db:migrate -w cascade-backend`), never `prisma db push` — push drops drifted columns silently (incident history) and breaks the migration ledger. History was squashed to `prisma/migrations/0_baseline/` (ADR-001); environments that predate it need a one-time `npx prisma migrate resolve --applied 0_baseline` (see `documents/refactor/CUTOVER.md`). Vercel's `vercel-build` runs `prisma migrate deploy`.
