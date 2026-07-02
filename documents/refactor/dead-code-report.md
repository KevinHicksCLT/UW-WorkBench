# Dead Code & Dead Data Report (Charter Tasks 9 & 16)

Swept 2026-07-02 on the `refactor` branch with `knip` (config: `knip.json`, scoped to
app source — ops scripts/content dirs excluded, same rationale as the lint gate).

## Removed

| Item | Evidence | Commit |
| --- | --- | --- |
| `backend/src/routes/levels.ts` | not imported by the app.ts chain | backend refactor |
| `frontend/src/viz/FlowCanvas.tsx` + `viz/layout.ts` | zero imports (knip + grep) | dead-code sweep |
| `.ctx-sidebar*` CSS block (index.css) | zero class usages | dead-code sweep |
| `.metric-tile` CSS class (index.css) | zero class usages | dead-code sweep |
| `date-fns` (backend dependency) | zero imports in src AND scripts | dead-code sweep |
| `playwright` (frontend devDependency) | zero imports; e2e uses root `@playwright/test` | dead-code sweep |
| 5 stray root-level verification PNGs + 3 superseded Sidebar-Rework-v2 PNGs | orphaned artifacts | screenshot sweep |
| `documents/refactor-baseline/screens-before/` | pruned after final verification (regenerable via `npm run e2e`) | final commit |

## Kept deliberately (checked, not dead)

| Item | Why it stays |
| --- | --- |
| `pino-pretty` (backend devDep) | referenced at runtime by transport string `'pino-pretty'` in `lib/logger.ts` (dev only) — invisible to knip |
| `yaml` (backend devDep) | used by `backend/scripts/extract-regulations-baseline.ts` (ops script, outside knip scope) |
| `backend/scripts/**` (134 files) | replayable operational/data-migration history — documented in `backend/scripts/README.md` |
| knip "unused exports/types" (~90) | mostly library barrels' public API (`components/ui/index.ts` prop types, `lib/resolvers/index.ts` types) and split-module constants; type-level, tree-shaken at build, kept as intentional API surface |
| `.piece-*` CSS classes | flagged by an earlier audit but actually used (OrgMapCanvas, MapNode) |

## Database: dead tables & data (Task 16)

Full audit of all **94 models** in `schema.prisma` against code references (routes,
resolvers, seeds, scripts): **zero dead tables**. Every model is either actively read
by routes/resolvers or seed-populated and surfaced through a screen. No drops needed;
no data removed. (Details: every FK column carries an explicit index; `erd_v5.mmd`
verified in sync with the schema.) Screenshots/blobs: the schema stores **no** image
data — the only binary-ish field is a file-size integer.
