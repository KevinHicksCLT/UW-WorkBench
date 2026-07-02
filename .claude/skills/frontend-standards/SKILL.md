---
name: frontend-standards
description: Frontend coding standards for this repo — compose from the components/ui library (never re-implement shared components), Sheet.tsx for all flat lists, useDialogs for modals, React.lazy pages, no files over 500 lines. Use whenever creating or modifying anything under frontend/src (components, pages, styling, routing).
---

# Frontend standards (established by the 2026-07 refactor)

Violating any of these is a review-blocking defect.

## 1. Compose from the component library — never re-implement

`frontend/src/components/ui/` holds the ONE canonical implementation of every shared
component: `Button`/`LinkButton`, `Card`, `Input`/`Select`/`Textarea`/`Label`,
`StatusPill`, `Chip`, `SkeletonLoader`, `EmptyState`/`LoadingState`/`ErrorMessage`,
`DrawerShell`. Import from `../components/ui` (barrel).

- Never hand-write `className="btn-primary…"` / `"card…"` / `"input"` / `"pill-*"` /
  `"chip*"` / skeleton loops / "Loading…"/"No rows" divs — use the component.
- The components emit `base-class + verbatim className merge`. Do not break that
  contract; unit tests in `frontend/tests/components/ui/` freeze the exact class
  strings — if a change is intentional, update tests AND verify visually.
- New shared pattern used on 2+ pages? Add it to `ui/` (with TSDoc + a class-contract
  test), then adopt it everywhere — no page-local copies.
- Known non-migrated exceptions (leave as-is): lookup-map class sites
  (`STATUS_PILL_CLASS[x]`-style), pills/buttons rendered as `<Link>`, `.tag-*` classes.

## 2. Canonical composites

- **Flat list/spreadsheet tab → `components/Sheet.tsx`.** No hand-rolled filter bars or
  tables.
- **Node drill-down → `components/Inspector.tsx`** (fed by `/inspector/:nodeId`).
- **Modals/confirm/prompt → `lib/dialogs` (`useDialogs`)** — never
  `window.confirm/alert/prompt`.
- Right-side drawers use `ui/DrawerShell`.

## 3. Structure

- **No file over 500 lines.** Split into a feature folder next to the original
  (`viz/map/`, `pages/portfolio-initiative/` are the pattern) — cohesive extraction,
  TSDoc header per module.
- Pages are route-level code-split: every page in `App.tsx` is `React.lazy` behind the
  single `Suspense` boundary; `Layout` and `Login` stay eager. New pages must be lazy.
- Reusable logic → hooks/helpers in `lib/` or the feature folder, typed, TSDoc'd.

## 4. Type safety & lint

- TS strict; **no `any`**, no `@ts-ignore`/`@ts-expect-error`.
- `npm run lint` (zero warnings) + `npm run typecheck` must pass — pre-commit runs
  them; don't bypass hooks.

## 5. Tests

Tests live in `frontend/tests/**` mirroring `frontend/src/**` (never colocated).
Changes to `lib/` or `ui/` require updating/adding the mirrored suite and keeping
coverage thresholds green (`npm run test:coverage -w cascade-frontend`).
