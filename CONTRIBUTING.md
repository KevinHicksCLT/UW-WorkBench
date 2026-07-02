# Contributing

## Branching strategy

```
feature/<name>  →  develop  →  master
```

- **`master`** — production. Deploys the production Vercel environment against the Neon
  `production` DB branch. Only receives merges from `develop`.
- **`develop`** — integration. Deploys the develop Vercel preview against the Neon
  `develop` DB branch. Only receives merges from feature branches via pull request.
- **`feature/<name>`** — all work happens here. Cut from `develop`. If your work needs
  schema or data changes, also cut a **Neon DB branch of the same name** from the Neon
  `develop` branch and point `backend/.env` at it — one command:
  `node scripts/neon-branch-create.mjs <name>` (always forks from `develop`).

### How database changes flow (no manual "DB merges")

Neon branches are point-in-time **copies**, not git-style merges. What promotes between
environments is the **schema, via committed migrations** — data never moves upward:

1. Feature work: schema edits land as a migration (`npm run db:migrate -w
cascade-backend`), applied to your feature DB branch as you develop.
2. Merge feature → `develop`: the `Promote` workflow runs `prisma migrate deploy`
   against the Neon `develop` branch, smoke-checks the deployment, then **deletes the
   feature's Neon branch automatically** (same-name convention).
3. Merge `develop` → `master`: same flow against the Neon `production` branch.

⚠ If the Neon **Vercel integration** ("preview branching") is enabled, it auto-creates
a DB branch per preview deployment and defaults the parent to the project's default
branch (**production**). Set it to fork from **`develop`** instead: Vercel →
Integrations → Neon → Configure → _Parent branch for preview branches_ → `develop`.
Otherwise previews see production data and drift from the develop schema.

### Deployment gating

Vercel does **not** build feature branches on push (`scripts/vercel-ignore-build.sh`
skips everything except `develop`/`master`). Feature previews deploy from CI's
`deploy-preview` job **after** the quality gates pass (activate with repo secrets
`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` + variable `VERCEL_CI_DEPLOY=true`).
`develop`/`master` build on Vercel directly; their protection is the PR gate.

### Rules

1. Never commit directly to `develop` or `master` — protect both branches in GitHub
   (Settings → Branches → require PR + a passing `quality` check).
   ⚠ **Currently unenforceable**: this repo is private on a GitHub Free plan, and
   GitHub only allows branch protection/rulesets on private repos with Pro/Team.
   Until the plan is upgraded (or the repo is made public / moved to a Team org),
   the no-direct-push rule is convention — the pre-commit hooks and CI still run,
   but nothing blocks a direct push. Enable protection the moment the plan allows:
   required status check `quality`, 1 approving review, no force pushes.
2. Every PR requires **at least one review** and a **green CI run** before merge.
3. Keep PRs scoped: one feature/fix per branch.
4. After merge, delete the git feature branch and its Neon DB branch.

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): …`,
`fix(scope): …`, `docs: …`, `refactor(scope): …`, `chore: …`, `test: …`.

## Quality gates (enforced, not optional)

| Gate                 | Command                 | Runs                                               |
| -------------------- | ----------------------- | -------------------------------------------------- |
| Lint (zero warnings) | `npm run lint`          | pre-commit + CI                                    |
| Format               | `npm run format:check`  | pre-commit (auto-fixes staged files) + CI via lint |
| Typecheck            | `npm run typecheck`     | pre-commit + CI                                    |
| Unit tests           | `npm test`              | CI (run locally before pushing)                    |
| Coverage threshold   | `npm run test:coverage` | CI                                                 |
| Build                | `npm run build`         | CI + Vercel                                        |

Pre-commit hooks are installed automatically by `npm install` (husky). **Do not bypass
hooks** (`--no-verify`) — if a gate fails, fix the cause.

## Code standards

- TypeScript strict mode everywhere; **no `any`**, no `@ts-ignore`/`@ts-expect-error`.
- Relative imports use the `.js` extension (ESM/tsx resolver requirement):
  `import { prisma } from '../db/prisma.js'`.
- No file over ~500 lines — extract hooks/helpers/services.
- Frontend list views use `components/Sheet.tsx`; dialogs use `lib/dialogs`; shared UI
  comes from `frontend/src/components/ui/` — never re-implement a library component.
- Backend: routes stay thin (validate → service → respond); derivations live in
  `backend/src/lib/resolvers/`; every query is tenant-scoped; 404 (not 403) on
  cross-tenant access.
- Schema changes: update `backend/prisma/schema.prisma` **and**
  `documents/value-streams/Master Documentation/erd_v5.mmd`, and add a migration
  (`npm run db:migrate -w cascade-backend`). Never `db push` against shared branches.

## Local setup

See the top-level [README](README.md) — clone → `npm install` → configure
`backend/.env` → `npm run dev:backend` + `npm run dev:frontend`.
