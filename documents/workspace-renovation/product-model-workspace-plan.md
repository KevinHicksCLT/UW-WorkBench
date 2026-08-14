# Product Model Workspace — 4-Agent Parallel Build Plan

**Branch family:** `Product-Model-Workspace` (integration branch) with one sub-branch per agent.
**Scope:** extend the Workspace module (menu key `workspace`, path `/portfolio`) with a fourth
rationalizable structure — **Product Models** — alongside Applications, Value Streams, and Roles;
refactor the workspace so **every piece of board data comes from the database**; implement the
**Workspace Board v3 wireframe** across all four structures; seed **atomic-detail, insurance-accurate
data** for ABC Insurance; and add an **ontology/taxonomy layer** (SKOS) covering the workspace
domains.

This plan supersedes the draft "Product Model Workspace — Design & Build Plan" where the two
disagree, because the draft was written against assumptions that do not match the repo:

| Draft assumption | Repo reality |
|---|---|
| Findings model is `RationalizationFinding` | Findings are **`RationalizationCapability`** (schema.prisma ~line 1920) |
| `backend/scripts/export-taxonomy.ts` exists (cited in the uploaded TTL) | **Does not exist** — the uploaded `taxonomyabcinsurance.ttl` / `.json` files define the *target output format*; the script is new work (Agent 1) |
| WR-12/13 pgvector embeddings available to reuse | **Not built** — R2 of the renovation plan is still pending; semantic matching ships in a non-vector form first (ontology + normalized-name matching), pgvector remains deferred (PM-09) |
| Board renders N legacy columns | `boardNodes.tsx:297` hard-caps at **two** legacy apps (`legacyApps.slice(0, 2)`) |
| Anatomy catalog model is `AnatomyCategory` per layer | Correct, but it also has a `view` axis (COMPONENT \| BEHAVIOR \| MISPLACED) from WR-06 that the product-model twin must mirror |

---

## 0. Ground truth (repo audit, 2026-07-11)

- **Workspace UI:** `frontend/src/pages/greenfield-migration/` (2,821 lines across 11 files;
  shell `GreenfieldMigration.tsx` 665 lines, board builder `boardNodes.tsx` 547, tri-mode
  `LensBar.tsx` 418). `/portfolio` → `frontend/src/pages/portfolio/Portfolio.tsx` (16-line wrapper).
- **Workspace API:** `backend/src/routes/rationalization.ts` (646 lines, single file — already
  over the 500-line ceiling; this refactor splits it into a `routes/rationalization/` feature
  module per backend-standards).
- **Board data is already DB-backed** (stages, findings, apps, components, microservices, screens,
  anatomy catalog all come from the API). What is **not** DB-backed — and must become so:
  - `frontend/src/lib/rationalization.ts`: `LAYERS` (the entire row axis), `CAPDAN_META`/`CAPDAN_ORDER`,
    `STATUS_META`/`STATUS_ORDER` — hardcoded vocabulary.
  - `LensBar.tsx`: `MODES` and `VIEWS` inline arrays.
  - `backend/src/routes/rationalization.ts:129-167`: `GF_NEW` / `COMP_NEW` hardcoded scaffold
    templates written into the DB on `POST /initiatives`.
- **Schema:** `Rationalization*` family at schema.prisma 1783–2017. **No `ProductModel*` models
  exist** — PM-01 is greenfield. Migrations are ledger-only (0_baseline + 12), `db push` banned.
- **Seed:** orchestrated by `backend/src/seed/seed.ts` (company **ABC Insurance**, tenant `strata`);
  workspace demo boards in `backend/src/seed/rationalization.ts` (1,186 lines) and
  `backend/src/seed/seedAnatomyCatalog.ts`.
- **Ontology uploads (target format):** `taxonomyabcinsurance.ttl` + `.json` — SKOS
  (`skos:Concept` / `skos:ConceptScheme`, prefixes `tb:` = `https://w3id.org/transformation-bridge/ontology#`,
  `tbi:` = `https://w3id.org/transformation-bridge/id/`) with three schemes today: `process`
  (12,146 concepts), `organization` (120), `standards` (1,339); plus a compact viewer JSON
  (`taxonomyviewerdata.json`: nested `{l,n,e,c}` trees). The build adds `applications`, `roles`,
  and `product-model` schemes and creates the exporter.
- **Renovation plan:** `documents/workspace-renovation/renovation-plan.md` — R0/R1 shipped
  (WR-01..06, 09, 10, 15), R2/R3 pending. The v3 wireframe is the next design iteration on top of
  the shipped R1 board.

## 0.1 The v3 wireframe, decomposed (what every domain mode must render)

From `workspace_wireframe.pdf` / the FNOL Workspace Board v3 design:

1. **Top bar** — structure tabs (Applications / Value streams / Roles / **Products**), scoping
   selects (e.g. Applications: *Claims Platform*; Process (L4): *Annuity Application Intake &
   Good-Order*), `Edit board`, `+ New…`, and a **legend**: green = *correct — stays*, red = *needs
   to move*, `2→1 semantically same · auto`, `REVIEW semantically different`.
2. **Legacy columns** (left) — one panel per legacy source (e.g. *ClaimsLegacy — 12 screens ·
   80 steps — 43 correct · 17 move*), sectioned by axis rows (UI / Integration / Business Service /
   Data / Infrastructure), each item flagged ✓ *correct here* or ✗ with a relocation badge
   (`→ Business`, `→ Integration`, `→ Dead code`), and an expandable **"WHY THIS MOVES"** panel
   (what the screen captures / sends / processes / validates, plus where the logic lands).
3. **Normalize column** (center) — header roll-up (*102 raw steps · 58 normalized · 5 awaiting
   review*); one box per axis row showing **side-by-side comparison cards** (source A vs source B),
   per-group verdicts (*all 14 fields match on name, type and order*), **normalized entries** with
   stable notations (`#N-101 Loss Capture Form — 14 fields · 1 capability — 2→1 AUTO`), and **HELD /
   REVIEW** cards where the sources are semantically different (*same 22 fields — flow shape and
   validation timing differ*), each with a proposed resolution awaiting sign-off.
4. **Greenfield column** (right) — target builds with status chips (BUILDING / PLANNED), tech
   stack line, and inbound counts (*10 in ›*).
5. **Dead code lane** — full-width red band (*Dead code 7 — across both apps — unreachable /
   superseded, retire with sign-off*).
6. **Edges** — green (correct, stays in its row) and red (relocations) bezier links from legacy
   items into Normalize boxes; green links from Normalize boxes to Greenfield targets.

For **Products** mode the same skeleton applies with: columns = `LegacyProductModel`s, rows = the
11 product components, card color by `scope` (Common = blue, Segment = tan/orange, Geography =
grey, Eliminate = red/dead lane), and the in-box expansion revealing matched
`ProductModelAnatomyCategory` sub-categories.

---

## 1. Parallelization strategy — how four agents avoid collisions

**The anti-collision device is a file-ownership matrix plus contracts frozen in this document.**
Every file (existing or new) has exactly one owning agent; the schema DDL, API DTOs, vocabulary
shape, and ontology URI scheme are specified here (§6) so downstream agents code against the
contract, not against another agent's in-flight branch.

### File-ownership matrix (exclusive — no other agent edits these)

| Path | Owner |
|---|---|
| `backend/prisma/schema.prisma`, `backend/prisma/migrations/**` | **Agent 1** |
| `documents/value-streams/Master Documentation/erd_v5.mmd` | **Agent 1** |
| `backend/src/seed/**` (incl. new `productModel.ts`, `seedProductModelAnatomy.ts`, edits to `seed.ts`, `rationalization.ts`, `seedAnatomyCatalog.ts`) | **Agent 1** |
| `backend/scripts/export-taxonomy.ts` (new), `backend/scripts/seed-*.ts` | **Agent 1** |
| `backend/src/routes/rationalization/**` (new module dir replacing `rationalization.ts`), `backend/src/routes/product-models/**` (new), `backend/src/routes/taxonomy.ts` (new) | **Agent 2** |
| `backend/src/app.ts`, `backend/src/lib/ontology/**` (new), `backend/src/lib/resolvers/**` (only if a new resolver is needed) | **Agent 2** |
| `backend/tests/**` for routes/lib | **Agent 2** (Agent 1 owns `backend/tests/seed/**`) |
| `frontend/src/pages/greenfield-migration/**`, `frontend/src/lib/rationalization.ts` | **Agent 3** |
| `frontend/tests/**/greenfield-migration/**` | **Agent 3** |
| `frontend/src/pages/product-models/**` (new), `frontend/src/pages/portfolio/Portfolio.tsx`, `frontend/src/App.tsx`, `shared/src/menuRegistry.ts` | **Agent 4** |
| `e2e/**`, `documents/workspace-renovation/renovation-plan.md` (status updates) | **Agent 4** |

Deliberate consequences of this split:

- **Only Agent 1 touches the schema and seeds.** Agents 2–4 never run `prisma migrate dev`; they
  rebase onto Agent 1's branch (or merge the integration branch) once PM-01 lands.
- **Only Agent 2 touches `app.ts`** (router registration for `/product-models` and `/taxonomy`).
- **Only Agent 4 touches `App.tsx` and `menuRegistry.ts`** (route + menu wiring), eliminating the
  classic merge collision on those two hubs. Agent 4 also owns the thin `Portfolio.tsx` wrapper so
  the domain switch can be mounted without editing Agent 3's board shell (§5, D-2).
- **Frontend/backend seams are DTO contracts** (§6.2). Agents 3 and 4 build against the contract
  with the existing seeded data until Agent 2's endpoints land, then integrate.

### Branch & merge choreography

1. All four agents branch off `Product-Model-Workspace` at the same base commit:
   `pmw/agent-1-data`, `pmw/agent-2-api`, `pmw/agent-3-board`, `pmw/agent-4-pages`.
2. **Merge order into the integration branch: 1 → 2 → 3 → 4.** Agent 1's schema+seed merges first
   (it is pure-additive and unblockable); Agent 2 rebases and merges; Agents 3 and 4 are mutually
   conflict-free and merge in either order.
3. Each merge must pass the full gate: `npm run lint && npm run typecheck && npm test && npm run build`
   (husky enforces lint-staged + typecheck pre-commit), and behavior-affecting changes are verified
   against the running app (login as `kevin.hicks@capgemini.com` / `demo1234`, curl the endpoint or
   drive the browser) — unit tests only cover the lib/resolver layer.
4. Neon: Agent 1 applies the migration to a **feature DB branch** via the `neon-db-branch-ops`
   skill; agents 2–4 point `backend/.env` at that branch. Never `db push`.

---

## 2. Agent 1 — Data foundation: schema, migration, seeds, ontology export

*Covers PM-01, PM-02, seed-accuracy refresh, and the ontology deliverable. No frontend, no routes.*

### 1-A. Schema migration (PM-01) — one migration, additive only

Add a `// --- PRODUCT MODEL RATIONALIZATION ---` section with the six models from the draft plan
(`ProductModelWorkspace`, `LegacyProductModel`, `ProductModelComponent`,
`ProductModelAnatomyCategory`, `ProductModelFinding`, `CanonicalProductModel`) **with these
repo-alignment corrections**:

- Follow the `Rationalization*` conventions exactly: `tenantId` + `companyId` on every model,
  cascade from workspace, `illustrative Boolean @default(true)`, `layout Json?` on the workspace,
  `@@unique([tenantId, companyId, name])` on the workspace, `@@index([companyId])` everywhere.
- `ProductModelAnatomyCategory` mirrors `AnatomyCategory` including a **`view`** axis
  (COMPONENT | BEHAVIOR | MISPLACED) in addition to `scope` (COMMON | SEGMENT | GEOGRAPHY), plus a
  **`slug`** column (stable, unique per company) that doubles as the SKOS concept identifier (§6.3).
- Back-relations on `Company` (`productModelWorkspaces`, `productModelAnatomyCategories`) and
  `Role` (`canonicalProductModels @relation("CanonicalProductModelOwner")`).

**Plus the v3-wireframe support models**, shared-shape but per-domain (both domains need them):

```
model NormalizationEntry {            // one normalized item in a Normalize box (#N-101 …)
  id, tenantId, companyId, workspaceId → RationalizationWorkspace (cascade)
  layer          String                // row axis token
  notation       String                // "N-101" — stable, unique per workspace
  name           String
  matchStatus    String  @default("AUTO")   // AUTO | REVIEW | HELD
  matchBasis     String?               // "all 14 fields match on name, type and order"
  differenceNote String?               // "same 22 fields — flow shape and validation timing differ"
  proposedResolution String?           // shown on HELD cards
  componentId    String?  → RationalizationComponent (SetNull)
  sortOrder      Int @default(0); illustrative; timestamps
}
// RationalizationCapability gains: normalizationEntryId String? → NormalizationEntry (SetNull),
// deadCode Boolean @default(false), whyThisMoves Json?  // {captured, sent, processed, validated, lands}
```

`ProductModelFinding` gets the same three additions (`normalizationEntryId` pointing at a
product-domain `NormalizationEntry` row — the model is domain-agnostic via `workspaceId`'s
domain, see below — plus `deadCode`, `whyThisMoves`). If keeping `NormalizationEntry` single-domain
proves cleaner in Prisma (two FK targets), split into `NormalizationEntry` /
`ProductModelNormalizationEntry` twins — Agent 1 decides, the DTO contract (§6.2) is unchanged.

**Board vocabulary — the "DB as source of truth" fix.** One reference model replaces every
hardcoded frontend vocabulary constant:

```
model WorkspaceVocabulary {
  id, tenantId, companyId → Company (cascade)
  domain    String   // APPLICATION | PRODUCT_MODEL
  kind      String   // LAYER | CLASSIFICATION | STATUS | MODE | VIEW | DISPOSITION | MATCH_STATUS
  token     String   // stable key, e.g. "UI", "Common", "Segment"
  label     String
  color     String?  // tailwind token, e.g. "sky" — presentation defaults live with the data
  sortOrder Int @default(0)
  meta      Json?    // e.g. { legend: "correct — stays" }
  @@unique([companyId, domain, kind, token])
}
```

This is justified under the db-data-model skill: the row axis differs per domain (5 IT layers vs
11 product components), the classification dimension differs (CAPDAN vs scope), and today the axis
literally cannot be changed without a frontend deploy. `RationalizationWorkspace` gains
`domain String @default("APPLICATION")` so one workspace list serves both rationalization types.

Run `npm run db:migrate -w cascade-backend` once for the whole set; update **`erd_v5.mmd` in the
same commit** (db-data-model skill gate).

### 1-B. Seed: paper-thin atomic detail, accurate to ABC Insurance (PM-02)

All seed content is **insurance-domain-real** — actual field names, lengths, thresholds, form
numbers — not lorem-ipsum. Files: new `backend/src/seed/productModel.ts`,
`seedProductModelAnatomy.ts`, `seedWorkspaceVocabulary.ts`; registered in `seed.ts`'s `run()`
sequence; idempotent (wholesale replace per company, matching `seedAnatomyCatalog.ts`).

1. **`WorkspaceVocabulary`** — both domains: APPLICATION layers (UI, Integration, Business
   Service, Data, Infrastructure), CAPDAN classes, migration statuses, modes, views, match
   statuses; PRODUCT_MODEL components (the 11 boxes), scopes (Common/Segment/Geography/Eliminate)
   with the legend colors, dispositions (Retain/Refactor/Replace/Retire).
2. **`ProductModelAnatomyCategory`** — transcribe the full section-3 research catalog (below,
   expanded): for each of the 11 components × 3 scopes, the named sub-categories with real
   descriptions. Target ≥ 8–15 rows per component×scope cell where the research supports it —
   e.g. Party & Roles/COMMON: *insured, applicant, beneficiary, producer of record, payer, loss
   payee, additional interest, mortgagee, lienholder…*; Limits & Deductibles/SEGMENT: *fixed
   deductible tiers (SMB), layered excess towers (Large Commercial), SIRs, Lloyd's line size &
   order %…*; Regulatory & Filings/GEOGRAPHY: *Solvency II lines, IFRS 17 cohorts, premium tax
   regimes, FATCA/CRS, state rate/form filing (SERFF)…*
3. **Product Model demo workspace** — "Commercial & Personal Lines North Star" for ABC Insurance:
   3–4 `LegacyProductModel`s that echo the seeded application estate (e.g. *PolicyPro — Commercial
   Package (East)* [segment: SMB, geography: US-East], *QuoteMaster — Personal Auto* [Personal
   Lines, US], *Mainframe Annuity Master* [Specialty, US], *London Market Binder* [Lloyd's, UK]);
   per-component `ProductModelFinding`s at atomic grain (e.g. Coverage & Perils: *"Hired &
   non-owned auto endorsement CA 20 01 attached by default"* — scope Segment/SMB; Rating &
   Pricing: *"Minimum premium $500 hard-coded in rate routine RT-114"* — scope Geography/NY);
   `NormalizationEntry` rows with AUTO/REVIEW/HELD examples; one `CanonicalProductModel` per major
   line with linked `ProductModelComponent`s.
4. **App-domain v3 refresh** — extend `backend/src/seed/rationalization.ts` so the existing
   FNOL/Submission boards carry the new fields (`whyThisMoves`, `deadCode`, `NormalizationEntry`
   groups with real match narratives like the wireframe's *Loss capture form: Claim number —
   text (12); Policy number — text (10); Date of loss — date; Loss type — pick list, 11 options…*),
   so the v3 board renders fully from seed with zero mock data.
5. **Scaffold templates to DB:** move the `GF_NEW`/`COMP_NEW` starter content out of the route
   handler into seeded template rows (vocabulary `kind: 'SCAFFOLD'` meta JSON or dedicated
   illustrative template workspace) — Agent 2 reads them instead of hardcoding (§3, 2-C).

### 1-C. Ontology export (`backend/scripts/export-taxonomy.ts`) — the ontology deliverable

Create the script the uploaded TTL cites as its generator. Runs with
`npx tsx --env-file=.env scripts/export-taxonomy.ts` from `backend/`, imports
`../src/db/prisma.js` (note `.js`), writes to `documents/taxonomy/` (gitignored outputs or
committed snapshots — committed, dated, like the uploads):

- **Formats:** SKOS Turtle (`taxonomy-<company>.ttl`), flat JSON (`nodes[]` with
  `{id, label, notation, parentId, extra}`), and the nested viewer JSON (`{l, n, e, c}` trees) —
  byte-compatible with the three uploaded files' structure, using the `tb:`/`tbi:` namespaces.
- **Schemes:** the existing three (`process` from ProcessNode+closure, `organization` from
  OrgUnit, `standards` from Standard) **plus** `applications` (Application by kind/category),
  `roles` (Role by OrgUnit), and the new **`product-model`** scheme: ConceptScheme
  `tbi:scheme-product-model`; top concepts = the 11 components; children = the
  `ProductModelAnatomyCategory` rows (URI from `slug`), with `skos:scopeNote` carrying the scope
  and `skos:related` linking SEGMENT/GEOGRAPHY concepts to their COMMON parent concept.
- These concept URIs are the join key for the semantic matcher (§3, 2-D) and, later, the pgvector
  work (PM-09) — the ontology is load-bearing, not decorative.

### 1-D. Tests & verification

Mirrored tests under `backend/tests/seed/` (testing-standards): vocabulary completeness per
domain, anatomy row counts per component×scope, referential integrity of `NormalizationEntry` →
findings, exporter round-trip (TTL parses; viewer JSON tree count equals flat node count). Run
`npm run db:setup -w cascade-backend` on a fresh Neon feature branch as the end-to-end proof.

---

## 3. Agent 2 — Backend APIs: rationalization refactor + product-models module + taxonomy

*Covers PM-03 (API half), PM-07, PM-08 (API), the DB-as-source-of-truth route work, and the
ontology-backed matcher. Codes against §6 contracts; rebases when Agent 1's migration merges.*

### 2-A. Split `rationalization.ts` into a feature module (backend-standards)

`backend/src/routes/rationalization/` — `index.ts` (middleware stack: `requireAuth`,
`requirePermission('applications')`, `cacheResponses` on reads) + `boards.ts`, `findings.ts`,
`normalization.ts`, `vocabulary.ts`, `helpers.ts`. Pure mechanical split first (endpoints and DTOs
unchanged — keeps Agent 3 stable), then additive changes. Every file < 500 lines; zod on every
body; tenant scoping by walking to the tenant; 404 not 403; `try/catch(e){next(e)}`; pino only.

### 2-B. New endpoints for the v3 board (both domains)

- `GET /rationalization/vocabulary?domain=` — serves `WorkspaceVocabulary` (the frontend deletes
  its `LAYERS`/`CAPDAN_META`/`STATUS_META`/`MODES`/`VIEWS` constants; §6.2 DTO).
- `GET /rationalization/:id` gains: `normalizationEntries[]` (with per-entry raw-finding counts
  and match status), per-column roll-ups (`{rawSteps, correct, move, deadCode}` per legacy app;
  `{raw, normalized, awaitingReview}` for Normalize), `whyThisMoves` on findings, and the
  dead-code group. Batch pattern only: one `{ in: ids }` query per junction, aggregate in memory —
  no per-row fan-out.
- `PATCH /rationalization/normalization-entries/:id` — resolve REVIEW/HELD (approve/hold/re-map),
  audited like the layout commit.
- `POST /rationalization/initiatives` — replace `GF_NEW`/`COMP_NEW` literals by reading Agent 1's
  seeded scaffold templates; scaffold content becomes data.

### 2-C. `backend/src/routes/product-models/` (PM-03 API, PM-07, PM-08)

Mirrors the applications+rationalization patterns:

- `GET /product-models` — master list (mirrors `routes/applications.ts`: cached read, batched
  resolver enrichment): all `LegacyProductModel`s for the company with segment, geography,
  disposition, workspace membership, finding counts.
- `POST /product-models`, `PATCH /product-models/:id` — CRUD for legacy product models.
- `GET /product-models/workspaces` + `GET /product-models/workspaces/:id` — board list/detail,
  same `StageDetail`-style DTO shape as app rationalization (§6.2) so Agent 3's board builder is
  domain-generic; filters `?legacyModelIds=`, `?segments=`, `?geographies=` (the three inspection
  modes, PM-05's server half).
- `GET /product-models/anatomy-catalog?component=&scope=` — the reference taxonomy.
- Findings CRUD (PM-07): create, reclassify `scope`, set `segmentValue`/`geographyValue`, link
  `targetComponentId`, mark `deadCode`.
- Canonical models (PM-08): CRUD + component linkage + status roll-up (Planned/Building/Live
  derived from linked components' `migrationStatus` — computed on read, never denormalized).

### 2-D. Ontology-backed semantic matcher (`backend/src/lib/ontology/matcher.ts`)

Pre-pgvector implementation of the wireframe's AUTO/REVIEW verdicts: normalize finding names
(casefold, stopwords, singularize), match across sources against each other and against anatomy
concepts (exact slug → AUTO "2→1 semantically same"; same concept but attribute deltas → REVIEW;
no concept agreement → HELD). Exposed via `POST /rationalization/:id/rematch` (and the
product-model twin) writing `NormalizationEntry.matchStatus`. Interface designed so PM-09 can swap
the comparator for cosine similarity without changing callers.

### 2-E. `backend/src/routes/taxonomy.ts`

`GET /taxonomy` (scheme list + counts) and `GET /taxonomy/:scheme` (viewer-JSON shape) — the live
API twin of Agent 1's file exporter, tenant-scoped, powering any future in-app taxonomy viewer.

### 2-F. Tests

Mirrored `backend/tests/routes/{rationalization,product-models}/…` + `tests/lib/ontology/` —
matcher verdict table-tests, tenant-isolation (cross-tenant → 404), DTO snapshots for the board
detail, roll-up math. Verify live: login via API, curl each endpoint against the seeded board.

---

## 4. Agent 3 — Workspace board UI: v3 wireframe across all four structures

*Covers PM-04 (board half), PM-05 (client half), PM-06, PM-07 (UI). Owns
`frontend/src/pages/greenfield-migration/**` and `frontend/src/lib/rationalization.ts`
exclusively. Builds against §6.2 DTOs; until Agent 2 merges, develops against the existing
endpoints plus fixture JSON typed to the contract.*

### 3-A. DB-driven vocabulary (kills the hardcoded axis)

Replace `LAYERS`, `CAPDAN_META`, `CAPDAN_ORDER`, `STATUS_META`, `STATUS_ORDER`, `MODES`, `VIEWS`
with a `useVocabulary(domain)` hook over `GET /rationalization/vocabulary`. `rationalization.ts`
(the lib file) keeps only types and pure helpers. Row axis, classification chips, legend, status
colors all render from vocabulary rows — Products mode gets its 11-component axis and
scope colors (Common = blue, Segment = tan/orange, Geography = grey) with **zero new hardcoded
arrays**. Geometry constants (`cellGeometry.ts`) stay in code — layout is presentation, not data.

### 3-B. v3 board rendering (PM-06 + the wireframe across Applications/VS/Roles/Products)

- **Legacy columns:** per-item ✓/✗ + relocation badge, expandable "WHY THIS MOVES" panel
  (from `whyThisMoves`), column header roll-ups (*12 screens · 80 steps · 43 correct · 17 move*).
  Lift the two-app cap (`boardNodes.tsx:297`): render N columns with horizontal scroll; the
  Normalize comparison cards compare the **selected pair** (tab switcher when > 2 sources).
- **Normalize boxes:** normalized entries with notation chips (`#N-101`), raw→normalized counts
  per box (*16 raw → 10*), AUTO badge, and HELD/REVIEW cards (difference note + proposed
  resolution + REVIEW pill); header roll-up (*102 raw · 58 normalized · 5 awaiting review*).
  Approve/hold actions call `PATCH /normalization-entries/:id` through `useDialogs` confirms.
- **Greenfield:** status chips + inbound counts (*10 in ›*). **Dead-code lane:** full-width red
  band listing `deadCode` findings with retire-with-sign-off affordance.
- **Edges:** green stay-edges and red move-edges per the legend; legend itself renders from
  vocabulary `meta`.

### 3-C. Domain switch + Products inspection modes (PM-04/05 client side)

`LensBar` gains the domain segmented control (Application Rationalization ↔ Product Model
Rationalization) above the mode selector, both driven by vocabulary MODE rows. Under Products:
modes = Legacy Product Models / Segment / Geography, multi-selects fed by
`GET /product-models` (models) and its distinct segment/geography values; board data from
`GET /product-models/workspaces/:id`. The board builder (`buildBoardBase`) is parameterized by
`(axisRows, classificationMeta, domain)` rather than forked — one builder, two domains.

### 3-D. Findings UI (PM-07) + hygiene

Create/reclassify findings from the board (scope picker, segment/geography value, target
component) via `EditBoxModal` extensions. In-box expansion (WR-10 pattern) shows matched anatomy
sub-categories. Keep every file < 500 lines (split `boardNodes.tsx` if it grows — e.g.
`normalizeNodes.tsx`, `edges.ts`); compose from `components/ui/`; no `window.confirm`; pages stay
lazy. Mirrored tests for the board builder and vocabulary hook (pure functions extracted for
testability).

---

## 5. Agent 4 — Master pages, navigation, E2E, docs

*Covers PM-03 (UI half), all route/menu wiring, verification harness. Owns `App.tsx`,
`menuRegistry.ts`, `Portfolio.tsx`, new `frontend/src/pages/product-models/**`, `e2e/**`.*

### D-1. `/product-models` master page (mirrors `/applications`)

`frontend/src/pages/product-models/ProductModels.tsx` — `useApi('/product-models')`, TOC view
(grouped by segment with counts) + List view via the shared **`Sheet`** component
(name / source system / segment / geography / disposition / workspace / findings), `?focus=` deep
link, row click opens `ProductModelDrawer.tsx` (DrawerShell: description, disposition,
components touched, canonical mapping, workspaces it appears in). Optional per-segment drill page
mirroring `ApplicationKind.tsx`. Everything composed from `components/ui/`; page lazy in
`App.tsx` behind the single Suspense boundary.

### D-2. Navigation & wiring

- `shared/src/menuRegistry.ts`: add `{ key: 'product-models', label: 'Product Models', path: '/product-models' }`
  (after `applications`).
- `frontend/src/App.tsx`: lazy import + route for `/product-models` (and drill route).
- `frontend/src/pages/portfolio/Portfolio.tsx`: pass the initial-domain prop / query param
  (`/portfolio?domain=product-models`) through to Agent 3's board so deep links land on the right
  domain — this file is the only shared UI seam between Agents 3 and 4, and only Agent 4 edits it.

### D-3. E2E + verification harness

Extend the Playwright route smoke: `/product-models` renders the Sheet with seeded rows;
`/portfolio` domain switch shows the Products board; legacy modes still render. Add an API-body
baseline for `GET /product-models` and the board detail. Run the full compliance gate
(`compliance-check` skill) on the integration branch after each merge.

### D-4. Documentation

Update `documents/workspace-renovation/renovation-plan.md` with a PM item table (PM-01…PM-09,
status per merge); cross-link this plan; note the taxonomy exporter in the module README table if
present. Keep `erd_v5.mmd` untouched (Agent 1's file).

---

## 6. Frozen contracts (agents code against these, not against each other)

### 6.1 Schema DDL
As specified in §2/1-A (the draft plan's six models with the corrections listed, plus
`NormalizationEntry`, `WorkspaceVocabulary`, `RationalizationWorkspace.domain`, and the
`RationalizationCapability`/`ProductModelFinding` additions). Agent 1 may adjust Prisma mechanics
(relation names, twin tables) but **not** field names/semantics used in the DTOs below.

### 6.2 API DTOs (additions)

```ts
// GET /rationalization/vocabulary?domain=APPLICATION|PRODUCT_MODEL
{ vocabulary: Array<{ domain; kind; token; label; color: string|null; sortOrder; meta: object|null }> }

// Board detail additions (both GET /rationalization/:id and GET /product-models/workspaces/:id)
{ ...existingStageDetail,
  domain: 'APPLICATION'|'PRODUCT_MODEL',
  columnStats:   Array<{ sourceId; rawSteps; correct; move; deadCode }>,
  normalizeStats:{ raw; normalized; awaitingReview },
  normalizationEntries: Array<{ id; layer; notation; name; matchStatus: 'AUTO'|'REVIEW'|'HELD';
    matchBasis; differenceNote; proposedResolution; componentId; findingIds: string[] }>,
  findings: Array<{ ...existing, deadCode: boolean, normalizationEntryId: string|null,
    whyThisMoves: { captured?; sent?; processed?; validated?; lands? } | null,
    // product domain only:
    scope?: 'Common'|'Segment'|'Geography'|'Eliminate', segmentValue?; geographyValue? }> }

// GET /product-models
{ productModels: Array<{ id; name; description; sourceSystem; segment; geography; disposition;
  workspaces: Array<{id; name}>; findingCount; illustrative }> }
```

### 6.3 Ontology URI scheme
Namespaces `tb:` = `https://w3id.org/transformation-bridge/ontology#`,
`tbi:` = `https://w3id.org/transformation-bridge/id/`. Schemes: `tbi:scheme-process`,
`-organization`, `-standards` (existing format), `-applications`, `-roles`,
`-product-model` (new). Product-model concepts: `tbi:pm-<component-slug>` (top concepts) and
`tbi:pma-<ProductModelAnatomyCategory.slug>` (children); `skos:notation` = sortOrder,
`skos:scopeNote` = scope, `skos:related` links segment/geography concepts to their common core.

### 6.4 Vocabulary tokens (seed = contract)
APPLICATION: LAYER {UI, Integration, Business Service, Data, Infrastructure};
CLASSIFICATION {Common, Different, Relocate, Eliminate}; MATCH_STATUS {AUTO, REVIEW, HELD}.
PRODUCT_MODEL: LAYER {Party & Roles, Product Hierarchy, Coverage & Perils, Limits & Deductibles,
Rating & Pricing, Forms & Wordings, Eligibility & UW Rules, Exposures & Schedules,
Reinsurance & Layering, Regulatory & Filings, Distribution};
CLASSIFICATION {Common: blue, Segment: tan/orange, Geography: grey, Eliminate: red};
MODE {Legacy Product Models, Segment, Geography}; DISPOSITION {Retain, Refactor, Replace, Retire}.

---

## 7. PM-item coverage map & deferred work

| Item | Owner | Notes |
|---|---|---|
| PM-01 schema migration | Agent 1 | + NormalizationEntry, WorkspaceVocabulary, domain flag |
| PM-02 anatomy seed | Agent 1 | + vocabulary seed, product demo workspace, app-board v3 refresh |
| PM-03 master list + CRUD | Agent 2 (API) + Agent 4 (UI) | mirrors `/applications` |
| PM-04 domain switch | Agent 3 (board) + Agent 4 (`Portfolio.tsx` deep link) | |
| PM-05 inspection modes | Agent 2 (filters) + Agent 3 (lens) | |
| PM-06 board rendering | Agent 3 | 11 boxes, scope colors, in-box expand, v3 wireframe |
| PM-07 findings CRUD | Agent 2 (API) + Agent 3 (UI) | |
| PM-08 canonical models | Agent 2 | status roll-up computed on read |
| PM-09 semantic/duplicate detection | **Deferred** | blocked on WR-12 pgvector; Agent 2's matcher interface (§3, 2-D) is the swap point |
| Ontology | Agent 1 (exporter) + Agent 2 (matcher, `/taxonomy` API) | SKOS, upload-format-compatible |

**Cross-cutting rules for all four agents:** ESM `.js` relative-import suffixes; strict TS, no
`any`, no `@ts-ignore`; migrations only (never `db push`); `erd_v5.mmd` sync on schema change;
resolvers over hand-walked graphs; batch queries (`{ in: ids }`), never per-row fan-out; tenant
scope every query, 404 on cross-tenant; pino, never `console.log`; compose from `components/ui/`;
`Sheet.tsx` for flat lists; `useDialogs` for modals; lazy pages; files < 500 lines; mirrored
`tests/` tree; all gates green before merge.

---

## Status — 2026-08-11

Post-build audit of the four workstreams (recorded here rather than rewriting the plan body
above, which stays as the historical contract). Where the shipped code diverges from the plan,
the divergence is deliberate and noted.

### Per-workstream status

- **Agent 1 — schema, seeds, ontology exporter: DONE.** `ProductModel*` family +
  `NormalizationEntry` + `WorkspaceVocabulary` migrated; ABC Insurance product seed
  (`backend/src/seed/productModel.ts`: 4 `LegacyProductModel`s — PolicyPro — Commercial Package
  (East), QuoteMaster — Personal Auto, Mainframe Annuity Master, London Market Binder — plus
  canonical models and component findings) and the SKOS taxonomy exporter are in.
- **Agent 2 — API routes: DONE; tests being added.** `backend/src/routes/product-models/`
  feature module (`models.ts`, `workspaces.ts`, `findings.ts`, `canonical.ts`, `helpers.ts`)
  serves the §6.2 DTOs, including `GET /product-models`.
- **Agent 3 — board: rebuilt as `frontend/src/pages/workspace-map/`** (not an extension of
  `pages/greenfield-migration/` as §4 assumed — that directory no longer exists; see path
  corrections below). The **Products lens deliberately runs on the real product spine**
  (`ProductLevelType`/`ProductNode` — LOB version comparison), not on the
  `LegacyProductModel`-column skeleton §4 sketched. This is an **accepted divergence from §4**:
  the spine data is richer and already normalized, so the lens compares versions off it while
  the legacy-model columns remain the rationalization entry point.
- **Agent 4 — master list, wiring, docs (this branch, `pmw2/agent4-master-list`).** §D-1's
  master list shipped as a **fifth view of the existing `/product-models` hierarchy shell** —
  `?view=legacy` ("Legacy models" pill in `ProductModelHierarchy.tsx`) — rather than replacing
  the product-spine viewer (TOC/Map/List/Framework), which is a deliberate, recent build that
  stays. New files: `frontend/src/pages/product-models/LegacyModels.tsx` (Sheet: name / source
  system / segment / geography / disposition / workspaces / findings; `?focus=<id>` deep link),
  `LegacyModelDrawer.tsx` (DrawerShell detail; workspace chips link to
  `/portfolio?domain=product-models`), `legacyModelList.ts` (pure helpers, unit-tested under
  `frontend/tests/pages/product-models/`). E2E: `e2e/product-model-workspace.spec.ts` gained a
  legacy-models test (seeded rows render; row click opens the drawer). **No `App.tsx` change
  was needed** — the view loads through the already-lazy `ProductModelHierarchy` route.

### Path corrections (stale references in the plan body above)

| Plan body says | Now |
|---|---|
| `frontend/src/pages/greenfield-migration/**` (§0, §1.1 ownership table, §4) | `frontend/src/pages/workspace-map/**` |
| `frontend/tests/**/greenfield-migration/**` | `frontend/tests/pages/workspace-map/**` |
| §D-1 `ProductModels.tsx` / `ProductModelDrawer.tsx` as a standalone page | `LegacyModels.tsx` / `LegacyModelDrawer.tsx` as `/product-models?view=legacy` |

Verification note: unit gates (typecheck / lint / vitest) run per branch; the Playwright specs
are written but need both dev servers + a seeded Neon branch, so they execute at integration,
not in cloud sessions.
