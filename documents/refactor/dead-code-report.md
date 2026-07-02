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

Audit of all **94 models** in `schema.prisma` against code references (routes,
resolvers, seeds, scripts), followed by a row-level pass on the suspects:

**Dropped** (migration `20260702130000_drop_dead_role_tab_leftovers`, applied to the
refactor Neon branch; reaches develop/production via `migrate deploy` at cutover):

| Item | Evidence |
| --- | --- |
| `RoleDottedLine` table | zero code references outside schema; **0 rows** — leftover of the scrapped FB-45/50-53 Role tab |
| `UserPreference` table | zero code references outside schema; **0 rows** |
| `Role.jobDescription` column | zero code references outside schema; **0 populated values** (FB-53 leftover) |

All three were empty, so the drop is data-loss-free by construction; `erd_v5.mmd`
updated in the same commit.

**Kept after row-level review:**

| Item | Why |
| --- | --- |
| `Initiative` / `NodeInitiative`, `KnowledgeBase`, `IntegrationSource` | no bespoke screens, but listed + editable in Data Admin's generic CRUD (surfaced UI) — retire deliberately with a product decision, not in a behavior-frozen refactor |
| `Scenario`, `AnalysisStatus` | read by dashboard counts / AI-analysis routes |
| Regulations feed tables (`RegulatorySource`, `RegulatoryBulletin`, `ComplianceRule`, `IntegrationSystem`, `JurisdictionIntegration`) | read by `/regulations` feeds + lenses |
| `Checklist`/`ChecklistItem`/`TestingTemplate` | still read by roles/work routes; Work-Library retirement of the legacy grain is a separate planned change |

Screenshots/blobs: the schema stores **no** image data — the only binary-ish field is
a file-size integer.
