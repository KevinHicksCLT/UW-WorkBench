# Strata — Enterprise Operating-Model Insights Platform

Build Plan (v2.0 — Cascade stack, TypeScript)

**Stack:** Vite + React + **TypeScript** (frontend) · Express + **TypeScript** (API, Vercel serverless) · Prisma ORM · Neon Postgres · Vercel
**Visualization:** React Flow (flows/dependencies) · d3-org-chart (org) · Recharts (dashboards; Tremor optional)
**Source of truth (MVP seed):** `IT_Roles_Analytics_v12.xlsx`
**Philosophy:** Connected-data-first, drill-down-native, seed real data early.
**Core identity:** One governed model of a company's operating model — companies → divisions → departments → value streams → sub-streams → SOPs → applications → initiatives → roles → people → deliverables → work stats — where every view is generated live from a single source of truth, and changing a fact once updates every diagram, dashboard, and report that references it.

> **Working name.** "Strata" is a placeholder (layered organizational depth). Trademark/clearance not done. Rename is a find-replace on a constant, not a refactor.

> **What changed from v1.0.** v1.0 targeted Next.js (App Router) + Drizzle. v2.0 adopts the Cascade repo's stack — **Vite + React SPA**, **Express API as a Vercel serverless function**, **Prisma ORM**, **Neon Postgres**, single Vercel project — and migrates the entire codebase (including Cascade's reusable infrastructure) to **TypeScript**. The data model, phase structure, and product philosophy are unchanged; only the runtime, ORM, routing, and language are.

---

## Assumption: built on Cascade

Strata reuses Cascade's architecture and toolchain rather than reinventing it. Where Cascade ships reusable, domain-agnostic infrastructure, it is **ported to TypeScript and kept**:

- JWT auth (`bcryptjs` + `jsonwebtoken`) and the `requireAuth` / `requireRole` middleware.
- The tenant-scoping helper pattern (`tenantInitiative()` / `tenantWorkstream()`-style lookups that return 404 on cross-tenant access).
- The append-only audit log (`logAudit`) and fire-and-forget logging discipline.
- The event-driven rules engine and notification dispatcher (carried forward, retargeted to Strata entities in later phases).
- The Vite app shell: `react-router-dom` routing, the `AuthProvider` context, the `api` fetch client, `Layout` / `PageHeader` / `KpiTile` / `StatusPill` components, the Tailwind `index.css` design tokens.

The **program / workstream / initiative** domain model is *replaced* by the operating-model spine below. Reusable infra is migrated `.js` → `.ts` file-by-file; the domain schema is rewritten, not migrated.

---

## What We're Building

A platform that turns a company's operating model into **on-demand, drill-down insight** at every level — and lets you author new companies, value streams, applications, roles, and initiatives with the same depth.

The drill-down spine (the thing every screen navigates):

```
Company
└── Division
    └── Department / Team
        └── Value Stream (L2)
            └── Sub-Value Stream (L3 / L4)
                ├── SOP (standard operating procedure)
                ├── Application (internal / external)
                ├── Development Initiative
                └── Role
                    └── Person (employee / contractor assignment)
                        ├── Checklist / Deliverables
                        └── Work Stats (commits / tickets / time online)
```

The experiences built on top of that spine:

- **Interactive diagrams & flow charts** — pannable/zoomable value-stream maps and application-dependency graphs; click a node to drill into its L3/L4 sub-streams, owning roles, and supporting applications.
- **Org charts** — collapsible division → department → role hierarchy with headcount and exposure overlays.
- **ROI dashboards & overview dashboards** — executive KPI tiles, financial roll-ups, and the role-by-category analytics matrix that already lives in the seed workbook.
- **Authoring** — add and edit companies, divisions, value streams, applications, roles, initiatives, and people, with the same connected depth as the seeded data.
- **Connected data** — change a value-stream definition or a role's department once, and every diagram, dashboard, roster, and report that references it reflects the change immediately.

What's explicitly *future*: live plugins (Jira, GitHub, Slack/Teams) that auto-populate work stats and DORA metrics. The schema and connector abstraction are designed now; the connectors are built in Phase 8. Until then, work stats are seeded/entered manually so every earlier phase runs against real-shaped data.

---

## Architectural Calls

Opinionated, up front, so they're easy to challenge before code lands.

1. **Vite + React SPA frontend + Express API as a Vercel serverless function — one Vercel project.** The Vite app builds to static assets; the Express app is exported as the default handler from `api/index.ts` and served by Vercel's Node runtime behind `/api/*`. This matches Cascade exactly. There is **no separately-hosted, always-on Node server** — only `npm run dev` runs Express as a local process (port 4000). The discarded v1.0 alternative (Next.js App Router + React Server Components) is not used.

2. **TypeScript everywhere.** Frontend (`.tsx`/`.ts`, Vite compiles natively), API (`.ts`, compiled by Vercel's runtime for the serverless function; `tsx` for local dev), and a shared `shared/` workspace of **zod schemas** that are the single contract across the API boundary — backend validates with them, frontend infers request/response types from them. zod is already a Cascade backend dependency; promoting it to a shared package is the clean migration story.

3. **Neon Postgres, app queries on the pooled string, migrations on the direct string.** `DATABASE_URL` = Neon pooled (`-pooler` host; append `?pgbouncer=true` for Prisma). `DIRECT_URL` = Neon direct, used by `prisma migrate`. Cascade's `schema.prisma` already declares both (`url` / `directUrl`) and `binaryTargets = ["native", "rhel-openssl-3.0.x"]` for Vercel's runtime — carried over unchanged.

4. **Prisma ORM with a serverless-safe singleton client.** A `globalThis`-guarded `PrismaClient` prevents connection exhaustion across warm function invocations. Prisma's generated types are the in-app domain types; the zod schemas (call #2) are the wire types. The v1.0 Drizzle/`attachDatabasePool`/Fluid-pool pattern is dropped.

5. **Hierarchy = adjacency list (`parentId` self-relation) + recursive CTEs via `prisma.$queryRaw`. Graph relationships = explicit junction models.** Prisma cannot express `WITH RECURSIVE` through its query builder, so every deep drill-down endpoint runs a **typed raw SQL** query (`prisma.$queryRaw<Row[]>`). Self-relations (Cascade precedent: `StrategicObjective` `ObjectiveTree`) handle L3→L4 nesting. Junction tables are explicit Prisma models with `@@unique` composite keys (Cascade precedent: `InitiativeObjective`, `InitiativeKpi`). React Flow renders nodes/edges directly from junction rows. No graph database.

6. **`tenantId` on every table + app-layer scoping as the MVP default; Postgres RLS as Phase 6 defense-in-depth.** Cascade enforces tenancy in the API layer (helper lookups + `where: { … : { tenantId } }`), *not* in the database, and Prisma has no equivalent to Drizzle's RLS helpers. So Strata uses app-layer scoping from day one (centralized helpers, 404-not-403 on cross-tenant access) and **adds RLS in Phase 6** via a raw-SQL Prisma migration (`CREATE POLICY …`) plus a per-request `SET LOCAL app.current_tenant` issued inside the same transaction as the query. The pooled-connection caveat is real and tracked in the risk register.

7. **`IT_Roles_Analytics_v12.xlsx` is the seed source of truth.** v11 is superseded. The seed is an **idempotent Prisma upsert keyed on natural keys** (division code, role name, value-stream name) using `upsert` in FK order and `createMany({ skipDuplicates: true })` for junctions, so re-importing an updated workbook converges rows instead of duplicating them. `SEED_FORCE=1` wipes-and-reseeds (Cascade's exact pattern). Where the workbook is silent (people, work stats, SOP bodies, app metadata), we synthesize clearly-labeled illustrative data.

8. **React Flow for flows/dependencies, d3-org-chart for org charts, Recharts for dashboards (Tremor optional).** Recharts already ships in Cascade's frontend. React Flow (`@xyflow/react`) and a thin d3-org-chart wrapper are added for the new diagram surfaces — both run fine in a Vite SPA. SVG everywhere until a single view needs >10k nodes/points, at which point that view moves to a Canvas renderer (ECharts).

9. **Connected data is the product, not a feature.** One repository; every view derives from it; "change once, reflect everywhere." Roll-ups recompute on write and affected caches are invalidated — the Cascade `services/rollup.js` discipline, ported to TS and extended to the operating-model hierarchy.

10. **Connector framework is designed now, built in Phase 8.** OAuth per connector, webhook-first ingestion under `app.use('/api/connectors', …)`, a normalized internal `WorkStat` schema, finalized in Phase 7 so connectors plug in with no migration.

11. **`vercel.json` is a valid `rewrites` config — the existing `experimentalServices` file is deleted.** Unlike a Next.js project (which needs none), a Vite-static + Express-serverless split *requires* a `vercel.json`. The current `experimentalServices` schema is deprecated and disables zero-config detection. It is replaced with a `buildCommand` / `outputDirectory` / `rewrites` config, and the API is mounted under `/api` so dev and prod paths are identical (no proxy prefix-stripping).

---

## The Data Model — the spine everything hangs off

This is the load-bearing decision. Get the entities and their natural keys right in Phase 1 and every later phase is additive. The v12 workbook hands us the structure directly; the job is to normalize it, not invent it. Entities are expressed as **Prisma models**; IDs default to `cuid()` (Cascade convention) with **natural-key `@@unique` constraints** as the upsert conflict target.

### What the seed workbook actually contains (verified)

| Seed artifact | Count | Becomes (Prisma model) |
|---|---:|---|
| Divisions (`Aligned Role Tasks`, `Org Chart View`) | 14 | `Division` |
| Departments / teams | ~97 | `Department` |
| Canonical roles (`Role Assignment List`, `Items`) | 159 | `Role` |
| L2 value streams (`Value Streams`) | ~25 | `ValueStream` |
| Value-stream domains | 15 | `ValueStreamDomain` (or a `domain` attribute) |
| L3/L4 sub-value-streams (`Sub-Value Streams`) | ~100 | `SubValueStream` |
| Readiness-checklist items (`Items` / `Hierarchy`) | ~3,337 | `ChecklistItem` |
| Role-aligned tasks (`Aligned Role Tasks`) | ~4,743 | `RoleTask` |
| Task/checklist categories | ~19 canonical | `Category` |
| External interactions (`External Interactions`) | ~27 | `ExternalInteraction` |
| Role × category analytics (`Role_by_Category`) | 14×19 matrix | derived view (raw SQL), not a stored table |
| Merge crosswalk + source traceability | — | provenance metadata (`SourceRef`) |

### Core entities (all carry `tenantId`; app-layer scoped, RLS in Phase 6)

**Hierarchy (self-relation where natural, explicit relations where the level is fixed):**
- `Company` → `Division` → `Department` → … the org spine. `Division`/`Department` use explicit relations (fixed depth); a generic `OrgNode` self-relation table is the escape hatch if a customer's org is deeper than department.
- `ValueStream` (L2) → `SubValueStream` (L3/L4, self-referencing `parentId` for L3→L4 nesting, queried by recursive CTE via `$queryRaw`).
- `Sop`, `Application` (`kind` ∈ `{internal, external}`), `Initiative` (development initiatives), `Role`, `Person`.

**People & assignment:**
- `Person` (employee/contractor), `Assignment` (person ↔ role, with `employmentType` ∈ `{badged, contractor, si_partner}`, dates, allocation %).
- `Deliverable` / `ChecklistItem` (seeded from `Items`), `ChecklistStatus` (per person/assignment completion).
- `WorkStat` (commits, tickets-closed, time-online, etc.) — a normalized fact table with `source` (`manual` now; `github`/`jira`/`slack` later), `metric`, `value`, `periodStart`. **Reserved for Phase 7/8; created early so nothing reshapes later.**

**Graph relationships (junction models, each with `tenantId` + composite `@@index`/`@@unique`):**
- `RoleValueStream` (`participationType` ∈ `{Lead, Core, Support, Control}` — straight from the workbook).
- `ApplicationValueStream`, `ApplicationSubValueStream`.
- `RoleTask` (role ↔ task ↔ category), `SubValueStreamRole`.
- `ExternalInteraction` (party ↔ internal owner role ↔ related value stream).
- `InitiativeValueStream`, `InitiativeApplication`.

**Cross-cutting:**
- `Category` (the ~19 canonical task categories — the dimension behind the analytics matrix).
- `SourceRef` (provenance: which workbook sheet/row a record came from — the connected-data audit trail starts here).
- `AuditEntry` (append-only; who changed what, when, before/after) — Cascade's model, carried forward; populated from Phase 6.

### Natural keys (so re-seeding is idempotent)

Every seedable entity gets a stable business key for `upsert({ where: { naturalKey }, … })`:
- `Division.code`, `Department.(divisionCode, name)`, `Role.name`, `ValueStream.name`, `SubValueStream.(valueStreamName, l3, l4)`, `Category.name`.
- Surrogate `id` (cuid) is the FK target; the natural key is the upsert conflict target. Re-importing an edited v12 converges rows; it never duplicates them.

---

## Stack, Environments & Deploy

### Environments
1. **Local dev** — `frontend`: `vite` on 5173; `backend`: `tsx watch src/index.ts` on 4000, pointed at a dedicated Neon dev branch (or local Postgres). `.env.local` holds `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
2. **GitHub** — source of truth. Every PR gets a Vercel Preview deploy; pair it with a Neon branch (via the Neon GitHub/Vercel integration) so schema changes are tested against a snapshot before merge.
3. **Vercel** — Production (main) + Preview (PRs). Single project: static `frontend/dist` + `api/*` serverless function.

### Prisma client (serverless-safe singleton)
```ts
// backend/src/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
```
- App queries → pooled `DATABASE_URL`. Migrations (`prisma migrate`) → `DIRECT_URL`.
- The `globalThis` guard prevents a new client (and a new connection pool) on every warm invocation.

### Serverless entrypoint & `vercel.json`
```ts
// api/index.ts — Vercel serves an Express app exported as the default handler
import app from '../backend/src/app';
export default app;
```
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api" }]
}
```
- **Delete the existing `experimentalServices` `vercel.json`.** It is the deprecated schema and disables zero-config.
- Vercel rewrites are transparent to the function: a request to `/api/health` still arrives at Express as `/api/health`. Therefore **Express mounts its routers under `/api`** (e.g. `app.use('/api/health', …)`), and the Vite dev proxy maps `/api` → `http://localhost:4000` **without rewriting the prefix** — so dev and prod paths are identical. (This differs from Cascade's current proxy, which strips `/api`; the change removes a dev/prod skew.)

```ts
// frontend/vite.config.ts
server: { proxy: { '/api': 'http://localhost:4000' } } // no rewrite
```

### Migrations & seeding
- `prisma migrate dev` locally (forward-only migrations live in `backend/prisma/migrations/`); `prisma migrate deploy` on Vercel against `DIRECT_URL`, as a distinct step *before* the seed.
- Seed is a typed Prisma script doing **batched upserts** in FK order (categories → divisions → departments → roles → value streams → sub-streams → checklist items → tasks → junctions → illustrative people/stats). Idempotent: second run is a no-op. `SEED_FORCE=1` wipes-and-reseeds.

### TypeScript toolchain
- **Backend:** `tsx watch` for dev; `tsc --noEmit` for type-check in CI; Vercel compiles `api/*.ts` for the function (no separate backend bundle step). Prisma's generated client is fully typed.
- **Frontend:** Vite compiles TS natively; `tsc --noEmit` for type-check; `vite build` for prod.
- **Shared:** `shared/` workspace exports zod schemas; backend imports them for request validation, frontend imports them for typed forms and `z.infer`-ed response types.

### Deploy ritual
Push to `main` → Vercel auto-builds: `prisma generate` → `prisma migrate deploy` → seed-if-empty → `vite build` → live at `https://<project>.vercel.app`. Subsequent pushes auto-deploy; the seed no-ops when data exists.

### Git hygiene
- **Never commit:** `.env*` (except `.env.example`), the source `.xlsx`, secrets.
- **Commit:** `.env.example`, the seed *script*, migrations, the normalized seed export.

---

## Phase 0 — Foundation

**The question:** Can I run the app locally, talk to Neon through Prisma, deploy a blank shell to Vercel, and is the toolchain TypeScript end-to-end?

**Status:** ✅ Complete (2026-05-31). TypeScript migration done across `backend`, `frontend`, and a `shared/` zod workspace; Prisma `globalThis` singleton, `api/index.ts`, `GET /api/health` (live `SELECT 1`), and `tsc --noEmit` green in both workspaces. **Deviations from the plan:** the full Cascade domain was ported to TS and kept rather than skipped (it is replaced in Phase 1 instead); `vercel.json` retains the existing **`experimentalServices`** config (not the `rewrites` style), so Express mounts routers at the **root** and the dev proxy strips `/api`. Exit #1/#2 (Vercel deploy + Neon-branch preview) pending the first deploy.

**What exists at the end:** A Vite + React + TS frontend and an Express + TS API (Vercel serverless) in one project, connected to Neon via Prisma, with a `GET /api/health` route confirming a live DB round-trip. Reusable Cascade infra is ported to TS. No domain data yet.

**Components:**
- Workspace scaffold (`backend`, `frontend`, `shared`); Tailwind + the Cascade `index.css` design tokens; `react-router-dom`, `AuthProvider`, `api` client — all migrated to TS.
- `backend/src/db/prisma.ts` (singleton above); `schema.prisma` with `url`/`directUrl` and Vercel `binaryTargets`.
- `api/index.ts` exporting the Express app; `vercel.json` (rewrites); Express routers mounted under `/api`.
- `GET /api/health` → `SELECT 1` through Prisma (`prisma.$queryRaw`), returns `{ ok, db: 'reachable', commit }`.
- TS toolchain: `tsx` dev, `tsc --noEmit` type-check in CI, shared zod package wired into both sides.
- `.env.example`, README, `.gitignore` (already excludes `.env*`, `*.xlsx`, `dev.db`).

**Exit criteria (Given/When/Then):**
1. **Given** the app deployed to Vercel, **When** I `GET /api/health`, **Then** it returns `200 { ok: true, db: "reachable" }` within 1 s.
2. **Given** a PR, **When** Vercel builds the Preview against a Neon branch, **Then** `/api/health` passes against it.
3. **Given** a local checkout with `.env.local`, **When** I run dev (`vite` + `tsx watch`), **Then** the app boots and `/api/health` passes via the `/api` proxy.
4. **Given** the repo, **When** I run `tsc --noEmit` in both workspaces, **Then** it passes with zero errors and there is no `experimentalServices` block or committed secret/`.xlsx`.

---

## Phase 1 — Data Spine + Seed v12 (the real-data MVP)

**The question:** Is the entire v12 operating model loaded into Neon, normalized, idempotent, type-safe, and queryable by recursive drill-down?

**Status:** ✅ Complete (2026-05-31). The operating-model spine replaces the Cascade domain, seeded from `IT_Roles_Analytics_v12.xlsx` via `transform-workbook.ts` → committed `backend/data/seed/spine.json` → idempotent `seed.ts`. `verify-seed.ts` passes: 14 divisions · 97 departments · **162 roles** (159 org-placed + 3 checklist-only architects the workbook defines checklists for but never places in the org chart) · 19 categories · 26 value streams · 208 sub-streams (104 L3 + 104 L4) · 3,337 checklist items · 4,743 role tasks · 329 role↔stream links · 27 external interactions. `/companies/:id/tree` (<1 s) and `/value-streams/:id` (recursive-CTE sub-stream tree + participation types) verified end-to-end via Playwright against the running app. **Deviations:** provenance is inline `sourceSheet`/`sourceRow` columns (not a separate `SourceRef` table); the fixed-depth org tree uses a typed nested include while the recursive CTE drives the sub-value-stream tree; tenant scoping is a direct `tenantId` filter (every spine table carries it). Exit #5 (automated cross-tenant test) deferred to the Phase 6 RLS work.

**What exists at the end:** The full Prisma schema (hierarchy + junctions + people/stats models, all `tenantId`-scoped) and an idempotent seed loading all 14 divisions, ~97 departments, 159 roles, ~25 value streams, ~100 sub-streams, ~3,337 checklist items, ~4,743 tasks, ~19 categories, and external interactions — for one seeded company. A handful of typed API routes return the data, drill-downs via recursive CTE.

**Components:**
- `backend/prisma/schema.prisma` — every entity and junction from **The Data Model**, with `tenantId`, natural-key `@@unique` constraints, and indexes on FK + junction pairs.
- App-layer tenant scoping: centralized helper lookups (`tenantValueStream()`, `tenantRole()`, …) returning 404 on cross-tenant access; tenant derived from the JWT session (Phase 6), a fixed seeded tenant until then.
- `backend/scripts/transform-workbook.ts` — v12 `.xlsx` → normalized CSV/JSON checked into `backend/data/seed/` (isolates workbook quirks from the schema).
- `backend/src/seed/seed.ts` — batched Prisma upserts in FK order, `SourceRef` recorded per row, `createMany({ skipDuplicates: true })` for junctions. Idempotent; `SEED_FORCE=1` re-seeds.
- `GET /api/companies/:id/tree` — recursive-CTE drill-down (`$queryRaw`) returning a nested structure (division → department → role).
- `GET /api/value-streams/:id` — stream + L3/L4 sub-streams + participating roles (with participation type).
- `backend/scripts/verify-seed.ts` — asserts row counts match the workbook.

**Exit criteria:**
1. **Given** an empty database, **When** the seed runs, **Then** counts equal the workbook (14 divisions, 159 roles, ~25 value streams, ~3,337 checklist items, etc.) and a manifest prints.
2. **Given** a seeded database, **When** the seed runs again, **Then** zero rows are inserted/duplicated (pure no-op) and it exits 0.
3. **Given** an edited workbook export (one role renamed, one department moved), **When** the seed re-runs, **Then** changed rows update in place; no orphans/duplicates.
4. **Given** a seeded company, **When** I `GET /api/companies/:id/tree`, **Then** the full division→department→role hierarchy returns via a single recursive CTE in <1 s p95.
5. **Given** app-layer scoping, **When** a query runs without a tenant context, **Then** it returns no cross-tenant rows (proven by an automated test). *(Database-level RLS arrives in Phase 6.)*
6. **Given** any seeded record, **When** I inspect it, **Then** it carries a `SourceRef` back to the workbook sheet/row.

---

## Phase 2 — Read-Only Insight Surfaces (drill-down UI)

**The question:** Can a user navigate the entire operating model in the browser, top to bottom, without dead ends?

**Status:** ✅ Complete (2026-05-31). Read-only drill-down SPA, verified end-to-end via Playwright (0 console errors): Overview → Division → Department → Role, and Value Streams → detail, with SPA breadcrumbs, a debounced global search (divisions/departments/roles/value-streams/sub-streams) as a live sidebar dropdown plus a `/search` page, and no dead ends (role ↔ value-stream cross-links). Role pages show value-stream participation with type (Lead/Core/Support/Oversight/Control) and checklist items + role tasks grouped by category; value-stream pages render the L3/L4 sub-process tree (recursive CTE) with inputs/outputs and participating roles by type. New backend read endpoints: `/divisions/:id`, `/departments/:id`, `/roles/:id`, `/search`. `tsc --noEmit` green in both workspaces. **Scope note:** people, applications, SOPs, and development initiatives are not navigable — they aren't in the v12 workbook/seed (deferred to later phases), so the "Illustrative" badge (exit #4) isn't needed yet (all data is real workbook data).

**What exists at the end:** A navigable React SPA — company overview → division → department → value stream → sub-stream → role → (illustrative) people, with breadcrumbs, search, and detail panels. Read-only. The first thing a stakeholder can click through.

**Components:**
- App shell (sidebar nav, breadcrumb, global search) reusing Cascade's `Layout` / `PageHeader` / pills, migrated to TS.
- `react-router-dom` route + list/detail pages per entity level; every relationship is a clickable `Link` (role → its value streams; value stream → its roles/applications/sub-streams; application → the streams it supports).
- Global search across divisions, roles, value streams, applications, SOPs, initiatives.
- "Illustrative data" badge wherever values are synthesized rather than seeded.
- Typed `api` client calls (zod-inferred response types); loading/empty/error states for every view.

**Exit criteria:**
1. **Given** the seeded company, **When** I start at the company page, **Then** I can reach any role, value stream, sub-stream, application, SOP, or initiative in ≤4 clicks, each page <1.5 s p95.
2. **Given** any detail page, **When** I view it, **Then** every related entity is a working link and there are no dead ends.
3. **Given** the search box, **When** I type a role or value-stream name, **Then** matching results across entity types appear within 300 ms and link correctly.
4. **Given** a synthesized value, **When** it renders, **Then** it shows the "Illustrative" badge; seeded values do not.
5. **Given** a value-stream detail page, **When** I view participating roles, **Then** each shows its participation type (Lead/Core/Support/Control) exactly as in the workbook.

---

## Phase 3 — The Operating Model Explorer (the app *is* the drill)

**The question:** Can a CEO open one modern, immersive, top-down interactive flow on the whole company and drill all the way to a single person's tasks and performance — with the six lenses answerable at *every* level?

**Status:** ✅ Complete (2026-05-31). The Explorer **is** the application: it's the home route (`/`), the other top-level tabs are retired (detail pages remain as deep-link targets, reachable from the inspector and global search). One reusable React Flow surface (`DrillCanvas` + custom data-driven `DrillNode`) renders every canvas level; the deepest record levels (person, task) swap the canvas for a Recharts profile board. A type-aware `Inspector` answers the **six lenses — Who · What · How · Where · Why/Risk · How well** — for whatever node is focused, at every level. Verified end-to-end via Playwright (0 console errors) for both CEO acceptance walkthroughs.

The full drill, all working today: **Company → Division → Department → Value Stream → Sub-Value Stream → Applications (internal/external) → Initiatives in progress → Dependencies/Risks → Roles → Person (employee/contractor) → Tasks → Person metrics.** Levels with no real workbook data — initiatives, people/contractors, per-person tasks, person metrics, first-class risks — are seeded as **illustrative** data (`illustrative=true`), badged everywhere in the UI; later phases swap illustrative → real/authored/connected data with **no UI change** (the contract is uniform).

**Design direction: "elevated light."** Inter type scale, a single restrained accent over the navy neutral, three soft-shadow depth tiers, full-bleed canvas, custom nodes, animated level changes, and React Flow chrome fully themed (no default attribution, no rainbow palette). The "looks cheap" verdict on the prior three-surface version is what this phase exists to fix.

**What exists at the end:** A single immersive drill that opens on the company and digs to a person's metrics, with a persistent breadcrumb (deep-linkable, browser-back works), a focus inspector showing the six lenses for any node, lazy + cached level loading with hover prefetch, and skeleton states throughout. The three Phase-3-v1 surfaces (org chart, value-stream flow, dependency graph) are **absorbed** into drill levels and the Where/Why lenses.

**Components:**
- **Uniform per-node contract** (`backend/src/routes/explorer.ts`): `GET /explorer/node/:type/:id → { type, id, name, subtitle, illustrative, lenses{who,what,how,where,why,howWell}, children:{ childType, items[], total, nextCursor } }`, plus `/explorer/node/:type/:id/children?cursor=…` for big fan-outs. `:type` ∈ company|division|department|valueStream|subValueStream|application|initiative|role|person|task. One fetch per node serves **both** the inspector (its `lenses`) and the canvas (its `children`). Lens math reuses `CONTROL_CATEGORIES`/`PART_ORDER`; headcount via `groupBy`, person metrics via `avg` on the latest period; department→stream and division→stream are **derived** (Role → RoleValueStream), no new columns.
- **Schema (additive):** `Initiative`, `InitiativeValueStream`, `InitiativeDivision`, `Person`, `Assignment` (denormalized `employmentType`, index `[initiativeId, employmentType]` powering UC1), `PersonTask`, `PersonMetric` (`@@unique([personId, period, name])`), `Risk` — all `tenantId`-scoped, `illustrative` flagged, cascading from `Company` so the seed wipe stays one line.
- **Illustrative seed** (`backend/src/seed/illustrative.ts → seedDeepLevels`): deterministic (FNV-1a hash) — 6 flagship initiatives (Claims Transformation, Underwriting Modernization, …), ~492 people (≈70% contractor/SI in tech/claims/data), assignments, 3–6 tasks each, 4 metrics × 6 monthly periods, risks. Forces ≥1 **offshore UI-Developer contractor on Claims Transformation** so UC1 always resolves.
- **Frontend:** `pages/Explorer.tsx` (drill-frame stack + URL `/n/<type:id>/…` sync + cache + prefetch), `viz/DrillCanvas.tsx`, `viz/nodes/DrillNode.tsx`, `components/DrillBreadcrumb.tsx`, `components/Inspector.tsx` (type-keyed lens renderer registry), `components/PersonBoard.tsx` + `TaskBoard.tsx` (Recharts metric trends). Elevated-light tokens in `index.css` + `tailwind.config.js` (Inter, type scale, accent/surface, shadow tiers, RF theme overrides).

**Exit criteria (Given/When/Then):**
1. **Given** the app, **When** I land on `/`, **Then** the company opens as the parent of a drillable canvas and the inspector answers all six lenses for it.
2. **Given** any level, **When** I view its inspector, **Then** all six lens blocks (Who/What/How/Where/Why/How well) render, and illustrative levels show the "Illustrative" badge.
3. **(CEO UC1)** **Given** the Explorer, **When** I drill Company → Claims value stream → Claims Transformation initiative → its offshore UI-Developer contributor, **Then** I see that contractor's vendor/region and their performance metrics (throughput/quality/utilization/cycle-time trends).
4. **(CEO UC2)** **Given** the Underwriting division, **When** I drill to a single underwriter, **Then** the person board shows that one person's allocation, current tasks, and metric trends — "the value of a single underwriter."
5. **Given** any drilled node, **When** I copy its URL and reload, **Then** the full breadcrumb path restores (deep-linkable) and browser-back pops one level.
6. **Given** the build, **When** I run `tsc --noEmit` (both workspaces) and `vite build`, **Then** both pass; the Playwright walkthroughs run with 0 console errors; no React Flow attribution or rainbow palette remains.

---

## Phase 4 — Broader organization (v13) + insight visualizations at every level

**The question:** Can a CEO read *how the company operates as a whole* — at every drill level — from charts and graphs, rather than reading off labeled fields? And does the drill broaden to the full v13 model (value-stream domains, KPIs, process flows, I/O, reporting lines)?

**Status:** ✅ Complete (2026-05-31). Re-sourced from **`IT_Roles_Analytics_v13.xlsx`** and broadened the model into a single **operating-model-led drill with the org nested underneath**: **Company → Value-Stream Domain → Value Stream → Process Area → Sub-Process → Process Step**, and at the value-stream level *"who runs it"* leads into the org (**Role → People**, each linking back to its Division). The workbook's noisy 13–15 value-stream domains (six single-stream, several compound `A / B` labels) are **consolidated into 6 clean domains** (Core Insurance, Distribution & Customer, Technology & Data, Finance & Actuarial, Risk/Compliance/Audit, Corporate & Enterprise). The six operating-model questions are **answered silently through visualizations** — the labeled "● 01 · Who …" lens cards are gone; the inspector is an **insights panel** of titled chart cards (workforce donut + on/near/offshore split, KPI-attainment bars, KPI-vs-target bars, process-flow strip, risk-severity bars, work-focus category bars, reporting, systems, I/O mix). The **sidebar is a navigable index** — *How it operates* (the 6 domains) and *Who runs it* (the 14 divisions) — so the canvas stays operating-model-led while the org is one click away. **Drillable vs. static is explicit everywhere:** canvas nodes show a persistent "Dig deeper ›" cue (leaves show "detail"); panel rows that drill are accent-coloured with a `›` chevron, plain facts stay grey. Verified end-to-end via Playwright (0 console errors): company → 6 domains, domain → value-stream KPIs + process flow, value-stream "who runs it" → role → people, sidebar jump to any domain/division, and the CEO walkthroughs still resolve. **Data confirmed faithful to the workbook** (e.g. Claims Intake-to-Settlement: 17 KPIs / 36 steps / 32 I/O loaded = workbook exactly).

**What exists at the end:** The v13 spine loaded accurately — **15 value-stream domains, 14 divisions, 244 roles (90 reporting links + 84 extended roles), 26 value streams, 243 real KPI definitions, 256 E2E process steps, 835 inputs/outputs + data elements, 24 department standards** — plus the illustrative deep levels (people/initiatives/tasks/metrics/risks). Every drill node returns the same six-lens payload, but the UI renders it as charts titled by insight.

**Components:**
- `transform-workbook.ts` rewritten for v13 → expanded `spine.json` (domains, KPIs, process steps, I/O, extended roles, role-hierarchy, standards); role-name reconciliation extended; extended roles inherit division/department from their manager.
- Schema (migration `v13_domains_metrics_steps_io_roles`): `ValueStreamDomain`; `Metric` extended with the real KPI definition (category/formula/target text/owner/framework) + an illustrative current reading parsed against the real target; `ProcessStep`; `IoItem`; `Standard`; `Role` gains `managerRoleId` self-relation + `roleLevel`/`description`/`responsibilities`/`status`.
- Backend `explorer.ts`: `company` returns **grouped** children (Operating model + Organization); `domain → value streams`; `valueStream` lenses carry real KPIs + attainment + the step flow + I/O; `subValueStream(L4) → process steps`; `role → Direct reports + People` (grouped). KPI attainment is rolled up by category for domain/division/company.
- Frontend: `viz/charts.tsx` (Recharts donut/attainment-bars/KPI-bars/severity/category/flow-strip/IO-mix); `Inspector.tsx` rebuilt as the chart-driven insights panel (no lens labels); `DrillCanvas` clusters children into labeled bands; `DrillNode` gains domain/process-step styling + a band-label node.

**Exit criteria:**
1. **Given** the home view, **When** I open `/`, **Then** the Company drills into its **6 consolidated value-stream domains** (operating-model-led, not parallel bands), and the panel shows workforce, operating-model, and KPI-attainment charts — no labeled lens cards.
2. **Given** a value stream, **When** I focus it, **Then** I see its real KPIs charted against target, KPI attainment by category, its E2E process flow as a step strip, and a *"who runs it"* list of roles that drills into the org.
3. **Given** the sidebar, **When** I pick a domain or a division, **Then** the canvas jumps there and the current location is highlighted — both entry points are always visible.
4. **Given** any node or panel row, **When** I look at it, **Then** drillable elements carry a persistent "Dig deeper ›"/`›` affordance and plain facts do not, so it's obvious what digs deeper; and the six questions are answerable from charts with no "● 01 · Who" labels.
5. **Given** the build, **When** I run `tsc --noEmit` (both workspaces) + `vite build`, **Then** both pass and the Playwright walkthroughs run with 0 console errors.

---

## Phase 5 — Applications & Initiatives: real data + authoring

**Replaces illustrative:** the **Where** lens (applications) and the **Initiative** drill level + **Why** lens (risks/dependencies) — today seeded illustrative; this phase makes them authored/real. **Adds:** application, initiative, and risk authoring + link editors; retires the standalone dependencies surface.

**The question:** Can a user author real applications, initiatives, and risks — with their system roles, value-stream/division links, and contributors — so the Where lens, the Initiative level, and the Why/Risk lens become real, and the standalone dependency view is no longer needed?

**Status:** Not started.

**What exists at the end:** CRUD for `Application`, `Initiative`, `Risk` and their junctions (`ApplicationValueStream` system role; `InitiativeValueStream`/`InitiativeDivision`; risk links to stream/initiative/owner-role). The Where lens, the initiative drill level (with its contributor roll-up), and the Why/Risk lens all read authored data. Dependencies and risks live inside the Why lens and as risk nodes — the standalone external-interactions/dependency graph is absorbed and removed from the IA.

**Components:**
- zod forms + Express CRUD for applications/initiatives/risks; link editors (attach an app to a stream with a system role; link an initiative to streams/divisions; register a risk against a stream/initiative/owner role).
- The `illustrative` flag flips to `false` on authored rows; the badge disappears for them automatically (no UI change — uniform contract).
- Initiative contributor roll-up (`/explorer/initiatives/:id/contributors`) reads real assignments; the offshore-contractor query (UC1) resolves against authored data.
- Import path for an applications/initiatives CSV to bulk-author.

**Exit criteria:**
1. **Given** the authoring UI, **When** I create an application and attach it to two value streams with system roles, **Then** it appears in those streams' Where lens (no badge) with no code change.
2. **Given** an initiative I author with value-stream/division links and a sponsor, **When** I drill into it, **Then** its lenses and contributor canvas render from authored data.
3. **Given** a risk I register against a value stream, **When** I view that stream's Why/Risk lens, **Then** the risk appears with severity/status and links to its owner role.
4. **Given** authored applications/initiatives, **When** I run the CEO UC1 drill, **Then** the offshore UI-Developer contributor still resolves — now against real data.
5. **Given** an entity referenced in a drill, **When** I archive it, **Then** it leaves active lenses but historical references resolve gracefully.

---

## Phase 6 — Connected Data, RBAC, Audit & Governance

**Replaces illustrative:** nothing — this is the trust layer. **Adds:** the drill is now **gated by scope** (a viewer only drills what they're entitled to), every write is audited, and tenant isolation is RLS-backed.

**The question:** Is this enterprise-trustworthy — role-based access that gates the drill, an audit trail, data-freshness signals, and proven multi-tenant isolation (now backed by RLS)?

**Status:** Not started.

**What exists at the end:** JWT authentication (Cascade's, ported to TS), role-based permissions that scope what a user can drill into, the append-only audit log populated across all writes, data-freshness/staleness flags surfaced in the lenses, **and Postgres Row-Level Security as defense-in-depth** behind the app-layer scoping.

**Components:**
- Auth: `bcryptjs` + `jsonwebtoken`, `requireAuth` deriving `tenantId` from the session (never the request body), `requireRole(...)` — Cascade's middleware, migrated.
- RBAC layer: `Viewer` / `Editor` / `Admin` scoped to divisions/value streams; enforced per request and reflected in the drill — out-of-scope nodes are hidden/locked, the node endpoint 404s them.
- `AuditEntry` (append-only): actor, action, entity, before/after diff, UTC timestamp; queryable in-app (Cascade's `audit` route + `logAudit`, ported).
- Data-freshness: `updatedAt` + `lastReviewedAt` on records; a staleness flag surfaces records not reviewed in N months; optional review reminders.
- **RLS migration:** a raw-SQL Prisma migration enabling RLS and `CREATE POLICY USING (tenant_id = current_setting('app.current_tenant')::uuid)` on every table; the app connects as a non-owner role; middleware issues `SET LOCAL app.current_tenant = $1` inside the request transaction (see risk register for the pooled-connection caveat).
- Multi-tenant isolation test suite proving no query crosses tenants even with the GUC unset or a hostile `tenantId` in the body.

**Exit criteria:**
1. **Given** a `Viewer` scoped to one division, **When** they try to drill into another division (canvas or deep-link URL), **Then** the node 404s cleanly, the action is denied, and an audit event is recorded.
2. **Given** any create/edit/delete, **When** it completes, **Then** an `AuditEntry` with actor, before/after diff, and UTC timestamp exists and is visible.
3. **Given** two tenants, **When** an automated test queries tenant A's data while authenticated as tenant B (including a forged `tenantId`), **Then** zero rows leak — enforced by **both** app-layer scoping and RLS.
4. **Given** a record not reviewed in N months, **When** I focus it in the drill, **Then** its lens shows a staleness flag.
5. **Given** the audit log, **When** I filter by entity or actor, **Then** I can reconstruct the full change history of any record.

---

## Phase 7 — People, Assignments, Deliverables & Tasks: real (manual + CSV)

**Replaces illustrative:** the **Person** and **Task** levels and the **Who** lens — today seeded illustrative; this phase makes people, assignments, deliverables, and per-person tasks real (manual entry + CSV). **Adds:** people management and the employee-vs-offshore-contractor distinction everywhere in the drill.

**The question:** Can the model carry real people, role assignments, deliverables, and tasks — entered manually now, plugin-fed later — so the person board and Who lens are real?

**Status:** Not started.

**What exists at the end:** The `Person` / `Assignment` / `PersonTask` / deliverable layer is fully usable and authored: assign employees and contractors (with `employmentType`, vendor, region) to roles and initiatives, attach checklists/deliverables, record tasks by hand or CSV. Only `PersonMetric` remains illustrative (filled by Phase 8). The person board renders real tasks; UC1/UC2 run on real people.

**Components:**
- People management UI: create employees/contractors, set `employmentType`/`vendor`/`region`, assign to roles + initiatives with allocation % and dates.
- Per-person deliverables/checklist with completion status (seeded from `Items`, editable); `PersonTask` entry + CSV import.
- The drill's person board reads real assignments/tasks; the `illustrative` badge clears on Who/What for authored people.
- Roll-ups: department/value-stream/initiative headcount and load aggregate real person-level data.

**Exit criteria:**
1. **Given** a role, **When** I assign an employee and an offshore contractor with allocation %, **Then** both appear on the role's person canvas, the headcount lens, and the initiative contributor roll-up.
2. **Given** a person, **When** I attach deliverables and mark some complete, **Then** completion % is correct on the person board and rolls up to the department lens.
3. **Given** a CSV of tasks, **When** I import it, **Then** rows land as `PersonTask`s and render on the person board.
4. **Given** an employee vs. an offshore contractor, **When** I drill either, **Then** `employmentType`/region is distinguished on the node, the board, and the Who lens.
5. **Given** real people, **When** I run CEO UC1 and UC2, **Then** both walkthroughs resolve against authored data (only the metric trends remain illustrative until Phase 8).

---

## Phase 8 — Connectors + DORA → real person metrics (last illustrative replaced)

**Replaces illustrative:** the **How-well** lens at the person level — `PersonMetric` is the last illustrative data; this phase feeds it from real connectors so the person board's throughput/quality/cycle-time trends become real. **Adds:** the connector framework + DORA.

**The question:** Can external tools (GitHub/Jira/Slack) auto-populate person metrics, computing DORA, so the deepest lens (How well) is real and **no illustrative data remains anywhere**?

**Status:** Not started.

**What exists at the end:** A pluggable connector framework (OAuth, webhook-first ingestion under `/api/connectors`, normalized into `PersonMetric`/`WorkStat`) and the first live connector (GitHub *or* Jira), feeding real commits/PRs/tickets into the person board and the roll-up How-well lenses. DORA metrics computed by correlating connector data. After this phase the "Illustrative" badge is gone from the product.

**Components:**
- Connector abstraction: a declarative manifest per integration; centralized OAuth/token storage/refresh, rate-limiting, retries, observability; Express webhook receivers with polling fallback.
- First connector (GitHub recommended — commits/PRs/review duration map cleanly to person throughput/quality).
- Normalization layer: external events → `PersonMetric` rows (period/name/value), attributed to the right `Person`/`Assignment`; `illustrative` flips to `false`.
- DORA computation correlating deploys + incident signals; surfaced in the delivery roll-up lens, drillable to source events.
- Privacy boundary: tenant/person identity derived from connector config + payload, never cross-tenant.

**Exit criteria:**
1. **Given** a connected GitHub org, **When** a commit/PR lands, **Then** within the ingestion window a normalized `PersonMetric` row appears against the correct person and shows on their board (no badge).
2. **Given** the framework, **When** a second connector is added, **Then** it reuses the OAuth/normalization/observability scaffolding without bespoke plumbing.
3. **Given** correlated deploy + incident data, **When** I focus the delivery lens, **Then** all four DORA metrics compute over a chosen window, each drillable to source events.
4. **Given** a token expiry, **When** ingestion runs, **Then** it refreshes silently or surfaces a clear re-auth prompt — never crashing the pipeline.
5. **Given** the whole product, **When** I drill any level, **Then** no "Illustrative" badge remains — every lens is real or authored.

---

## Phase 9 — Polish & Daily-Driver Hardening

**Replaces illustrative:** nothing — the data is all real by Phase 8. **Adds:** the drill is fast, keyboard-navigable, accessible, and exportable at every level.

**The question:** Is the drill off the charts — per-level performance budgets, keyboard drill navigation, accessibility, board-ready export of any drill view, and onboarding good enough that a CEO uses it unprompted?

**Status:** Not started.

**What exists at the end:** Per-level p95 budgets met, keyboard-driven drill (enter to drill, esc/backspace to pop, arrow between sibling nodes), accessibility pass over the canvas + inspector, PDF/PNG export of any drill view (canvas or person board), polished empty/loading/error/skeleton states everywhere, onboarding polish.

**Components:**
- Performance: query/index tuning, node-payload caching, per-level p95 budgets enforced in CI (alongside `tsc --noEmit`).
- Keyboard drill nav: focus-ring traversal of sibling nodes, enter = drill, esc/backspace = pop, `/` = search; full breadcrumb reachable by keyboard.
- Accessibility: ARIA on the canvas/nodes/inspector lenses, contrast, focus management; charts have text alternatives.
- Export: PDF/PNG of any drill view or person board, watermarked with tenant + timestamp.
- Onboarding: first-run guided drill (Company → a person) for the "show me the value of one person" path.

**Exit criteria:**
1. **Given** any drill level on a mid-tier laptop, **When** I open it, **Then** it meets its p95 budget (canvas levels <2 s, boards <1.5 s) and CI fails on regression.
2. **Given** an accessibility audit on the drill, **Then** zero critical violations and every node/lens/breadcrumb is keyboard-reachable.
3. **Given** any drill view, **When** I export it, **Then** I get a clean PDF/PNG watermarked with tenant + timestamp.
4. **Given** any node, **When** its data is empty/loading/errored, **Then** a purpose-built state renders.
5. **Given** a new CEO user, **When** they first sign in, **Then** the onboarding drill walks them from the company to a single person's metrics.

---

## Definition of Done (project-wide, every phase)

- Code reviewed and merged to `main`; Preview deploy green.
- `tsc --noEmit` passes in every workspace (no `any`-leakage at the API boundary; shared zod schemas are the contract).
- Migrations are forward-only and run cleanly on a fresh Neon branch.
- The seed remains idempotent (re-run produces zero duplicates).
- Tenancy holds: an automated test proves no cross-tenant leak for any new table (app-layer from Phase 1; RLS-backed from Phase 6).
- p95 page/query budgets met for the phase's surfaces.
- No secrets, no source `.xlsx`, committed.
- Empty/loading/error states exist for every new data surface.
- README and `.env.example` updated for any new env var or setup step.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| **TS migration introduces type drift across the API boundary** | A shared `shared/` workspace of zod schemas is the single contract; backend validates with them, frontend infers types from them. `tsc --noEmit` gates CI in both workspaces. |
| **Spreadsheet structure drifts** (a future v13 renames sheets/columns) | Seed reads a *normalized export* (CSV/JSON) checked into the repo via `transform-workbook.ts`, not the raw `.xlsx`. A documented transform isolates workbook quirks from the schema. |
| **Category taxonomy noise** (~19 canonical categories plus stray variants) | Normalize to a canonical list in the transform; map variants via a small crosswalk; never seed raw category strings. |
| **Re-seed creates duplicates** | Natural-key `@@unique` constraints; seed uses `upsert` + `createMany({ skipDuplicates: true })`. Phase 1 exit #2 tests the no-op re-run. |
| **Cross-tenant data leak** | App-layer scoping (helpers + `where` tenant filters) from day one; RLS added Phase 6 as defense-in-depth; isolation test suite gates every new table. |
| **RLS + pooled connection GUC mismatch** | With PgBouncer/pooled connections, a session-level `SET app.current_tenant` can bleed across requests. Set it as `SET LOCAL` **inside the same transaction** as the query (`prisma.$transaction`), or scope it via a connection acquired for that request. Benchmark before relying on it; app-layer scoping remains the primary guard. |
| **Prisma can't express recursive drill-down** | Use `prisma.$queryRaw<Row[]>` with `WITH RECURSIVE` for tree/roll-up endpoints; keep them in `services/` behind typed functions. Add `ltree`/closure table only if profiling shows a specific hot subtree. |
| **Serverless connection exhaustion** | `globalThis`-guarded singleton `PrismaClient`; pooled `DATABASE_URL` with `?pgbouncer=true`; `DIRECT_URL` only for migrations. If cold-start p99 is unacceptable, disable Neon scale-to-zero on production and re-benchmark. |
| **`vercel.json` breaks the build** | Replace the deprecated `experimentalServices` config with `buildCommand`/`outputDirectory`/`rewrites`. API mounted under `/api`; dev proxy does not strip the prefix, so dev == prod. |
| **Diagram performance at scale** | SVG (React Flow) is fine to ~thousands of nodes; move a single >10k-node view to Canvas (ECharts). Auto-layout (elk/dagre) keeps large graphs readable. |
| **ORM choice ages** | Keep DB access behind `backend/src/db/` and `services/`. Prisma matches the Cascade repo and ships fully-typed clients; if it regresses, the swap is contained. Benchmark on our infra before locking in. |
| **Connector scope creep into early phases** | Connectors are Phase 8 only. `WorkStat` is finalized in Phase 7 so connectors plug in with no migration. |
| **"Connected data" claims break under edits** | Every dashboard/diagram derives from the DB with explicit cache invalidation on write; Phase 3/4/5 exit criteria each include an "edit reflects everywhere" check. |
| **Soft-delete leaves broken diagrams** | `archivedAt` instead of hard delete; archived entities resolve gracefully in historical references (Phase 5 #5). |
| **Insurance/regulated-data obligations** (residency, SOC 2, model audit) | Out of scope for the build; flagged for evaluation before any production customer. App-layer scoping, RLS, audit log, and `SourceRef` provenance are the foundations those obligations build on. |

---

## Repository Layout

```
strata/                            # npm workspaces monorepo (Cascade layout)
├── api/
│   └── index.ts                   # Vercel serverless entrypoint → exports Express app
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # all entities + junctions (+ RLS migration, Phase 6)
│   │   └── migrations/            # forward-only Prisma migrations
│   ├── scripts/
│   │   ├── transform-workbook.ts  # v12 .xlsx → normalized CSV/JSON
│   │   ├── verify-seed.ts         # asserts counts match the workbook
│   ├── src/
│   │   ├── app.ts                 # Express app; routers mounted under /api
│   │   ├── index.ts               # local dev listener (port 4000)
│   │   ├── db/prisma.ts           # serverless-safe singleton
│   │   ├── routes/                # companies, value-streams, applications, roles, people, …
│   │   ├── services/              # recursive-CTE drill-down/roll-up, rules engine, notifications
│   │   ├── middleware/            # auth (JWT), rbac, tenant scoping
│   │   ├── connectors/            # Phase 8 framework (OAuth, normalize, ingest)
│   │   └── seed/seed.ts           # idempotent batched upserts
│   └── data/seed/                 # checked-in normalized export (NOT the .xlsx)
├── frontend/
│   ├── index.html
│   ├── vite.config.ts             # /api dev proxy (no prefix rewrite)
│   └── src/
│       ├── main.tsx, App.tsx
│       ├── pages/                 # company/division/value-stream/role/people, diagrams, dashboards, admin
│       ├── components/            # Layout, PageHeader, KpiTile, StatusPill (ported from Cascade)
│       ├── viz/                   # React Flow nodes/layout, d3-org-chart wrapper, heatmap
│       └── lib/                   # api client, auth context, format helpers (all .ts/.tsx)
├── shared/
│   └── schemas/                   # zod schemas → contract types for both sides
├── docs/                          # FUNCTIONAL / TECHNICAL / PRODUCT_GUIDE
├── vercel.json                    # rewrites: /api/(.*) → /api ; outputDirectory frontend/dist
├── .env.example                   # DATABASE_URL, DIRECT_URL, JWT_SECRET, …
├── .gitignore                     # .env*, *.xlsx, secrets
└── README.md                      # this plan
```

Packages and folders are created as phases land — no empty placeholders. `connectors/` arrives in Phase 8; `middleware/{auth,rbac}` is ported in Phase 0 and activated in Phase 6.

---

## Deliberately Not In This Plan (yet)

- **Live Jira/GitHub/Slack/Teams connectors before Phase 8.** Work stats are manual/CSV until the framework exists; the schema is connector-ready from Phase 7.
- **A graph database.** Plain Postgres + junction models + recursive CTEs (`$queryRaw`) cover the relationships. Re-evaluate only if queries routinely traverse >7 hops (then Apache AGE in Postgres before a separate graph DB).
- **`ltree` / closure tables up front.** Added only for a specific subtree that profiling proves is hot.
- **A separately-hosted, always-on Express server.** The Express app runs as a Vercel serverless function behind `/api/*`; the only long-running process is `npm run dev` locally.
- **Next.js / React Server Components.** The v1.0 App-Router approach is dropped in favor of the Cascade Vite SPA + Express serverless split.
- **Drizzle ORM.** Replaced by Prisma to match the repo.
- **Auth.js / a hosted IdP.** Auth is Cascade's JWT scheme (Phase 6); SAML SSO is a later add.
- **Monte-Carlo / probabilistic ROI.** The engine is deterministic; sensitivity analysis is a later module.
- **Real-time multi-user collaboration.** Optimistic single-user editing + audit log is enough until collaboration is a felt need.
- **Mobile-first UI.** Responsive enough for laptops/tablets in a meeting (Cascade's responsive shell carries this); no dedicated mobile app.
- **Localization / AI narrative generation / air-gapped deployment.** English first; managed Vercel + Neon is the target; all noted as later differentiators.

---

## Key References

- **Stack & deploy:** Vite static build + Express serverless function on one Vercel project (`rewrites` config, API mounted under `/api`); Neon Postgres pooled vs. direct connection strings; per-PR Neon branches.
- **ORM:** Prisma ORM (`schema.prisma`, generated typed client, `migrate deploy`, `$queryRaw` for recursive CTEs) with a serverless-safe singleton client.
- **Language/toolchain:** TypeScript throughout; `tsx` for backend dev; Vite for frontend; shared zod schemas as the API contract; `tsc --noEmit` in CI.
- **Data modeling:** Postgres adjacency list + recursive CTEs; junction models over a graph DB; app-layer tenant scoping with Postgres RLS as Phase 6 defense-in-depth.
- **Visualization:** React Flow (`@xyflow/react`); d3-org-chart; Recharts (Tremor optional); ECharts as the Canvas escape hatch.
- **Reused from Cascade:** JWT auth + RBAC middleware, audit log, rules engine, notification dispatcher, tenant-scoping helpers, the Vite app shell and Tailwind design tokens — all ported to TypeScript.
- **Seed source of truth:** `IT_Roles_Analytics_v12.xlsx` — 14 divisions, ~97 departments, 159 roles, ~25 L2 value streams, ~100 L3/L4 sub-streams, ~3,337 checklist items, ~4,743 role tasks, ~19 categories, external interactions, role × category matrix.