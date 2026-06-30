# Autonomous SDLC Platform — Design

**Status:** Design only (no code committed).
**Author:** generated 2026-06-18.
**Goal:** a human request in Microsoft Teams flows autonomously through story
creation → Kanban board → domain-specific coding agents → GitHub PR → Teams
review → merge → Neon DB branch promotion → board card moved to Done.

---

## 1. Confirmed decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Board / "Jira" | **GitHub Projects** (free) | Native to GitHub Issues — no sync layer. Jira Cloud free tier is a drop-in if Jira is mandated later (see §8). |
| Coding agents | **Claude Code GitHub Action** on a **Max** OAuth token | Runs on the Claude Max plan — no per-call API billing. |
| DB merge | **Neon branch promotion** | Already the team's database; branch-per-git-branch is the existing pattern. |
| Hosting | **Free tier everywhere** | GitHub Actions + GitHub Projects + Neon free tier + Teams webhooks + one free serverless relay. |

---

## 2. Core architectural insight

> Put **all** Claude intelligence inside **GitHub Actions**, authenticated with a
> single Max OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`). Every other piece is a free
> managed service wired together by webhooks. The Teams endpoint holds **no AI** —
> it is a dumb HTTP relay that forwards text into GitHub via `repository_dispatch`.

This collapses the whole platform to: **one relay + a handful of GitHub Actions +
GitHub Projects + Neon.** Nothing custom to host, nothing to pay for, and the
expensive/credentialed part (Claude) lives in exactly one place.

---

## 3. End-to-end flow

```
User (Teams chat)
  │  @mention message: "Add CSV export to the reports page"
  ▼
[Teams Outgoing Webhook]  ──►  [Relay: Cloudflare Worker (free)]
                                   │ no AI — verifies HMAC, forwards text + author
                                   ▼
                          GitHub  repository_dispatch  (event_type: new-story)
                                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Action A — Story Agent  (Claude Code Action, Max token)        │
  │  • turns free-text into a structured story                     │
  │  • creates a GitHub Issue (title, description, acceptance       │
  │    criteria, domain label e.g. `domain:backend`)               │
  │  • adds the Issue to the GitHub Project (Backlog column)        │
  └──────────────────────────────────────────────────────────────┘
                                   ▼
                 GitHub Project board (free Kanban)
        Backlog → Ready → In Progress → In Review → Done
                                   │  human (or rule) adds label `ready`
                                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Action B — Domain Agent  (Claude Code Action, Max token)       │
  │  triggered by: issue labeled `ready` + `domain:*`              │
  │  • picks the story autonomously (no human assignment)          │
  │  • creates a feature branch                                    │
  │  • implements the change                                       │
  │  • opens a PR with `Closes #<issue>`                           │
  │  • moves the card → In Review                                  │
  └──────────────────────────────────────────────────────────────┘
                                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Action C — Neon Preview  (on pull_request: opened)             │
  │  • create ephemeral Neon branch `preview/pr-<n>`               │
  │  • run `prisma migrate deploy` against it → migrations tested  │
  └──────────────────────────────────────────────────────────────┘
                                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Action D — Notify Teams  (on pull_request: opened)            │
  │  • POST Adaptive Card to Teams Incoming Webhook (free)         │
  │    "Review needed" + PR link                                  │
  └──────────────────────────────────────────────────────────────┘
                                   ▼
              Human reviews + merges the PR in GitHub
                                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Action E — Promote + Close  (on merge to develop/main)         │
  │  • map git branch → Neon branch (develop→staging, main→prod)   │
  │  • run `prisma migrate deploy` against the target Neon branch  │
  │  • delete the PR's ephemeral Neon branch                       │
  │  • merge auto-closes the Issue (`Closes #N`) → card → Done     │
  └──────────────────────────────────────────────────────────────┘
```

---

## 4. Components (all free / Max)

| Step | Service | Cost | Notes |
|------|---------|------|-------|
| Interface | Teams Outgoing Webhook | free | Built into Teams; @mention in a channel POSTs to the relay. |
| Relay | Cloudflare Worker (or Azure Function free tier) | free | No AI. Verifies the Teams HMAC, calls GitHub `repository_dispatch` with a PAT. |
| Story agent | Claude Code GitHub Action | Max | `anthropics/claude-code-action`, auth via `CLAUDE_CODE_OAUTH_TOKEN`. |
| Board | GitHub Projects + Issues | free | The cloud Kanban; column = status. |
| Domain agents | Claude Code GitHub Action (one workflow / prompt per domain) | Max | Routed by `domain:*` label; scoped by paths / CODEOWNERS. |
| Review notify | Teams Incoming Webhook | free | Adaptive Card with the PR link. |
| DB CI/CD | Neon + `neondatabase/*` actions + Prisma | free | Branch per PR; promote on merge. |
| Board move | GitHub Projects automation | free | `Closes #N` closes the issue on merge → card auto-moves to Done. |

---

## 5. Auth model (the one thing to get right)

- Run `claude setup-token` **once** on the Max account → store the result as the
  GitHub secret `CLAUDE_CODE_OAUTH_TOKEN`. Every Claude Code Action uses it, so
  all agent usage counts against **Max** — **no API bill**.
- The relay holds a fine-scoped GitHub **PAT** (only `repository_dispatch` on the
  target repo) plus the **Teams webhook signing secret** (to verify inbound HMAC).
- Actions use the built-in `GITHUB_TOKEN` for Issues / PRs / Projects.
- Neon actions use a `NEON_API_KEY` secret.

Secrets live in GitHub Actions secrets + the relay's environment. Nothing
sensitive is exposed to the agents beyond the scoped `GITHUB_TOKEN`.

---

## 6. "Domain-specific agents" — how routing works

- A **domain** = a label (`domain:backend`, `domain:frontend`, `domain:data`)
  plus a **workflow file** carrying a domain-tuned system prompt and an allowed
  path scope (the backend agent only touches `backend/`, etc.).
- The Story Agent assigns the domain label from the request text.
- Each domain workflow triggers on `issues: [labeled]` and filters for its own
  label → autonomous pickup, no human assignment.
- Per-agent guardrails: allowed tools, max turns, path allowlist, and the PR gate
  (human review before merge) keep autonomy bounded.

---

## 7. Neon "DB merged to correct branch" — concretely

| Git event | Neon action | Migration command |
|-----------|-------------|-------------------|
| PR opened | Create `preview/pr-<n>` from the parent env branch | `prisma migrate deploy` against the preview branch |
| Merge → `develop` | Target the **staging** Neon branch | `prisma migrate deploy` |
| Merge → `main` | Target the **production** Neon branch (`br-curly-poetry`) | `prisma migrate deploy` |
| PR closed | Delete `preview/pr-<n>` | — |

Migration breakage surfaces on the PR's ephemeral branch in CI, never on prod.
This automates the existing "Neon branch per git branch" workflow.

---

## 8. Risks & open items

1. **Max usage limits.** Autonomous agents can burn Max quota fast. Throttle with
   concurrency caps and the `ready`-label gate (agents only pick labeled stories).
2. **`repository_dispatch` needs a PAT** in the relay — scope it to one repo,
   dispatch-only, and rotate it.
3. **Human-in-the-loop stays at PR review** — the only manual gate; everything
   else is autonomous. Optionally add a second gate: a human must add the `ready`
   label before a domain agent picks the story up.
4. **Jira swap path.** If Jira is mandated later: create issues in Jira instead of
   GitHub Issues, and transition them on merge via `atlassian/gajira-transition`.
   The board columns map 1:1; the rest of the pipeline is unchanged.
5. **Prod migrations are irreversible.** Use `migrate deploy` (never `reset`) on
   `main`, and put the prod promotion job behind a **GitHub Environment with a
   required reviewer** for a final manual approval.

---

## 9. Build order (when implementation starts)

A future MVP would wire one thin slice first, then widen:

1. Relay (Teams → `repository_dispatch`) + `CLAUDE_CODE_OAUTH_TOKEN` secret.
2. Action A (Story Agent) → Issue + Project card.
3. One domain Action B → branch + PR.
4. Action D (Teams review notify).
5. Action C + E (Neon preview + promote on merge).
6. Add remaining domain agents (copy Action B, change label + path scope).
```
