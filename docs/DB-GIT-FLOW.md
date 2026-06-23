# Database git-flow (Neon + Vercel + GitHub)

Single source of truth for how git branches map to Neon database branches.

## Project

- **Neon project:** `CapgeminiTransformationBridge` (`billowing-salad-46113160`), region `aws-us-east-1`, PG 18.
- This replaced the old `Enterprise-AI-Transformation` (`rapid-grass-11109352`) project, whose
  branch tree had become an un-deletable linear chain of backup snapshots. The old project is kept
  as a cold safety net until cutover is confirmed, then can be deleted.

## Branch mapping

| Git branch        | Vercel environment        | Neon branch                         | Data                                    |
|-------------------|---------------------------|-------------------------------------|-----------------------------------------|
| `master`          | Production                | `production` (root, default)        | Live prod data (restored 2026-06-23)    |
| `develop`         | Preview (pinned)          | `develop` (forked from `production`)| Prod copy; integration target          |
| `feature/*` (PRs) | Preview (per-deployment)  | `preview/pr-<N>` (forked from `develop`) | Ephemeral; deleted on PR close     |

Neon branch IDs:
- `production` = `br-quiet-pine-aqwnciny` (endpoint `ep-nameless-lab-aqoee5pp`)
- `develop`    = `br-empty-moon-aq73j99z` (endpoint `ep-morning-bar-aqgw0f4r`)
- `vercel-dev` = `br-morning-math-aqc2ggrx` — auto-created by the Vercel integration; reconcile or
  point Vercel's develop deploy at the `develop` branch instead (see manual steps).

## Workflow ("merge upward")

1. Cut a feature branch from `develop`:  `git switch develop && git switch -c feature/x`
2. Open a PR into `develop`. The GitHub Action `.github/workflows/neon-preview-branches.yml`
   creates a Neon branch `preview/pr-<N>` **forked from `develop`** and comments it on the PR.
   Vercel builds a preview deploy against that branch.
3. Merge the PR → `develop`. The Action deletes the preview Neon branch.
4. Release: open a PR `develop` → `master`. Merging deploys to Vercel Production against the Neon
   `production` branch.

### Schema changes
Prisma migrations are the unit of promotion. Run `npx prisma migrate deploy` against each Neon
branch as the change moves up (preview → develop → production). The preview branch already carries
`develop`'s schema at fork time, so only *new* migrations in the PR need applying.

## Local development

`backend/.env` points `DATABASE_URL`/`DIRECT_URL` at the **`develop`** branch. Never develop
against `production`. Rollback URLs are kept commented in `.env`.

## Manual steps (dashboard OAuth — cannot be scripted)

1. **Neon API key:** Neon console → Account settings → API Keys → create one →
   add as GitHub repo secret `NEON_API_KEY` (`KevinHicksCLT/transform-platform`).
   `NEON_PROJECT_ID` is already set.
2. **Activate the Action:** the workflow only runs once it lands on `master`. Merge it up.
3. **Neon ↔ Vercel integration:** in Vercel, map
   - Production env → Neon `production` branch
   - the `develop` git branch's deploy → Neon `develop` branch
   - Preview deploys → let the integration / Action use the per-PR branch.
4. **Chatbot RO:** `DATABASE_URL_RO` still points at the old prod (`ep-rough-bar`). To move it,
   recreate the `chatbot_ro` grants on the new `production` branch (`scripts/chatbot-ro-setup.sql`)
   and update the env var.
