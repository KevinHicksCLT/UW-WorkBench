---
name: project-spreadsheet-inventory
description: Complete sheet inventory for IT_Roles_Analytics_v15.xlsx — grain, columns, and which entity each feeds
metadata:
  type: project
---

## IT_Roles_Analytics_v15.xlsx — Sheet Inventory

### Structural / Data Sheets (feed the DB)

| Sheet | Rows | Grain | Key Columns | Feeds |
|-------|------|-------|-------------|-------|
| Org Chart View | 159 | 1 row/role | Division, Department/Team, Role, Source Sheet, Item Role | Division, Department, Role |
| Org Chart View 2 | 159 | 1 row/role | Higher-Level Category, Division, Department/Team, Role, Item Role, Task Count | higherCategory (Core Business/IT/Corporate Function) |
| Extended Role Inventory | 84 | 1 row/extended role | Role, Role Family, Role Level, Primary VS Domain, Primary VS, Reports To, Description | Role (extended roles) |
| Role Hierarchy Map | 90 | 1 row/report relationship | Manager Role, Direct Report Role, Report Level, VS Domain, Primary VS | Role.managerRoleId |
| Value Streams | 329 | 1 row/role×substream | VS Domain, L2 VS, Sub-Stream, Role, Role Family, Participation Type, Inputs/Outputs | RoleValueStream |
| Sub-Value Streams | 104 | 1 row/L4 sub-process | VS Domain, L2 VS, L3 Process Area, L4 Sub-Process, Key Roles, Inputs/Outputs | SubValueStream (L3 and L4) |
| Value Stream Metrics | 243 | 1 row/KPI | VS Domain, L2 VS, L3, Category, Name, Description, Formula, Target, Owner | Metric |
| E2E Process Flows | 256 | 1 row/step | VS Domain, L2 VS, L3, L4, Step#, Name, Leads, Supporting, Inputs/Outputs | ProcessStep (needs PROCESS_VS_MAP for name reconciliation) |
| Inputs & Outputs Inventory | 835 | 1 row/IO item | VS Domain, L2 VS, L3, L4, Type, Name, Key Roles, Data Elements | IoItem |
| Items | 4743 | 1 row/checklist item | Role, Role Family, Role-Checklist, Category, Canonical, Item | ChecklistItem |
| Aligned Role Tasks | 4743 | 1 row/task | Division, Dept, Role, Source Sheet, Item Role, Category, Canonical | RoleTask (org-context version of Items) |
| External Interactions | 27 | 1 row/external party | Party Type, External Role, Internal Role Owner, Division, Interaction Type, VS | ExternalInteraction |
| Standards Index | 24 | 1 row/department | #, Department, Standards Count, Charter Included, Link, Primary Owner | Standard |

### Analytics / Pivot Sheets (not seeded, reference only)

| Sheet | Purpose |
|-------|---------|
| Category_Totals | Authoritative canonical category list with counts |
| Role_by_Category | Cross-tab of roles × categories |
| Core Business & Corp Functions | Narrative descriptions of divisions |
| Hierarchy | Same data as Items, row-level (for internal Excel use) |
| Items Pivot | Pivot of Items |
| Items x Value Streams Pivot | Cross-tab items × value streams |
| Financial Driver Map | Illustrative financial linkage (not seeded) |
| Financial Impact Overview | Illustrative scenario summary |
| Scenario Inputs | 6 operating model scenarios |
| Application TCO | Illustrative app cost model (3 apps) |
| Merge Crosswalk | Role name merge/crosswalk reference |
| Source Traceability | Provenance tracking |
| Imported Dependencies | Dependency index |
| Role Assignment List | Clean list: Role → Division/Dept |
| Measurement_Guardrails | Viva Insights analytics guardrail principles |
| Role_Module_Map | Viva Insights metric module per role type |
| Metric_Catalog | Viva Insights person-query metrics |
| OrgData_Mapping | Viva Insights org data field mapping |
| Core_Fields | Fact_PersonPeriod schema definition |
| README | Workbook purpose and scope |

### Individual Role Sheets (159+ role-specific checklist sheets)

Each major role has its own sheet (e.g. "Chief Technology Officer", "Claims Adjuster", etc.) — these are the SOURCE for the Items sheet. The Items sheet aggregates them. Not seeded directly.

### Key structural notes

- **VS name inconsistency:** E2E Process Flows uses abbreviated VS names vs. canonical names in Value Streams/Sub-Value Streams. Fixed by PROCESS_VS_MAP in transform-workbook.ts.
- **Category duplicates:** "Vendor/Third-party" and "Vendor/Third‑party" (unicode dash) and "Approvals/Sign‑offs" normalized by transform to 40 unique categories.
- **higherCategory** not in Org Chart View (original) — only in Org Chart View 2 column A.
- **4 null-higherCategory roles:** Product Filing Specialist, Competitive Intelligence Analyst, Coverage Analyst (Product, Delivery & PMO/IT), Subrogation/Litigation Specialist (Claims/Core Business) — data omissions in v15.
