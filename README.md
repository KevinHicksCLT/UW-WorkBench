# Transformation Bridge

An operating-model insights platform. It holds one governed, connected model of a
company's operating model — the **process spine** (domains → value streams → areas →
sub-processes → atomic tasks), the **org spine** (divisions → departments → roles), and
everything wired to them (deliverables, applications, standards, regulations,
checklists, testing plans) — plus a parallel **portfolio (SPM) domain** (programs →
workstreams → initiatives with benefits, costs, RAID). Every screen is derived live
from that single source of truth: change a fact once and every list, map, dashboard,
and drill-down that references it updates. The deployed demo models an insurance
enterprise seeded from a curated workbook.

## Stack & architecture

npm-workspaces monorepo, TypeScript + ESM throughout.

```
 Browser (SPA)
   │  fetch("/api/roles")                        frontend/  (cascade-frontend)
   ▼                                             Vite · React 18 · Tailwind · React Router
 /api proxy — strips the /api prefix
   │  dev:  Vite proxy  (vite.config.ts)  → :4000
   │  prod: Vercel experimentalServices (routePrefix "/api")
   ▼
 Express (routers mounted at ROOT: /roles, /work…)   backend/  (cascade-backend)
   │  requireAuth (JWT → req.tenantId) · zod · pino  Express · Prisma · tsx
   ▼
 Prisma ──► Neon Postgres (branch per environment: production / develop / feature)

 shared/  (@cascade/shared) — zod schemas + types imported by both sides
```

The subtlety worth internalizing: the frontend api client prefixes every call with
`/api`, and that prefix is **stripped before it reaches Express** in both environments.
So `api.get('/roles')` → `GET /api/roles` in the browser → arrives at Express as
`GET /roles`. Routers are therefore mounted at the root in `backend/src/app.ts`, never
under `/api`.

The data model is a **generic typed graph** ("erd_v5"): two self-nesting spines
(`ProcessNode` L1–L5 with a closure table; `OrgUnit` with a closure table), a small set
of entities (`Role`, `Deliverable`, `Application`, `Standard`,
`RegulatoryRequirement`, …), and junction tables wiring entities to nodes or roles. No
free-text cross-references — every association is a foreign key, and location strings
are derived at read time by the resolvers in `backend/src/lib/resolvers/`. Canonical
schema diagram: `documents/value-streams/Master Documentation/erd_v5.mmd` (kept in
lockstep with `backend/prisma/schema.prisma`).

## Quickstart

Prerequisites: Node ≥ 20, npm, and connection strings for a Neon Postgres branch
(there is no local database — dev runs against a live Neon branch).

```bash
git clone <repo> && cd transform-platform
npm install                      # installs all workspaces, husky hooks, prisma client

cp backend/.env.example backend/.env
# Fill in: DATABASE_URL (Neon POOLED host), DIRECT_URL (Neon direct host), JWT_SECRET.
# Optional: PLATFORM_NAME / SEED_* overrides for white-label onboarding, and the
# AI-assistant block (ANTHROPIC_API_KEY, DATABASE_URL_RO).

# Fresh/empty database only — builds schema from migrations and seeds demo data:
npm run db:setup -w cascade-backend        # prisma generate → migrate deploy → seed
# (Neon branches forked from develop already carry schema + data — skip this.)

# Two terminals:
npm run dev:backend              # Express on http://localhost:4000
npm run dev:frontend             # Vite on http://localhost:5173 (proxies /api → :4000)
```

Open http://localhost:5173 and log in as the seeded admin:
**`kevin.hicks@capgemini.com` / `demo1234`**.

For your first change, follow [CONTRIBUTING.md](CONTRIBUTING.md): cut
`feature/<name>` from `develop` (plus a same-named Neon branch if you touch schema or
data — `node scripts/neon-branch-create.mjs <name>`), commit through the pre-commit
hooks, open a PR, and let CI + review gate the merge.

## Scripts

All run from the repo root. `-w <package>` targets a workspace by **package name**
(`cascade-backend`, `cascade-frontend`, `@cascade/shared`), not directory name.

| Command                                 | What it does                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev:backend`                   | `tsx watch` the Express API on :4000                                                             |
| `npm run dev:frontend`                  | Vite dev server on :5173                                                                         |
| `npm run build`                         | prisma generate (backend) + vite build (frontend) — what Vercel runs                             |
| `npm run lint` / `lint:fix`             | ESLint (flat config), **zero warnings tolerated**                                                |
| `npm run format` / `format:check`       | Prettier                                                                                         |
| `npm run typecheck`                     | `tsc --noEmit` for backend + frontend                                                            |
| `npm test` / `npm run test:coverage`    | Vitest unit tests (backend + frontend), with coverage thresholds                                 |
| `npm run e2e`                           | Playwright smoke suite (see [e2e/README.md](e2e/README.md) — needs both dev servers + seeded DB) |
| `npm run db:setup -w cascade-backend`   | One-command DB setup: generate → `migrate deploy` → seed                                         |
| `npm run db:migrate -w cascade-backend` | Create/apply a schema migration (`prisma migrate dev`)                                           |
| `npm run db:seed -w cascade-backend`    | Re-run the seed only                                                                             |
| `npm run db:studio -w cascade-backend`  | Prisma Studio against the active branch                                                          |

> `prisma db push` is **deprecated in this repo** — it silently drops drifted columns.
> Schema changes go through version-controlled migrations only (see
> [ADR-001](documents/adr/ADR-001-prisma.md)).

## Quality gates

| Gate                                  | Where it runs                     | What it enforces                                                                                                                 |
| ------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Pre-commit (husky)                    | every commit                      | lint-staged (Prettier + ESLint `--max-warnings 0` on staged files), then a full-repo typecheck                                   |
| Pipeline (`.github/workflows/ci.yml`) | every push (one run, staged jobs) | feature branches: `quality → deploy-preview`; develop/master: `quality → data-promote → migrate → deploy → smoke → neon-cleanup` |
| Branch protection                     | GitHub                            | PR + review + green CI required to merge into `develop` / `master`                                                               |

Do not bypass hooks (`--no-verify`); if a gate fails, fix the cause.

## Testing

- **Unit (Vitest).** Backend: node environment, coverage measured over the pure logic
  layers (`src/lib/**`, `src/middleware/**`). Frontend: jsdom + Testing Library,
  coverage over `src/lib/**` and the `components/ui/` library. Thresholds: 80% lines /
  functions / statements, 70% branches (enforced by `npm run test:coverage`).
- **E2E (Playwright).** `npm run e2e` logs in as the seeded admin and walks every
  top-level route, failing on console errors, failed API calls, or blank screens. It
  doubles as the behavioral-baseline harness for the refactor
  ([documents/refactor-baseline/BASELINE.md](documents/refactor-baseline/BASELINE.md)).
- Route handlers are intentionally exercised by the E2E suite + API baseline diff
  rather than unit tests — keep new logic in `lib`/resolvers where it is unit-testable.

## Deployment

One Vercel project serves both workspaces via `vercel.json` `experimentalServices`:
the frontend at `/` and the Express backend at `/api` (prefix stripped before Express).
Vercel's direct git builds are disabled (`git.deploymentEnabled: false`) — **every
deployment comes from the Pipeline workflow, after its gates**.

Promotion flow (git flow mirrored by Neon DB branches):

1. `feature/<name>` (git + same-name Neon branch via
   `node scripts/neon-branch-create.mjs <name>`) → PR → **`develop`**. On merge, the
   pipeline migrates the Neon `develop` branch, deploys, smoke-checks
   (`scripts/deploy-smoke.mjs`), and deletes the feature's Neon branch
   (`scripts/neon-branch-cleanup.mjs`).
2. `develop` → PR → **`master`**. Same flow against the Neon `production` branch and
   the production URL.

**Schema promotes automatically on every merge** (committed migrations replayed by the
`migrate` stage). **Datasets promote only when you say so** — put the literal marker
`[promote-data]` in the merge commit message (edit the commit title in GitHub's merge
dialog, or from the CLI):

```bash
# feature → develop, promoting the feature's Neon dataset over develop's:
gh pr merge <PR#> --merge --subject "Merge feature/<name> [promote-data]"

# develop → master, promoting develop's dataset over production's:
gh pr merge <PR#> --merge --subject "Promote develop to production [promote-data]"
```

The `data-promote` stage then Neon-restores the target branch from the source
(`scripts/neon-data-promote.mjs`), preserving the target's prior state as
`backup/<target>-<sha>`. Without the marker the stage is a green no-op — ordinary
merges never touch data.

Rollback: redeploy the previous commit from Vercel; a mispromoted dataset is restored
from its automatic `backup/*` branch; a misbehaving migration via Neon point-in-time
restore (see [documents/refactor/CUTOVER.md](documents/refactor/CUTOVER.md)).

## Repository map

| Path                 | What lives there                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `frontend/`          | React SPA — [frontend/README.md](frontend/README.md)                                                    |
| `backend/`           | Express API + Prisma schema/migrations/seed — [backend/README.md](backend/README.md)                    |
| `shared/`            | Zod schemas + types shared across the API boundary — [shared/README.md](shared/README.md)               |
| `e2e/`               | Playwright smoke suite — [e2e/README.md](e2e/README.md)                                                 |
| `backend/scripts/`   | One-off operational/data scripts (lint-exempt) — [backend/scripts/README.md](backend/scripts/README.md) |
| `scripts/`           | Pipeline + verification helpers — [scripts/README.md](scripts/README.md)                                |
| `api/`               | Vercel serverless entrypoint shim for the backend service                                               |
| `.github/workflows/` | CI, Promote, Neon PR-preview branches                                                                   |
| `documents/`         | Source workbooks, schema diagram (`erd_v5.mmd`), ADRs, refactor charter & baseline                      |
| `docs/`              | Operational runbooks (DB git-flow)                                                                      |

## Further reading

- [CONTRIBUTING.md](CONTRIBUTING.md) — branching, commit conventions, code standards.
- [CLAUDE.md](CLAUDE.md) — condensed architecture/conventions reference (AI-assistant oriented, but accurate for humans too).
- [documents/adr/ADR-001-prisma.md](documents/adr/ADR-001-prisma.md) — why Prisma stays, and the migrations-only workflow.
- [documents/refactor/CHARTER.md](documents/refactor/CHARTER.md) — the 22-task refactor charter this codebase was hardened against.
- [documents/refactor/CUTOVER.md](documents/refactor/CUTOVER.md) — cutover runbook + rollback path.
- [documents/refactor-baseline/BASELINE.md](documents/refactor-baseline/BASELINE.md) — the behavioral baseline every change is verified against.
