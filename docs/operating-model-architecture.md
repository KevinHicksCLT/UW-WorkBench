# Operating-Model Rework — Complete Design

Status: **proposal for review** (2026-06-09). For: Kevin (DB architect / UI dev) + Claude.
Scope: rework the **entire** operating-model backend onto single sources of truth, and
rebuild **Data Admin as an interactive builder** — so a non-technical admin can paint the
model and its deep connections, the DB stays clean and correct, and every screen reflects
edits instantly. **All current data is preserved** (cleaned/reorganized, never lost or
fabricated).

---

## 0. The contract (your requirements)

1. **DB = single source of truth.** Each concept is one row; everything else references
   it by id. Renames/moves propagate everywhere automatically.
2. **Data is preserved** — reorganized into the new shape, nothing invented, nothing dropped.
3. **Data Admin = interactive builder**, not table grids: drill/drag/rename the structure,
   *draw* the connections, edit details in an inspector. The admin never sees a raw table.
4. **Robust + generic** — handles a lot more future data and deep interlinking, reusable
   across companies, with naming that doesn't confuse.

---

## 1. Why the current model breaks (from the 49-model inventory)

Three structural failures, in priority order:

**1a. Cross-references are free-text strings, not FKs.** The deepest one. Roles connect to
processes and I/O by *name string*, so nothing can propagate or be trusted:
`IoItem.keyRoles`, `ProcessStep.leads`/`supporting`, `Role.primaryValueStream`,
`StandardItem.ownerRole`, `ExternalInteraction.internalRoleOwner`,
`Scenario.divisionName`/`valueStreamName`, `Application.primaryDivisionName`,
`Risk`/`Metric` string anchors. Rename a role → none of these follow.

**1b. The same structure is modeled 3+ ways.** `Level` (configurable tree) vs `OrgLevel`
(org tree) vs the explicit `Division`/`Department`/`ValueStream`/`SubValueStream` tables —
plus `Division.higherCategory` (string) duplicating the L1 segment, and
`ValueStream.domain` (string) **and** `ValueStream.domainId` (FK) **and** `ValueStreamDomain`
(table) all for one grouping. This is the "Core Business" bug: 4 unsynced copies.

**1c. Process / I/O / responsibilities are fragmented.** `SubValueStream` (legacy tree),
`ProcessStep` (sequenced), `Level` L3–L5, and `IoItem` (anchored by l3/l4 *strings*) are
four overlapping ways to describe how work flows; role scope is split across
`Role.responsibilities`, `ChecklistItem`, `RoleTask`, and `RoleValueStream`.

(Full inventory + duplication list lives in the chat record / can be appended as Appendix A.)

---

## 2. Target architecture — one structure, three layers

Everything structural becomes **one tree of typed Nodes**. Cross-cutting connections become
**typed Links**. Rich detail becomes **Attributes**. Operational data (people, apps,
initiatives…) are **aggregates that reference nodes by id**.

### 2.1 The unified structure (replaces Level + OrgLevel + Division/Dept/VS/SubVS)

```
Enterprise (L0)
└─ Segment (L1)            Core Business · IT · Corporate Function   ← ONE shared grouping
   └─ Division (L2)        Underwriting · Claims · Finance & Investments …
      ├─ Department (L3)   ← ORG branch
      │  └─ Role (L4)
      └─ Value Stream (L3) ← WORK branch
         └─ Sub-Process (L4)
            └─ Process Step (L5)
               └─ I/O Item (L6)   inputs / outputs / deliverables
```

A Division owns **both** its Departments (org) and its Value Streams (work) — so the org
tree and the value-stream tree are no longer two models; they're two branches of one tree
that **share** Enterprise → Segment → Division. "Core Business" is **one** Segment node;
divisions point at it by `parentId`. Per your call, Segment is the single shared grouping
for both branches (this retires the redundant 6-"domain" list and `higherCategory`).

### 2.2 Layer A — `NodeType` (the taxonomy = data, not code)

```prisma
model NodeType {
  id          String  @id @default(cuid())
  tenantId    String                       // company-overridable; ships with defaults
  dimension   String                       // STRUCTURE (one tree) — kept for future axes
  key         String                       // stable code: 'segment','division','department',
                                            //   'role','value_stream','sub_process','step','io_item'
  label       String                       // display singular: "Value Stream"
  pluralLabel String
  level       Int                          // depth in the tree
  parentKeys  String[]                     // which node types may be its parent (branching rules)
  icon        String?
  sortOrder   Int     @default(0)
  @@unique([tenantId, key])
  @@unique([tenantId, level, key])
}
```

This is what makes the builder generic and **removes every hard-coded label list**
(`CATEGORIES`, `VS_LEVELS`, `DIVISION_SEQUENCE`, friendly level names). A new company gets
the default `NodeType` set and can rename/extend. `parentKeys` encodes the branching
(a Division may parent a Department *or* a Value Stream).

### 2.3 Layer B — `Node` (one row per concept)

```prisma
model Node {
  id         String   @id @default(cuid())
  companyId  String
  company    Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  typeKey    String                         // FK-by-key → NodeType.key (the level/label)
  parentId   String?
  parent     Node?    @relation("NodeTree", fields: [parentId], references: [id], onDelete: Cascade)
  children   Node[]   @relation("NodeTree")
  name       String
  code       String?                        // optional external/stable code
  description String?
  sortOrder  Int      @default(0)
  attributes Json?                          // flexible long-tail per type
  // outgoing/incoming links + attribute companions relate here
  @@index([companyId, typeKey])
  @@index([parentId])
  @@unique([companyId, parentId, name])     // no dup siblings
}
```

Replaces `Level`, `OrgLevel`, `Division`, `Department`, `Role`, `ValueStream`,
`SubValueStream`, `ValueStreamDomain`, and the segment strings — **all of it, one table**.

### 2.4 Layer C — `NodeLink` (the web of deep connections)

```prisma
model NodeLink {
  id           String @id @default(cuid())
  companyId    String
  fromId       String                       // Node
  toId         String                       // Node
  relationType String                       // PARTICIPATES_IN | SUPPORTS | OWNS | LEADS |
                                             // PRODUCES | CONSUMES | DEPENDS_ON | IMPACTS …
  attributes   Json?                        // e.g. { participationType:'lead', impact:0.4 }
  @@unique([fromId, toId, relationType])
  @@index([toId, relationType])
  @@index([companyId, relationType])
}
```

This is where the **free-text cross-refs become real edges**, and where the admin "draws"
connections. Conversion map:

| Today (string or junction) | Becomes |
|---|---|
| `RoleValueStream` (role↔VS + participationType) | `NodeLink(role → value_stream, PARTICIPATES_IN, {participationType})` |
| `ProcessStep.leads` / `supporting` (strings) | `NodeLink(role → step, LEADS / SUPPORTS)` |
| `IoItem.keyRoles` (string) | `NodeLink(role → io_item, OWNS/CONSUMES)` |
| `ApplicationValueStream` | `NodeLink(application → value_stream, SUPPORTS, {systemRole})` |
| `InitiativeValueStream` / `InitiativeDivision` | `NodeLink(initiative → node, IMPACTS, {impactType/role})` |
| `Role.managerRoleId` | stays a `Node.parentId`-style edge or `NodeLink(role→role, REPORTS_TO)` |
| `StandardItem.ownerRole(Id)`, `Risk.ownerRoleId`, `Initiative.sponsorRoleId` | `NodeLink(x → role, OWNED_BY/SPONSORED_BY)` |
| `ExternalInteraction` (role↔external party + io) | external party becomes a node (type `external_party`); links carry interaction metadata |

Rich, heavily-queried junctions can **stay as typed tables** for performance/constraints
(hybrid); `NodeLink` is the default + the extension point so new connection types need no
schema change.

### 2.5 Attributes — detail without bloating the node

- **Companion tables** for queried/constrained detail (keep the `LevelAiAdoption` pattern →
  `NodeAiAdoption` keyed to the value-stream node; role-profile fields; process-step detail;
  metric definitions; I/O data elements).
- **`Node.attributes` jsonb** for the flexible long-tail.
- Rule: *filter/aggregate on it or it has a lifecycle → column; else → jsonb.*

### 2.6 Standalone aggregates — reference nodes, don't duplicate them

These keep their own identity but link to the structure **by id** (today many use strings):

| Aggregate | Links to nodes via |
|---|---|
| `Person` (+ `Assignment`, `PersonTask/Metric/Signal/AppUsage`) | `Assignment.roleNodeId` → role node |
| `Application` | `NodeLink(application_node → value_stream)`; app is a node (dimension APPLICATION) or aggregate — see decision 1 |
| `Metric` | `metric.nodeId` → value-stream/step node |
| `Standard` / `StandardItem` | `nodeId` (dept/role) + `ownerLink` |
| `Initiative` & SPM (`Program`/`Workstream`/`PortfolioInitiative` + Benefit/Cost/Milestone/RAID) | `NodeLink(initiative → value_stream/division)`, plus its own subtree |
| `Risk`, `Scenario`, `Rationalization*`, `Deliverable`/`Task` | `nodeId` FKs instead of name strings |
| `Tenant`, `User`, `Company`, `AuditEntry` | system — unchanged |

### 2.7 Unify the duplicates

| Duplication | Resolution |
|---|---|
| `Level` + `OrgLevel` + `Division/Dept/VS/SubVS` | one `Node` tree (typed) |
| `Division.higherCategory` + Level/OrgLevel L1 | one `Segment` node; divisions reference by `parentId` |
| `ValueStream.domain` + `.domainId` + `ValueStreamDomain` | drop — value streams group under their Division/Segment |
| `SubValueStream` + `ProcessStep` + Level L4/5 + `IoItem` strings | `Node` sub_process/step/io_item + `NodeLink` for roles/I/O |
| `Initiative` vs `PortfolioInitiative` | one initiative concept (merge or one canonical, other a view) — decision 2 |
| `RoleTask` (template) + `PersonTask` (instance) + `Assignment` | template = node/attr on role; instance = PersonTask; assignment = staffing edge |
| 22× `illustrative` flags + status vocabularies | one `provenance` enum + one `status` taxonomy table |

---

## 3. Naming conventions (generic, unambiguous)

- One **type** per concept, named once in `NodeType.label`; never reuse a word for two
  types (kills "domain"=segment vs "domain"=VS-grouping).
- **Instances** carry `name`; **types** carry `label`; **code** carries neither — it reads
  both from the DB. Zero label string literals in the frontend.
- Stable snake_case `key`s decouple code from display, so renaming a level is data-only.
- The **Data Dictionary** view is generated from `NodeType` so the glossary can't drift
  (fixes audit U1/D4).

---

## 4. Data Admin as an interactive builder

The admin gets **four surfaces**, all driven by `NodeType` so they're generic — and you
never edit a raw table:

1. **Structure canvas** (evolves today's Levels tree). Drill the tree; **add a child**
   (type offered from `NodeType.parentKeys`), **inline-rename**, **drag to reparent/reorder**.
   One surface for the whole operating model because it's one tree.
2. **Connection builder.** Select a node → see its existing edges → **draw a new link** to
   another node and pick the relation type (Role —participates in→ Value Stream;
   App —supports→ VS; Step —produces→ Deliverable). This is how the admin makes deep
   connections without knowing a schema. Bidirectional, validated by allowed type pairs.
3. **Inspector.** Select any node → a generated form for its attributes (incl. AI-adoption,
   role profile, metric definition) from the node type's attribute schema.
4. **Taxonomy settings.** Rename levels / reorder / add a node type for this company
   (rarely touched; this is what makes it reusable).

Plus the existing **Home dashboard configurator** = "paint the UI": choose which model-driven
widgets render. Because widgets read nodes/links by id, what you build in the canvas is what
the dashboards and every screen show — **the edit-reflects-everywhere promise, by construction.**

UX principle: the builder speaks the **domain** (segments, value streams, roles, "connect
these"), never the **database** (tables, FKs, joins). The graph is the interface.

---

## 5. Migration — preserve everything, phased, dev-branch only

Additive and reversible; prod untouched until you promote. Each phase is a reviewable commit.

1. **Create** `NodeType`, `Node`, `NodeLink`, attribute companions (additive raw SQL).
2. **Seed** the default `NodeType` taxonomy for the company.
3. **Backfill `Node`** from existing rows, preserving names/ids-as-`code`:
   Segments ← distinct `Division.higherCategory` (∪ Level/OrgLevel L1); Divisions ←
   `Division` (parent=segment); Departments ← `Department`; Roles ← `Role`; Value Streams ←
   `ValueStream`/Level L3 (parent=its division); Sub-Process/Step ← `SubValueStream`/`ProcessStep`;
   I/O ← `IoItem`.
4. **Backfill `NodeLink`** from the junctions, and **resolve the free-text refs** (keyRoles,
   leads/supporting, ownerRole, primaryValueStream…) to node ids by name match. **Anything
   that doesn't resolve is logged, not guessed** — it feeds the data-correction pass and the
   Data Health panel (which already flags unresolved/orphaned data).
5. **Move attributes** (`LevelAiAdoption` → `NodeAiAdoption`, etc.).
6. **Read adapters**, screen by screen, starting with the broken category path
   (de-hard-code `ListExplorer`/`MapCanvas`, read `NodeType`+`Node`). Then Organization,
   Value Streams, Telemetry, Work, People.
7. **Write adapters** — point the builder surfaces at `Node`/`NodeLink`.
8. **Verify** continuously (`verify-admin-scoping.mjs` + Data Health) — counts must match
   pre-migration; nothing lost.
9. **Retire** legacy tables once nothing reads them.

**Data-true guarantee:** backfill is a pure restructure (1:1 row provenance, original id kept
as `code`), counts reconciled at every step; the only "new" values are not_used/unresolved
markers, surfaced for you to fix — never invented.

---

## 5b. Full repoint + testing + acceptance bar (required)

This is **not** a partial migration. Definition of done:

- **Every backend API** reads/writes the new model (Node/NodeType/NodeLink + companions +
  merged Initiative + status/provenance). No screen still reads a legacy table.
- **Every screen/tab** in the app (Home, Value Streams/map, Organization, Standards,
  Telemetry, Initiatives, Deliverables & Tasks, People, Data Admin, detail pages) renders
  from the new model.
- **Thorough testing phase** before "done": exercise **every tab** (Playwright + the verify
  script + Data Health), confirm data **renders** and is **in sync across all tabs** (the
  same entity shows the same name/count everywhere; an edit in the builder propagates to all
  consumers). Cross-tab reconciliation must be green.
- **Acceptance bar:** the refactored app is **at least as good as the current app from the
  user's perspective** — same or better information, navigation, and visuals; no lost
  feature, no emptier screen, no broken link. **If any tab is worse or out of sync, it's a
  bug to fix before done**, not a deferral.
- **Data-true:** every count/figure reconciles to the pre-migration baseline (captured
  first); the only changes are structural + the logged unresolved-reference markers.

## 6. Sequencing recommendation

Land a **vertical slice first** to prove the whole design on real tables and de-risk it:
**Segment + Division** on `Node`/`NodeType`, de-hard-code the map, and wire the structure
canvas for those two levels — so "rename Core Business in Data Admin → it changes on Home,
Organization, and the map" works end-to-end. Then expand down the tree (Value Stream →
Process → I/O), then convert the links (roles ↔ VS ↔ apps), then the aggregates, then retire
legacy. Each step keeps the app working via adapters.

---

## 7. Decisions — LOCKED (2026-06-09)

1. **Applications & external parties:** Application stays an **aggregate** that links to
   value-stream nodes (keeps its TCO/rationalization detail); **External Party = a node**
   (`type external_party`) so role↔external interactions are real drawable edges. ✅
2. **Initiative vs PortfolioInitiative:** **merge into one canonical Initiative** with one
   stage/status model, linking to nodes and carrying the SPM benefit/cost/milestone/RAID
   subtree. The two stage vocabularies collapse into one. ✅
3. **Links:** **hybrid** — keep rich, hot-path junctions as typed tables (role↔value-stream
   `participationType`, app↔value-stream `systemRole`) for integrity + speed; use generic
   `NodeLink` for everything else and any new link type (no schema change to add one). ✅
4. **Status & provenance:** **unify now** — one configurable status taxonomy per node/entity
   type + one `provenance` field (`real | illustrative | imported`), replacing the 7+ status
   vocabularies and 22 scattered `illustrative` booleans. ✅
5. **Slice scope:** _pending_ — recommended: Segment+Division vertical slice first.
