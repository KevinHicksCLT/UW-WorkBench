# Creator → Approver Framework — Phase Goals and Architecture

Transformation Bridge (Strata) · Vite + React 18 frontend / Express backend (npm workspaces) / Neon / Prisma / Vercel · RBAC/ABAC entitlements (2026-07) · pino audit trail

> **Status (2026-07-05): PROPOSED — first pass for disposition.** Companion doc: [dual-approval-inventory.md](dual-approval-inventory.md) holds the line-item recommendations of which changes/decisions require separate approval; disposition those rows first — accepted rows become the seeded `ApprovalPolicy` registry in Phase 1.

---

## What exists today (survey, 2026-07-05)

The framework builds on real, already-shipped substrate — these are load-bearing facts for the design:

| Capability | State | Where |
|---|---|---|
| Audit trail | ✅ Every admin/graph/portfolio write logs actor email, entity, action, field-level diff | `services/audit.ts` → `AuditEntry`; read at Data Admin → Audit Log |
| Manager chain | ✅ Modeled, ⚠️ unused | `User.reportsToId`, `isManager`, `isApprover` (RBAC build, 2026-07-03) — no code consumes `isApprover` yet |
| Approval-shaped states | ⚠️ Embryonic | `PortfolioInitiative` workflow (`SUBMIT / APPROVE / MOVE_BACK`); `ChangeRequest.status` (`PENDING/APPROVED/REJECTED`) — **neither records who may/did approve** |
| Entitlements | ✅ | `PermissionSet`/`PermissionGrant` per user type + tri-state `UserPermissionOverride`, resolved in `permissionService`, enforced by `requirePermission` |
| Outbound delivery | ⚠️ Email (Resend) + Jira only | Feedback pipeline (`lib/feedback/`) — checkpointed, idempotent, retryable; the pattern to clone |
| Inbound webhooks | ✅ Pattern exists | IAM provisioning webhook: HMAC-SHA256 signed, `WebhookEvent` idempotency ledger |
| Employment/vendor identity | ❌ Thin | Only `ProgramResource.roleType` (`EMPLOYEE\|CONTRACTOR`), denormalized by name; vendor is free text on `Application`; nothing on `User` |
| AI agents as actors | ❌ Static only | `ProcessNode.automatability` scoring + `NodeAiAdoption`; no agent worker identity, no runtime execution |
| Work-instance tracking | ❌ For operating model; ⚠️ portfolio has `WorkplanActivity` (`PLANNED/IN_PROGRESS/DONE`, `assignedTo` is a free-text name) | `work.ts` serves the *static* model |
| Scheduled jobs | ❌ None | Needed for SLA escalation (Vercel cron is the natural fit) |

**Design consequence:** Phases 1–3 (approvals + integrations) can be built on what exists. Phases 4–5 (wait-time metrics, scorecards) require identity groundwork — actor type, employment type, vendor linkage — called out explicitly in Phase 4.

---

## Core concepts (shared vocabulary)

- **ApprovalPolicy** — a tenant-scoped rule: *this kind of change requires approval before it takes effect*. Keyed by a **decision key** (e.g. `portfolio.initiative.delete`, `user-admin.permission-sets.update`, `applications.onboard-ai`). Declares the quorum model and the approver-resolution rule. The dispositioned inventory seeds this registry.
- **ApprovalRequest** — one instance: creator X proposes change Y governed by policy Z. Holds the *proposed change payload*; the underlying entity is untouched until approved.
- **ApprovalAssignment** — one approver seat on a request (a request has 1..n). Records who resolved into the seat, their decision, **when, and via which channel** (in-app, Teams card, Outlook card, ServiceNow ticket #).
- **Definition of done (quorum + ordering).** A policy declares exactly what "approved" means as **ordered stages**; the request is approved only when every stage is satisfied, and a rejection at any stage terminates the whole request immediately (later stages are never dispatched — Legal saying no means Sourcing is never bothered).
  - Each **stage** holds one or more seats and a quorum: `MANAGER` (1 seat: creator's manager), `ANY_OF` (first decision fills it), `ALL_OF` (every seat must approve), `N_OF_M`.
  - **Parallel** approval = one stage with multiple seats (Legal + ISO + Architecture + Sourcing all at once, any order).
  - **Sequential** approval = multiple stages (Stage 1 Legal → Stage 2 Sourcing → Stage 3 ISO); a stage's assignments are only created and dispatched when the prior stage completes, so nobody is asked to review something that hasn't cleared its predecessor.
  - Mixed shapes compose naturally: e.g. Stage 1 = Legal alone, Stage 2 = ISO + Architecture in parallel, Stage 3 = Sourcing.
- **Decision events trigger workflow.** Every decision — wherever it was made — lands in Transformation Bridge as the system of record and is emitted as an internal event (`approval.approved` / `approval.rejected` / `approval.stage-completed`), which is what applies the held change and what future workflow (notifications, downstream requests, agent triggers) subscribes to. Channels are input devices; the event in Bridge is the fact.

### Approver-resolution methodology (deterministic, evaluated in order)

**Two independent tests, both required: RBAC answers "may this person sit approval seats for this kind of decision" (role + isApprover); ABAC answers "does this specific request fall inside their bounded context" (attributes). Being flagged an approver is necessary, never sufficient.**

1. **`MANAGER`** → the creator's `User.reportsToId`. Fallback chain when null: the domain admin for the creator's org-unit L1 → `SITE_ADMIN`. (Manager data is already maintained in User Admin.)
2. **Role-seat panel** → the policy names operating-model **Roles** (e.g. *ISO Security Architect*, *Enterprise Architect*); each seat resolves to users via `User.operatingRoleId` where `isApprover = true`. This is what finally gives `isApprover` a job: it marks which humans in a role may sit approval seats. Multiple eligible users per seat → any one of them can take the seat (first decision fills it).
3. **Named individuals/groups** → explicit user list on the policy (for standing bodies like an AI Council whose membership isn't a single operating role).

**ABAC bounded-context filter (applied to every candidate from 1–3).** Each ApprovalRequest derives a **subject attribute set** from the governed entity via the existing resolvers (`ancestorNames`/`streamAncestry`): value stream(s), domain/L1, org unit (division/department), geography. Each candidate approver has a **scope attribute set** already on their User record: `orgUnitId` (widened to its subtree via `OrgUnitClosure`), `geography` (`GLOBAL` matches everything), and their value-stream links (`valueStreamIds` from the RBAC build). A candidate is eligible only when **every subject attribute is contained in the corresponding scope attribute** — the manager of *North America Auto Underwriting* (orgUnit = Underwriting subtree ∋ Auto, geography = NORTH_AMERICA, value stream = Underwriting) can approve requests inside exactly that intersection and nothing else. Rules: an **unset** scope attribute on the approver = unbounded on that dimension (most approvers won't carry all three); a subject attribute that can't be derived for an entity (e.g. geography on a tenant-wide RBAC change) is skipped for that request. If the filter empties a seat, that's an unresolvable seat → immediate escalation (below), and the coverage gap is surfaced in the admin UI ("no in-scope approver for Underwriting/APAC").

**Pluggable decision point.** Resolution lives behind one interface — `resolveApprovers(decisionKey, subjectAttributes, requesterId) → eligible seats/users` — with the internal RBAC/ABAC implementation as default. A tenant that masters fine-grained entitlements in an external application configures an adapter instead: Transformation Bridge calls out with the same inputs and treats the response as the eligible set (cached briefly, fail-closed). Teams/Outlook/ServiceNow are **never** the authority on who may approve — they are delivery channels only; eligibility is always resolved by Bridge (or its configured external PDP) before anything is dispatched, and the callback re-verifies eligibility at decision time (an approver whose scope changed mid-flight can no longer decide).

**Guardrails (non-negotiable):**
- **Separation of duties:** the creator can never fill a seat on their own request, even if the rule matches them. If removing the creator empties a seat, resolution escalates (manager → domain admin → SITE_ADMIN).
- **Unresolvable seat = immediate escalation**, not silent stall — the request is flagged and routed to the fallback chain; the gap (e.g. "no user holds Role 'Sourcing Lead' with isApprover") is surfaced in the admin UI.
- **Policy changes are themselves Tier-1 governed** (meta-approval): editing an ApprovalPolicy or a PermissionSet requires dual approval, otherwise the framework can be disarmed by the person it's meant to check.

---

## Phase 1 — Approval core (in-app end-to-end)

> **Status: BUILT 2026-07-05** (branch `kevins-070526-feature-branch`). All success criteria below verified — unit tests (`backend/tests/lib/approvals/`), live API E2E (hold 202 → duplicate 409 → self-approve 404 → second-admin approve → replay applied → audit chain REQUESTED/SEAT_APPROVED/APPROVED/APPLIED), and the Approvals page in-browser. Policies seeded from the dispositioned inventory (DA-01/03/08/11/12 enabled). Deviations from this spec: the inbox is a TOP-LEVEL `approvals` menu key (not `workspace.approvals` — discoverability); SLA hours are calendar-hour v1 (working-day math lands with Phase 4); the policy admin surface is list + enable/disable/SLA only (stage editor is a Phase 1.x follow-up); criterion 3's reject notification is in-app only until Phase 2 delivery lands. Demo scaffolding: second SITE_ADMIN `site.admin@abc-insurance.demo` (Sid Adams) + a demo manager chain, so every seat type is exercisable after reseed.

### Goal
For every decision key accepted in the inventory, the change is **held, reviewed, and only applied after approval** — entirely inside Transformation Bridge — with the full decision trail in the audit log.

**Success criteria (verifiable):**
1. A governed mutation (e.g. `DELETE /portfolio/programs/:id`) by a non-exempt user does **not** modify the entity; it returns `202` with an ApprovalRequest id, and the entity row is unchanged in the DB.
2. The resolved approver(s) see the request in a **My Approvals** inbox (new `workspace.approvals` menu key, permission-gated) showing: what changes (field-level before/after), who asked, when, policy, due date.
3. Approve → the original change is applied *by the server replaying the stored payload through the same validated code path*, stamped with both creator and approver identity. Reject → nothing is applied; creator is notified with the reason.
4. Every decision writes an `AuditEntry` (`entityType: 'ApprovalRequest'`) recording **time, user, action, and method** (`IN_APP` in this phase) — plus a second AuditEntry for the applied change itself, so the entity's history shows *proposed by / approved by*.
5. Self-approval is impossible (verified by test: creator who is also the only role-holder gets an escalated request, not a self-seat).
5b. **Bounded context is enforced** (verified by test: an `isApprover` user whose scope is Underwriting/NORTH_AMERICA is offered — and can decide — a request whose subject is Underwriting/NORTH_AMERICA, is *not* offered an Underwriting/APAC request, and a direct API attempt to decide the out-of-scope request returns 404; a GLOBAL-geography approver matches both).
6. An `ApprovalPolicy` admin tab (Data Admin) lists all policies with quorum, resolution rule, SLA — CRUD gated, and policy edits themselves raise an ApprovalRequest (meta-approval).

### Recommended architecture
- **Models** (graph-conform, junctions not free text): `ApprovalPolicy` (tenant-scoped; `decisionKey` unique per tenant; `slaHours`; `enabled`) with ordered `ApprovalPolicyStage` rows (`policyId`, `order`, `quorum: MANAGER|ANY_OF|ALL_OF|N_OF_M`, `n?`, seat rule JSON `{ kind: 'MANAGER' | 'ROLES' | 'USERS', roleIds?, userIds? }`); `ApprovalRequest` (`policyId`, `entityType`, `entityId?`, `action`, `payload` Json — the zod-validated body; `requestedById`; `currentStage`; `status: PENDING|APPROVED|REJECTED|CANCELLED|EXPIRED`; `dueAt`; `decidedAt`), `ApprovalAssignment` (`requestId`, `stageId`, `seatRoleId?`, `assigneeId?`, `assignedAt`, `status`, `decidedAt`, `method`, `externalRef?`, `comment?`). Assignments for stage N+1 are created only when stage N completes; `assignedAt` is the measurement clock's start (Phase 4). ERD updated in the same change (db-data-model skill).
- **Enforcement = intercept-and-replay middleware.** A `requireApproval(decisionKey)` layer sits after `requirePermission` on governed routes. If a policy is enabled and the actor isn't exempt, it snapshots the validated body as `payload`, creates the request + assignments, and short-circuits with 202. Approval replays the payload through the same handler function (extracted service functions where needed). This keeps *one* validation/tenancy path — no parallel "pending tables" per entity, no drift.
- **Creator UX:** the blocked mutation surfaces as a toast/banner "Submitted for approval — pending N approver(s)" with a link to a My Requests view; the entity list can badge rows with pending requests.
- **Exemptions:** policy flag `selfApplyUserTypes` (e.g. SITE_ADMIN bypasses in break-glass; every bypass is audited loudly). Default: no exemptions.
- **Why intercept-and-replay:** the alternative (apply-then-revert) leaks unapproved state to every reader and makes rejection destructive; the alternative (per-entity draft tables) duplicates schema. Storing the validated request body and replaying it is the smallest honest implementation, and the payload doubles as the reviewable diff.

---

## Phase 2 — Microsoft delivery fabric (Teams, Outlook, Adaptive Cards, Loop)

### Goal
Approvers act **where they live** — a Teams chat or an Outlook mail — with enough context in the card to decide or to ask a clarifying question, without opening Transformation Bridge; deep link always present as the third option.

**Success criteria (verifiable):**
1. Creating an ApprovalRequest notifies each assignee on **every channel they opted into** — channels are per-user, multi-select preferences in Settings (extending the existing `me/preferences` store + `NotificationCard`): in-app only, email (actionable mail), Teams Adaptive Card DM, and **SMS reserved for SLA-breached critical approvals** (Phase 4 escalation triggers it; a user may opt into e.g. *email AND Teams card* for new requests plus *SMS on breach*). Teams/Outlook delivery rides a Power Automate flow (Premium confirmed available); SMS via a provider adapter (Twilio-class). Preference routing is the dispatcher's job — channel adapters stay dumb.
2. The card carries: title, requester, entity, field-level before/after summary, due date, policy name, and three actions: **Approve**, **Reject (with comment)**, **Ask a question** — plus an **Open in Transformation Bridge** deep link (`/workspace/approvals/:id`).
3. Card actions call back to a signed inbound endpoint (`POST /approvals/webhook`, HMAC over raw body — same pattern as the provisioning webhook, `WebhookEvent` idempotency ledger included). A decision from a card is **indistinguishable in the domain** from an in-app decision except for `method: 'ADAPTIVE_CARD_TEAMS' | 'ADAPTIVE_CARD_EMAIL'` in the assignment row and audit entry.
4. "Ask a question" posts the question onto the request's comment thread in-app and notifies the creator; the card refreshes to show the answer (card refresh via Power Automate re-post; Loop component is the stretch upgrade for live state).
5. A decided card can't decide again (idempotency ledger; late clicks get "already decided by X at T").
6. Outage behavior: if the flow endpoint is down, delivery retries with backoff and the request remains fully actionable in-app — Teams/Outlook is an accelerant, never the system of record.

### Recommended architecture
- **Outbound:** a `lib/approvals/dispatch.ts` mirroring the feedback pipeline (checkpointed steps, retryable, per-channel status on the assignment row). Channel adapters: `powerAutomate.ts` (POST to a per-tenant Flow HTTP-trigger URL from config, payload = card JSON + callback token), `email.ts` (Resend fallback with Approve/Reject links when no MS environment). Config lives in `backend/config/approvals.config.json` + env secrets — the feedback config precedent.
- **Card actions → callback:** each card embeds a single-use signed action token (request id + assignment id + action nonce). The Power Automate flow relays the click to `/approvals/webhook` with the tenant's HMAC. No Bridge credentials ever live in the flow.
- **Why Power Automate as the seam:** it keeps all Microsoft-side auth (Teams app registration, actionable-message provider registration for Outlook) inside the customer's M365 tenant, where their admins already govern it — Bridge only needs one HTTPS trigger URL per tenant and one shared secret. Swapping to Graph API direct-send later changes only the adapter.
- **Loop components:** treat as Phase 2b — Adaptive Cards ship first (universal, works in both Teams and Outlook); Loop adds live-updating state but requires newer tenant features.

---

## Phase 3 — ServiceNow (and generic ticketing) connector

### Goal
Tenants that route approvals through ServiceNow get a ticket per ApprovalRequest; approving the ticket approves the request; **the ticket number is memorialized in the Bridge audit log**.

**Success criteria (verifiable):**
1. Policy-level channel setting `SERVICENOW` creates a record in the tenant's SNOW instance per request (recommend `sysapproval_approver` or a catalog request — decide with the customer's SNOW admin), carrying the same context block + deep link.
2. SNOW approval/rejection flows back (Business Rule → outbound REST to `/approvals/webhook`, HMAC-signed) and closes the assignment with `method: 'SERVICENOW'`, `externalRef: '<ticket #>'`.
3. `GET /audit?entityType=ApprovalRequest` shows time, user, action, method **and ticket #** for SNOW-decided approvals.
4. The connector is generic at the interface: `channel adapter` contract (`deliver(assignment) → externalRef`, `parseCallback(req) → decision`) so Jira/other ticketing systems are adapters, not rebuilds.

---

## Phase 4 — Wait-time, SLA, and escalation engine

### Goal
Every approval (and later, every tracked work item) knows **who it's waiting on, since when, against what SLA**, and escalates on breach — to the assignee's manager by default.

**Measurement principle (Kevin, 2026-07-05): the clock starts at assignment.** Wait/completion time is `assignedAt → decidedAt/completedAt`, and the model is deliberately generic over *what* was assigned — approving something and creating something are both "a task someone was assigned." Approval assignments are the first instrumented task type (they exist in Phase 1); the same `assignedAt/completedAt/waitingOn` contract extends to work assignments (e.g. `WorkplanActivity`, future work-instance items) so Phase 5 metrics never care which kind of task they're aggregating.

**Success criteria (verifiable):**
1. Each PENDING assignment exposes `waitingOn` (user + operating role, or agent name), `waitingSince`, `dueAt` (policy `slaHours` in **working days**, Mon–Fri v1), and `breached: boolean`.
2. A scheduled job (Vercel cron hitting `/approvals/escalate`, idempotent) finds breached assignments and: re-notifies the assignee honoring their **breach-tier preferences (this is where opted-in SMS fires)**, notifies the assignee's `reportsTo` (their preferred channels), stamps an `EscalationEvent` on the request, re-escalates every N days up the chain — every escalation audited. Defaults (agreed 2026-07-05): **3 working days to respond, escalate to manager on breach, re-escalate every 2 working days.**
3. Deliverable rollup: where governed entities tie to deliverables/initiatives, the pending-approval wait time surfaces on the parent (e.g. initiative shows "blocked 4d on Legal review").
4. **Identity groundwork lands here** (prereq for Phase 5): `User.actorType` (`HUMAN | AGENT`), `User.employmentType` (`EMPLOYEE | CONTRACTOR`), `User.vendorPartyId` → `ExternalParty` (partyType Vendor/SystemIntegrator). Backfill from `ProgramResource` where names match; User Admin form extended. Agents become first-class users (actorType AGENT, no login) so approvals, wait metrics, and audit rows attribute to them identically.

### Why here
Escalation needs the cron + the event trail; the scorecard (Phase 5) is pure read-side over the events this phase emits. Splitting them keeps Phase 4 shippable while identity backfill is validated.

---

## Phase 5 — Response-time metrics, comparisons, and shareable scorecards

### Goal
In the Metrics module, a manager sees response/wait performance for **their** people; senior leaders compare teams, roles, vendors, and humans-vs-agents; any view exports as a shareable scorecard/heatmap.

**Success criteria (verifiable):**
1. Time windows: past 5 / 10 / 20 / 60 working days and YTD, selectable everywhere.
2. Manager view is permission-scoped by the ABAC manager chain: a manager sees direct (and transitive) reports only; a domain admin their L1; SITE_ADMIN/executives everything. Reuses `requirePermission('metrics')` + a new scope resolver over `reportsToId` closure.
3. Per-person metrics: median/p90 response time to approval seats, breach count, escalations received, open items with age. Per-responsible-party metric: how fast they clear items escalated **to** them (the "responsible parties are also compared" requirement).
4. Comparators: person vs **median of same operating role + decision-key combination** (cohort benchmark); team vs team (e.g. solution architects vs data architects via operatingRole grouping); employee vs contractor; vendor vs vendor (Cognizant vs TCS via `vendorPartyId`); human vs agent and agent vs agent (via `actorType`).
5. Scorecard/heatmap export: a permission-checked, snapshot-based share (server-rendered page or PDF) a manager can hand a vendor, scoped to exactly the cohort shared — no live data leakage beyond the snapshot.
6. All aggregation server-side via resolver-style batch queries (no per-row fan-out), computed from `ApprovalAssignment`/`EscalationEvent` timestamps — the metrics are a *view over the audit trail*, never separately maintained numbers that can drift.

---

## Traceability & sequencing

| Phase | Depends on | Ships value alone? |
|---|---|---|
| 0. Inventory disposition (companion doc) | — | Yes — governance decisions documented |
| 1. Approval core | 0 | Yes — in-app dual approval + audit |
| 2. MS fabric | 1 | Yes — approvals without opening the app |
| 3. ServiceNow | 1 (parallel to 2) | Per-tenant |
| 4. SLA/escalation + identity | 1 | Yes — nothing waits silently |
| 5. Metrics/scorecards | 4 | Yes — the comparative heatmap |

Suggested tracker IDs: `APR-<phase>.<item>` (e.g. APR-1.3 = replay-on-approve). Inventory rows carry `DA-##` ids.

---

## Decisions (Kevin, 2026-07-05)

1. **Pilot scope — CONFIRMED.** Phase 1 pilots on portfolio gates (DA-11/DA-12) + RBAC four-eyes (DA-01/DA-03).
2. **Blocking semantics — DECIDED (Claude's judgment, per Kevin's delegation): hold-until-approved (intercept-and-replay) for ALL governed decisions, no apply-then-revert mode in v1.** Why this path: (a) unapproved state never leaks to readers, dashboards, or rollups — with apply-first, a rejected $2M change request would have already flowed into initiative financials seen by executives; (b) rejection is a no-op instead of a destructive revert, which matters most exactly where approvals matter most (cascading deletes can't be un-deleted); (c) one validated code path — the replay goes through the same zod + tenancy + audit route as a direct write, so the approval layer can't drift from the API; (d) the audit story is clean: *proposed → decided → applied* as three attributable events. Cost accepted: creators wait on GOVERN-tier changes — that friction is the control working, and the OPTIONAL/EXEMPT tiers keep it off high-frequency work. If a future family genuinely needs apply-then-acknowledge, the policy model can carry a per-policy `mode` flag without reworking the engine.
3. **M365 — CONFIRMED.** Power Automate Premium assumed available; Teams Adaptive Cards primary. **Clarified principle:** who can approve is NEVER flagged in MS Teams — eligibility is resolved exclusively by Transformation Bridge's RBAC/ABAC (or a tenant-configured external fine-grained-entitlements PDP that Bridge calls). Channels only deliver. **Notification channels are per-user preferences** (multi-select: email AND Teams cards etc.; SMS opt-in for SLA-breached criticals) — see Phase 2 criterion 1.
4. **ServiceNow — CONFIRMED:** native `sysapproval` records.
5. **SLA defaults — CONFIRMED:** 3 working days, escalate to manager on breach, re-escalate every 2 working days.

## Decisions (continued, 2026-07-05)

7. **Measurement start — DECIDED:** the clock starts when a person (or agent) is **assigned** a task, and measures until completion — regardless of whether the task is creating something or approving something. Captured as the Phase 4 measurement principle; `ApprovalAssignment.assignedAt` is the first instrumented case.
8. **Definition of done — DECIDED (supersedes the "AI Council trigger" question; the Council was illustrative).** Every policy declares its own definition of done: how many approvers, which roles/people, and **ordering** — sequential stages (Legal → Sourcing → ISO), parallel seats (any order), or mixed. Now a core model concept (`ApprovalPolicyStage`); the specific trigger/panel for AI-technology onboarding gets configured when DA-24a is dispositioned.

## Still open

6. **Vendor source of truth** *(scorecard concern, not approval-channel concern — see Phase 5).* To compare Cognizant resources vs TCS resources, each contractor's User record must say which vendor employs them. Question is only where that fact is mastered: proposed default is a `User.vendorPartyId → ExternalParty` field maintained in Transformation Bridge's User Admin (backfilled from `ProgramResource` name matches), unless an HR/VMS feed should provision it.
