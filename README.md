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

**Status:** Not started.

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

**Status:** Not started.

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

**Status:** Not started.

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

## Phase 3 — Interactive Diagrams & Flow Charts

**The question:** Can a user *see* the operating model — pan, zoom, and click into value-stream flows, application-dependency graphs, and org charts?

**Status:** Not started.

**What exists at the end:** Three interactive surfaces driven live from the relational data: (a) value-stream flow maps (L2 → L3/L4 with inputs/outputs/upstream/downstream), (b) application-dependency graphs (apps ↔ value streams ↔ external interactions), (c) the org chart (division → department → role). Clicking a node deep-links to its Phase 2 detail page.

**Components:**
- React Flow (`@xyflow/react`) for flow maps and dependency graphs; custom typed nodes show name, owner role, participation type, automation/exposure color band.
- Auto-layout (dagre/elk); pan/zoom/minimap/controls.
- d3-org-chart (thin React/TS wrapper) for the collapsible org chart with headcount badges.
- Edges built from junction-model rows (`RoleValueStream`, `ApplicationValueStream`, `ExternalInteraction`) served by typed endpoints.
- Click-through: node → Phase 2 detail page; drill node → expand L3/L4 children in place.

**Exit criteria:**
1. **Given** a value stream, **When** I open its flow map, **Then** its L3/L4 sub-processes render as a laid-out, pannable/zoomable graph with inputs/outputs visible, in <2 s.
2. **Given** a flow node, **When** I click it, **Then** I deep-link to that entity; **When** I expand it, **Then** child sub-streams appear without a full reload.
3. **Given** the application-dependency view, **When** I select an application, **Then** the graph highlights every value stream and external interaction it touches, sourced from junction rows (not hardcoded).
4. **Given** the org chart, **When** I collapse/expand a division, **Then** departments and roles animate and headcount badges are correct.
5. **Given** a diagram, **When** the underlying data changes (Phase 5), **Then** re-opening it reflects the change with no code edit (connected-data proof).

---

## Phase 4 — ROI & Overview Dashboards

**The question:** Can an executive get on-demand roll-up insight — KPIs, ROI, and the role-by-category analytics — without exporting anything?

**Status:** Not started.

**What exists at the end:** A dashboard layer: a portfolio/overview dashboard (counts, coverage, status roll-ups), an ROI dashboard (cost/benefit/automation roll-ups with drill-to-source), and the role × category analytics matrix as an interactive heatmap — all generated live from Neon.

**Components:**
- Recharts KPI cards, bar/area/line charts, delta indicators (Recharts already ships in Cascade; Tremon/Tremor optional if a richer card library is wanted).
- Role-by-category heatmap (the `Role_by_Category` matrix) as a derived raw-SQL view, click-to-drill into underlying tasks.
- ROI roll-ups computed by recursive CTE over the hierarchy (every figure drillable to its source role/task — "show your work"), in a ported/extended `services/rollup.ts`.
- Scope filters (company / division / value stream) recompute roll-ups live.
- Heavy aggregates cached per (tenant, scope) with explicit invalidation on write.

**Exit criteria:**
1. **Given** the seeded company, **When** I open the overview dashboard, **Then** counts match the DB exactly and render <2 s p95.
2. **Given** the ROI dashboard, **When** I drill any roll-up figure, **Then** it decomposes to contributing roles/tasks down to the source row.
3. **Given** the analytics heatmap, **When** I click a (role, category) cell, **Then** I see the exact tasks behind that count.
4. **Given** a scope filter, **When** I switch from company to a division, **Then** every figure recomputes within 1 s.
5. **Given** a value edited in Phase 5, **When** I reload the dashboard, **Then** roll-ups reflect it (connected data, no manual cache refresh).

---

## Phase 5 — Authoring / CRUD (add & edit everything)

**The question:** Can a user create and edit companies, divisions, value streams, sub-streams, SOPs, applications, initiatives, and roles — with the same depth as the seeded data?

**Status:** Not started.

**What exists at the end:** Full create/edit/(soft-)delete for every entity and relationship, with validation, optimistic UI, and the connected-data guarantee. This is what makes Strata a platform rather than a viewer.

**Components:**
- zod-validated typed forms (shared schemas) and Express route handlers per entity; relationship editors (link a role to value streams with a participation type; attach applications to streams; assign roles to a department) — the Cascade route pattern (zod parse → tenant-scoped lookup → Prisma write → audit), ported to TS.
- A "new company" wizard scaffolding an empty tenant with the canonical category taxonomy pre-loaded.
- Optimistic updates + server reconciliation; recursive-CTE roll-ups recompute on write; affected dashboard caches invalidated.
- Soft delete (`archivedAt`) so nothing referenced is hard-deleted under a diagram.
- Inline validation (a sub-stream must belong to a value stream; a role's department must belong to a division).

**Exit criteria:**
1. **Given** the authoring UI, **When** I create a value stream and attach two roles with participation types, **Then** it appears in the hierarchy, the flow map, and the dashboards with no code change or manual cache bust.
2. **Given** an existing role, **When** I move it to another department, **Then** the org chart, roster, and every roll-up update on next view.
3. **Given** a "new company" action, **When** I complete the wizard, **Then** an isolated tenant exists with the taxonomy seeded and zero cross-tenant data visible.
4. **Given** invalid input (orphan sub-stream, missing required field), **When** I submit, **Then** the form blocks with a specific message and nothing is written.
5. **Given** an entity referenced by a diagram, **When** I archive it, **Then** it disappears from active views but historical references resolve gracefully.
6. **Given** any create/edit, **When** it succeeds, **Then** the change reflects in <1 s in the editing view and is durable across reload.

---

## Phase 6 — Connected Data, RBAC, Audit & Governance

**The question:** Is this enterprise-trustworthy — role-based access, an audit trail, data-freshness signals, and proven multi-tenant isolation (now backed by RLS)?

**Status:** Not started.

**What exists at the end:** JWT authentication (Cascade's, ported to TS), role-based permissions, the append-only audit log populated across all writes, data-freshness/staleness flags, **and Postgres Row-Level Security as defense-in-depth** behind the app-layer scoping.

**Components:**
- Auth: `bcryptjs` + `jsonwebtoken`, `requireAuth` deriving `tenantId` from the session (never the request body), `requireRole(...)` — Cascade's middleware, migrated.
- RBAC layer: `Viewer` / `Editor` / `Admin` scoped to divisions/value streams; enforced per request, backed by RLS.
- `AuditEntry` (append-only): actor, action, entity, before/after diff, UTC timestamp; queryable in-app (Cascade's `audit` route + `logAudit`, ported).
- Data-freshness: `updatedAt` + `lastReviewedAt` on records; a staleness flag surfaces records not reviewed in N months; optional review reminders.
- **RLS migration:** a raw-SQL Prisma migration enabling RLS and `CREATE POLICY USING (tenant_id = current_setting('app.current_tenant')::uuid)` on every table; the app connects as a non-owner role; middleware issues `SET LOCAL app.current_tenant = $1` inside the request transaction (see risk register for the pooled-connection caveat).
- Multi-tenant isolation test suite proving no query crosses tenants even with the GUC unset or a hostile `tenantId` in the body.

**Exit criteria:**
1. **Given** a `Viewer` scoped to one division, **When** they attempt to edit a role or view another division, **Then** the action is denied cleanly and an audit event is recorded.
2. **Given** any create/edit/delete, **When** it completes, **Then** an `AuditEntry` with actor, before/after diff, and UTC timestamp exists and is visible.
3. **Given** two tenants, **When** an automated test queries tenant A's data while authenticated as tenant B (including a forged `tenantId`), **Then** zero rows leak — enforced by **both** app-layer scoping and RLS.
4. **Given** a record not reviewed in N months, **When** I view it or the governance dashboard, **Then** it shows a staleness flag.
5. **Given** the audit log, **When** I filter by entity or actor, **Then** I can reconstruct the full change history of any record.

---

## Phase 7 — People, Assignments, Deliverables & Work Stats (manual)

**The question:** Can the model carry real people, role assignments, deliverables, and work stats — entered manually now, plugin-fed later?

**Status:** Not started.

**What exists at the end:** The `Person` / `Assignment` / `Deliverable` / `WorkStat` layer is fully usable: assign employees and contractors to roles, attach checklists/deliverables, record work stats by hand or CSV. The `WorkStat` schema is the exact shape the Phase 8 connectors will write to.

**Components:**
- People management UI: create employees/contractors, set `employmentType`, assign to roles with allocation % and dates.
- Per-person deliverables/checklist with completion status (seeded from `Items`, editable).
- `WorkStat` entry + CSV import (`source = "manual"`, normalized `metric`/`value`/`periodStart`).
- Person dashboard: assignments, deliverable completion, work-stat trends (Recharts).
- Roll-ups: department/value-stream views aggregate person-level stats.

**Exit criteria:**
1. **Given** a role, **When** I assign an employee and a contractor with allocation %, **Then** both appear on the role, the department roster, and the org-chart headcount.
2. **Given** a person, **When** I attach deliverables and mark some complete, **Then** completion % is correct on the person dashboard and rolls up to the department.
3. **Given** a CSV of work stats, **When** I import it, **Then** rows land in `WorkStat` with `source="manual"` and render as trends.
4. **Given** the `WorkStat` schema, **When** reviewed against the Phase 8 connector contract, **Then** a connector can write with no migration (verified by a mock connector writing one row).
5. **Given** an employee vs. a contractor, **When** I view assignments, **Then** `employmentType` is distinguished everywhere it matters.

---

## Phase 8 — Connector Framework + First Plugin + DORA

**The question:** Can external tools (GitHub/Jira/Slack) auto-populate work stats, and can we compute DORA metrics from them?

**Status:** Not started.

**What exists at the end:** A pluggable connector framework (OAuth, webhook-first ingestion under `/api/connectors`, normalized into `WorkStat`) and the first live connector (GitHub *or* Jira), feeding real commits/PRs/tickets into existing person and dashboard views. DORA metrics are computed by correlating connector data.

**Components:**
- Connector abstraction: a declarative manifest per integration; centralized OAuth/token storage/refresh, rate-limiting, retries, observability; Express webhook receivers with polling fallback.
- First connector (GitHub recommended — commits/PRs/review duration map cleanly to `WorkStat`).
- Normalization layer: external events → internal `WorkStat` rows, attributed to the right `Person`/`Assignment`.
- DORA computation correlating GitHub deploys + (Jira/incident) signals; surfaced on a delivery dashboard with the caveat that no single source has all four metrics.
- Privacy boundary: tenant/person identity derived from connector config + payload, never cross-tenant.

**Exit criteria:**
1. **Given** a connected GitHub org, **When** a commit/PR lands, **Then** within the ingestion window a normalized `WorkStat` row appears against the correct person.
2. **Given** the framework, **When** a second connector is added, **Then** it reuses the OAuth/normalization/observability scaffolding without bespoke plumbing.
3. **Given** correlated deploy + incident data, **When** I open the delivery dashboard, **Then** all four DORA metrics compute over a chosen window and each is drillable to source events.
4. **Given** a token expiry, **When** ingestion runs, **Then** it refreshes silently or surfaces a clear re-auth prompt — never crashing the pipeline.
5. **Given** a connector for tenant A, **When** it ingests, **Then** no data is written to any other tenant (isolation test).

---

## Phase 9 — Polish & Daily-Driver Hardening

**The question:** Is the attention to detail off the charts — fast, accessible, exportable, and good enough that an executive uses it unprompted?

**Status:** Not started.

**What exists at the end:** Performance budgets met, accessibility pass, board-ready exports (PDF/PNG of diagrams and dashboards), empty/loading/error states everywhere, keyboard navigation, onboarding polish.

**Components:**
- Performance: query/index tuning, aggregate caching, p95 budgets enforced in CI (alongside `tsc --noEmit`).
- Accessibility: keyboard nav, ARIA, contrast, focus management across diagrams and tables.
- Exports: PDF/PNG of any diagram or dashboard, watermarked with tenant + timestamp.
- Polished empty/loading/error/skeleton states on every surface; micro-interactions on diagrams.
- Onboarding: first-run guide for the "new company" path.

**Exit criteria:**
1. **Given** any primary page on a mid-tier laptop, **When** it loads, **Then** it meets its p95 budget (lists <1.5 s, diagrams <2 s, dashboards <2 s) and CI fails on regression.
2. **Given** an accessibility audit on core flows, **Then** zero critical violations and every interactive element is keyboard-reachable.
3. **Given** any diagram or dashboard, **When** I export it, **Then** I get a clean PDF/PNG watermarked with tenant + timestamp.
4. **Given** any data-fetching surface, **When** data is empty/loading/errored, **Then** a purpose-built state renders.
5. **Given** a new user, **When** they create their first company, **Then** the onboarding guide walks them through it.

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