---
name: session-flow
description: The mandatory git + Neon branch protocol for every Claude session — start from a synced develop, cut a feature branch with a Neon DB branch of the same name, and commit + push every code change (migrations included) to a draft PR into develop before replying. Use at the start of every session, before the first file edit, and before any reply that changed code or schema.
---

# Session flow

Follow this in every session, local or cloud. It is not optional, and it is not "at the end of the
feature" — steps 1–3 happen before the first edit, step 4 before every reply that changed code.

Neon project `billowing-salad-46113160`, org `org-misty-bar-64403461`. Locally `neonctl` is
authenticated by OAuth — use `npx -y neonctl@2 …`. There is **no `NEON_API_KEY` on the machine**, so
`scripts/neon-*.mjs` are the _pipeline's_ tools; do not try to run them from a session.

## 1. Start from a synced `develop`

```bash
git switch develop && git pull --ff-only origin develop
```

Working tree dirty? **Surface it to the user — never discard their work.** `git switch -c` in step 3
carries the changes onto the new branch, which is usually what they want.

## 2. Confirm `develop` is in sync with `master`'s database

Read-only comparison of the two Neon branches. `prisma migrate diff` issues catalog queries only —
no DDL, no DML, no locks, no long transactions — so it **cannot block or deadlock either database**.

```bash
PROD=$(npx -y neonctl@2 connection-string production --project-id billowing-salad-46113160 --org-id org-misty-bar-64403461 --database-name neondb --role-name neondb_owner)
DEV=$(npx  -y neonctl@2 connection-string develop    --project-id billowing-salad-46113160 --org-id org-misty-bar-64403461 --database-name neondb --role-name neondb_owner)

cd backend
npx prisma migrate diff --from-url "$PROD" --to-url "$DEV" --script --exit-code   # develop's extras
npx prisma migrate diff --from-url "$DEV" --to-url "$PROD" --script --exit-code   # production's extras
```

Exit `0` = identical, `2` = drift.

- **Neither has output → in sync.** Proceed.
- **Only the first → develop is ahead.** Normal: migrations awaiting the next develop → master release.
- **The second has output → production is ahead. STOP and tell the user.** A change reached `master`
  without flowing down to `develop`. Never auto-repair it: the fix is a `master → develop` git merge
  letting migrations flow, never a hand-copied database.

Report the verdict in your reply. No Neon credentials (cloud session)? Say the check could not run —
never imply it passed.

## 3. Cut the feature branch — git AND database, same name

Both, before the first file edit:

```bash
git switch -c feature/<slug>

npx -y neonctl@2 branches create --name feature/<slug> --parent develop \
  --project-id billowing-salad-46113160 --org-id org-misty-bar-64403461
```

The fork inherits develop's schema, data, and migration ledger — no migrate or seed needed. Never
create a branch from `production`, and if one of that name already exists, **reuse it** — never recreate.

Then point `backend/.env` at it — `DATABASE_URL` = pooled, `DIRECT_URL` = direct. Comment out the old
values (keep them for rollback) and leave `DATABASE_URL_RO` alone:

```bash
npx -y neonctl@2 connection-string feature/<slug> --project-id billowing-salad-46113160 \
  --org-id org-misty-bar-64403461 --database-name neondb --role-name neondb_owner --pooled   # → DATABASE_URL
npx -y neonctl@2 connection-string feature/<slug> --project-id billowing-salad-46113160 \
  --org-id org-misty-bar-64403461 --database-name neondb --role-name neondb_owner            # → DIRECT_URL
```

Restart `npm run dev:backend` to pick up the new connection.

**Cloud sessions** have no Neon credentials: the git branch (`claude/<slug>`) is made for you, and CI's
`deploy-preview` job creates the same-name Neon branch on your first push. That satisfies the rule —
just say so.

## 4. Ship every code change before you reply

Every turn that changed code, not just the last one:

```bash
git add -A && git commit -m "feat(scope): …"                  # Conventional Commits
git push -u origin HEAD                                       # -u on the first push only
gh pr create --draft --base develop --title "…" --body "…"    # first push only; later pushes update it
```

**DB changes ship in the same commit as the code that needs them:** the generated migration under
`backend/prisma/migrations/`, the `schema.prisma` edit, and the `erd_v5.mmd` update all go together.
Schema changes happen only through `npm run db:migrate -w cascade-backend` — **never** `prisma db push`.

The PR is a **draft**; mark it ready (`gh pr edit <n> --ready`) when the user says the work is done. It
must target `develop` — a feature PR aimed at `master` is wrong (`gh pr edit <n> --base develop`).

Husky pre-commit runs lint-staged + typecheck. **Never** `--no-verify` — fix the failure instead.

## Hard nevers

- **Never** edit, commit, or push on `develop` / `master`.
- **Never** `prisma db push` — migrations only.
- **Never** sync databases with a Neon branch **restore**: it re-parents the target under the source and
  welds the tree into an undeletable chain (this project has been bitten by exactly that). Dataset
  promotion is a logical `pg_dump` copy owned by the pipeline (`scripts/neon-data-promote.mjs`, triggered
  by ending a merge title with `[promote-data]`) — never a session's job.
- **Never** delete or overwrite a Neon environment branch (`production`, `develop`).

Related: `db-migrations-workflow` (schema changes), `compliance-check` (the gates a PR must pass),
`CONTRIBUTING.md` (the human-facing version of this policy).
