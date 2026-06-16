# Cascade — Technical Documentation

## Architecture

```
┌─────────────────────────┐     HTTPS / JSON      ┌─────────────────────────────┐
│  Frontend (Vite + React)│ ─────────────────────▶│   Express API (Node.js)     │
│   - React Router        │                       │   - JWT auth middleware     │
│   - Tailwind            │                       │   - Tenant scoping          │
│   - Recharts            │                       │   - Zod request validation  │
└─────────────────────────┘                       └──────────────┬──────────────┘
                                                                 │
                                  ┌──────────────────────────────┼──────────────────────────────┐
                                  │                              │                              │
                          ┌───────▼───────┐            ┌─────────▼────────┐          ┌──────────▼─────────┐
                          │  Roll-up svc  │            │  Workflow svc    │          │  Rules engine      │
                          │  (financials) │            │  (stage gate)    │          │  (event-driven)    │
                          └───────┬───────┘            └─────────┬────────┘          └──────────┬─────────┘
                                  │                              │                              │
                                  └──────────────────────────────┼──────────────────────────────┘
                                                                 │
                                                          ┌──────▼──────┐
                                                          │  Prisma ORM │
                                                          └──────┬──────┘
                                                                 │
                                                          ┌──────▼──────┐
                                                          │   SQLite    │
                                                          │   (dev)     │
                                                          └─────────────┘
```

For production, swap the `provider = "sqlite"` line in `prisma/schema.prisma` for `"postgresql"` and update `DATABASE_URL`. No application code changes are required.

## Data model overview

```
Tenant ─┬─< User
        ├─< Program ─< Workstream ─< Initiative ─┬─< BenefitLine ─< MetricValue
        │                                        ├─< CostLine    ─< MetricValue
        │                                        ├─< Milestone
        │                                        ├─< RaidItem
        │                                        ├─< InitiativeObjective >─ StrategicObjective
        │                                        └─< InitiativeKpi >─ Kpi
        ├─< StrategicObjective ─< Kpi
        ├─< Resource
        ├─< Notification
        ├─< AuditEntry
        └─< BusinessRule
```

Key choices:

- **Sparse FK on MetricValue.** Each metric value belongs to either a `BenefitLine` or a `CostLine`, never both. We model this with two nullable FKs and indexes on each combination of `(lineId, dataset, periodStart)`. This keeps the time-phased data in a single table for unified aggregation queries.
- **Denormalized rollups on Initiative.** `cumulativeBenefit`, `cumulativeCost`, `cumulativeNetBenefit`, and `valueScore` are stored on the Initiative row for fast list reads. They're recomputed by `services/rollup.js#recomputeInitiative` whenever benefits, costs, or objective links change.
- **Program-level summary is computed at read time.** No denormalization above the Initiative level — the read path through `summarizeProgram()` is cheap enough at MVP scale.
- **Tenant scoping via relations.** Programs have `tenantId` directly. Workstreams, Initiatives, and their children scope through their parent's `tenantId`. Every list query in the routes filters via `where: { workstream: { program: { tenantId } } }` (or similar). Helper functions `tenantInitiative()` and `tenantWorkstream()` centralize this in route handlers.

## Service modules

### `services/rollup.js`
- `recomputeInitiative(id)` — sums ACTUAL + future-FORECAST metric values; computes value score from objective links; persists denormalized totals.
- `summarizeProgram(id)` — read-time aggregation of all initiatives under a program, returning totals and stage/status distributions.

### `services/workflow.js`
Single function `applyWorkflowAction({initiativeId, action, actor})` that handles all three actions (SUBMIT, APPROVE, MOVE_BACK). Computes the new stage, derives the new state from `STAGE_TO_STATE` map, fires notifications, writes audit entries, and triggers `ON_FIELD_CHANGE` rules on the `stage` field.

### `services/rulesEngine.js`
- `runRulesForEntity({tenantId, entityType, trigger, fieldName?, fieldValue?, entity, actor})` — looks up matching rules and executes them.
- `executeAction({rule, cfg, entity, actor, tenantId})` — implements SET_VALUE, NOTIFY, RUN_RULE.
- `interpolate(template, entity)` — replaces `{!fieldName}` tokens.

### `services/okr.js`
- `recomputeKpi(id)` — applies the direction-aware achievement formula.
- `recomputeObjective(id)` — recursive: recomputes children first, then composites KPI weighted average with child average.

### `services/audit.js`
- `logAudit({tenantId, actorEmail, entityType, entityId, action, diff?})` — fire-and-forget logger; failures only log to console so a broken audit never breaks the user's transaction.

### `services/notifications.js`
- `sendNotification(...)`, `listForUser(userId)`, `markRead(id, userId)`.

## API surface

All routes are JSON, prefixed with `/api`, and require `Authorization: Bearer <token>` except `/api/auth/login` and `/api/health`.

```
POST   /api/auth/login                       → {token, user}
GET    /api/auth/me                          → user

GET    /api/programs                         → Program[]
GET    /api/programs/:id                     → Program (deep)
GET    /api/programs/:id/summary             → aggregate
POST   /api/programs                         → Program
PATCH  /api/programs/:id
DELETE /api/programs/:id

GET    /api/workstreams/:id                  → Workstream (deep)
POST   /api/workstreams
PATCH  /api/workstreams/:id
DELETE /api/workstreams/:id

GET    /api/initiatives                      → Initiative[]   (?programId, ?workstreamId, ?stage, ?status)
GET    /api/initiatives/:id                  → Initiative (deep)
POST   /api/initiatives
PATCH  /api/initiatives/:id
DELETE /api/initiatives/:id
POST   /api/initiatives/:id/workflow         {action: SUBMIT|APPROVE|MOVE_BACK}
POST   /api/initiatives/:id/recompute
POST   /api/initiatives/:id/milestones
PATCH  /api/initiatives/milestones/:milestoneId
DELETE /api/initiatives/milestones/:milestoneId
POST   /api/initiatives/:id/objectives       {objectiveId, impact}
DELETE /api/initiatives/:id/objectives/:objectiveId

POST   /api/benefits-costs/lines             {type, initiativeId, name, category?, startDate, endDate}
DELETE /api/benefits-costs/lines/:type/:id
GET    /api/benefits-costs/lines/:type/:id/values
POST   /api/benefits-costs/values            {type, lineId, dataset, values: [{periodStart, amount}]}

GET    /api/raid                             → RaidItem[]    (?programId, ?initiativeId, ?type, ?status)
POST   /api/raid
PATCH  /api/raid/:id
DELETE /api/raid/:id

GET    /api/okr/objectives
GET    /api/okr/objectives/:id
POST   /api/okr/objectives
PATCH  /api/okr/objectives/:id
DELETE /api/okr/objectives/:id
POST   /api/okr/objectives/:id/recompute
GET    /api/okr/kpis                         (?objectiveId)
POST   /api/okr/kpis
PATCH  /api/okr/kpis/:id
DELETE /api/okr/kpis/:id

GET    /api/dashboard/portfolio              → executive snapshot

GET    /api/notifications                    → my notifications
POST   /api/notifications/:id/read

GET    /api/audit                            → audit entries (?entityType, ?entityId, ?limit)

GET    /api/rules
POST   /api/rules                            (ADMIN/MANAGER)
PATCH  /api/rules/:id                        (ADMIN/MANAGER)
DELETE /api/rules/:id                        (ADMIN/MANAGER)
```

## Workflow state machine

```
                ┌─────┐  SUBMIT   ┌───────────┐  APPROVE   ┌─────┐
   IDEA ──────▶ │ ... │ ────────▶ │ Pending   │ ─────────▶ │ ... │  (next stage)
                └─────┘            │ Approval  │            └─────┘
                  ▲                └───────────┘
                  │  MOVE_BACK ◀──────────────────┐
                  └────────────────────────────────┘
```

Stage → State mapping enforced in `workflow.js`:

```
IDEA       → PLANNING
PLAN       → PLANNING
EXECUTE    → ACTIVE
REALIZE    → ACTIVE
COMPLETE   → DONE
```

## Roll-up algorithm

For an Initiative with N benefit lines and M cost lines:

```
cumulativeBenefit = Σ (over all benefit lines) Σ (over their MetricValues v)
                       v.amount IF (v.dataset == ACTUAL)
                       OR (v.dataset == FORECAST AND v.periodStart > today)

cumulativeCost    = same, on cost lines

cumulativeNetBenefit = cumulativeBenefit − cumulativeCost

valueScore = Σ (over InitiativeObjective links) impactWeight[link.impact]
             where impactWeight = { LOW: 1, MEDIUM: 2, HIGH: 3 }
```

All four are persisted on the Initiative row so list queries don't trigger N+1 sums.

## Multi-tenancy

Tenant isolation is enforced in the API layer, not the database layer:
- Every list endpoint filters by `tenantId` in the `where` clause.
- Every detail endpoint either filters directly or via the parent relation chain.
- Helper functions `tenantInitiative()` and `tenantWorkstream()` are used in routes to centralize the lookup and return 404 (not 403) when a tenant tries to access another tenant's data — consistent with not leaking existence information.

For production, layer Postgres Row Level Security on top by adding a session variable for `tenant_id` and `CREATE POLICY` clauses per table — Prisma supports this via raw SQL setup queries. The application code stays unchanged.

## Scaling considerations

| Concern | MVP approach | Production approach |
|---|---|---|
| DB | SQLite | PostgreSQL with read replicas |
| Time-phased values | Single `MetricValue` table | Partition by `periodStart` quarter; consider columnar (ClickHouse) for >10M rows |
| Auth | JWT with shared secret | Rotate per env; add SAML SSO; add session revocation list |
| Audit log | Same DB | Separate write-optimized store (e.g., Postgres logical replication to event-store) |
| Roll-ups | Synchronous on save | Move to event-driven via outbox pattern |
| Notifications | In-app only | Add SES/Postmark for email; add web push |
| File uploads | Not implemented | S3-backed with presigned URLs; virus scan |

## Sandbox build notes

During this initial build the Prisma engine binaries (`binaries.prisma.sh`) are blocked at the network layer in some sandbox environments, returning `403 Forbidden` on `prisma generate`. Run the setup commands on a normal developer machine; they work everywhere `binaries.prisma.sh` is reachable. The Prisma schema and all application code are syntactically valid and the frontend builds cleanly (verified with `npm run build`).
