# Dual-Approval Inventory — DISPOSITIONED

> **Status: all 28 rows ACCEPTED as recommended (Kevin, walked in-session 2026-07-05).** DA-12's $50k panel threshold confirmed; DA-24a confirmed as a **parallel single-stage** ALL_OF panel. This table is now the seed source for the Phase 1 `ApprovalPolicy` registry.

Companion to [approval-framework-plan.md](approval-framework-plan.md). Grounded in a full survey of all **89 mutation endpoints** (2026-07-05, branch `kevins-070526-feature-branch`); endpoints are grouped into **decision-level rows** — a policy governs a decision, not a URL.

## How to disposition

Set each row's **Disposition** to one of:
- **ACCEPTED** — becomes a seeded `ApprovalPolicy` (enabled) in Phase 1
- **MODIFIED** — accepted with changes; note the change in Notes (different approver, quorum, threshold…)
- **REJECTED** — no approval policy; standard RBAC + audit trail is sufficient
- **DEFERRED** — revisit after the pilot

Edit this file directly, or walk the rows with Claude in-session and dispositions will be recorded here. Accepted/modified rows get `ApprovalPolicy` seeds; every row keeps its `DA-##` id for traceability into the tracker (`APR-1.x` items).

**Recommendation tiers used below:**
- **GOVERN** — dual approval on by default (high blast radius, security-sensitive, or financially material)
- **OPTIONAL** — policy created but **disabled** by default; tenant can arm it (routine but sometimes sensitive)
- **EXEMPT** — no policy; audit trail only (low risk, high frequency — approval here would train people to rubber-stamp)

**Default approver logic** (from the plan): `MANAGER` = creator's `reportsTo` with fallback to domain admin → SITE_ADMIN; role-seat panels resolve via `operatingRoleId` + `isApprover`; the creator can never self-approve. **Every candidate additionally passes the ABAC bounded-context filter** — their org-unit subtree, geography (`GLOBAL` = all), and value-stream scope must contain the request's subject attributes (e.g. the North America Auto Underwriting manager approves only within Underwriting ∩ NORTH_AMERICA ∩ Auto), whether resolution is internal or delegated to an external entitlements PDP.

---

## A. RBAC / User Admin / Security — highest priority (the framework must protect itself)

| ID | Decision / change | Trigger endpoints | Risk | Recommended policy | Disposition | Notes |
|----|-------------------|-------------------|------|--------------------|-------------|-------|
| DA-01 | Replace a user type's permission set | `PUT /permission-sets/:userType` | Rewrites entitlements for every user of that type; delete+recreate (no partial) | **GOVERN** · ANY_OF one *other* SITE_ADMIN | **ACCEPTED** 2026-07-05 | Four-eyes among admins; creator excluded |
| DA-02 | Per-user permission overrides | `PUT /users/:id/overrides` | Silent privilege escalation path for one account | **GOVERN** · target user's manager **or** second SITE_ADMIN | **ACCEPTED** 2026-07-05 | |
| DA-03 | Mint or promote an admin (role → `*_ADMIN` / `SUPER_USER`) | `POST /users`, `PATCH /users/:id` when role escalates | Direct privilege escalation | **GOVERN** · ANY_OF second SITE_ADMIN | **ACCEPTED** 2026-07-05 | Non-admin user creation stays EXEMPT (DA-04) |
| DA-04 | Create / edit / deactivate non-admin users | `POST/PATCH/DELETE /users/:id` | Routine people ops; soft-delete reversible | **EXEMPT** (audited) | **ACCEPTED** 2026-07-05 | Deactivation of a *manager* with reports → OPTIONAL flag |
| DA-05 | Bulk user import | `POST /users/import` | One spreadsheet upserts many accounts incl. attributes | **GOVERN** · MANAGER; require dry-run diff attached to the request | **ACCEPTED** 2026-07-05 | Import already supports `?dryRun` — the request payload embeds its result |
| DA-06 | Create API key / webhook secret | `POST /api-keys` | Mints a machine credential into the tenant | **GOVERN** · ANY_OF second SITE_ADMIN | **ACCEPTED** 2026-07-05 | Revocation (`POST /api-keys/:id/revoke`) stays EXEMPT — removing access should never wait |
| DA-07 | IAM provisioning writes | `PUT/POST/DELETE /provisioning/users*` | Machine-driven; already HMAC-signed + idempotent | **EXEMPT** | **ACCEPTED** 2026-07-05 | Governing these breaks IAM automation; the API key that authorizes them is governed (DA-06) |
| DA-08 | **Change an approval policy itself** | future `POST/PATCH/DELETE /approval-policies*` | Disarming a control must not be unilateral | **GOVERN** · ANY_OF second SITE_ADMIN (meta-approval) | **ACCEPTED** 2026-07-05 | Non-negotiable per plan; disabling a policy = changing it |

## B. Portfolio / SPM — financial & governance decisions

| ID | Decision / change | Trigger endpoints | Risk | Recommended policy | Disposition | Notes |
|----|-------------------|-------------------|------|--------------------|-------------|-------|
| DA-09 | Delete a program / workstream | `DELETE /portfolio/programs/:id`, `/workstreams/:id` | Cascades initiatives, finance lines, RAID history | **GOVERN** · MANAGER | **ACCEPTED** 2026-07-05 | |
| DA-10 | Delete an initiative | `DELETE /portfolio/initiatives/:id` | Removes charter, workplan, finance baselines | **GOVERN** · MANAGER | **ACCEPTED** 2026-07-05 | |
| DA-11 | Initiative stage-gate advance | `POST /portfolio/initiatives/:id/workflow` (`APPROVE`) | Already an approval in spirit — but *anyone with update permission* can fire it today | **GOVERN** · initiative **sponsor role** seat (fallback MANAGER) | **ACCEPTED** 2026-07-05 | Phase 1 migrates this ad-hoc transition into the framework — first consolidation win |
| DA-12 | Approve a change request | `PATCH /portfolio/change-requests/:cid` (status → APPROVED) | CRs carry cost/schedule impact; today `PENDING→APPROVED` records no approver | **GOVERN** · MANAGER; **escalate to panel** (sponsor + finance role) when cost impact > threshold ($50k confirmed) | **ACCEPTED** 2026-07-05 | Second consolidation win; threshold tunable per tenant |
| DA-13 | Delete benefit/cost lines; edit ACTUAL metric values | `DELETE /portfolio/lines/:type/:id`, `POST /portfolio/values` (ACTUAL dataset) | Rewrites financial history/baseline | **OPTIONAL** · MANAGER | **ACCEPTED** 2026-07-05 | TARGET/FORECAST edits stay EXEMPT — planning must stay fluid |
| DA-14 | Create/update/delete strategic objectives & weights | `POST/PATCH/DELETE /portfolio/objectives*` | Weights re-score every initiative's value ranking | **GOVERN** · MANAGER (executive owner) | **ACCEPTED** 2026-07-05 | Impact-link edits (`/initiatives/:id/objectives`) EXEMPT |
| DA-15 | Charter edits after initiative activation | `PATCH /portfolio/initiatives/:id` (charter fields, state=ACTIVE) | Rewriting the agreed scope of active work | **OPTIONAL** · sponsor seat | **ACCEPTED** 2026-07-05 | Pre-activation charter authoring EXEMPT |
| DA-16 | RAID item deletion | `DELETE /portfolio/raid/:id` | Removes risk/decision history | **OPTIONAL** · MANAGER | **ACCEPTED** 2026-07-05 | RAID "Decision" items are natural future *sources* of ApprovalRequests — synergy noted in plan |
| DA-17 | Resource rate / engagement changes | `ProgramResource` writes (rate, rollOn/rollOff) | Cost commitment changes | **OPTIONAL** · MANAGER | **ACCEPTED** 2026-07-05 | Allocation % changes EXEMPT |

## C. Operating-model graph — structural & governance content

| ID | Decision / change | Trigger endpoints | Risk | Recommended policy | Disposition | Notes |
|----|-------------------|-------------------|------|--------------------|-------------|-------|
| DA-18 | Delete or reparent a process node | `DELETE /builder/nodes/:id`, `PUT /builder/nodes/:id/parent` | Cascades closure; moves/destroys whole subtrees & wiring | **GOVERN** · domain admin for the node's L1 (fallback MANAGER) | **ACCEPTED** 2026-07-05 | Node create/edit EXEMPT (DA-19) |
| DA-19 | Create/edit nodes, roles, deliverables, checklists; inspector link wiring | builder create/update; `/inspector/*`; `/admin/roles`, `/admin/deliverables` non-delete | Routine authoring — the graph must stay cheap to maintain | **EXEMPT** (audited) | **ACCEPTED** 2026-07-05 | Approval here = rubber-stamp training |
| DA-20 | Delete a role / deliverable / application | `DELETE /admin/roles/:id`, `/admin/deliverables/:id`, `/admin/applications/:id` | Orphans junctions (NodeRole, RoleDeliverable…) | **OPTIONAL** · MANAGER | **ACCEPTED** 2026-07-05 | |
| DA-21 | Create/update/delete a Standard | `POST/PATCH/DELETE /admin/standards*` | Standards are enterprise policy; each has an owner role (CTO, CISO…) | **GOVERN** · seat = the standard's **owner role** | **ACCEPTED** 2026-07-05 | Approver comes from the entity itself — good pattern test |
| DA-22 | Edit an SDLC skill pack file | `PUT /standards-skills/:skill/file` | Hand-authored governance content consumed by tooling | **GOVERN** · owner role of the pack's standard (fallback CTO seat) | **ACCEPTED** 2026-07-05 | |
| DA-23 | Regulation writes: requirement CRUD + value-stream / role-set replacement | `POST/PATCH /regulations/requirements*`, `PUT .../value-streams`, `PUT .../role-sets`, `DELETE /regulations/*` | Compliance obligations; the PUTs are replace-all (destructive) | **GOVERN** · compliance role seat (CRO/CCO operating role) | **ACCEPTED** 2026-07-05 | Replace-all endpoints are the priority |
| DA-24 | Onboard a new application | `POST /admin/applications` | New tech enters the estate | **OPTIONAL** · MANAGER — **except AI (DA-24a)** | **ACCEPTED** 2026-07-05 | |
| DA-24a | **Onboard an AI technology** (the AI Council case) | Application create/update with `isAiTechnology` flag (new field) | Legal, security, architectural, sourcing exposure | **GOVERN** · **ALL_OF panel**: Legal counsel + ISO Security Architect + Enterprise Architect + Sourcing Lead | **ACCEPTED** 2026-07-05 | **Parallel, single stage** (all four asked at once, any order; any rejection terminates); panel seats resolve via operating roles + `isApprover` |

## D. Work library, data admin, misc.

| ID | Decision / change | Trigger endpoints | Risk | Recommended policy | Disposition | Notes |
|----|-------------------|-------------------|------|--------------------|-------------|-------|
| DA-25 | Work template create/delete | `POST/DELETE /work-library/templates*` | Templates shape checklist/testing practice broadly | **OPTIONAL** · MANAGER | **ACCEPTED** 2026-07-05 | Key edits, reordering, plan answers EXEMPT |
| DA-26 | Delete org units / level types (generic admin) | `DELETE /admin/:entity/:id` for structural entities | Org spine surgery; closure cascades | **GOVERN** · domain admin (fallback second SITE_ADMIN) | **ACCEPTED** 2026-07-05 | Non-structural admin entities OPTIONAL |
| DA-27 | Scaffold a rationalization initiative | `POST /rationalization/initiatives` | Seeds workspace + stages + components in bulk | **OPTIONAL** · MANAGER | **ACCEPTED** 2026-07-05 | |
| DA-28 | Self-service & telemetry | `/me/preferences*`, `POST /feedback` | Personal scope only | **EXEMPT** | **ACCEPTED** 2026-07-05 | Listed for completeness |

---

## Summary of recommendations

| Tier | Rows | Character |
|---|---|---|
| GOVERN (on by default) | DA-01, 02, 03, 05, 06, 08, 09, 10, 11, 12, 14, 18, 21, 22, 23, 24a, 26 (17) | Security/RBAC, deletes with cascade, financial baseline & gates, governance content, AI onboarding |
| OPTIONAL (built, off) | DA-13, 15, 16, 17, 20, 24, 25, 27 (8) | Sensitive-sometimes; tenant arms per appetite |
| EXEMPT | DA-04, 07, 19, 28 (4 groups) | High-frequency authoring & machine writes — approval would degrade into rubber-stamping |

**Suggested pilot subset (Phase 1):** DA-11 + DA-12 (portfolio gates — consolidates the two existing ad-hoc approval states) and DA-01 + DA-03 (RBAC four-eyes). Exercises both approver models (role seat + manager/second-admin) on day one.
