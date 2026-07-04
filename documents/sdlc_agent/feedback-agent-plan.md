# Feedback & SDLC Automation — Phase Goals and Architecture

Transformation Bridge (Strata) · Vite + React 18 frontend / Express backend (npm workspaces) / Neon / Prisma / Vercel (`experimentalServices`: frontend at `/`, backend at `/api`) · Jira Cloud · GitHub

> **Repo-fit note (2026-07-03):** this plan was originally drafted assuming Next.js. The repo is a Vite + Express monorepo (`frontend` / `backend` / `shared` workspaces), so the architecture sections below have been adapted to what is actually built: Express feature routers mounted at root (the `/api` prefix is stripped by the Vite proxy in dev and `vercel.json` in prod), `requireAuth` JWT middleware supplying `req.tenantId` / `req.user`, Prisma against Neon branches (migrations only), the `components/ui` internal component library, and existing deps that remove work (`@anthropic-ai/sdk`, `multer`, `zod`, pino already in the backend).

---

## UI Requirement — Feedback Capture Widget

*Frontend deliverable for Phase 1; buildable and testable independently of the pipeline behind it.*

### Goal

From any screen in Transformation Bridge, a user can submit contextual feedback in three interactions or fewer (open → type → submit), with all technical context captured automatically and the screenshot visible to them before it leaves the browser.

**Success criteria (verifiable):**

1. A feedback button is present in the header on every authenticated screen; opening it never navigates away from or destroys the state of the page the user is on (modal/popover, not a route).
2. The form contains exactly: optional name field, required feedback textarea, screenshot preview with an include/exclude toggle, submit button. Submit is disabled while the textarea is empty.
3. On open, a screenshot of the current view is captured client-side and shown in the form as a thumbnail. The user sees exactly what will be attached; unchecking the toggle sends no screenshot. Screenshot capture failing (tainted canvas, unsupported browser) degrades gracefully — form still works, screenshot omitted.
4. On submit, the client automatically attaches: current route, app version/commit SHA, and user agent. Tenant ID and user ID are **not** sent by the client — the server stamps them from the JWT (`req.tenantId` / `req.user`), per the repo's tenancy rule (never trust the body). The user never types context manually.
5. Submit shows a pending state, then confirmation, in under ~1 second. On network failure the user's typed text is preserved and a retry is offered — feedback is never silently lost.
6. The widget makes exactly one request: a single multipart `POST /api/feedback` carrying the text, context fields, and the screenshot file (if included). No direct calls to Vercel Blob, Jira, Anthropic, or email from the browser — the backend does the Blob upload server-side.

### Recommended architecture (adapted to this repo)

- **Placement:** feedback button in the header in `frontend/src/components/Layout.tsx`, next to the existing `AssistantWidget` — that widget is the precedent for header-hosted overlays.
- **Component:** one new `frontend/src/components/FeedbackWidget.tsx` (keep under the 500-line file cap), composed from the internal `components/ui` library (Button, Input, Textarea, Label) — never hand-rolled class strings. `lib/dialogs` / `useDialogs` is confirm/alert-grade, not form-grade, so the modal shell is bespoke but styled to match `DrawerShell`/existing overlays. Modal, not a route — page state is untouched.
- **Screenshot:** `modern-screenshot` (new frontend dep; better CSS coverage than `html2canvas`) captured on button click **before** the modal renders, held as a blob in component state, shown as a thumbnail with an include/exclude toggle. Capture wrapped in try/catch — failure degrades to a form without a screenshot. Note the app renders `@xyflow/react` SVG maps; verify capture fidelity on the map view during build.
- **Context capture:** route from `useLocation()`; commit SHA via a Vite `define` in `frontend/vite.config.ts` (`__COMMIT_SHA__` from `VERCEL_GIT_COMMIT_SHA`, which Vercel populates at build; fallback `'dev'`); userAgent from `navigator.userAgent`. User/tenant come from the JWT server-side — nothing to wire client-side.
- **Submit:** one multipart `POST` via the existing `lib/api.ts` wrapper (extend it with a multipart-capable `post` if needed — it currently sends JSON). Pending state on the button; on failure keep the typed text in state and offer retry. No new state management, no feature flags.

### Why

- **Capture-on-open with visible preview** solves the multi-tenant privacy problem structurally: the user is the redaction gate, seeing exactly what ships to Jira before it does. It also means the screenshot shows the state that prompted the feedback, not the state after the modal covered it (capture before the modal renders, or exclude the modal element).
- **Auto-captured context (criterion 4)** is what makes the Phase 2 coding agent viable — route and commit SHA turn "something's broken" into an actionable story. Making the user type it guarantees it's missing.
- **One multipart POST, nothing else from the browser (criterion 6)** keeps every secret server-side and means the UI has zero knowledge of Blob/Jira/Inngest/Resend — the whole downstream pipeline can change without touching the frontend. Server-side Blob upload (instead of a signed client upload) also drops a round-trip and a token-minting endpoint, and `multer` is already a backend dependency.
- **Text preservation on failure (criterion 5)** because losing a paragraph of typed feedback to a network blip is the fastest way to train users to never use the widget again.
- **No speculative features:** no category dropdowns, severity pickers, or file-upload fields — the LLM triage step downstream does classification, so the form stays at minimum friction.

---

## Phase 1 — Feedback Capture → Jira Ticket → Notification

### Goal

A user submits feedback from any screen and, without further human action, a well-formed Jira ticket lands in the backlog and stakeholders are notified.

**Success criteria (verifiable):**

1. Submitting the feedback form returns confirmation to the user in under ~1 second, regardless of downstream processing time.
2. Every submission produces exactly one row in the `Feedback` table containing: name (optional), feedback text, route/screen, tenant ID, user ID, app version/commit SHA, browser info, screenshot URL.
3. Every submission produces exactly one Jira ticket — retries never create duplicates — containing: generated title, 1–2 sentence summary, original comment verbatim, screenshot attached, generated implementation story, acceptance criteria, `feedback` label.
4. Every successfully ticketed submission triggers exactly one notification email to the configured list, containing the Jira key and link.
5. A downstream failure (Jira down, email bounce) is visible in a dashboard and retryable without re-running earlier steps. The feedback row records its state (`pending` → `ticketed` → `notified` / `failed`) and the Jira key.

### Recommended architecture (adapted to this repo)

- **UI:** as specified in the widget section above — header button in `Layout.tsx`, `FeedbackWidget.tsx` modal, one multipart `POST /api/feedback`.
- **Schema:** new `Feedback` model in `backend/prisma/schema.prisma` — id, tenantId, userId, name?, text, route, commitSha, userAgent, screenshotUrl?, status (plain uppercase string per repo convention: `PENDING | TICKETED | NOTIFIED | FAILED`), jiraKey?, error?, timestamps. This is a standalone operational table, **not** part of the erd_v5 operating-model graph — but `documents/value-streams/Master Documentation/erd_v5.mmd` still gets updated on the schema change (db-data-model skill mandates sync). Migration via `npm run db:migrate -w cascade-backend` — never `db push`.
- **API route (Express):** new `backend/src/routes/feedback.ts` mounted at root in `app.ts` (`app.use('/feedback', …)` — reached as `/api/feedback` through the Vite proxy in dev and the `vercel.json` route prefix in prod). `requireAuth` at top, `multer` memory storage (image mime only, ~5 MB cap), inline `zod` validation, `try/catch (e) { next(e) }` into the central error handler, pino logging for free via the existing `httpLogger`. Flow: validate → server-side `@vercel/blob` `put()` (new dep) → Prisma insert (tenantId/userId from JWT, never body) → `inngest.send('feedback/submitted', { data: { feedbackId } })` → return 200 with the row id. Rate limit DB-backed (count the user's rows in the last minute before insert) — serverless-safe, no new dependency.
- **Pipeline (Inngest function, same repo):** business logic lives in `backend/src/lib/feedback/` so the unit-test suite covers it (tests mirror under `backend/tests/`, per testing-standards):
  1. `generateTicket.ts` — **single structured-output Anthropic API call** (no tools, no loop) via the already-installed `@anthropic-ai/sdk` → `{title, summary, story, acceptanceCriteria}` JSON.
  2. `jira.ts` — Jira REST API v3 create issue with `feedback` label (description body is **ADF JSON**, not markdown), then attachments endpoint (fetch the Blob URL server-side → multipart with `X-Atlassian-Token: no-check`).
  3. `notify.ts` — **Resend** notification email with Jira key + link.
  4. Each step wrapped as `step.run()` in `backend/src/lib/feedback/inngest.ts`; every step writes status/jiraKey back to the Feedback row via Prisma. Event id = feedback id; Inngest step memoization keeps the Jira create exactly-once across retries (criterion 3).
- **Inngest serve endpoint:** `inngest/express` handler mounted in `app.ts` at `/inngest` (public URL `/api/inngest`). Local dev requires `npx inngest-cli dev` as a third terminal alongside the two dev servers. If Vercel deployment protection is enabled, Inngest needs the protection-bypass secret. This Express-on-`experimentalServices` + Inngest combination is the least-proven piece of the plan — budget slack for it, and note the fallback: the same `lib/feedback/` steps driven by the `Feedback.status` state machine plus a retry endpoint, swapped to Inngest before prod.
- **Env additions** (`backend/.env` + `.env.example`): `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`, `RESEND_API_KEY`, `FEEDBACK_NOTIFY_LIST`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `BLOB_READ_WRITE_TOKEN`. `ANTHROPIC_API_KEY` already exists (chat/ai-analysis routes use it).
- **No MCP servers. No Python service.** Jira via API token; email via Resend; storage via existing Neon/Prisma + Vercel Blob (server-side only).

### Why

- **This phase is a workflow, not an agent.** Only one step (ticket content generation) needs a model. Everything else is deterministic and benefits from being treated that way.
- **Inngest over fire-and-forget:** Vercel serverless freezes after the response returns, so "one API call handles two things" fails silently in prod. Trap specific to this repo: the dev backend is a **persistent** `tsx watch` process where fire-and-forget appears to work — it will pass every local test and then die on Vercel. Inngest gives per-step retries, checkpointing, idempotency, and a run dashboard — satisfying criteria 3 and 5 without hand-building status sweeps.
- **Direct APIs over MCP:** a fixed pipeline gains nothing from flexible tool access, and Jira attachment upload (multipart) is poorly supported by MCP tooling anyway. Direct REST removes an entire failure class (model choosing wrong project/issue type).
- **TypeScript over Python:** the Anthropic SDK is equivalent; staying in one repo eliminates a second deployment, second CI pipeline, and cross-service auth.
- **Structured context in criterion 2** exists to feed Phase 2 — the coding agent needs route, commit SHA, and tenant context to act on a ticket.
- **Privacy note:** multi-tenant screenshots may capture client data. Screenshot should be visible/opt-in at submission time before it's shipped to Jira.

### Build order & verification (Phase 1)

1. **Schema** — `Feedback` model + migration + erd_v5.mmd sync.
2. **Backend route** — `routes/feedback.ts` (auth, multer, zod, Blob put, insert, event emit).
3. **Pipeline libs** — `lib/feedback/{generateTicket,jira,notify}.ts` + Inngest function + serve endpoint; unit tests with mocked fetch in the mirrored `tests/` tree.
4. **Frontend widget** — `FeedbackWidget.tsx` + `Layout.tsx` button + vite `define` for the SHA + `lib/api.ts` multipart support.
5. **Verify live** (unit tests cover the lib layer, not routes — repo convention): log in as the seeded admin, submit feedback from the browser with all three dev processes running (backend, frontend, `inngest-cli dev`), watch the run in the Inngest dev dashboard, confirm the Jira ticket + attachment + email, and confirm the Feedback row walks `PENDING → TICKETED → NOTIFIED`. Then run the full gates (`typecheck`, `lint`, `test`, `build`).

**Pre-build blocker:** a Jira Cloud site + project key + API token must exist before step 3 can be verified — everything else is buildable solo.

### As built (2026-07-03, branch `SDLC-Agent`) — deviations from the plan above

Phase 1 is implemented and verified end-to-end (browser → API → Claude ticket generation → DB), with two deliberate simplifications:

1. **Screenshot storage: Postgres `bytea`, not Vercel Blob.** The screenshot is small (JPEG ~100-500 KB, 5 MB cap), only needs to live until the Jira attachment step, and DB storage removes an entire vendor + token. Served tenant-scoped at `GET /api/feedback/:id/screenshot`; the Jira attach step reads bytes straight from the row. Swap to Blob later only if volume demands it.
2. **Async execution: checkpointed status machine + `waitUntil`, Inngest optional hardening.** `lib/feedback/pipeline.ts` checkpoints every step onto the Feedback row (`ticket` json → `jiraKey` → `screenshotAttachedAt` → `notifiedAt`) and skips completed steps, so `POST /api/feedback/:id/retry` (SITE_ADMIN) resumes from the failed step with zero duplicate Jira tickets. The route responds immediately and hands the pipeline promise to Vercel's `waitUntil` (`@vercel/functions`) so the serverless function stays alive until delivery completes — the plain fire-and-forget froze on Vercel (tickets appeared minutes late, emails never sent; observed live 2026-07-04). `waitUntil` is a no-op on the persistent dev server. Inngest (per-step retries + dashboard) remains the upgrade path if volume or reliability demands grow; the steps are already shaped as its `step.run()` blocks.
3. **Config file (added scope):** `backend/config/feedback.config.json` holds the button toggle (`feedbackButtonEnabled`), the Jira target (`enabled`/`baseUrl`/`projectKey`/`issueType`/`labels`), and the notification list. Re-read per request — toggling requires no restart. Secrets stay in env: `JIRA_EMAIL`, `JIRA_API_TOKEN`, `RESEND_API_KEY`, optional `FEEDBACK_FROM_EMAIL` / `FEEDBACK_MODEL` (see `.env.example`).

Status pipeline as implemented: `PENDING → GENERATED → TICKETED → NOTIFIED / FAILED` (GENERATED added so the LLM step is verifiable — and never re-billed on retry — before Jira credentials exist; with `jira.enabled: false` the pipeline stops there). Notification email is plain `fetch` to the Resend API — no SDK. Remaining to activate: fill in Jira creds + set `jira.enabled: true`, Resend key + recipients, and wire Inngest for prod.

---

## Phase 2 — Story → Autonomous Implementation → PR → Review

### Goal

When a feedback story is moved to **In Progress** in Jira, an agent implements it against the codebase, and a tested pull request plus a status transition and notification appear without human coding effort. Humans remain the merge gate.

**Success criteria (verifiable):**

1. Transitioning a `feedback`-labeled ticket to In Progress triggers exactly one agent run (webhook-driven, no polling; duplicate transitions do not spawn duplicate runs).
2. Each run produces at most one PR, on branch `feedback/<JIRA-KEY>`, referencing the ticket.
3. The PR is only opened if the full test suite passes; the agent writes or updates tests covering the acceptance criteria.
4. On PR creation, the ticket transitions to **Pending Review** and a completion email is sent with PR + ticket links.
5. No PR is ever auto-merged. Runs are capped in wall-clock time and token budget; a run that exceeds caps fails visibly and transitions the ticket to a flagged state rather than hanging.

### Recommended architecture

- **Trigger:** Jira Cloud webhook (status transition) → Inngest function (dedupes, validates label/project).
- **Execution:** Inngest dispatches a **GitHub Actions workflow** running **Claude Code / Claude Agent SDK in headless mode** against a fresh checkout. Prompt = story + acceptance criteria + structured context from the ticket.
- **Workflow steps:** clone → branch `feedback/<KEY>` → agent implements + writes tests → run full suite → push → open PR via GitHub API.
- **Orchestration:** the Inngest function awaits workflow completion, then transitions the Jira ticket and sends the Resend email. Failure paths transition the ticket to a flagged status.

### Why

- **GitHub Actions as the sandbox:** an autonomous code-executing agent needs isolation. Ephemeral runners with scoped tokens solve this for free; self-hosting means building containment yourself. CI is already colocated, so "tests green before PR" (criterion 3) is structural, not procedural.
- **Claude Code headless over a hand-rolled agent:** the edit/test/iterate loop, file tooling, and repo navigation are already built and maintained (including an official GitHub Action). Your effort goes into orchestration and guardrails, which is where the actual risk lives.
- **Inngest stays the brain:** webhooks, dedupe, ticket transitions, and email reuse the exact Phase 1 machinery — one system to observe and debug.
- **Human merge gate is non-negotiable:** the agent's failure mode is a plausible-looking wrong PR; review is the containment.
- **Sequencing constraint:** the 2026-07 big-bang refactor has landed on this codebase, so the original "wait for the refactor" blocker is gone — but the rule generalizes: never point the autonomous PR-opener at a branch with heavy in-flight churn (e.g. active data-rework branches). Pin agent runs to `master`/`develop`.

---

## Phase 3 — Autonomous Regression & Data Quality Detection

### Goal

Regressions in critical user flows and integrity violations in app data are detected on a schedule and filed as deduplicated defect tickets — without a human noticing the problem first, and without flooding the backlog with noise.

**Success criteria (verifiable):**

1. A defined set of critical flows (Playwright) and data-integrity checks (SQL against Neon) runs on a schedule; every run is logged with pass/fail per check.
2. A deliberately introduced regression in a covered flow produces a defect ticket within one scheduled cycle.
3. A failure matching an existing open ticket (embedding-similarity or key match) does **not** create a new ticket — it comments on / links the existing one. Repeatedly failing checks produce one ticket, not one per cycle.
4. Filed defects reuse the Phase 1 ticket format (title, summary, evidence, acceptance criteria, `defect` label) and pipeline.
5. Zero tickets are created from passing runs. Signal-to-noise is auditable: every ticket traces to a specific failed assertion.

### Recommended architecture

- **Detection (deterministic):** Inngest cron → Playwright suite against critical flows + SQL integrity assertions against Neon (orphaned rows, closure-table consistency, tenant isolation checks).
- **Triage (LLM, only on failure):** a model receives the failure artifact (trace, screenshot, query result), searches open tickets for duplicates (embeddings over existing feedback/defect tickets), and either files a new defect through the **same Inngest ticket-creation function as Phase 1** or links the existing ticket.
- **No open-ended "review the app" agent.** Coverage grows by adding assertions, not by increasing agent autonomy.

### Why

- **Assertion-driven detection produces signal; exploratory agents produce noise proportional to token spend.** "Autonomously review the app" has no ground truth, so its output can't satisfy criterion 5. A failed assertion is ground truth.
- **The LLM is confined to triage** — summarizing failures and deduplicating — the two tasks where judgment beats rules and where a wrong answer is cheap (a mislabeled ticket, not a false alarm storm).
- **Dedupe is the make-or-break requirement** (criterion 3). Without it this phase actively damages the backlog it's meant to protect. It's listed as a success criterion, not a nice-to-have, for that reason.
- **Full pipeline reuse:** detection feeds the Phase 1 ticket function, and defect tickets moved to In Progress feed Phase 2. The three phases compose into one loop: detect → ticket → implement → verify.

---

## Cross-phase connection inventory

| Dependency | Used in | Form | Status in repo |
|---|---|---|---|
| Neon (existing) | 1, 3 | Prisma / SQL — no MCP | in place (branch-per-feature flow) |
| Vercel Blob | 1 | `@vercel/blob` SDK, server-side only | new dep + store token |
| Inngest | 1, 2, 3 | Workflow engine (free tier), `inngest/express` serve at `/api/inngest` | new dep + account + local `inngest-cli dev` |
| Anthropic API | 1 (structured output), 2 (Claude Code), 3 (triage) | SDK / Agent SDK | `@anthropic-ai/sdk` already installed; key already in env |
| Jira Cloud | 1, 2, 3 | REST v3 + webhooks, API token | account/project needed |
| Resend | 1, 2 | API key | new account |
| GitHub | 2 | Actions + App token | repo exists |
| `modern-screenshot` | 1 | frontend dep | new dep |
| `multer` / `zod` / pino | 1 | upload parsing / validation / logging | already installed |

**Pre-build validation:** confirm Jira is Cloud (webhooks + REST v3 available) and that an API token can create issues *and upload attachments* in the target project — the only integration with real unknowns. Second-riskiest piece: Inngest's sync endpoint against the Vercel `experimentalServices` Express deployment (deployment protection, function timeouts) — validate with a hello-world Inngest function before building the pipeline on it.
