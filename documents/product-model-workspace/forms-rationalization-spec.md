# Transformation Bridge — Forms Rationalization Module

## Spec-Driven Design Stories

**Version:** 0.1 (Draft for review — Kevin / Kelly / Xandor)
**Date:** 2026-07-31
**Sources:** Form Rationalization design doc (Kelly), Transformation Bridge live app (`transform-platform.vercel.app`), meeting notes 7/28 & 7/30

> **Scope note:** FR-8.1 (Mock Forms Ingestion & Naming-Convention Parsing) is **deferred to a later phase** and is intentionally excluded from this build. Until then the module runs on an in-app mock dataset that conforms to the shared data model in §3, so the ingestion path can be added later without UI change.

---

## 1. Context & Goal

Insurance carriers today maintain hundreds of forms because every state/product combination is treated as a unique form. The design doc's thesis: **forms are not unique — they decompose into three layers**:

```
Enterprise (Core) Forms  →  State Variations  →  Product-Specific Variations
```

**End goal of this module:** guide an enterprise from its **current state** (hundreds of individually-maintained forms) to a **target state** of a small set of reusable core forms with **multistate/region overlays** (e.g., a single "Western States Amendment" replacing separate CA/NV/AZ amendments) — the end-state architecture typically targeted in Guidewire / Duck Creek product rationalization programs.

The module answers three questions for every form:

1. Why does this form exist? (statutory, DOI, disclosure, product differentiation, legacy, unknown)
2. Can the requirement be absorbed into the core form (as a conditional language block)?
3. Can multiple state forms be unified into one multistate/region form?

---

## 2. Look & Feel Constraints (keep consistent with the live app)

New Forms views must reuse the existing Transformation Bridge visual system rather than introduce a new one:

- **Theme:** dark navy app chrome (`#141f37` theme color), existing card + data-grid component library, existing typography scale.
- **Navigation pattern:** Forms Rationalization lives as a tab/section alongside the existing Portfolio / Products / Value Streams / Workspace areas, using the same drill-down pattern (zoomed-out summary → zoomed-in detail) already used for products.
- **Cards:** summary metrics presented as stat cards in the same card style as the portfolio views. Per 7/28 feedback, new cards must **not** repeat the wasted-left-margin layout — use full card width, vertical stacking of metrics.
- **Legibility (hard requirement from 7/28):** no muted gray body text; all new text meets WCAG AA contrast against the navy theme; use the app's primary legible font.
- **Grids:** all new tables inherit the spreadsheet-like grid behavior being built for the product grid — multi-level combinatory filtering, sort on any column including within groups, search, and browser back-button-safe navigation.
- **AI assistant:** forms views feed context into the existing bottom-right AI assistant (context-aware, per the 7/28 enhancement item) rather than adding a second chat surface.
- **Status color language:** 🟢 Standard / 🟡 State Variation / 🔴 Product-Specific Variation — used consistently across heat map, grids, and cards.

---

## 3. Shared Data Model (backing all stories; mock data first)

Per the 7/30 meeting, the demo runs on **10–20 mocked forms** (Liberty / State Auto / Safe Auto homeowner + the design doc's Personal Auto examples) loaded into the knowledge base and wired to the tool. All views below must render entirely from this model so real filed-forms data can be swapped in later without UI change.

```
Form {
  formId              // e.g. "PA-101-CA", "AUTO-CA-001"
  title, description
  lineOfBusiness      // e.g. Personal Auto, Homeowners
  productIds[]        // products that attach this form
  layer               // CORE | STATE_VARIATION | PRODUCT_VARIATION
  parentFormId        // the core form this varies from (null for core)
  state               // null = countrywide; derived from naming convention when ingesting
  region              // optional grouping (e.g. "Western States") — target-state concept
  coverageRefs[]      // e.g. UM/UIM, PIP
  existenceReason     // STATUTORY | DOI_REQUIREMENT | STATE_DISCLOSURE |
                      // PRODUCT_DIFFERENTIATION | LEGACY_ARTIFACT | UNKNOWN
  regulatoryCitations[], relatedRules[], relatedForms[], filingDependencies[]
  cluster { clusterId, similarityPct }          // AI clustering output
  decision {                                    // rationalization decision record
    status            // UNDECIDED | KEEP_STATE_VARIATION | STANDARDIZE | UNIFY | RETIRE
    reason, decidedBy, decidedAt
  }
}
```

**Derived metrics (computed, never hand-entered):** commonality % per core form, counts of state/product variations, rationalization-candidate count, decision progress %.

**Ingestion rule (from 7/30):** when loading forms, the absence of a state identifier in the form ID/naming convention marks a form as countrywide; a state token (e.g., `-CA-`, `-NY-`) marks it as a state variation and links it to its parent where determinable. *(Implementation of the loader itself is deferred with FR-8.1; the rule still governs how the mock dataset is authored.)*

---

## 4. Epic & Story Index

| Epic | Stories | Status |
|---|---|---|
| E1 — Forms Hierarchy & Portfolio Summary | FR-1.1, FR-1.2 | In scope |
| E2 — State Overlay Heat Map | FR-2.1, FR-2.2 | In scope |
| E3 — Form Rationalization Matrix | FR-3.1 | In scope |
| E4 — AI Form Clustering | FR-4.1, FR-4.2 | In scope |
| E5 — Rationalization Workflow & Decisions | FR-5.1, FR-5.2, FR-5.3 | In scope |
| E6 — Executive Decision Dashboard | FR-6.1 | In scope |
| E7 — Compliance Agent Integration | FR-7.1, FR-7.2 | In scope |
| E8 — Data Foundation & Mock Dataset | FR-8.1 | **Deferred — later phase** |

---

## Epic 1 — Forms Hierarchy & Portfolio Summary

*Stop displaying forms as a flat list; display them as a three-layer hierarchy.*

### FR-1.1 — Core Form Summary Card ("Main Form View")

**As a** transformation executive, **I want** each core form presented as a single summary card with its variation footprint, **so that** I see one core form instead of dozens of raw forms.

**Spec — UI**

- Card per core form in the existing stat-card style (full-width content, vertically stacked metrics, high-contrast text). Example content, per the design doc:
  - Title: *PA Core Policy Form* (parent: Personal Auto Policy)
  - **Used By:** 18 Products · **States:** 50 · **Commonality:** 92%
  - **State Variations:** 14 · **Product Variations:** 3
- Commonality rendered with the app's standard progress/percent visual; variation counts are click-through links into FR-1.2 drill-down filtered to that layer.
- Cards grid is filterable by line of business and product (combinatory filters, consistent with product grid behavior).

**Spec — Behavior**

- All metrics computed from the data model (counts of children by `layer`, distinct `productIds`, distinct `state`).
- Clicking the card opens the hierarchy drill-down (FR-1.2) anchored at that core form.

**Acceptance Criteria**

- Given the mock dataset, when I open the Forms tab, then I see one card per `CORE` form and zero cards for variation-layer forms.
- Given a core form with 14 `STATE_VARIATION` children, when its card renders, then "State Variations: 14" is shown and clicking it opens the drill-down pre-filtered to state variations.
- Given any card, when rendered on the navy theme, then all text passes WCAG AA contrast (no muted gray).

**Data:** `Form` where `layer = CORE` + aggregated child counts.

---

### FR-1.2 — Hierarchical Drill-Down (LOB → Core → State → Coverage → Product)

**As an** analyst, **I want** to navigate the form hierarchy exactly as the doc's visual (Personal Auto → Countrywide Policy Form → State Variations → Coverage Variations → Product Exceptions), **so that** I can move from zoomed-out to zoomed-in without losing context.

**Spec — UI**

- Expandable tree/grid using the same drill-down interaction as the product hierarchy: each level is a defined column/level, not a collapsed group requiring click-in (addresses the 7/28 parent/child grouping complaint).
- Levels: Line of Business → Core (countrywide) Form → State Variations → Coverage Variations → Product Exceptions.
- Each row shows layer badge (🟢/🟡/🔴), form ID, description, product count, and decision status chip (from E5).
- Breadcrumb reflects the path; browser back button returns to the previous level.

**Spec — Behavior**

- Sort and filter operate at any level of the hierarchy (e.g., filter states to "Modified" while sorted by product count) — filters intersect.
- Deep links: every node has a routable URL.

**Acceptance Criteria**

- Given the mock Personal Auto data, when I expand *Countrywide Policy Form*, then I see its state variations as rows, and expanding a state shows its coverage/product variations.
- Given active filters at two levels, when both are applied, then the visible rows are the logical intersection.
- Given a drill-down three levels deep, when I press browser back, then I return exactly one level up.

**Data:** full `Form` hierarchy via `parentFormId`.

---

## Epic 2 — State Overlay Heat Map

*Instead of showing 50 forms, show a state heat map.*

### FR-2.1 — 50-State Heat Map per Core Form

**As an** executive, **I want** a per-core-form map/grid of all 50 states colored by status, **so that** I instantly see where the countrywide form applies untouched vs. where deviations exist.

**Spec — UI**

- View toggle on a core form: Card → **State Overlay**. Renders all states as a US map (or state-tile grid fallback) using the standard legend: 🟢 Standard · 🟡 State Variation · 🔴 Product-Specific Variation.
- Legend always visible; colors must also carry a text/icon status for accessibility (not color-only).
- Hover/tap a state → tooltip with state name, status, count of variant forms, top existence reason.
- Click a state → opens FR-3.1 matrix scoped to that state.

**Acceptance Criteria**

- Given the mock data where CA/FL/NY/TX are `Modified` and the rest `Standard`, when the overlay renders, then exactly those four states show the variation color and all others show Standard.
- Given a state with only product-level variants, when rendered, then it shows the 🔴 product-specific status.
- Given any state click, when selected, then the Rationalization Matrix opens scoped to that state and the URL updates.

**Data:** aggregation of `Form` by `state` under one `parentFormId`.

### FR-2.2 — Region Grouping View (Multistate Target State)

**As a** product manager, **I want** to group states into regions (e.g., Western States) on the overlay, **so that** I can see and plan multistate/region form consolidation — the end goal of the program.

**Spec — UI/Behavior**

- Region lens toggle: states aggregate into named regions; a region is colored by its "worst" member status and shows `n states / m variant forms`.
- Regions are definable (default set provided in mock data, e.g. Western States = CA/NV/AZ) and are the target container for UNIFY decisions (FR-5.3).

**Acceptance Criteria**

- Given the default Western States region, when the region lens is on, then CA/NV/AZ render as one region tile with combined counts.
- Given a UNIFY decision creating a "Western States Amendment" (FR-5.3), when I re-open the overlay, then the region tile reflects the unified target form.

**Data:** `region` on `Form` + region definition list (mockable).

---

## Epic 3 — Form Rationalization Matrix

### FR-3.1 — State × Product Requirement Matrix

**As an** analyst, **I want** a per-state matrix of requirements vs. products showing Same / Variant / Different, **so that** I can see exactly what is common, what is state-required, and what is product-specific.

**Spec — UI**

- Table per state (design doc "California Auto Forms" example): rows = requirements (Main Policy Form, CA Amendment, UM/UIM, Disclosure…), columns = products (A, B, C…).
- Cell values: `Same` / `Variant A` / `Variant B` / `Different`, colored with the standard status language; identical variants share a label so matching cells are visually groupable.
- Summary band above the table: **70% Common · 20% State Required · 10% Product Specific** (computed), in the standard stat style.
- Grid inherits spreadsheet behavior: sortable columns, filterable rows, sticky headers.

**Spec — Behavior**

- Clicking a cell opens the underlying form(s) side-by-side comparison (reuses FR-4.2 diff surface).
- Matrix is reachable from heat-map state click (FR-2.1) and via direct URL.

**Acceptance Criteria**

- Given mock CA data matching the design doc, when the matrix renders, then Main Policy Form and UM/UIM rows show `Same` across products, CA Amendment shows Variant A/B/A, and Disclosure shows Different/Different/Same.
- Given the same data, when the summary band computes, then it shows the common/state/product split percentages derived from cell values (not hardcoded).
- Given a cell click, when two variant forms differ, then a comparison view opens showing both forms.

**Data:** requirement rows derived from `coverageRefs`/form roles; variant equality from `cluster` similarity + explicit mapping in mock data.

---

## Epic 4 — AI Form Clustering

*"Probably the most valuable view" — replace manual comparison with AI-clustered similarity.*

### FR-4.1 — Cluster View (Similar Forms Grouped)

**As an** analyst, **I want** AI-generated clusters of similar forms with a similarity score, **so that** the business immediately sees "these are effectively the same form and should be consolidated."

**Spec — UI**

- Cluster cards grouped by state (design doc example: *California Forms — Cluster 1 — 92% similar — PA-101-CA, AUTO-CA-001, AU-CA-010*).
- Card shows: cluster ID, similarity %, member form IDs (linked), covered products, and a **Consolidate** call-to-action that opens the decision workflow (FR-5) pre-filled with cluster members.
- Sortable by similarity %, member count, savings potential; filterable by state, LOB, product.

**Spec — Behavior**

- Clusters are computed offline/async by the AI pipeline and stored on the model (`cluster`); the UI never blocks on live AI calls.
- Similarity threshold for display is configurable (default ≥ 85%).

**Acceptance Criteria**

- Given the mock dataset, when the cluster view loads, then CA forms PA-101-CA / AUTO-CA-001 / AU-CA-010 render as one cluster at 92% and NY forms as a second cluster at 96%.
- Given a cluster's Consolidate action, when clicked, then the FR-5 workflow opens with all member forms attached.

**Data:** `cluster { clusterId, similarityPct }` on each `Form`.

### FR-4.2 — Cluster Detail & Form Diff

**As an** analyst, **I want** to open a cluster and see member forms compared side-by-side with differences highlighted, **so that** I can validate the AI's similarity claim before deciding.

**Spec — UI/Behavior**

- Two-or-more column comparison; common language rendered normally, differences highlighted; per-pair similarity shown.
- Differences are classified where known: statutory wording vs. formatting vs. product wording (feeds Question 1 categories).
- Export/insert-to-AI-assistant action: pushes the comparison context to the bottom-right assistant for follow-up questions.

**Acceptance Criteria**

- Given a 92% cluster, when I open detail, then differing sections are visibly highlighted and the identical remainder is not.
- Given the AI assistant open, when I use "Ask about this comparison," then the assistant receives the cluster context (form IDs, diff summary).

**Data:** form content sections (mock text bodies for the demo) + diff classification.

---

## Epic 5 — Rationalization Workflow & Decision Capture

*The executive view shouldn't focus on forms; it should focus on decisions. Every state-specific form gets a recorded answer to the three questions.*

### FR-5.1 — "Why Does This Form Exist?" Classification

**As a** compliance analyst, **I want** to classify each variation form's reason for existence, **so that** legacy duplication is separated from true regulatory mandate.

**Spec — UI/Behavior**

- On any non-core form: a classification control with exactly the doc's categories: Statutory Requirement · DOI Requirement · State Disclosure Requirement · Product Differentiation · Legacy Artifact · Unknown.
- Classification is single-owner, auditable (who/when), and displayed as a chip in all grids and drill-downs.
- AI pre-suggests a category (with citation context from FR-7.1) but a human confirms — maker-checker: the confirmer cannot be the AI.

**Acceptance Criteria**

- Given an unclassified form, when displayed anywhere, then its chip shows `Unknown` styled as needing attention.
- Given an AI suggestion, when a user confirms or overrides it, then the decision record stores user, timestamp, and prior value.

### FR-5.2 — Absorb-into-Core Decision (Standardize)

**As an** analyst, **I want** to record that a state form's requirement can be absorbed into the core form as a conditional language block, **so that** the separate state form can be eliminated.

**Spec — UI/Behavior**

- Decision action `STANDARDIZE` on a variation form: captures target core form, the conditional language block note (e.g., "National Auto Form + California Conditional Language Block"), and reason.
- On save, hierarchy (FR-1.2), heat map (FR-2.1), and dashboard (FR-6.1) counts update: the form moves out of "candidates" into "decided."

**Acceptance Criteria**

- Given a CA amendment marked STANDARDIZE into the national form, when I revisit the drill-down, then the form shows a Standardize chip and the core form's future-state view lists the CA conditional block.
- Given a decided form, when the dashboard recomputes, then outstanding-decision count decreases by one.

### FR-5.3 — Unify-States Decision (Multistate/Region Form)

**As a** product manager, **I want** to unify multiple state amendments into a single multistate/region form with state-specific rule sections, **so that** we reach the target state (e.g., CA + NV + AZ amendments → one Western States Amendment).

**Spec — UI/Behavior**

- From a cluster (FR-4.1) or multi-select in a grid: `UNIFY` action → dialog to name the target form (e.g., "Western States Amendment"), pick/create the region, and list member state sections.
- Creates a target-state form record (layer CORE-region) with the member forms linked as `supersededBy`; members get decision status UNIFY.
- Region overlay (FR-2.2) and dashboard reflect the new target form.

**Acceptance Criteria**

- Given CA/NV/AZ amendments selected, when I complete UNIFY as "Western States Amendment," then a new form record exists with three state rule sections and all three source forms show UNIFY status linking to it.
- Given the same name+type already exists in the directory, when I try to create it, then creation is blocked (consistent with the app's existing no-duplicate rule for value streams).

**Data (E5):** `decision` block on `Form`; target-state form records; audit trail. All decision transitions are versioned/snapshottable per the 7/30 versioning requirement.

---

## Epic 6 — Executive Decision Dashboard

### FR-6.1 — Portfolio Decision Dashboard

**As an** executive, **I want** a portfolio-level dashboard of form counts, rationalization candidates, decision progress, and top opportunities, **so that** I manage the program by decisions, not by forms.

**Spec — UI**

- Stat cards (design doc example): Total Forms 420 · Core Forms 45 · State Variations 310 · Product Variations 65 · **Rationalization Candidates 180**.
- Progress indicators (7/28 requirement): % of normalization/decisions complete and count of outstanding decisions.
- **Top Opportunities** table: opportunity name × savings potential (High/Medium/Low), sortable, each row linking to the relevant cluster/matrix (e.g., "CA Amendment Consolidation — High").
- Current-state vs. target-state summary: forms today vs. projected forms after all recorded decisions execute ("hundreds of forms → smaller set of core forms with overlays").

**Acceptance Criteria**

- Given the mock data, when the dashboard loads, then every number is computed live from form/decision records (nothing hardcoded).
- Given one new STANDARDIZE decision, when I return to the dashboard, then candidates and outstanding decisions each decrement and projected target-state count updates.
- Given a Top Opportunity row click, when opened, then I land on the supporting view (cluster or matrix) for that opportunity.

**Data:** aggregations over `Form` + `decision`; opportunity list derived from clusters (size × similarity × savings heuristic; mockable).

---

## Epic 7 — Compliance Agent Integration

### FR-7.1 — Bridge Context Package per Form

**As a** compliance agent (AI) or analyst, **I want** every form to expose a structured context package, **so that** evaluation happens with full context instead of an isolated document.

**Spec**

- Panel on form detail (and API/JSON for the agent), fields per the design doc: Parent Form · State · Associated Products (count + list) · Regulatory Citations (count + list) · Related Coverages · Related Rules · Related Forms.
- Same package is what the bottom-right AI assistant receives as context when opened from a form view (fixes "assistant lacks context" from 7/28).

**Acceptance Criteria**

- Given form CA-UM-001 in mock data, when its detail opens, then the context panel shows parent Personal Auto Policy, state California, 12 products, 15 citations, UM/UIM coverage, 23 rules, 5 related forms.
- Given the AI assistant opened from that form, when I ask a question, then the assistant demonstrably has the package (echoes correct parent/state/product facts).

### FR-7.2 — Agent Recommendation (Keep / Standardize / Retire)

**As an** analyst, **I want** the compliance agent to recommend a disposition with a reason, **so that** human deciders start from an informed default.

**Spec — UI/Behavior**

- Recommendation banner on form detail, one of: **KEEP STATE VARIATION** ("California statutory wording requirement") · **STANDARDIZE** ("Requirement already covered in core form") · **RETIRE** ("No active filing dependency").
- One-click "Accept recommendation" → opens the matching FR-5 decision pre-filled; explicit human confirmation always required (deterministic rule: agent can never finalize a decision).
- Recommendations are stored with the citation(s)/evidence that produced them.

**Acceptance Criteria**

- Given a form with an active statutory citation, when the agent evaluates it, then the recommendation is KEEP with the citation shown.
- Given a form with no filing dependencies, when evaluated, then RETIRE is recommended, and accepting it records a human-confirmed RETIRE decision.
- Given no human confirmation, when only the agent has acted, then the form's decision status remains UNDECIDED.

---

## Epic 8 — Data Foundation & Mock Dataset *(deferred)*

### FR-8.1 — Mock Forms Ingestion & Naming-Convention Parsing — **DEFERRED to a later phase**

Ingestion loader (CSV/JSON manifest → data model, naming-convention state parsing, exception list) will be built later. The current build ships a hand-authored mock dataset that satisfies the same dataset floor: ≥ 3 core forms, variations across ≥ 4 states (CA/NY/TX/FL), 2 products with product-specific variants, 2 pre-built clusters, and 1 retire candidate — enough to demo every epic.

---

## 9. Out of Scope (this spec)

External regulator/SERFF data acquisition, paid memberships, and live filed-forms scraping (data-sourcing workstream); PowerPoint/demo collateral; Copilot-vs-Claude tooling choice; change-impact assessment for **applications** (separate module, mock data owned by Kevin/Xandor); org/role value-stream changes not related to forms.

## 10. Traceability

| Story | Source |
|---|---|
| FR-1.1, FR-1.2 | Design doc "Main Form View" + hierarchy visual; 7/30 "hierarchical display for executives" |
| FR-2.1, FR-2.2 | Design doc "State Overlay View" + legend; end goal multistate/region target |
| FR-3.1 | Design doc "Form Rationalization Matrix" (California example, 70/20/10) |
| FR-4.1, FR-4.2 | Design doc "AI Form Clustering View"; 7/30 AI clustering discussion |
| FR-5.1–5.3 | Design doc "Rationalization Workflow" Questions 1–3; 7/28 decision tracking; 7/30 governance |
| FR-6.1 | Design doc "Decision Dashboard"; 7/28 progress indicators |
| FR-7.1, FR-7.2 | Design doc "What the Compliance Agent Would See"; 7/28 AI-assistant context fix |
| FR-8.1 *(deferred)* | 7/30 mock data / knowledge base follow-up; naming-convention rule |
| Look & feel §2 | Live app shell (title, `#141f37` theme); 7/28 legibility, card-space, grid & navigation feedback |
