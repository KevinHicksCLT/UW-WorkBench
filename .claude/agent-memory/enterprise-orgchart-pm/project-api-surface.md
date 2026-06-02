---
name: project-api-surface
description: Explorer API endpoints and shapes available for the UI team — updated for v3 (TCO, byParticipation, roleFamily/roleLevel, org/tree)
metadata:
  type: project
---

## Explorer API Surface (v3 — post-TCO implementation, 2026-06-01)

All endpoints require `Authorization: Bearer <token>` (JWT from POST /auth/login).

### Authentication

```
POST /auth/login  { email, password }
→ { token, user: { id, name, email, role } }
```

Demo credentials: `demo@strata.io` / `demo1234`

### Overview (sidebar index)

```
GET /explorer/overview
→ {
    company: { id, name },
    counts: { domains, divisions, valueStreams },
    domains: [{ id, name, valueStreams: number }],
    divisions: [{ id, name, higherCategory, roles: number }]
  }
```

`higherCategory` values: `"Core Business"` | `"IT"` | `"Corporate Function"`

### Unified drill node

```
GET /explorer/node/:type/:id[?cursor=<id>]
→ { type, id, name, subtitle, illustrative, lenses: {...}, children: { childType, total, nextCursor, items } }
```

#### Node types and their children

| type | children | key lenses |
|------|----------|-----------|
| `company` | `domain` (6) | divsByGroup, capabilityOverlaps, where.realAppCount/totalRealTco/tcoByBucket (NEW v3) |
| `domain` | `valueStream` | KPIs, apps, process steps |
| `valueStream` | `subValueStream` (L3) + `application` | where.tco (NEW v3): total + byBucket for real apps |
| `subValueStream` L3/L4 | L4s + `role` | who.byParticipation (NEW v3): Lead/Core/Support/Control/Oversight |
| `division` | `department` | where.tco (NEW v3): total + byBucket + apps via primaryDivisionName match |
| `role` | `role` (reports) + `person` | who.roleFamily + who.roleLevel (NEW v3) |
| `application` | `role` + `application` | what.tco (NEW v3): 6-bucket breakdown, illustrative flag |
| `department` | `role` | headcount, value streams |
| `processStep` | (none) | leads, supporting, inputs, outputs |
| `person` | `task` | assignments, metrics (illustrative) |
| `initiative` | `person` | health, value streams, risks (all illustrative) |
| `task` | (none) | status, priority (illustrative) |

### Company node special fields

`divsByGroup`: three-bucket CEO org view
```json
{
  "Core Business": [{ "id", "name", "roles" }],   // 6 divisions
  "IT": [{ "id", "name", "roles" }],               // 4 divisions
  "Corporate Function": [{ "id", "name", "roles" }] // 4 divisions
}
```

`capabilityOverlaps`: Gap 1 — cross-division capability overlap signal
```json
[{ "capability": "Engineering", "count": 5, "divisions": [{ "id", "name" }] }]
```

`lenses.where` (v3 additions):
```json
{
  "systems": 35,
  "byKind": [...],
  "realAppCount": 6,
  "totalRealTco": 5335000,
  "tcoByBucket": {
    "license": 1660000, "labor": 1620000, "vendorServices": 870000,
    "infra": 690000, "depreciation": 270000, "overhead": 225000
  }
}
```

### ValueStream node — TCO rollup (v3)

`lenses.where.tco`: aggregated from real apps (illustrative=false) linked to this value stream via ApplicationValueStream. `null` if no real app is linked.
```json
{ "total": 985000, "byBucket": { "license": 210000, "labor": 340000, "vendorServices": 180000, "infra": 145000, "depreciation": 60000, "overhead": 50000 } }
```

### Division node — TCO rollup (v3)

`lenses.where.tco`: apps where `primaryDivisionName == division.name`. `null` if no real app is tagged to this division.
```json
{ "total": 985000, "byBucket": {...}, "apps": [{ "id", "name", "ownershipModel", "totalTco" }] }
```

### SubValueStream node — byParticipation (v3)

`lenses.who.byParticipation`: roles grouped by participationType from RoleValueStream for this sub-stream.
```json
{ "Lead": [], "Core": [{ "id", "name" }], "Support": [], "Control": [], "Oversight": [] }
```

### Role node — roleFamily + roleLevel (v3)

`lenses.who.roleFamily`: from Extended Role Inventory (v15). Null for org-roster roles not in that sheet.
`lenses.who.roleLevel`: "Executive" | "Leadership" | "Manager" | "Individual Contributor" | null.

### Application node — TCO (v3)

`lenses.what.tco`: full 6-bucket breakdown for real apps (illustrative=false). `null` for illustrative apps.
```json
{ "license": 210000, "labor": 340000, "vendorServices": 180000, "infra": 145000, "depreciation": 60000, "overhead": 50000, "total": 985000, "illustrative": false }
```
`lenses.where.ownershipModel`: "Hybrid" | "In-house" | "SaaS" | null (real apps only).
`subtitle` now includes ownership model: `"Core · Hybrid ownership · High criticality"`.

### Org tree endpoint (v3)

```
GET /explorer/org/tree
→ {
    nodes: [{ id, name, roleLevel, divisionId, managerRoleId }],  // 244 nodes
    edges: [{ from, to, type: "reports-to" }]                     // 90 edges
  }
```
Note: matrixRoles is a raw string on Role (no FK) — cannot serve structured matrix edges. Clients should treat it as a label on the node only.

### Real Applications (v3 seed)

6 real apps from IT_Roles_Analytics_v15.xlsx "Application TCO" sheet (illustrative=false):
| App | ownershipModel | primaryDivisionName | totalTco |
|-----|---------------|---------------------|----------|
| Claims Management Platform | Hybrid | Claims | $985,000 |
| Policy Administration Platform | In-house | Operations & Customer Service | $1,245,000 |
| Finance ERP | Hybrid | Finance & Investments | $985,000 |
| IAM Platform | SaaS | Cybersecurity & IAM | $705,000 |
| Data Analytics Platform | Hybrid | Data & AI | $815,000 |
| Broker / Distribution Portal | SaaS | Sales, Distribution & Marketing | $600,000 |

Company-level totalRealTco = $5,335,000.

### Gap signals

**Gap 1 — capability overlaps**: `company.capabilityOverlaps` — role families in 2+ divisions.
**Gap 2 — ownership gaps**: `subValueStream.hasOwner=false` + `valueStream.lenses.how.ownershipGaps`. 12 of 104 L3 process areas unowned.

### Counts (DB-verified v3 seed)

- Domains: 6 | Divisions: 14 | Value streams: 26
- Sub-value streams: 104 (L3+L4) | Process steps: 256 | Metrics/KPIs: 243
- Roles: 244 (90 reporting links) | Applications: 35 (29 illustrative + 6 real)
- People: 730 (illustrative) | Initiatives: 6 (illustrative) | Risks: 31

### Other endpoints

```
GET /explorer/node/:type/:id/children   → children array only
GET /explorer/initiatives/:id/contributors[?employmentType=&region=]
GET /value-streams | /companies | /divisions | /departments | /search?q=&limit=
```

### Illustrative data badge

`illustrative: true` on: Application (29 of 35), ApplicationValueStream (illustrative ones), Initiative, InitiativeValueStream, InitiativeDivision, Person, Assignment, PersonTask, PersonMetric, Risk.
