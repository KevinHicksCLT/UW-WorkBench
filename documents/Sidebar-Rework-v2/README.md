# Value Streams — Sidebar Rework (v2)

Consolidated deliverables for the reworked Value Streams inspector. Same sidebar for **List + Map**, at **all levels** (L3 rollup → L4 → L5 detail), client-first language, full L5 CRUD, and **single source of truth** propagation.

## Contents

**Details**
- `Value-Streams-Inspector-UX-Spec.md` — UX research, principles, target-state design, level behavior, edit/CRUD, and propagation rules.
- `Value-Streams-Inspector-User-Stories.md` — developer backlog (Epics I/J/K/L/M) with acceptance criteria, priorities, estimates, and delivery order.

**Screenshots / wireframes** (each as SVG + PNG)
- `wf2-inspector-edit-mode-rev` — L5 detail, **edit mode**: associate/add roles & apps, add/edit checklist items, edit testing template; no node operations; propagation + Undo.
- `wf4-map-inspector-edit-rev` — **Map** with the shared inspector (L3 rollup), lean edit toolbar, "one source of truth" pill.
- `wf6-levels-l3-l4-l5` — the **same sidebar** at L3 (rollup, all), L4 (rollup, less), and L5 (full detail).

## Key decisions

- One inspector component, identical at every level and in both views; only content density changes.
- No database/schema/table names in the UI — the client's own business terms only.
- No manual node operations; the app auto-places and wires associations.
- Any association added/edited/created/moved writes one canonical record and reflects everywhere (all tabs, List & Map, the whole app, and L3/L4 rollups) — never a duplicate.
