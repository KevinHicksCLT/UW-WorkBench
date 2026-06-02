---
name: project-v3-plan
description: Product Plan v3 tag-mapping audit, schema extension decisions, and API contract for the drillable hierarchy + tagged pieces model
metadata:
  type: project
---

## Product Plan v3 — Confirmed Tag Mapping (sheet → column → target field)

### Confirmed present and seeded
| Tag | Sheet | Column | Target field | Notes |
|-----|-------|--------|--------------|-------|
| higherCategory (Core Business / IT / Corporate Function) | Org Chart View 2 | col[0] "Higher-Level Category" | Division.higherCategory | Already seeded |
| Division name | Org Chart View 2 / Org Chart View | col[1] | Division.name | Already seeded |
| Department | Org Chart View 2 / Org Chart View | col[2] | Department.name | Already seeded |
| roleFamily | Value Streams col[4], Extended Role Inventory col[1] | "Role Family" | Role.roleFamily | Partially seeded (many null) |
| roleLevel | Extended Role Inventory col[2] | "Role Level" | Role.roleLevel | In schema, partially seeded |
| participation type | Value Streams col[5] "Participation Type" | "Lead/Core/Support/Control/Oversight" | RoleValueStream.participationType | Seeded |
| subStream (compound "L3 — L4") | Value Streams col[2] "Sub-Stream" | compound string | RoleValueStream.subStream | Seeded |
| primaryDomain | Extended Role Inventory col[3] "Primary Value Stream Domain" | Role.primaryDomain | Seeded |
| primaryValueStream | Extended Role Inventory col[4] "Primary Value Stream" | Role.primaryValueStream | Seeded |
| managerRoleName → managerRoleId | Role Hierarchy Map col[0] Manager, col[2] Report | Role.managerRoleId | In schema; self-relation already exists |
| matrixRoles | Extended Role Inventory col[6] "Matrix/Project Reports To" | Role.matrixRoles field (raw string) | In schema as string; no matrix relation model exists |
| ownerRole (KPI) | Value Stream Metrics col[10] "Owner Role" | Metric.ownerRole (raw string) | In schema as string |
| measurementLevel | Value Stream Metrics col[8] "Measurement Level" | Metric.measurementLevel | In schema |
| valueStream link to metric | Value Stream Metrics col[1] | Metric.valueStreamId | In schema |

### Application TCO — CONFIRMED PRESENT in v15
Sheet: "Application TCO" (row 2 = header, rows 3-8 = 6 real applications)
Columns: Application | Ownership Model | Primary Division | Linked Value Stream | License / Subscription | Internal Labor | Vendor Services | Infrastructure / Platform | Depreciation / Amortization | Allocated Overhead | Total Annual TCO

6 real applications with full TCO breakdown:
- Claims Management Platform (Hybrid / Claims / $985,000 TCO)
- Policy Administration Platform (In-house / Operations & Customer Service / $1,245,000)
- Finance ERP (Hybrid / Finance & Investments / $985,000)
- IAM Platform (SaaS / Cybersecurity & IAM / $705,000)
- Data Analytics Platform (Hybrid / Data & AI / $815,000)
- Broker / Distribution Portal (SaaS / Sales, Distribution & Marketing / $600,000)

Ownership Model values: "Hybrid" | "In-house" | "SaaS"
The 29 existing Application records are ALL illustrative (illustrative=true). The 6 TCO records are REAL (from the sheet). They should be seeded with illustrative=false and proper TCO fields.

### Financial Driver Map — CONFIRMED PRESENT (illustrative linkage model)
Sheet: "Financial Driver Map" (10 rows + header). Maps roles/teams/apps/external spend/processes/value streams to finance categories and cost drivers. This is a mapping reference, not a row-grain entity. It does NOT add per-app TCO beyond what Application TCO provides. No new seeding needed from this sheet; it provides context for the CEO financial lens but is not a DB entity.

### What is NOT in the v15 data
1. **Category hierarchy ABOVE Division is NOT a separate entity.** The plan's "Category" level = the higherCategory field on Division ("Core Business" | "IT" | "Corporate Function"). There is no separate Category table; the three values are a property of Division. Do NOT create a Category model.
2. **No per-sub-value-stream application tags.** Application TCO sheet links apps to value streams (L2 level). No sub-value-stream (L3/L4) app tags exist in v15.
3. **No explicit KPI ownerRoleId FK.** Metric.ownerRole is a raw string (role name), not a FK. A role lookup by name can resolve it at query time, but no migration adds a FK column — the string column is the grain.
4. **Matrix edges**: matrixRoles stored as a raw string on Role ("Project Manager, Scrum Master"). There is no separate MatrixLink relation model. The Role Hierarchy Map col[6] "Project/Matrix Roles" provides the same data as a string. No separate matrix junction table exists in v15.
5. **No categoryId or divisionId tags on people/roles other than what's already in the schema.** People → Roles → Division → higherCategory is the chain; no direct person-to-category tag column.

## Schema Extensions Needed

### Application model — add TCO fields + real data marker
New fields on Application:
- ownershipModel: String? ("Hybrid" | "In-house" | "SaaS" | "Vendor")  
- primaryDivisionName: String? (raw string from TCO sheet; links to Division by name)
- linkedValueStreamName: String? (raw string for join)
- licenseCost: Float? (License / Subscription)
- laborCost: Float? (Internal Labor)
- vendorServicesCost: Float? (Vendor Services)
- infraCost: Float? (Infrastructure / Platform)
- depreciationCost: Float? (Depreciation / Amortization)
- overheadCost: Float? (Allocated Overhead)
- totalTco: Float? (Total Annual TCO)

The 6 real apps from the TCO sheet get illustrative=false. The 29 illustrative apps remain illustrative=true.

### Role model — NO new fields needed
roleFamily, roleLevel, managerRoleId, primaryDomain, primaryValueStream already exist in schema. matrixRoles already stored as a string. All present.

### RoleValueStream — NO new fields needed
participationType already exists. subStream already exists.

### Metric — NO new fields needed
measurementLevel, ownerRole already in schema.

### SubValueStream application tags — CANNOT BUILD
No v15 data supports L3/L4-grain app tags. ApplicationValueStream links at ValueStream (L2) level only.

## API Contract — exact shapes for UI team

### 1. Sub-stream pieces (tagged people + apps at a sub-value-stream)
GET /explorer/node/subValueStream/:id

Top-level:
- roleLinkCount: number — RVS rows mapped to this L3/L4
- hasOwner: boolean — false = accountability gap

lenses.who.rolesInvolved: [{ id, name, subtitle }]
lenses.who.byParticipation: { Lead: [{id, name}], Core: [...], Support: [...], Control/Oversight: [...] }  (NEW — group roles by participationType)
lenses.where: {} — (no app tags at sub-stream level; apps come from parent value stream)

children.items: flowItems (sub-processes or steps) + roleItems (roles involved)

### 2. Per-level rollups
Each level returns headcount breakdown by employment type + region, application count + TCO, KPI attainment — aggregated from all pieces tagged at or below.

GET /explorer/node/company/:id → lenses.who.headcount (total/badged/contractor/si_partner), lenses.where.systems (count + byKind), new: lenses.where.totalTco (sum of real app TCO)
GET /explorer/node/domain/:id → same breakdowns for apps/roles in that domain's value streams
GET /explorer/node/valueStream/:id → role headcount + app TCO (from ApplicationValueStream records)
GET /explorer/node/division/:id → headcount + app TCO for apps whose primaryDivisionName matches division

### 3. Application detail — with TCO
GET /explorer/node/application/:id
lenses.where: { kind, ownershipModel, vendor, criticality, valueStreams, internal, external }
lenses.what: { category, tco: { license, labor, vendorServices, infra, depreciation, overhead, total }, illustrative }
lenses.who: roles[]
children: roleItems + connected app items

### 4. Role / Person detail (already exists — confirm fields)
GET /explorer/node/role/:id — already has: division, department, manager, directReports, categories, roleTasks, kpisOwned, valueStreams, applications
NEW additions: roleFamily, roleLevel in the role subtitle / lenses.who

GET /explorer/node/person/:id — already has full person detail (illustrative)

### 5. Org chart edges (reports-to tree)
The Role Hierarchy Map data is already seeded into Role.managerRoleId (self-relation).
Existing nodeRole() already returns: manager (reports-to) + reports (direct reports) in lenses.who and children.

No new /orgchart endpoint needed — the existing drill-down node API already serves the tree. If a dedicated flat tree endpoint is useful for the UI force-directed chart, add:
GET /org/tree → { nodes: [{id, name, roleLevel, divisionId, managerRoleId}], edges: [{from, to}] }

Matrix edges: Role.matrixRoles is a raw string — cannot serve structured matrix edges from it without fuzzy name matching. Report this gap.

## Why: decision log
- "Category" level not a new entity: v15 has no Category table; higherCategory is a Division property. Building a Category model would be inventing an entity.
- Application TCO data IS real (6 apps): should be seeded with illustrative=false and TCO fields added to schema.
- Matrix FK not buildable: matrixRoles is a raw string in the sheet; no FK resolution possible without risking data invention.
- Sub-stream app tags not buildable: no v15 data at that grain.

**How to apply:** When implementing v3 backend, add TCO fields to Application, seed 6 real apps, update nodeApplication() to expose TCO breakdown, add lenses.where.totalTco rollup at company/domain/valueStream nodes. Everything else is already in schema.
