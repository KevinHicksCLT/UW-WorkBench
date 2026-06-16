# Cascade — Functional Specification

This document describes the functional behavior of the Cascade Enterprise Transformation platform, organized by module. It is intended for product, business analyst, and QA audiences.

## 1. Identity & Tenancy

**Purpose.** Multi-tenant SaaS with logical isolation. Each tenant is an enterprise. Users belong to exactly one tenant.

**Roles.** ADMIN, MANAGER, MEMBER, VIEWER. Role checks are enforced at the API layer.

| Capability | ADMIN | MANAGER | MEMBER | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Read all data within tenant | ✅ | ✅ | ✅ | ✅ |
| Create/edit programs, workstreams, initiatives | ✅ | ✅ | ✅ |  |
| Approve workflow transitions | ✅ | ✅ |  |  |
| Manage business rules | ✅ | ✅ |  |  |
| Manage users (future) | ✅ |  |  |  |

**Authentication.** Email + password (bcrypt) → JWT bearer token, 7-day expiry. Token returned on `/api/auth/login`; included as `Authorization: Bearer <token>` on every subsequent call.

## 2. Programs

**Definition.** A Program is a top-level transformation effort with a defined start and end, a status (On Track / At Risk / Off Track), and one or more Workstreams.

**Key user stories.**
- As a transformation lead, I create a Program for "Digital Operations Transformation" so I can group related workstreams under a single executive narrative.
- As an executive, I see all my Programs on one page with their status pills and total benefit so I know at a glance where attention is needed.

**Screens.** Programs list, Program detail (with Workstreams + Initiatives table).

## 3. Workstreams

**Definition.** A Workstream is a thematic grouping of Initiatives within a Program. Examples: "Finance Transformation", "Supply Chain Digitization", "Customer Experience". Each workstream has its own RAG status separate from the parent Program's status.

**Business rules.**
- Deleting a Workstream cascades to all its Initiatives (and their benefits, costs, milestones, RAID items).
- Workstream status does not auto-roll-up to the Program; a Program owner sets that explicitly so executives can override system signals.

## 4. Initiatives — the heart of the platform

**Definition.** An Initiative is a single discrete change effort with a charter, owner, sponsor, financial profile, milestones, and stage-gate workflow. The Initiative is where 90% of platform usage happens.

**Lifecycle (5-stage workflow).**
```
IDEA → PLAN → EXECUTE → REALIZE → COMPLETE
```
- **IDEA** — captured but not yet planned. State = PLANNING.
- **PLAN** — charter being built. State = PLANNING.
- **EXECUTE** — work in progress. State = ACTIVE; resource demand becomes "live."
- **REALIZE** — go-live complete; benefits being measured. State = ACTIVE.
- **COMPLETE** — closed; all tracking frozen. State = DONE.

**Two-step approval.**
1. Owner clicks **Submit for Approval**. The Initiative's `workflowAction` becomes `SUBMIT`. Sponsor receives a notification.
2. Sponsor clicks **Approve**. Stage advances by one; `workflowAction` clears; Owner is notified; an audit entry of type `STAGE_ADVANCED` is logged.
3. Sponsor (or Admin/Manager) can also click **Move Back** at any time to roll the stage back by one (audit entry `STAGE_REVERTED`).

**Initiative tabs (UI).**
1. **Summary** — description, details (owner, sponsor, dates, state, workstream).
2. **Financials** — Benefits & Costs lines with monthly Actual/Target/Forecast values.
3. **Workplan** — Milestones (with optional `isGate=true` flag for stage-gate milestones).
4. **RAID** — initiative-scoped Risks/Assumptions/Issues/Decisions.
5. **Alignment** — links to Strategic Objectives with Low/Medium/High impact.
6. **Audit** — full history of changes to this initiative.

**Computed fields (denormalized for read performance).**
- `cumulativeBenefit` — sum of ACTUAL benefit metric values + FORECAST values for future periods.
- `cumulativeCost` — same logic on cost lines.
- `cumulativeNetBenefit` = benefit − cost.
- `valueScore` — sum of Low=1, Medium=2, High=3 across all linked Strategic Objectives.

## 5. Time-Phased Value Capture (Metrics + Datasets)

**Definition.** Every BenefitLine and CostLine carries a sparse monthly time series, with each period available in one or more **Datasets**: ACTUAL, TARGET, FORECAST. (Variance is computed at read time as ACTUAL − TARGET.)

**User flow.**
1. Open the Initiative's Financials tab.
2. Click "+ Add Benefit" → name it "Run-rate savings", set category, start, end.
3. Click the row → modal with month-by-month grid for ACTUAL.
4. Toggle to TARGET → enter planned monthly amounts.
5. Save. The Initiative's `cumulativeBenefit` is recomputed automatically; the chart on the same tab refreshes; the parent Program's summary KPI updates.

**Why this matters.** Most PPM tools track "expected savings" as a single number. The transformation use case requires phased monthly tracking with variance against plan — this is the platform's core differentiator.

## 6. RAID Log

**Definition.** Risks, Assumptions, Issues, Decisions — the four canonical entries in a transformation control log.

**Severity model.** `severity = probability × impact`, both on a 1–5 scale. Visual: green (1–8), amber (9–15), red (16–25).

**Cross-portfolio view.** The dedicated `/raid` page shows all RAID items across the tenant with type and status filters and a 5×5 heatmap that counts Risks in each (probability, impact) cell.

## 7. OKRs

**Hierarchy.** Strategic Objective → KPI. Objectives can have parent/child relationships (`parentId`). Initiatives align to Objectives via the `InitiativeObjective` join table with a Low/Medium/High impact rating.

**KPI achievement model.**
- Direction MAX (higher is better): `(currentValue − startingValue) / (targetValue − startingValue)`, clamped to [0, 1].
- Direction MIN (lower is better): inverted formula.
- Each KPI carries a `weight` (default 1.0).

**Objective achievement.** Weighted average of its KPIs' achievements. If the Objective also has child objectives, the child average is composited 50/50 with the KPI weighted average.

## 8. Business Rules Engine

**Triggers.**
- `ON_CREATE` — fired when an entity of `entityType` is created.
- `ON_UPDATE` — fired on any field change.
- `ON_FIELD_CHANGE` — fired only when `fieldName` changes to `fieldValue`.

**Actions.**
- `SET_VALUE` — write a static value into a field on the entity.
- `NOTIFY` — create a notification for a user (resolved via `recipientField` like `sponsorId` or static `userId`); supports `{!fieldName}` interpolation in subject/body.
- `RUN_RULE` — chain to another rule by ID.

**Example shipped with the demo seed.**
> "Notify sponsor on Off Track" — when an Initiative's `status` changes to `OFF_TRACK`, send a notification to the sponsor with subject "Initiative is OFF TRACK: {!name}".

## 9. Notifications

In-app notifications keyed to a user. Stored in `Notification` table; UI badge (future enhancement). Today, view via `GET /api/notifications`.

## 10. Audit Trail

Every CREATE / UPDATE / DELETE / STAGE_ADVANCED / STAGE_REVERTED / SUBMIT_FOR_APPROVAL / EXECUTED (rule fired) action logs a row in `AuditEntry` with actor email, entity type, entity id, and a JSON `diff`. Filterable by entity type or entity id via `/api/audit`.

## 11. Dashboard / Portfolio View

The `/` page is the executive snapshot. It calls `GET /api/dashboard/portfolio` once and renders:
- 4 tiles (Programs, Initiatives, Cumulative Benefit, Net Benefit).
- Stacked area chart of monthly Actual vs Target vs Forecast benefits.
- Bar charts: initiatives by stage, initiatives by status.
- Top 5 open risks by severity.

## Roadmap (out of MVP scope)

- Resource Management (Resource pool, Initiative Resource demand, capacity vs demand chart).
- Scenario Management (S1/S2/S3 overlays).
- Presentations (auto-refreshing slide decks → PDF).
- Interactive Gantt with dependencies.
- File attachments and rich-text discussions.
- Email delivery (notifications are in-app only today).
- SSO (SAML 2.0) and Guest mode.
