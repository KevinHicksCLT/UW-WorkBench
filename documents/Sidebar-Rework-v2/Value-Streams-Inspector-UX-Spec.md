# Value Streams — Sidebar / Inspector Rework

**UX research, design principles, and target-state specification**
Transformation Bridge · Value Streams (List + Map) · v2 · June 2026

---

## 0. Iteration 2 changes (authoritative — supersede earlier sections where they conflict)

This revision narrows and sharpens the design based on direction. Reworked wireframes: **`wf2-inspector-edit-mode-rev`** (L5 detail edit), **`wf4-map-inspector-edit-rev`** (map + shared panel), and new **`wf6-levels-l3-l4-l5`** (data by level).

**0.1 One sidebar, same at every level and in both views.** The inspector layout, tab set, and behavior are **identical** on List and Map and at L3, L4, and L5. Only the *content density* changes by level.

**0.2 Data by level.**
- **L3 (value stream)** — a **rollup** of everything beneath it: all roles, applications, deliverables, tasks, checklist items, and testing templates, shown as totals + top items. Read-oriented; drill in to edit.
- **L4 (sub-process)** — the **same rollup, scoped smaller** (fewer items than L3).
- **L5 (step/task)** — **full detail**: the actual roles (+RACI), applications (+usage), the deliverable, every checklist item, and the testing template — and this is where editing happens. *(This is the reworked area.)*

**0.3 Focused content set.** For this iteration the inspector centers on six client-facing groups — **Roles, Applications, Deliverables, Tasks, Checklist items, Testing templates** — surfaced as tabs: `Overview · Tasks · Roles · Applications · Deliverables · Checklist · Testing`. (Compliance / Metrics·AI / Initiatives from v1 §4.2 are deferred, not removed.)

**0.4 Show the client, not our build.** No table, entity, column, or schema names anywhere in the UI. Every label is the client's own business term (admin-editable). The panel reads as an organized picture of how the company runs. The "Source / data model" lines shown in v1 wireframes are **removed** from the product UI (they live only in this dev spec).

**0.5 No manual node operations.** The v1 "Node operations" block (add child / reparent / duplicate / delete node) is **removed** from the inspector. The application is responsible for placement and wiring: when a user adds or moves an item, the app automatically creates the correct associations and puts it in the right place. Users never hand-manage the hierarchy. (The Map keeps only add-step / rename / reorder / undo / auto-layout.)

**0.6 Required CRUD on the L5 detail (all auto-propagating).**
- **Roles** — associate an existing role **or** add a brand-new role inline; set Owner/Participant + RACI; detach.
- **Applications** — associate an existing app **or** add a brand-new app inline; set usage (performed/memorialized); detach.
- **Checklist items** — add, edit text, remove.
- **Testing template** — edit System / Location / Check / Expected.
- **Deliverables / Tasks** — associate / add; the app auto-places tasks under the correct parent.

**0.7 Single source of truth — propagation (hard requirement).** Any association that is **added, edited, newly created, or moved** must write to **one canonical record** and then be reflected **everywhere**: every other tab of the inspector, both List and Map, and every other screen that shows the entity (Org chart, Applications catalog, Deliverables, other value streams), plus the L3/L4 rollups. A new role/app/checklist item created here **is the same record** the rest of the app reads — never a duplicate. Changes are optimistic, reversible (Undo), and recorded in history. The UI confirms propagation explicitly (e.g., "added — now applied in Org chart, Applications & 2 streams").

---

## 1. Objective

Rework the right-hand sidebar (the "inspector") that appears on the Value Streams **List** and **Map** views so it:

1. Renders the operating model attached to a process node, at the right depth for the level.
2. Makes every linked entity a **hyperlink** to its canonical screen.
3. Lets users **create, read, update, and delete** the node's relationships **in edit mode**, directly from this surface — with the app handling placement/wiring.
4. Behaves **identically** whether the node was selected in the List or on the Map (one component, two hosts).

This document is the design rationale and behavior spec. The annotated wireframes in this folder (`wf2`, `wf4`, `wf6`; SVG + PNG) are the visual target state. The companion `Value-Streams-Inspector-User-Stories.md` is the developer backlog.

---

## 2. Current state (as observed in the running app)

| Area | What exists today | Gap |
|---|---|---|
| **List view** | Hierarchical grid: Domain ▸ Division ▸ Value Stream ▸ Sub-process ▸ Step. Selecting a row opens a right inspector. | Inspector is **read-only**. |
| **Inspector content** | Level badge, title, type, a "Testing template" button, three stat tiles (Supporting roles / Applications / Deliverables), an expandable Roles list, and an "Open expanded view" link. | Shallow; surfaces only a few of the linked groups. No editing. |
| **Expanded view** | Wider drawer drilling Deliverable ▸ Responsible roles ▸ Checklist. | Read-only. |
| **Map view** | Drill-down node graph (Company ▸ Domain ▸ Division ▸ Value Stream…). Breadcrumb trail. | **No inspector** on the Map. Selecting a node only drills. |
| **Map edit mode** | Toolbar: "Drag to move · hold to drill · drop in a row to reorder · double-click to rename." | Structural only. Cannot add, edit, or manage any associated data. No parity with a List editing experience. |

**Core problem:** the current sidebar is a shallow read-only viewer. Users must leave the screen to see or change almost anything, and the Map can't be inspected or edited at all.

---

## 3. UX research — principles applied

Grounded in current (2025–26) guidance from enterprise design systems and UX literature (sources in §11).

- **Master–detail is the right frame.** The grid/map is the *master*; the inspector is the *detail*. Keeps the user oriented while inspecting.
- **Progressive disclosure / data by level.** Show a one-glance summary first (rollups at L3/L4) and the full editable detail on demand (L5). Present key data upfront, details on demand.
- **Tabs for peer groups.** The six content groups are treated as equal peers; a single flat accordion of everything is hard to scan. Matches NN/g and IxDF guidance for deeper hierarchies.
- **Explicit edit mode with in-context affordances.** A clearly-signalled edit mode with explicit Save/Discard keeps read mode calm, while inline inputs and ＋Add / ✕ controls keep editing in context.
- **Feedback & perceived speed.** Skeleton screens on fetch; spinners only for explicit saves; optimistic UI with rollback on failure; explicit propagation confirmation.
- **Smart system, not manual surgery.** Users add/associate; the app figures out placement and wiring (no manual reparent/duplicate/delete of nodes).
- **Graph-editor conventions (Map).** Snap-to-grid, visible selection, on-node quick actions, keyboard navigation, and an always-available list alternative.

---

## 4. Target state — the unified inspector

One inspector component, reused by List and Map, identical at every level. Two modes (View / Edit) and a larger Expanded view.

```
┌──────────────────────────────────────────────┐
│ breadcrumb (each crumb a link)        [L_ badge]│  ← context + level
│ Step / stream name                              │
│ [Task] [Augmented ▾] [Verified ▾]               │ ← identity & status chips
│ [✎ Edit] [⤢ Expand]            ⟲ One source ●    │ ← actions + sync pill
├──────────────────────────────────────────────┤
│ Overview │ Tasks │ Roles │ Applications │       │ ← tab strip (consistent)
│ Deliverables │ Checklist │ Testing              │
├──────────────────────────────────────────────┤
│ (tab content — cards, chips, inline controls)   │
│ …every linked entity is a ↗ hyperlink…          │
├──────────────────────────────────────────────┤
│ ⤢ Open expanded view                            │
└──────────────────────────────────────────────┘
```

**Default width** ~400px, user-resizable (persisted in `UserPreference`); collapses to a full-screen drawer below ~1024px. The top accent bar carries the node's **domain color**.

### 4.1 Header & identity

- **Breadcrumb** built from the ancestor path; each crumb links to that node.
- **Name** = the admin-editable client label (never an internal/system name).
- **Status chips** (client language): type, automatability (manual/augmented/automated), verification.
- **Level badge** shows L3 (rollup) / L4 (rollup, less) / L5 (detail).
- **Actions:** Edit (mode toggle), Expand (half-screen), plus the always-on "⟲ One source of truth" pill.

### 4.2 Tabs (consistent across levels & views)

`Overview · Tasks · Roles · Applications · Deliverables · Checklist · Testing`

| Tab | L3 / L4 (rollup) | L5 (detail) |
|---|---|---|
| **Overview** | Totals for all six groups + top items | Description, status, quick summary |
| **Tasks** | Count + list of steps (drill down) | The step itself / sibling steps |
| **Roles** | Top roles with task counts | Named roles + Owner/Participant + RACI; **associate/add**, detach |
| **Applications** | Top apps with usage counts | Named apps + usage (performed/memorialized); **associate/add**, detach |
| **Deliverables** | Count + list | The deliverable(s) for the step; associate/open |
| **Checklist** | Aggregated count | Every checklist item; **add / edit / remove** |
| **Testing** | Count of templates | The testing template; **edit** System/Location/Check/Expected |

Rendering rules: tab badge = **live count**; empty tabs show an "Add the first…" CTA in edit mode; items render as cards/chips in the client's own terms (no IDs, no schema); junction attributes (Owner, performed, etc.) appear as inline badges; color encodes group (green=roles, blue=apps, etc.).

### 4.3 Rollups (L3 / L4)

Non-leaf nodes show **rolled-up** counts and top items aggregated across the subtree, computed live from the L5 detail so they're always correct. Editing any detail at L5 updates the L3/L4 counts automatically. See **`wf6-levels-l3-l4-l5`** and **`wf4-map-inspector-edit-rev`** (right panel).

---

## 5. Hyperlinks & navigation

Every entity reference is a deep link (`↗`) to its canonical screen, opened in context:

- Role → **Organization** ▸ Role · Application → **Applications** ▸ App · Deliverable → **Deliverables**
- Parent/child node & breadcrumb → re-target the inspector to that node (no full navigation)
- Testing template → opens in place for editing

Navigation never dead-ends: from a chip you can open the entity *or* (in edit mode) detach it.

---

## 6. Edit mode & CRUD (L5 detail) — see `wf2-inspector-edit-mode-rev`

Toggling **✎ Edit** enters an edit session. A persistent green banner reads *"Saved to the single source of truth — every change applies across all tabs & the whole app,"* with Save/Discard.

### 6.1 What's editable

- **Fields (inline):** step name, automatability, verification.
- **Roles:** **＋ Associate / add role** — a picker searches existing roles to associate **or** creates a new role inline; the row sets Owner/Participant + RACI; `↗` opens; `✕` detaches (keeps the role).
- **Applications:** **＋ Associate / add application** — associate existing or create new; set usage (performed/memorialized); detach.
- **Checklist items:** **＋ Add checklist item** (type → Enter), edit text in place, `✕` remove.
- **Testing template:** edit System / Location / Check (presence|absence) / Expected.
- **Deliverables / Tasks:** associate / add; the app auto-places tasks under the correct parent.

### 6.2 No manual node operations

There is **no** add-child / reparent / duplicate / delete-node block. When a user adds or moves an item, the application creates the correct associations and places it automatically. The Map edit toolbar is limited to add-step / rename / reorder / undo / auto-layout.

### 6.3 Save, undo, propagation

- **Optimistic** edits with an **Undo** toast that names where the change landed (e.g., *"Senior Accountant added — now applied in Org chart, Applications & 2 streams"*).
- **Single source of truth (hard requirement):** any association added/edited/created/moved (1) writes to one canonical record, (2) reflects in every other tab, (3) reflects everywhere the entity appears app-wide (Org chart, Applications, Deliverables, other streams, Map & List), (4) keeps L3/L4 rollups in sync, (5) is reversible and recorded in history. A "new" role/app/checklist item is the **same record** the rest of the app reads — never a duplicate.

---

## 7. Map specifics — see `wf4-map-inspector-edit-rev`

- **Selection vs. drill split:** single-click = select + inspect; double-click / hold = drill into children; click empty canvas = deselect.
- **Shared inspector** docks on the right exactly as in the List, including Edit. Same record, both views.
- **Lean edit toolbar:** add step, rename, reorder, undo, auto-layout. No manual reparent/connect/delete.
- **On-node controls:** ＋ adds a step inside; ⋯ opens a light menu (inspect / add / reorder). Inline-create ghost node: type to name, Enter to commit. The app wires associations.

---

## 8. States, accessibility, performance

- **States:** empty (friendly prompt + create CTA), loading (skeleton matching final layout), view-only (no Edit button when the user lacks rights).
- **Accessibility:** full keyboard path; always-visible focus ring; ESC closes pickers/panel; ⌘/Ctrl+Z undo; color never the only signal (icon + text on every badge); ARIA-labelled region; the Map always offers a list alternative.
- **Responsiveness:** resizable panel; full-screen drawer under ~1024px.
- **Performance:** rollups computed live (closure-based); tab contents lazy-loaded; optimistic writes.

---

## 9. Assumptions & open questions

Assumptions (flag if wrong):

1. A **permission layer** exists or will be added to gate the Edit button.
2. **Terminology** drives all labels (client business terms over internal names).
3. **Soft delete / history** is available to support Undo and audit.
4. The app can **infer placement & associations** reliably enough to remove manual node operations.

Open questions for product:

- Confirm the six-group tab set for this iteration (Compliance / Metrics·AI / Initiatives deferred from v1).
- Should associations be editable only at L5, or also directly on L3/L4 rollups?
- Do we need **per-node shareable URLs**?

---

## 10. Wireframe index (this folder)

| File | Shows |
|---|---|
| `wf2-inspector-edit-mode-rev` | **L5 detail, edit mode** — roles/apps/checklist/testing CRUD, no node ops, propagation |
| `wf4-map-inspector-edit-rev` | **Map** + shared inspector (L3 rollup), lean edit toolbar, source-of-truth pill |
| `wf6-levels-l3-l4-l5` | **Same sidebar at L3 (rollup all) / L4 (less) / L5 (full detail)** |

Each is provided as **SVG** (crisp at any zoom) and **PNG** (universally viewable). Numbered orange markers map to the legend panel on each wireframe.

---

## 11. Sources

- [Master-Detail pattern — Oracle Alta UI](https://www.oracle.com/webfolder/ux/middleware/alta/patterns/MasterDetail.html)
- [Enterprise UX best practices 2025 — devPulse](https://devpulse.com/insights/ux-ui-design-best-practices-2025-enterprise-applications/)
- [Inline edit design guidelines — PatternFly](https://www.patternfly.org/components/inline-edit/design-guidelines/)
- [Inline edit pattern — Cloudscape Design System](https://cloudscape.design/patterns/resource-management/edit/inline-edit/)
- [Designer's guide to user data and CRUD — Tanya Anokhina](https://medium.com/@tanya_anokhina/designers-guide-to-user-data-and-crud-4e53f7c5150d)
- [Progressive Disclosure — Interaction Design Foundation](https://www.interaction-design.org/literature/topics/progressive-disclosure)
- [Accordions on Desktop: When and How to Use — Nielsen Norman Group](https://www.nngroup.com/articles/accordions-on-desktop/)
- [Designing intuitive data experiences with graph visualizations — Cambridge Intelligence](https://cambridge-intelligence.com/blog/designing-intuitive-data-experiences-with-graph-visualizations/)
- [Building usable and accessible diagrams with React Flow — Synergy Codes](https://www.synergycodes.com/webbook/building-usable-and-accessible-diagrams-with-react-flow)
- [Drawer design guidelines — PatternFly](https://www.patternfly.org/components/drawer/design-guidelines/)
- [Types of "saving" options — Adam Shriki](https://medium.com/@adamshriki/the-different-types-of-saving-options-and-how-to-choose-the-right-one-22732d424714)
