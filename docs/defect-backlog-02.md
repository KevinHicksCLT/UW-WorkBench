# Defect backlog 02 — acceptance criteria

Source: review feedback received 2026-06-10. Branch `data-defects-02`.

Cross-cutting requirements that apply to **every** item:
- **Single source of truth.** Any value the UI shows must come from one DB table/column — no duplicated copies of the same fact in two tables. Where a duplicate exists, pick the canonical store, migrate, and delete/stop-reading the other.
- **Data Admin editable.** Every renamed/reworked screen keeps a Data Admin editor whose edits round-trip to the same DB rows the screen reads.
- **No duplicates.** Reseeds and migrations must be idempotent; data audits check for duplicate rows.

---

## D1 — Home Screen rework (transformation command center)

The Home tab becomes the apparatus for understanding the work ahead: a Shibumi-style
roll-up — programs → projects (initiatives) → scope → roles → tasks & deliverables —
hydrated with a representative baseline plan for the transformation itself.

**AC**
1. Home shows a portfolio roll-up: programs with status/progress, drillable to projects/initiatives, with rolled-up % complete and health.
2. A Gantt-style timeline renders program/initiative phases against dates from the DB (no hardcoded chart data).
3. A KPI/OKR section shows objectives + key results with achievement, sourced from DB tables.
4. Viva roll-up signal data appears as a Home widget (sourced from existing telemetry tables).
5. Portfolio, Programs, Risks and RAID Log views (moved out of Initiatives — see D6) are reachable from Home.
6. A representative baseline plan (programs, projects, milestones, KPIs) exists in the DB via idempotent seed; Data Admin can edit all of it.
7. Jira integration is acknowledged in the design: deliverables/tasks carry an external-key field and the UI shows a "Jira" affordance (stub — no live sync yet).

## D2 — Value Streams: List

**AC**
1. Dead vertical space between the top nav and the content is removed (content starts within ~16px of the tab bar).
2. The level filter chips drop Domains and Divisions — the list shows Value Streams → Sub-processes → Steps only.
3. Rows are thinner (≤32px) and the filter bar is slim (≤40px tall controls).
4. Columns are sortable.
5. The tree renders as a grid (columns: name, level, counts, …) while still expanding/collapsing rows Excel-style.
6. Side gutters reduced — the grid uses the available width.

## D3 — Value Streams: Map

**AC**
1. Map canvas starts near the top of the viewport (no large empty band above).
2. Node boxes are smaller in both dimensions; long names wrap instead of widening the box.
3. The right-side metrics sidebar is removed (hidden) for now.
4. Letter casing is consistent across node labels (title case, rendered consistently).
5. Breadcrumb font is much smaller than today.
6. Parallel-vs-sequential: steps that can run in parallel are not misrepresented as strictly sequential — documented approach + at minimum a visual treatment/note distinguishing sequence-independent steps. (Analysis written up; full auto-detection is future work.)

> **D3.6 analysis (2026-06-10):** the map's left-to-right chevron layout implies strict
> sequence, but the workbook orders steps by Activity ID, not by dependency. The data
> needed to detect true parallelism already exists: `ProcessStep.parentProcessId` groups
> steps under one L4, and `IoItem` inputs/outputs define which step consumes another's
> output. Two steps under the same parent with **no input/output edge between them** are
> sequence-independent and could run in parallel. Proposed treatment (next phase):
> compute that consumes-relation per L4 in the explorer API, lay independent steps in the
> same column (stacked vertically) instead of chained, and badge them "parallel-capable".
> This is also a good Bridge Assistant prompt ("which steps in <stream> could run in
> parallel?") since the SQL is a self-join on IoItem. Not auto-applied yet — needs the
> I/O data quality pass first.

## D4 — Organization: List + tabs

**AC**
1. Same list/grid + spacing fixes as D2 (thin rows, sort, grid with expand/collapse, no dead space).
2. People are not shown in the list (org structure stops at Role).
3. The "Table" sub-tab is removed; the second tab is "Map", mirroring Value Streams.

## D5 — Standards

**AC**
1. Blank gap between the horizontal menu and the list removed.
2. List renders as a grid consistent with D2/D4.
3. "Responsible owner" column removed from the top-level list.
4. Group/department names are not abbreviated (e.g. "Cyber & ISO Security" → "Information Security"); names live in the DB and are edited via Data Admin.
5. Select fields are hyperlinks that drill into the area summary page.
6. Fonts smaller/tighter (≈10pt list typography).
7. Search box has no instructional placeholder text (Google-style empty box).
8. **Data audit:** the "N departments × exactly 22 standards" coincidence is investigated; counts after the fix reflect real per-area variation, with the audit + fix recorded in docs.

> **D5.8 audit result (2026-06-10):** confirmed — 8 of 13 areas had exactly 22 items
> (plus 20/20/24). The items themselves are distinct, domain-appropriate guidelines per
> area (no copy-paste), but every area except Cybersecurity & ISO was authored to a
> ~22-item-per-department template. Cybersecurity & ISO's 113 items come from real
> regulatory packs (GDPR / CCPA-CPRA / NYDFS 500). Fix (`scripts/fix-standards-data.ts`):
> the 12 template areas are now flagged `illustrative=true` and the UI shows an
> "Illustrative" tag explaining the uniformity; the real area keeps `illustrative=false`.
> Fabricating fake count variation was deliberately rejected — the honest fix is
> labeling the provenance; real inventories will replace the template via Data Admin.

## D6 — Telemetry → Metrics

**AC**
1. Tab, routes, page header, admin tab renamed "Metrics" (old /active-ai links redirect).
2. Summary metric boxes are compact; vertical dead space removed.
3. AI Adoption view is refactored into two stages, both DB-driven:
   a. **Analysis coverage** — how many org groups / value streams / roles have been analyzed; % complete; expected finish; on-plan indicator.
   b. **Adoption** — % of tasks automated, % discarded, broken down by Groups, Roles, People, Task Categories, Tasks, Deliverables.
4. Existing color scheme is retained.
5. The breakdowns read from canonical tables (tasks/roles/value streams), not a parallel copy; Data Admin edits flow through.

## D7 — Initiatives → Workspace

**AC**
1. Tab renamed "Workspace" (route may stay /portfolio with the label changed; old links work).
2. Portfolio, Programs, Risks, RAID Log move to Home (D1.5); they no longer clutter Workspace.
3. "Application Rationalization" is titled "Application Rationalization Workspace".
4. Value-stream lens uses cascading dropdowns: picking an L3 value stream populates an L4 process dropdown (dependent selects), replacing the oversized chip rows.
5. Fonts/blank space reduced in low-value areas.

## D8 — Deliverables & Tasks

**AC**
1. Two separate tabs: Deliverables and Tasks.
2. Per-column sort affordance is bigger/darker than today; the separate large "Sort by" control above the table is removed.
3. Roles column removed from the task list; priority indicator removed.
4. "Work Matrix" label removed; dead space between top menu and list removed.
5. **Data:** deliverable names use consistent letter casing in the DB itself (one canonical row per deliverable, no duplicates differing only by case); fix is a migration/script, recorded in docs.

> **D8.5 audit result (2026-06-10):** `scripts/audit-deliverable-casing.ts` found 305 of 441
> titles lowercase vs 136 sentence-case, plus 13 same-name groups. The "duplicates" are
> same-name deliverables in **different value streams** — legitimate distinct rows (0 true
> duplicates within a company + value stream). `scripts/fix-deliverable-casing.ts --fix`
> sentence-cased the 305 titles; re-run reports 0 remaining (idempotent).

## D9 — External → Third-Parties

**AC**
1. Tab/page renamed "Third-Parties" (route /external still resolves).
2. Frequency column removed.
3. Blank-space fixes as elsewhere.
4. Internal owners reviewed: where the owner is too high-level, rows are re-pointed at the actual operating role (data fix in DB; editable in Data Admin).

## D10 — AI Assistant → Bridge Assistant

**AC**
1. Widget header/labels say "Bridge Assistant".
2. Response formatting is fixed: markdown renders correctly (headings, lists, tables, spacing) in the popup; no raw markdown artifacts.

## D11 — Data Admin: Data Dictionary

**AC**
1. Dictionary entries reflect the renamed tabs (Metrics, Workspace, Third-Parties, Bridge Assistant) and current screens; stale terms removed.

## D12 — Data Admin: Configure

**AC**
1. Dead space below the page header removed.
2. View tabs are, in order: **Configure | Audit Log | Data Dictionary** (Audit Log embedded as a view, not just a link).
3. Admin lists support sort.
4. Checklist-item editor: column/field "Text" is labeled **Description**; the "Cross role" column is removed from the visible columns (DB column stays).
5. **Structural edits hit the DB:** moving a node a level (e.g. moving Cyber one level lower) through the admin UI updates the underlying hierarchy rows (parent/level fields) — verified by reading the DB after the edit and by the app tabs re-rendering the new structure.

---

## Verification protocol

Each AC is checked off by exercising the running app (Playwright) + querying the DB
(Neon) after edits. The final pass (task #11) re-verifies everything end-to-end.

| Defect | Status |
| --- | --- |
| D1 Home rework | DONE (six new widgets: portfolio rollup, program Gantt w/ milestones+today line, OKRs, top risks, RAID summary, workforce signals; Portfolio/Programs/Risks/RAID moved from Workspace; jiraKey stub on Task+Deliverable w/ JIRA chip; baseline plan verified credible + Jira keys seeded; all configurable in Data Admin → Home) |
| D2 VS list | DONE (grid + sort + expand/collapse-all, 27px rows, no Domain/Division rows, flush top). 29-vs-36 count mismatch RESOLVED: 7 Life & Retirement streams had no division parent (no role links either) — re-parented to their closest functional division via `scripts/fix-vs-orphans.ts`; list and Home now both read 36 from the same node tree |
| D3 VS map | DONE (top-pinned camera, 143×65 boxes w/ wrapped labels, sidebar gated off, sentence-case labels, 11px breadcrumb; parallelism analysis documented) |
| D4 Organization | DONE (grid + sort, people removed, List & Map tabs) |
| D5 Standards | DONE (sortable grid, owner column removed, hyperlink drill-downs, Information Security rename in DB+seed+scripts, blank search, illustrative provenance tags; audit documented) |
| D6 Metrics | DONE (two-stage page: AnalysisStatus coverage + Task.aiDisposition adoption breakdowns by group/role/category/deliverable/stream; heat map demoted; compact stats; new tables Data Admin-editable) |
| D7 Workspace | DONE (cascade + declutter; Portfolio/Programs/Risks/RAID moved to Home; Workspace = App Rationalization Workspace, full width) |
| D8 Deliverables & Tasks | DONE (tabs split, declutter, 305 titles recased, dupes audited) |
| D9 Third-Parties | rename + frequency column DONE; owner review pending |
| D10 Bridge Assistant | DONE (renamed; live reply verified — tables/lists render as HTML, no raw markdown) |
| D11 Dictionary | pending |
| D12 Admin Configure | DONE except blank-space (in global UI pass) |
