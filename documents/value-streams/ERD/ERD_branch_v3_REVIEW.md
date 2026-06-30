# ERD v3 — Scale / Manage / Onboard / Rating Review

**Reviewer:** Claude · **Date:** 2026-06-22 · **Artifact:** `ERD_branch_v3.mmd` (34-table complete schema)
**Grounded in:** the live code — `backend/prisma/schema.prisma`, seed pipeline, Data Admin UI — not the diagram alone.

---

## 0. Verdict (TL;DR)

- **The generic recursive approach is correct** — and the app *already chose it*. `Node`/`NodeType`/`NodeLink` ([schema.prisma:1421-1487](../../../backend/prisma/schema.prisma)) is exactly the "typed node tree + typed link layer + JSON attributes" v3 describes.
- **v3 drawn as 34 new relational tables is the wrong *instantiation*.** It would become a **4th parallel model** of the same hierarchy. The repo already carries three: (a) legacy `Division/Department/Role` + `ValueStreamDomain/ValueStream/SubValueStream/ProcessStep`, (b) configurable `Level` + `OrgLevel` trees, (c) the unified `Node` graph. This drift is already the root of known audit issues.
- **Treat v3 as the *logical* model and the `Node` graph as the *physical* model.** Map most v3 tables → NodeTypes + NodeLink relationTypes; keep only genuinely-new / hot-path / structured things as real tables.
- **The model holds operating-model *metadata*, not *reference data*.** It can say "rating happens here, by this role, in this app, producing this deliverable." It **cannot hold a rate table / rating factors / a rating chart.** That is the single biggest gap for an insurance use-case.
- **Two meeting goals are currently unmet by v3:** capacity/wait-time/SLA/carrying-cost (you removed People — but you can keep these at *Role* grain without modelling persons), and read **views** (A15).

---

## 1. What the app actually is today (the context that changes everything)

| Model | Tables | State |
|---|---|---|
| **Legacy fixed-ish** | `Division`, `Department`, `Role`; `ValueStreamDomain`→`ValueStream`→`SubValueStream`(parentId+level)→`ProcessStep` | live, most data here |
| **Configurable trees** | `Level` (value streams), `OrgLevel` (org) — generic `parentId`+`levelNumber`, "same shape for a shared editor" ([schema.prisma:186](../../../backend/prisma/schema.prisma)) | built for the Levels editor |
| **Unified graph (rework target)** | `Node` + `NodeType` + `NodeLink` ([schema.prisma:1421](../../../backend/prisma/schema.prisma)) | built additively, migration not finished |

Key facts:
- `Role` **already** has `managerRoleId` *and* both `divisionId` + `departmentId` (sparse) ([schema.prisma:265-305](../../../backend/prisma/schema.prisma)). So A4 (managers) is already done; the A11 "Role→Department vs Division" ambiguity is *still live* (both FKs optional).
- `NodeType` is data-driven: `key`, `label`, `pluralLabel`, `level`, `parentKeys[]` (branching rules) — admins relabel/extend levels as data.
- `NodeLink` carries `relationType` + `attributes Json?` — so v3's attributed junctions (`RoleDeliverable.role`, `RegulationApplication.evidenceRef`, `NodeAppUsage.usageType`) are *already expressible* as link attributes.
- The schema comment itself states the intended **hybrid**: "rich, hot-path links also keep their typed junctions" ([schema.prisma:1470](../../../backend/prisma/schema.prisma)).

**Implication:** the architecture question isn't "fixed vs generic" (settled — generic). It's **"how do we collapse 3→1 and where do we draw the graph-vs-typed-table line."** v3 is the right vocabulary for that conversation but must be reconciled, not added.

---

## 2. Is this the correct approach? — Yes, with one redraw

- ✅ **Correct for configurability** (add levels, move subtrees, relabel): recursive adjacency + level-type lookup is the industry-standard answer, and matches the app.
- ✅ **Correct for connections**: typed link tables / typed `NodeLink` edges beat polymorphic `(entityType,entityId)` associations (which lose FK integrity).
- ⚠️ **Wrong as a parallel physical schema**: don't create `OrgUnit`/`ProcessNode`/13 junctions next to `Node`/`NodeLink`. Pick one physical spine.
- ⚠️ **Insufficient for structured/reference data** (rating, rate tables, decision logic) — needs a *separate* subsystem (§6).
- 🔎 **EAV/JSON caution**: `Node.attributes`/`NodeLink.attributes` JSON is great for the long tail, but anything you **aggregate or filter at scale** (automatability %, chargeback $, capacity hrs, metric values) should be a typed column/table, not JSON. That is the real "where to draw the line."

---

## 3. Gaps that make it painful to SCALE

1. **Parallel-model drift (the #1 risk).** 3 (→4 with v3) models of one hierarchy. Every feature must choose a model; counts diverge across screens (the known "two value-stream models" / dashboard-source-of-truth problem). **Cost grows with every feature.** Fix = converge before extending.
2. **No effective-dating / versioning anywhere.** Operating models change; rate tables change quarterly by filing. Nothing stores "as-of/version/effective-from". `AuditEntry` logs *that* a change happened, not queryable historical *state*. Blocks trend reporting, "what did this look like last quarter," and any rating use-case.
3. **Closure-table write-amplification.** v3 adds `*Closure`. With ~8,355 L5 nodes, a move near the root rewrites a large closure subtree in one transaction. Manageable now, but it's new write cost the live app (adjacency-only) doesn't pay today. Only add closures if read-side rollups demand them; otherwise recursive CTEs on `parentId` suffice at this size.
4. **Composite screens = 6–8-way joins.** The six-question views join node+deliverable+role+app+standard+reg+checklist. Without the **read views** (A15, not modeled) or materialized rollups, these get slow as rows grow.
5. **JSON attributes don't index/constrain.** At scale, reporting over `attributes` JSON is slow and unvalidated (no FK inside JSON, no type checks).

## 4. Gaps that make it painful to MANAGE

1. **Two ways to express one edge** (typed junction *vs* `NodeLink`). Powerful hybrid, but needs a **written source-of-truth rule** per relationship or it drifts. Currently implicit.
2. **Level-type ↔ depth consistency is app-only.** `NodeType.parentKeys` constrains *types*, but nothing stops an instance whose `parentId` depth disagrees with its `typeKey`. DB won't catch it.
3. **Per-instance display name still missing.** A14 wants per-company relabel for merged/acquired naming → holistic reporting. Today: `NodeType.label` is per-*type* (one label for all value streams), `Node.name` is the real name, **no per-instance display override, no Terminology table.** v3 adds `Terminology` + `dbValue/displayValue` — good — but a side-table label map means every read left-joins to resolve labels. Prefer a `displayName` column for the common case; reserve `Terminology` for cross-entity report relabeling.
4. **Cascade-delete everywhere, no soft-delete.** `onDelete: Cascade` on Company wipes ~10K rows on one mis-click. Meeting wants rollback-able. Need soft-delete / snapshot / restore.
5. **Orphan prevention is a convention, not a constraint** ("never add a node without wiring deliverables/roles/apps/tasks"). At scale, orphans creep (history of "orphaned company rows"). Needs validation jobs or constraints.

## 5. Gaps that make it painful to SET UP A NEW COMPANY

1. **No generic onboarding path.** Reality: author a company-specific `spine.json` (~2,500 spine rows) + run bespoke seed scripts that **delete & rebuild** the company. There is no "new company" wizard and no template. This is the dominant onboarding cost — and it's a **data-pipeline gap, not a schema gap** (v3 doesn't fix it).
2. **No starter / template library.** Insurance carriers share ~80% of a value-stream taxonomy, yet each company starts empty. The highest-leverage onboarding feature = a **reference "template company" you clone, then relabel/trim** (exactly what `Terminology` + the `Node` builder enable). Without it, onboarding is weeks.
3. **Tenant *and* Company dual scoping.** Every row carries `tenantId` *and* `companyId`. Onboarding must set both consistently — a foot-gun, and double the scoping logic.
4. **Per-jurisdiction reference data is huge & copied per company** (51 jurisdictions × regs ≈ 7K rows each). If rating/forms/rules are ever modeled, copying per company explodes; that data should be **shared + versioned centrally**, referenced by company — not duplicated.

## 6. The "rating chart" gap — reference data vs process metadata (biggest)

> Interpreting "rating chart" as an **insurance rate table / rating worksheet** (base rates, factors, tiers, by class/territory/coverage, effective-dated by filing). If you meant a maturity/automatability **scorecard view**, see the note at the end — that's largely doable today.

**Finding: the model cannot hold a rating chart.** Broad search found **zero** rating/rate/premium/factor/tier/decision-table/reference-lookup concepts ([only `RiskScoringBand`, a 5×5 grid] exists). The schema holds **process/org/work metadata**, not **structured reference data or calculation logic.**

What rating needs that is absent:
1. **Structured reference/lookup tables** — versioned rate tables, factor tables, tier definitions. (Not `ProcessNode`/`Deliverable` — those describe that rating *happens*, not the rates.)
2. **Rule / decision-table representation** — `premium = base × f₁ × f₂ … (min/max, rounding)`. `TestingTemplate` is presence/absence checks, not computation; `Standard`/`RegulatoryReq` are "task groups," not executable rules.
3. **Effective-dating + jurisdiction + filing scoping** — rates are per-state, per-LOB, per-effective-date, per-filing. The model has no time/version dimension at all (§3.2).

**Recommendation:** do **not** force rating into the operating-model spine. Add a **separate reference-data subsystem** — e.g. `RateProgram → RateTable (effectiveFrom, jurisdiction, lob, filingRef, version) → RateEntry (key dimensions → value)` + `RatingFactor` + an optional `DecisionRule` — and link it to the spine with one edge (`NodeRateProgram`/`AppRateProgram`: "this rating step/engine uses this program"). Different shape, different lifecycle, clean seam.

This also decides Open Question §7's spirit: the operating model is the *map of work*; reference/rating data is the *content the work consumes*. Keep them adjacent, not merged.

## 7. Meeting-goal coverage (A1–A19 + six questions)

| Goal | v3 status | Note |
|---|---|---|
| A2 generic org levels | ✅ | `OrgLevelType/OrgUnit` (app: `OrgLevel`/`Node`) |
| A3 role at multiple levels | ✅ | `RoleOrgAssignment` |
| A4 manager/reporting | ✅ | already live (`Role.managerRoleId`) |
| A5 connections at any level | ✅ | `Node*` junctions / `NodeLink` |
| A6 reg→app + evidence | ✅ new | `RegulationApplication` (not in app yet) |
| A7 chargeback | ✅ new | `AppChargeback` (not in app yet) |
| A8 task atomic; standards/regs as task groups | ✅ | `isTask`; `Standard`/`RegulatoryReq` |
| A9 automatability | ✅ | field (app already scores it) |
| A10 testing template | ✅ new | `TestingTemplate` |
| A11 key/FK audit | ⚠️ partial | v3 cleaner, but live `Role` still has *both* `divisionId`+`departmentId` optional — the exact ambiguity flagged on the call |
| A12 people + **capacity + wait-time** | ❌ removed | you removed People. **Capacity/wait-time/SLA/carrying-cost can stay at *Role* grain** without persons — see rec #5 |
| A13 data-admin UX (drag-drop move w/ inheritance; admin vs pref) | ⚠️ partial | builder add/move/connect exists; move-inheritance is automatic via adjacency; `UserPreference` added; closure upkeep + true drag-drop still to build |
| A14 display vs system name + terminology | ✅ new | `Terminology` + `dbValue/displayValue` (not in app yet) |
| A15 read views | ❌ gap | views aren't schema; still needed for the composite screens & perf |
| Six-Q #6 "how well: throughput/time/quality" | ⚠️ half | `Metric` ✅, but capacity/wait/SLA/carrying-cost removed with People |

Everything else from the six questions (who/what/how/where/controls) maps cleanly.

## 8. Recommendations (prioritized)

1. **Decide the physical spine and converge 3→1.** Adopt `Node`/`NodeType`/`NodeLink` as the spine; treat v3 as the logical map onto it. Retire/migrate the legacy + `Level`/`OrgLevel` duplicates. *Nothing else scales until this is done.*
2. **Write the graph-vs-typed-table rule.** Hot/aggregated/structured → typed columns/tables (automatability, chargeback, metric values, capacity). Long-tail/optional → `attributes` JSON / `NodeLink`. Document per relationship.
3. **Add a time dimension.** Effective-dating/versioning on the things that change (at minimum reference data; ideally node/link validity). Enables trends + rating.
4. **Add the rating/reference-data subsystem** as a separate, versioned, jurisdiction-scoped set of tables linked to the spine by one edge (§6). Don't merge into ProcessNode.
5. **Keep capacity/wait-time at Role grain** (satisfies the meeting without re-adding People): `Capacity(roleId, period, available/consumed)`, `WorkItem(taskNodeId, roleId, effort/duration/sla/carryingCost)`, `Handoff(fromRole,toRole,workItem,waitTime)`. "No people" ≠ "no capacity."
6. **Onboarding = clone-a-template.** Ship a reference "insurance starter" company; onboarding = clone + relabel (`Terminology`) + trim. Biggest scale-to-customers lever.
7. **Per-instance `displayName` column** for the common relabel case; reserve `Terminology` for cross-entity report aliases.
8. **Soft-delete + snapshot/restore** before drag-drop move ships (rollback-able requirement).
9. **Build the read views** (flattened L1–L5; role→deliverable→task) — A15.

## 9. Open questions

- **"Rating chart"** = insurance rate tables (reference data — needs §6 subsystem) **or** a maturity/automatability scorecard view (mostly doable today via existing automatability scoring + a chart)? This changes the work materially.
- **Capacity/wait-time** — re-add at *Role* grain (rec #5) to meet the meeting goal, or leave out per your "no people"? (They're separable.)
- **Closures** — only worth it if read-side rollups need them; otherwise drop for recursive CTEs at current scale.
- **Physical spine** — commit to `Node`/`NodeType`/`NodeLink` and schedule legacy retirement?
