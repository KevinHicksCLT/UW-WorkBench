# Value Streams Inspector — Developer User Stories (Sidebar Rework v2)

Backlog for the **reworked** sidebar/inspector on the Value Streams **List** and **Map** views.
Pairs with `Value-Streams-Inspector-UX-Spec.md` and wireframes `wf2-inspector-edit-mode-rev`, `wf4-map-inspector-edit-rev`, `wf6-levels-l3-l4-l5`.

**Legend:** Priority `P0` (must) · `P1` (core) · `P2` (fast-follow). Estimate in story points (Fibonacci). ACs use Given/When/Then. Internal/schema names appear in ACs for **developers only** — they must never surface in the UI (see L0).

---

## Epic I — Inspector shell (shared, all levels, both views)

### I1 · One inspector, List + Map `P0` · 5
**As a** user, **I want** the same inspector whether I select a row or a map node, **so that** the experience is consistent.
- **AC1** Selecting a row (List) or single-clicking a node (Map) opens the same inspector component docked-right.
- **AC2** On the Map, single-click selects + inspects (does not drill); double-click/hold drills.
- **AC3** Clicking empty canvas or pressing `Esc` clears selection and the panel.
- **Wireframe:** wf4 (2).

### I2 · Identical layout at every level `P0` · 3
- **AC1** Header, tab set, and styling are identical at L3, L4, and L5; only content density changes.
- **AC2** A level badge shows L3 (rollup) / L4 (rollup, less) / L5 (detail).
- **AC3** Tab set is `Overview · Tasks · Roles · Applications · Deliverables · Checklist · Testing`, each with a live count badge.
- **Wireframe:** wf6 (all), wf2, wf4.

### I3 · Resizable, responsive, accent color `P1` · 3
- **AC1** Panel is drag-resizable; width persists per user.
- **AC2** Top accent bar reflects the node's domain color.
- **AC3** Below ~1024px the panel becomes a full-screen drawer.

---

## Epic J — Data by level (rollup vs detail)

### J1 · L3 rollup view `P0` · 5
**As an** analyst on a value stream (L3), **I want** a rollup of everything beneath it, **so that** I can see how the whole stream operates at a glance.
- **AC1** Overview shows totals for all six groups aggregated across the subtree: roles, applications, deliverables, tasks, checklist items, testing templates.
- **AC2** Each group tab lists top/aggregated items with counts and links to detail.
- **AC3** Rollups are computed live from the underlying L5 detail and are always consistent with it.
- **Wireframe:** wf4 (right panel), wf6 (L3).

### J2 · L4 rollup view `P0` · 2
- **AC1** Same layout and groups as L3, scoped to the sub-process; counts are a subset of the parent L3.
- **Wireframe:** wf6 (L4).

### J3 · L5 detail view `P0` · 5
- **AC1** Shows the actual roles (+RACI), applications (+usage), the deliverable, every checklist item, and the testing template for the step.
- **AC2** Layout, header, and tab set identical to L3/L4; only density differs.
- **AC3** Only level where items are edited directly (Epics K/L).
- **Wireframe:** wf6 (L5), wf2.

### J4 · Rollups stay in sync `P0` · 3
- **AC1** Editing any L5 detail immediately updates the L4 and L3 counts/lists without a manual refresh.

---

## Epic K — Auto-association (no manual node operations)

### K1 · Remove the Node Operations block `P0` · 2
- **AC1** The inspector edit mode shows **no** add-child / reparent / duplicate / delete-node controls.
- **AC2** The Map edit toolbar exposes only: add step, rename, reorder, undo, auto-layout (no manual reparent/connect/delete surgery).
- **Wireframe:** wf2 (7), wf4 (1).

### K2 · System places & wires new items `P0` · 8
**As a** user, **I want** the app to figure out placement and associations, **so that** I never hand-manage the hierarchy.
- **AC1** When I add a task/step, the app places it under the correct parent automatically.
- **AC2** When I add or associate a role/app/checklist item/deliverable, the app creates the correct association(s) without asking me to wire them.
- **AC3** When an item is moved, the app updates structure and associations and keeps the closure/rollups correct.
- **Wireframe:** wf4 (3, 4).

---

## Epic L — L5 detail CRUD (client-facing, auto-propagating)

### L0 · No schema language in the UI `P0` · 2
- **AC1** No table/entity/column/ID/schema names render anywhere in the inspector at any level.
- **AC2** All labels come from the client's admin-editable terminology; items read as the client's roles/apps/controls.
- **Wireframe:** wf2, wf6 (all panels).

### L1 · Associate or add a role `P0` · 5
- **AC1** "＋ Associate / add role" opens a picker that searches existing roles to associate **or** creates a new role inline.
- **AC2** The row sets Owner/Participant and a RACI value; `↗` opens the role; `✕` detaches (the role itself is kept).
- **AC3** A newly created role becomes a real, shared role available everywhere immediately (Epic M).
- **Wireframe:** wf2 (2).

### L2 · Associate or add an application `P0` · 5
- **AC1** "＋ Associate / add application" searches existing apps to associate **or** creates a new app inline.
- **AC2** The row sets usage (performed/memorialized); `↗` opens the app; `✕` detaches.
- **AC3** A new app appears in the Applications catalog and anywhere apps are listed.
- **Wireframe:** wf2 (3).

### L3 · Add / edit checklist items `P0` · 5
- **AC1** "＋ Add checklist item" inserts an inline-editable item (type → Enter commits).
- **AC2** Existing items can be edited in place and removed (`✕`).
- **AC3** Items render as the client's process steps — no system/table references.
- **Wireframe:** wf2 (4), wf6 (L5).

### L4 · Edit the testing template `P0` · 5
- **AC1** System / Location / Check (presence|absence) / Expected are editable controls.
- **AC2** Changes save to the single record and reflect wherever the template is shown.
- **AC3** Presented as the client's control, with no schema labels.
- **Wireframe:** wf2 (5), wf6 (L5).

### L5 · Associate / add deliverables & tasks `P1` · 3
- **AC1** Deliverables can be associated or added and opened (`↗`).
- **AC2** Tasks/steps can be added; the app auto-places them under the correct parent (Epic K).

---

## Epic M — Single source of truth & propagation `P0` (hard requirement)

### M1 · One canonical record `P0` · 5
- **AC1** Adding/editing/creating/moving an association writes to exactly one canonical record — never a per-screen copy.
- **AC2** Creating a "new" role/app/checklist item produces a record the rest of the app reads; it is not duplicated.

### M2 · Reflect across all tabs & views `P0` · 5
- **AC1** A change made in one tab is visible in every other tab of the inspector without refresh.
- **AC2** A change made in List shows in Map and vice-versa.

### M3 · Reflect across the whole app `P0` · 8
- **AC1** A changed/added entity reflects on every other screen that shows it (Org chart, Applications, Deliverables, other value streams) and in L3/L4 rollups.
- **AC2** The change is optimistic, reversible via Undo, and recorded in history.

### M4 · Confirm propagation to the user `P1` · 2
- **AC1** On save, a toast names where the change landed (e.g., "Senior Accountant added — now applied in Org chart, Applications & 2 streams").
- **Wireframe:** wf2 (6).

---

## Suggested delivery order

1. **Shell & levels:** I1, I2, J1–J4 — one inspector, correct rollup/detail by level, in both views.
2. **Source of truth:** M1, M2, M3 — the propagation backbone (build before write features lean on it).
3. **L5 CRUD:** L0, L1, L2, L3, L4 — the editing the client asked for.
4. **Auto-association:** K1, K2 — remove node ops; app handles placement/wiring.
5. **Polish:** I3, L5, M4.

## Open questions (confirm with product)

- Confirm the six-group tab set (Compliance / Metrics·AI / Initiatives deferred).
- Associations editable only at L5, or also on L3/L4 rollups?
- Is there a permission layer to gate Edit, and soft-delete/history to back Undo?
- Do we need per-node shareable URLs?
