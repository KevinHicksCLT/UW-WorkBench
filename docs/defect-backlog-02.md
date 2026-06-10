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
| D1 Home rework | pending |
| D2 VS list | pending |
| D3 VS map | pending |
| D4 Organization | pending |
| D5 Standards | pending |
| D6 Metrics | pending |
| D7 Workspace | pending |
| D8 Deliverables & Tasks | pending |
| D9 Third-Parties | pending |
| D10 Bridge Assistant | pending |
| D11 Dictionary | pending |
| D12 Admin Configure | pending |
