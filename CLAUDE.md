# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Behavioral guidelines (think-before-coding, surgical changes, etc.) live in `.claude/CLAUDE.md` and are loaded alongside this file. This file is the architecture/commands reference.

## ⚠️ README is a plan, not the code

`README.md` describes **"Strata" v2.0** — an aspirational TypeScript rewrite with an operating-model domain (companies → divisions → value streams → roles → people). **None of it is built** ("Status: Not started" for every phase). The actual codebase is **"Cascade"**: JavaScript (ESM), with a **Program → Workstream → Initiative** strategic-portfolio-management (SPM) domain. When the README and the code disagree, the code is reality. Don't introduce TypeScript, zod-shared packages, `api/index.ts`, or the operating-model schema unless explicitly asked to start that migration.

## Commands

npm workspaces monorepo. Workspace **package names** are `cascade-backend` and `cascade-frontend` (directories are `backend`/`frontend`) — the `-w` flag takes the package name.

```bash
# Dev (run in two terminals — there is no combined root script)
npm run dev:backend          # Express on :4000 (node --watch)
npm run dev:frontend         # Vite on :5173, proxies /api → :4000

# Build (what Vercel runs)
npm run build                # prisma generate (backend) + vite build (frontend)

# Database (run against the backend workspace)
npm run db:setup   -w cascade-backend   # generate + db push + seed
npm run db:seed    -w cascade-backend   # seed demo tenant (no-op if users exist; SEED_FORCE=1 to wipe+reseed)
npm run db:reset   -w cascade-backend   # migrate reset --force + seed
npm run db:studio  -w cascade-backend   # Prisma Studio
npm run db:push    -w cascade-backend   # push schema without a migration
```

After editing `schema.prisma`: `npx prisma migrate dev --name <change>` (needs `DIRECT_URL`), then `npm run db:seed -w cascade-backend`.

**There is no test runner and no linter configured.** Don't claim tests pass — there are none. Verify changes by running the app and exercising endpoints (e.g. `curl localhost:4000/health`).

Demo login after seeding: `demo@cascade.io` / `demo1234` (ADMIN). Other seeded users: `sponsor@cascade.io` (MANAGER), `priya@`/`jamal@cascade.io` (MEMBER).

## Architecture

### Request path & the `/api` prefix (subtle — read this)
The frontend api client (`frontend/src/lib/api.js`) prefixes every call with `/api`. That prefix is **stripped before it reaches Express**, in both environments, so **Express mounts its routers at the root** (`/auth`, `/programs`, `/health` — *not* `/api/auth`):
- **Dev:** Vite proxy (`frontend/vite.config.js`) rewrites `/api/*` → `http://localhost:4000/*` (strips `/api`).
- **Prod:** `vercel.json` uses `experimentalServices` — the backend Express service is registered at `routePrefix: /api`, and Vercel delivers paths to it without the prefix.

So a frontend `api.get('/programs')` → `GET /api/programs` → reaches Express as `GET /programs`. The commit "drop /api prefix from express mounts" enforced this. If you add a router in `backend/src/app.js`, mount it at root and call it from the frontend with the `/api`-prefixed path. (Note: this contradicts the README's plan, which wanted the prefix kept — follow the code.)

### Backend (`backend/src/`)
Express + Prisma, plain JS ESM (`"type": "module"` — **import paths include the `.js` extension**).

- `app.js` — builds the Express app, mounts all routers, central error handler (`err.status || 500`, includes stack outside production). Exported as default (so it can also be served serverless).
- `index.js` — local dev listener only (port 4000); loads `dotenv/config`.
- `db/prisma.js` — single `PrismaClient` instance, imported everywhere. (Plain `new PrismaClient()` — not the globalThis-guarded singleton the README describes.)
- `middleware/auth.js` — `signToken` (JWT, 7-day), `requireAuth` (verifies Bearer token, loads user, sets `req.user` and `req.tenantId`), `requireRole(...roles)`.
- `routes/` — one router per domain area: `auth, programs, workstreams, initiatives, benefitsCosts, raid, okr, dashboard, notifications, audit, rules`.
- `services/` — business logic invoked from routes (see below).
- `seed/seed.js` — seeds one demo tenant ("Acme Industries") with programs, initiatives, time-phased benefits/costs, OKRs, RAID, a business rule, resources.

**Route handler pattern** (mirror it for consistency):
1. `router.use(requireAuth)` at top (most routers); `requireRole('ADMIN','MANAGER')` on mutating rules routes.
2. Validate the body with an inline `zod` schema (`z.object(...).parse(req.body)`).
3. **Tenant-scope every query** (see below) and return **404, not 403**, on cross-tenant/not-found.
4. On writes: `logAudit(...)` (fire-and-forget) and, where relevant, `runRulesForEntity(...)` and `recompute*(...)`.
5. `try/catch (e) { next(e) }` — let the central handler format errors.

### Multi-tenancy (app-layer, via relation traversal)
Tenancy is enforced in the API layer, **not** the database. Crucially, **`Initiative`/`Workstream` have no `tenantId` column** — the tenant is reached by walking the relation up to `Program.tenantId`. The canonical scoping filter is:

```js
where: { workstream: { program: { tenantId: req.tenantId } } }
```

Routers define a small helper (e.g. `tenantInitiative(id, tenantId)` using `findFirst` with that nested `where`) and return 404 when it misses. `req.tenantId` always comes from the JWT (`requireAuth`), never from the request body. Top-level tenant entities (`Program`, `StrategicObjective`, `Kpi`, `Resource`, `Notification`, `AuditEntry`, `BusinessRule`) filter on their own `tenantId` directly.

### Services
- `rollup.js` — `recomputeInitiative()` recomputes the **denormalized** `cumulativeBenefit/Cost/NetBenefit` and `valueScore` fields on `Initiative` from its time-phased `MetricValue` rows (ACTUAL, plus FORECAST for future periods) and objective-link impact weights. Call it after any write that affects benefits/costs/objective links. `summarizeProgram()` aggregates read-time (no program-level denormalization).
- `workflow.js` — stage-gate engine. Stages: `IDEA → PLAN → EXECUTE → REALIZE → COMPLETE`. `applyWorkflowAction({action: SUBMIT|APPROVE|MOVE_BACK})` advances/reverts stage, maps stage→`state` (PLANNING/ACTIVE/DONE), notifies sponsor/owner, audits, and fires rules.
- `rulesEngine.js` — event-driven `BusinessRule` executor. Triggers `ON_CREATE | ON_UPDATE | ON_FIELD_CHANGE`; actions `SET_VALUE | NOTIFY | RUN_RULE`. `actionConfig` is JSON; templates interpolate entity fields via `{!fieldName}`. Failures are logged, never thrown.
- `okr.js` — `recomputeKpi()` (achievement 0–1 from start/current/target + MAX/MIN direction) and `recomputeObjective()` (weighted KPI average, recursing through the `ObjectiveTree` self-relation).
- `notifications.js` / `audit.js` — thin Prisma wrappers (`sendNotification`, `logAudit`). `logAudit` swallows its own errors so it never breaks a request.

### Data model (`backend/prisma/schema.prisma`)
Postgres. Spine: `Tenant → Program → Workstream → Initiative`. An `Initiative` carries the stage-gate workflow, denormalized roll-up figures, and owns `BenefitLine`/`CostLine` (each holding monthly `MetricValue` rows keyed by `dataset` ∈ ACTUAL/TARGET/FORECAST — sparse FK: a `MetricValue` points to *either* a benefit or a cost line), `Milestone`, `RaidItem`. OKR module: `StrategicObjective` (self-referential tree) → `Kpi`, linked to initiatives via junction tables `InitiativeObjective` (with impact) and `InitiativeKpi`. Cross-cutting: `AuditEntry`, `BusinessRule`, `Notification`, `Resource`. Roles are strings: `ADMIN | MANAGER | MEMBER | VIEWER`.

`DATABASE_URL` is used by app queries; `DIRECT_URL` is required by `schema.prisma` for migrations (Neon pooled vs. direct). **`.env.example` omits `DIRECT_URL`** — set it in your local `backend/.env` or migrations fail.

### Frontend (`frontend/src/`)
Vite + React 18 SPA, plain JSX, Tailwind, React Router, Recharts.
- `lib/api.js` — fetch wrapper; reads JWT from `localStorage['cascade.token']`; on 401 clears storage and redirects to `/login`.
- `lib/auth.jsx` — `AuthProvider` context + `useAuth()`; persists token/user in `localStorage` (`cascade.token`, `cascade.user`); validates via `GET /auth/me` on load.
- `App.jsx` — gated routing: unauthenticated → `/login` only; authenticated → `Layout` shell + routes (`/` Portfolio, `/programs`, `/programs/:id`, `/initiatives/:id`, `/raid`, `/okrs`, `/rules`, `/audit`).
- `components/` — shared shell/UI: `Layout`, `PageHeader`, `KpiTile`, `StatusPill`, `StageBadge`. `pages/` — one per route. `lib/format.js` — display helpers.

## Conventions
- ESM throughout; **relative imports must include `.js`** (e.g. `import { prisma } from '../db/prisma.js'`).
- Validate request bodies with inline `zod` schemas; dates arrive as strings and are converted with `new Date(...)` before Prisma writes.
- Enums/statuses are plain strings (no Prisma enums) — match the exact uppercase tokens documented in `schema.prisma` comments.
- Don't commit `.env*` (only `.env.example`), build output, or secrets — already covered by `.gitignore`.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.