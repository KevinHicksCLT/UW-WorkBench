# cascade-frontend

React 18 SPA for the Transformation Bridge platform. Vite, TypeScript, Tailwind,
React Router. Serves on **:5173** in dev; deployed by Vercel as the `/` service.

## Run

```bash
npm run dev:frontend        # from the repo root — Vite dev server
npm run test -w cascade-frontend            # Vitest (jsdom + Testing Library)
npm run build -w cascade-frontend           # production build
```

All API traffic goes through the `/api` prefix, which is **stripped before it reaches
Express**: the Vite dev proxy (`vite.config.ts`) rewrites `/api/*` →
`http://localhost:4000/*`, and in production Vercel's `routePrefix: "/api"` does the
same. So `api.get('/roles')` → browser `GET /api/roles` → Express `GET /roles`. Set
`BACKEND_PROXY` to point the dev proxy at an alternate backend port.

## Layout

```
src/
  main.tsx / App.tsx     bootstrap + route table (React Router)
  pages/                 one component per routed screen (Overview, Roles, Work, …)
  components/            shared composite components
    ui/                  the internal component library (see below)
    Sheet.tsx            THE canonical flat-list view (combobox filters + grid)
    Inspector.tsx        the unified value-stream sidebar (tabbed node drill-down)
    Layout.tsx, PageHeader.tsx, drawers, org chart, …
    admin/  home/        feature-scoped component groups
  lib/                   hooks + client logic
    api.ts               fetch wrapper — adds /api, attaches the JWT from
                         localStorage, redirects to /login on 401
    useApi.ts            typed GET hook (loading / error / refetch)
    dialogs.tsx          useDialogs() — in-app confirm/alert/prompt modals
    auth.tsx, company.tsx, format.ts, …
  viz/                   map/flow visualization pieces (@xyflow/react + dagre)
  test/setup.ts          Vitest setup (jest-dom)
```

## Conventions

- **Compose from `components/ui/` — never re-implement a library component.** The
  barrel (`components/ui/index.ts`) exports: `Button`/`LinkButton`, `Card`,
  `Input`/`Select`/`Textarea`/`Label` (Field), `StatusPill`, `Chip`, `SkeletonLoader`,
  `EmptyState`, `LoadingState`, `ErrorMessage`, `DrawerShell`. If a page needs a
  button/input/pill/empty-state/etc., it imports it from `./components/ui`.
- **All flat list/spreadsheet views use `components/Sheet.tsx`** — no hand-rolled
  filter bars or tables.
- **`components/Inspector.tsx` is the unified node sidebar** (shared by the List and
  Map views): a tabbed drill-down (Overview / Roles / Applications / Deliverables /
  Tasks / Checklist / Testing / Governance) over a single `ProcessNode`, fed by
  `/inspector/:nodeId`. Node associations surface here — don't build parallel panels.
- **Dialogs go through `lib/dialogs` (`useDialogs`)** — never
  `window.confirm/alert/prompt`.
- **Data fetching** goes through `lib/api.ts` / `lib/useApi.ts` (typed against
  `@cascade/shared` where a contract exists) — no raw `fetch` in pages.
- TypeScript strict; no `any`; keep files under ~500 lines (extract hooks/helpers).

## How to extend

**Add a page.** Create `src/pages/<Name>.tsx`, register its route in `App.tsx`, and
(if it belongs in the nav) add it to `Layout.tsx`. Fetch with `useApi`, render lists
with `Sheet`, compose chrome from `components/ui`.

**Add a ui component.** Only when a pattern repeats across pages and nothing in the
barrel covers it: create `components/ui/<Name>.tsx` with TSDoc on the props, export
component + prop types from `components/ui/index.ts`, and add a unit test — the
coverage gate measures `components/ui/**` and `lib/**` (80% lines/functions/statements,
70% branches).

**Add client logic.** Shared hooks/formatters live in `src/lib/` where they are
unit-testable; page files stay presentational composition.
