# LOB / Regional Process-Variant Design Plan

**Pilot: New Business (Underwriting) — Continental Europe + Specialty**
Status: DESIGN ONLY — no code. Handoff target: Claude Design (wireframes) → team approval.
Source document: `documents/value-streams/New Business Process Flow Differences.docx`
Live app anchors: https://transform-platform.vercel.app/overview?view=toc | ?view=map | ?view=list

---

## 1. Problem statement

The process spine (L1 domain → L2 value stream → L3 area → L4 sub-process → L5 task) is
generic across all domains. Under Core Business, New Business flows genuinely differ by
**line of business** and by **region**, but today the app can only show one flavor.

The source document defines two independent variant axes:

| Axis | Values (from doc) | Pattern of difference |
|---|---|---|
| **Segment (LOB)** | Personal Lines, Small Commercial, Middle Market, Large Commercial, **Specialty** | Flows get progressively richer: steps are added, renamed, and reordered (e.g., Specialty replaces "Submission Triage" with "Specialist Triage" and adds Aggregation Analysis, Scenario Modeling, Custom Coverage Design, Market Negotiation) |
| **Region** | US Commercial, UK/Lloyd's, **Continental Europe**, Multinational Program | Mostly **insertions** around a common spine (e.g., Continental Europe inserts Country Compliance Review, Data Privacy Validation, Tax Validation) |

Pilot scope = one value of each axis: **Specialty** (segment) and **Continental Europe** (region).

### Hard requirements

- **R1 — No new hierarchy level.** L1–L5 stays as-is; level semantics are locked in `routes/explorer/index.ts`.
- **R2 — No duplication of common steps.** A common step exists once; variants reference it. (This is also the erd_v5 rule: single source of truth, associations are FKs, never repeated rows.)
- **R3 — Scales to many LOBs.** 5 segments × 4+ regions today; the model and every view must stay legible at 20+ variants.
- **R4 — Common vs. variant must be visually obvious** in TOC, Map, and List.
- **R5 — Axes combine.** A user must be able to view "Specialty in Continental Europe" (union of both variants' deltas).
- **R6 — Connected-additions rule.** Every variant-only step is a real, fully wired node (owner role, apps, deliverables, tasks) — no orphans.

---

## 2. Current state (what the views actually are — verified in code)

| View | Component | Mechanics relevant to this design |
|---|---|---|
| **TOC** | `components/TocView.tsx` hosted by `pages/explorer/Explorer.tsx` | Flat one-row-per-entry table in a Card; drill-in-place (domains → streams → navigates to `/streams/:id`); columns = name + count + optional `extra` third column. No chips/badges today. |
| **Map** | `viz/map/MapCanvas.tsx` (React Flow) + `viz/nodes/mapNodeCards.tsx` | Left-to-right drill columns, uniform 220×96 cards, domain color accents at every level, numbered step badges on L4/L5, count `Chip` ("N steps ›") on L4 cards. Inspector docks right as a collapsed rail. |
| **List** | `components/ListExplorer.tsx` (custom virtualized grid using `Sheet.tsx` helpers) | 5 flattened columns (Domain / Division / Value stream / L4 Process / L5 Process), each header a searchable multi-select combobox with dependent options; row click docks Inspector. |
| **Inspector** | `components/Inspector.tsx`, fed by `GET /inspector/:nodeId` | Tabs: Overview, Work, Tasks, Roles, Applications, Deliverables, Checklist, Testing, Governance. Container nodes show subtree rollups; leaf tasks show editable detail. |

**Existing primitives reusable for variants** (nothing else exists — this feature is greenfield on the spine):

- `ProcessNode.attributes Json?` — the only freeform bag on a node.
- `NodeStandard.excluded` / `NodeRegulation.excluded` — the established "does not apply at this node" override pattern.
- `LineOfBusiness` table (code/label/group/segments) — currently regulation-scoped only, but proves the taxonomy shape.
- Data endpoints: `GET /explorer/tree` (TOC + List), `GET /explorer/division/:id/flow` (Map), `GET /inspector/:nodeId`.

---

## 3. Data-model approaches

Both options share one new taxonomy table. Per erd_v5 rules: junctions not free text, and
`erd_v5.mmd` updated with the schema change when implementation happens.

**Shared: `ProcessVariant`**
`id · companyId · dimension ('SEGMENT' | 'REGION') · code · name · sortOrder`
Pilot seed rows: `(SEGMENT, SPEC, "Specialty")`, `(REGION, CE, "Continental Europe")`.
Adding an LOB later = one row + its tags; no schema change (satisfies R3).

### DM-A — Variant tags on the shared spine (annotation overlay) ← recommended for pilot

One junction: **`NodeVariant`** — `processNodeId · variantId · applicability ('ONLY' | 'EXCLUDED')`.

- **No rows for a node = common** (applies to every variant). The default is free.
- A variant-only step (e.g., "Data Privacy Validation") is an ordinary `ProcessNode` in the
  same parent, positioned by `sortOrder`, tagged `ONLY[CE]`, and fully wired per R6.
- A step a variant skips is tagged `EXCLUDED[SPEC]`.
- A **renamed/modified** step = base step `EXCLUDED[SPEC]` + new step `ONLY[SPEC]`
  (e.g., "Submission Triage" excluded for Specialty, "Specialist Triage" only-Specialty).
- Resolver `variantFlow(nodeIds, variantIds)` filters and orders in one `{ in: ids }`
  junction read — matches the existing batch-resolver pattern, no per-row fan-out.
- Combined lens (R5) = union of both variants' ONLY steps minus union of EXCLUDED.

**Pros:** minimal machinery (1 table + 1 junction), zero duplication, trivial to filter in
List/TOC, cheap queries, the "what's different" diff is computable (ONLY = added, EXCLUDED = removed).
**Cons:** cannot express a variant-specific *reorder* of common steps (order comes from the
shared `sortOrder`); renames cost two rows.

### DM-B — Base flow + variant delta (patch model)

`ProcessVariant` plus **`VariantStepOverride`**:
`variantId · action ('ADD' | 'REMOVE' | 'REPLACE') · baseNodeId? · newNodeId? · insertAfterNodeId · note?`

- The base flow is authored once; each variant is an ordered list of patch operations.
- New steps are still real `ProcessNode`s (R6); the override table only carries flow logic.
- Resolver applies the patch to the base sequence per lens.

**Pros:** expresses everything the doc contains — insertions at a position, replacements,
and reorders; the delta is *first-class data*, which directly powers every "what's different"
UI below; REPLACE keeps rename as one auditable row linking old ↔ new.
**Cons:** two moving parts and a patch-application resolver; authoring is less obvious than tagging.

### DM-C — Materialized variant subtrees (rejected)

Give each LOB its own L4 branch and share common steps via a multi-parent junction.
**Rejected:** breaks the single-parent tree that `ProcessNodeClosure` assumes, duplicates
structure (violates R2), and every rollup/resolver would need rework.

**Recommendation:** start the pilot on **DM-A** (Continental Europe is purely additive and
Specialty's differences are expressible as exclude+only pairs). If authoring at scale shows
frequent reorders/replacements, DM-B is the planned evolution — and the two share the
`ProcessVariant` table and all of the UI below, so wireframes are valid for either.

---

## 4. The shared UX primitive: the Variant Lens

Every view gets the same control, so users learn it once:

> **Lens selector** — sits beside the existing TOC | Map | List `ViewPills`.
> Two grouped comboboxes (matching `HeaderComboFilter` styling):
> `Segment: All ▾` `Region: All ▾`
> Default = "All" → today's generic view, plus variant *indicators* on rows/cards.
> Selecting a value resolves the flow for that lens; selecting both combines them (R5).
> A small "Compare" toggle switches from *lens mode* (show the resolved flow) to
> *diff mode* (show what changed vs. base) where the view supports it.

Color language (consistent across all three views, distinct from domain colors):
- **Common step** — current neutral rendering, unchanged.
- **Variant-only step** — variant accent (one hue per dimension: e.g., violet for Segment,
  teal for Region) + a small code chip (`SPEC`, `CE`).
- **Excluded-under-lens step** — ghosted (40% opacity, strikethrough name), hidden by default
  behind a "show skipped (n)" toggle.

---

## 5. View-by-view approaches (two per view, for wireframing)

### 5.1 TOC view

**TOC-1 — Badge column + lens (low-risk, fits existing table)**
- `TocView` already supports an `extra` third column — use it: per row a compact chip set,
  e.g. `Common` (gray) or `+3 CE` / `+5 SPEC` rollups on stream/area rows, `CE only` on step rows.
- Count column becomes lens-aware: "12 steps (9 common + 3 CE)".
- With a lens active, rows not in the lens disappear (or ghost via the skipped toggle).
- Wireframe: current TOC table + third-column chips + lens selector in the header strip.

**TOC-2 — Delta sections (diff-first)**
- Common rows render exactly as today. After the common rows of each group, collapsed
  accent rows: `▸ Continental Europe — 3 additional steps`, `▸ Specialty — 5 changed steps`.
- Expanding reveals the variant steps in-place (reuses the existing drill-in-place pattern),
  each marked added / replaces "X".
- Strength: tells the "what's different" story without any lens interaction; weakness:
  doesn't show the *resolved* flow a CE underwriter actually runs.
- Wireframe: TOC table with one expanded variant section.

### 5.2 Map view

**MAP-1 — Lens overlay on the existing canvas (low-risk)**
- Lens selector on the canvas toolbar. Cards stay 220×96 in the same drill columns.
- Variant-only cards: dashed border in variant accent + corner code chip (`CE`), inserted at
  their true flow position among the numbered step badges (numbers renumber under lens).
- Excluded cards ghost (toggle). No lens = generic flow, but any card that *has* variants
  carries a small stack chip: `⧉ 2 variants` → hover/click popover listing which LOBs differ.
- L4 count chips become lens-aware ("6 steps ›" → "8 steps ›" under CE).
- Wireframe: L4→L5 drill column with 2 inserted CE cards + 1 ghosted card + variant chip.

**MAP-2 — Divergence lanes (railroad diagram, high-storytelling)**
- Within one L4 flow, the common spine renders as the center lane; where a variant diverges,
  an accent-colored branch forks out, runs its variant-only cards, and rejoins the spine
  (React Flow edges already support this).
- Lane cap: max 2 lanes visible at once (chosen via lens); a "+3 more variants" affordance
  otherwise — this is the scaling guard for R3.
- Strength: the common/variant relationship is *spatial* — instantly readable, demo-friendly.
  Cost: new layout work in `buildGraph.ts`, denser canvas.
- Wireframe: New Business flow with the Specialty lane forking after "Broker Submission"
  and the CE lane inserting compliance steps mid-spine.

### 5.3 List view

**LIST-1 — "Applies to" column (fits the Sheet convention)**
- `ListExplorer` gains a 6th column **Applies To** with the same multi-select
  `HeaderComboFilter` as every other column (options: Common, Specialty, Continental Europe, …).
- Cells show the chip set (`Common` / `CE` / `SPEC + CE`). Filter to "Continental Europe"
  = the resolved CE flow (common + CE-only rows); filter to "CE only" = just the deltas.
- Rolls out for free to every other Sheet consumer later (Tasks tab, Work list).
- Wireframe: current 5-column grid + Applies To column, filter popover open.

**LIST-2 — Variant matrix (compare mode)**
- Toggled by the lens "Compare" switch: rows stay the flattened steps; one column per
  selected variant (cap ~4 side-by-side), cells `✓` present / `—` absent / `±` replaced
  (with the replacement name on hover).
- This is the audit/governance artifact: "show me exactly how CE differs from base and
  from Specialty" in one screen.
- Wireframe: steps × [Base | Specialty | Continental Europe] matrix with mixed cells.

### 5.4 Inspector (supporting, one approach)

- **Overview tab**: new "Applicability" block — chip row of variants this node is ONLY/EXCLUDED
  for, or "Common — applies to all lines and regions".
- Container rollups (counts, % automatable, standards/regs) become lens-aware when a lens
  is active, since they already derive from the subtree at read time.
- Governance tab precedent: this mirrors the existing `excluded` UX on standards/regs.

### 5.5 Org side (scoped out of pilot, noted for the plan)

Variant-only steps carry their own `NodeRole` owners (e.g., CE Compliance Officer, Specialty
Underwriter), so role/org views light up automatically — division/department already derive
from the Owner role's OrgUnit. A direct Role↔Variant tag is *not* needed for the pilot;
revisit if role catalogs themselves diverge by LOB.

---

## 6. Recommended combination

| Layer | Pilot pick | Future option |
|---|---|---|
| Data model | **DM-A** (ProcessVariant + NodeVariant tags) | Evolve to DM-B if reorders become common |
| Global UX | **Variant Lens** selector + shared color language | — |
| TOC | **TOC-1** badges | TOC-2 delta sections as a later "diff" affordance |
| Map | **MAP-1** lens overlay | MAP-2 divergence lanes as the flagship demo view, phase 2 |
| List | **LIST-1** Applies To column | LIST-2 matrix behind the Compare toggle, phase 2 |
| Inspector | Applicability block + lens-aware rollups | — |

Rationale: the pilot pairs the lowest-risk rendering changes (badge/chip/insert into
existing components) with the model that makes "common vs. not" a query, not a copy.
MAP-2 and LIST-2 are the high-impact comparison visuals — wireframe them now for the team
presentation, build them second.

## 7. Pilot content scope (from the source doc)

1. Seed `ProcessVariant`: `Specialty (SEGMENT)`, `Continental Europe (REGION)`.
2. Locate the New Business / Submission flow nodes under Core Business (L3/L4).
3. **Continental Europe** (purely additive): insert `Country Compliance Review`,
   `Data Privacy Validation`, `Tax Validation` at doc positions; tag `ONLY[CE]`; wire
   owner roles (compliance/tax), applications, deliverables; link GDPR/tax regulations via
   existing `NodeRegulation` (the `LineOfBusiness`/`markets` fields on the regulation side
   can drive suggestions).
4. **Specialty** (exclude+only pairs): `Specialist Triage` replaces `Submission Triage`;
   add `Technical Risk Assessment`, `Industry Expert Review`, `Aggregation Analysis`,
   `Scenario Modeling`, `Custom Coverage Design`, `Market Negotiation`; exclude base steps
   the doc omits for Specialty. Wire every new step per R6.
5. Verify all three views + Inspector under: no lens, CE lens, Specialty lens, CE+Specialty.

## 8. Wireframe handoff checklist (for Claude Design)

Produce frames for, in this order:
1. **Lens selector** control docked beside the TOC|Map|List pills (default + open + combined state).
2. **TOC-1** (badge column) and **TOC-2** (expanded delta section) — same underlying data.
3. **MAP-1** (lens overlay: inserted CE cards, ghosted excluded card, variant stack chip)
   and **MAP-2** (divergence lanes: Specialty fork + CE insertions).
4. **LIST-1** (Applies To column + filter popover) and **LIST-2** (variant matrix).
5. **Inspector Overview** applicability block.
6. Color/chip spec: neutral common, violet=Segment, teal=Region, ghost=excluded — must
   coexist with the domain colors (blue/green/amber) already on Map cards.

Current-state references for the designer: live app `?view=toc|map|list` at
https://transform-platform.vercel.app/overview, cards spec 220×96 (`viz/model.ts`),
chips/pills from `components/ui/Chip` + `StatusPill`.
