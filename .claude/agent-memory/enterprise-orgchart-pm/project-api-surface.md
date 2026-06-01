---
name: project-api-surface
description: Explorer API endpoints and shapes available for the UI team after v15 reconciliation
metadata:
  type: project
---

## Explorer API Surface (post-v15 reconciliation)

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
    domains: [{ id, name, valueStreams: number }],  // 6 consolidated domains
    divisions: [{ id, name, higherCategory, roles: number }]  // NEW: higherCategory field
  }
```

`higherCategory` values: `"Core Business"` | `"IT"` | `"Corporate Function"` — the three CEO-facing top-level buckets.

### Unified drill node

```
GET /explorer/node/:type/:id[?cursor=<id>]
→ { type, id, name, subtitle, illustrative, lenses: {...}, children: { childType, total, nextCursor, items } }
```

`children.items` each have: `{ id, type, name, subtitle?, group?, badges?, flow? }`

#### Node types and their children

| type | children | key lenses |
|------|----------|-----------|
| `company` | `domain` (6) | `divsByGroup` (NEW: Core Business/IT/Corporate Function groupings), who/what/how/where/why/howWell |
| `domain` | `valueStream` | KPIs, apps, process steps |
| `valueStream` | `subValueStream` (L3) + `application` | who (roles), how (process areas/steps), where (apps) |
| `subValueStream` L3 | `subValueStream` (L4) + `role` | inputs/outputs, upstream/downstream |
| `subValueStream` L4 | `processStep` + `role` | I/O counts |
| `processStep` | (none) | leads, supporting, inputs, outputs |
| `division` | `department` | higherCategory (NEW), headcount, value streams, controls |
| `department` | `role` | headcount, value streams |
| `role` | `role` (reports) + `person` | categories (40 in v15), roleTasks count, value streams |
| `person` | `task` | assignments, metrics (illustrative) |
| `initiative` | `person` | health, value streams, risks (all illustrative) |
| `application` | `role` + `application` | TCO, system role, value streams (illustrative) |
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

`capabilityOverlaps`: **Gap 1 — cross-division capability overlap signal** (added 2026-06-01)
Derived from `Role.roleFamily`. Returns families that appear in 2+ divisions. 157/244 roles have null roleFamily and are excluded (they have unique names, not a family tag).
```json
[
  { "capability": "Engineering", "count": 5, "divisions": [{ "id", "name" }, ...] },
  { "capability": "Operations & Service", "count": 3, "divisions": [...] },
  { "capability": "Product & Distribution", "count": 2, "divisions": [...] },
  { "capability": "Delivery", "count": 2, "divisions": [...] },
  { "capability": "Corporate Services", "count": 2, "divisions": [...] }
]
```
Sorted by `count` desc. Currently 5 overlapping families across 14 divisions.

### ValueStream node — Gap 2 fields (added 2026-06-01)

`lenses.how.ownershipGaps`: integer count of L3 process areas in this value stream that have zero role links (accountability gap / loss signal).

`children.items` for `subValueStream` type now include:
- `roleLinkCount: number` — count of `RoleValueStream` rows whose `subStream` starts with `"L3Name — "` (for L3 nodes)
- `hasOwner: boolean` — `false` when `roleLinkCount === 0` (the accountability gap flag)

### SubValueStream node — Gap 2 fields (added 2026-06-01)

Top-level fields on the node response itself:
- `roleLinkCount: number` — same computation as above, directly on the drilled node
- `hasOwner: boolean` — `false` = no roles mapped = accountability gap

**Join key note**: `RoleValueStream.subStream` stores compound strings `"L3Name — L4Name"`. Match L3 nodes via prefix `l3.name + ' — '`; match L4 nodes via exact string `"l3parent.name — l4.name"`. Do NOT try to join on `SubValueStream.id` — there is no FK.

**Current gap counts** (v15 data, verified 2026-06-01):
- 12 of 104 L3 process areas have `hasOwner=false`
- Affected value streams: Billing/Collections (2), Delegated Authority Mgmt (3), Change Mgmt & Adoption (1), Investment & Asset Mgmt (1), Third-Party & Vendor Mgmt (2), Audit & Assurance (2), Claims Recoveries & Subrogation (1)

### Counts (DB-verified as of v15 seed)

- Domains: 6 (consolidated from 13 raw)
- Divisions: 14 (all with higherCategory)
- Value streams: 26 (canonical names)
- Sub-value streams: 104 (L3 + L4)
- Process steps: 256 (all linked via PROCESS_VS_MAP)
- Metrics/KPIs: 243 (real definitions + illustrative readings)
- I/O items: 835
- Checklist items: 4743
- Role tasks: 4743
- Categories: 40 (normalized from 42 raw)
- Roles: 244 (159 org-chart + 84 extended + 1 auto-added from value stream refs)
- Applications: 29 (illustrative)
- People: 730 (illustrative)

### Other endpoints

```
GET /explorer/node/:type/:id/children   → children array only
GET /explorer/initiatives/:id/contributors[?employmentType=&region=]
GET /value-streams    → array of value streams
GET /companies        → array of companies
GET /divisions        → list (requires auth)
GET /departments      → list (requires auth)
GET /search?q=&limit= → [{ type, id, name, sublabel, href }]
```

### Illustrative data badge

`illustrative: true` on: Application, ApplicationValueStream, Initiative, InitiativeValueStream, InitiativeDivision, Person, Assignment, PersonTask, PersonMetric, Risk. These are synthesized and badge in the UI with "Illustrative".
