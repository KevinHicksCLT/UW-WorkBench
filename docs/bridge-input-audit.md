# Bridge Input ↔ Database Audit

Workbook: `AI Transformation Bridge Input.xlsx` · Spine: `backend/data/seed/spine.json` · Generated: 2026-06-10T19:15Z
Company: Meridian Insurance Group · Result: **2/13 sections FAIL**

| # | Section | Status | Summary |
|---|---------|--------|---------|
| 1 | Value streams | ✅ PASS | workbook 36 vs db 36 — missing 0, extra 0, domain mismatches 0 |
| 2 | Roles | ✅ PASS | workbook 261 vs db 261 — missing 0, extra 0 |
| 3 | Role participation (RoleValueStream) | ✅ PASS | workbook 416 vs db 416 — missing 0, extra 0 |
| 4 | L4 Process Master (SubValueStream) | ✅ PASS | L4: workbook 131 vs db 131 (missing 0, extra 0); L3: workbook 114 vs db 114 (missing 0, extra 0) |
| 5 | L5 Process Steps (ProcessStep) | ✅ PASS | workbook 711 vs db 711 — missing 0, extra 0, field-changed 0 |
| 6 | Inputs & Outputs Inventory (IoItem) | ✅ PASS | workbook 835 vs db 835 — missing 0, extra 0 |
| 7 | Value Stream Metrics (Metric) | ✅ PASS | workbook 267 vs db 267 — missing 0, extra 0 |
| 8 | Items (ChecklistItem) | ✅ PASS | workbook 4743 vs db 4743 — roles off: 0 |
| 9 | Aligned Role Tasks (RoleTask) | ✅ PASS | workbook 4743 vs db 4743 — roles off: 0 |
| 10 | Level tree (L3/L4/L5) | ✅ PASS | db L3=36 L4=131 L5=711 vs workbook streams=36 L4=131 L5=711 |
| 11 | Cap – Application Catalog (Application) | ❌ FAIL | workbook 30 vs db 35 — missing 26, db-only 31 (db-only rows are pre-existing illustrative apps; kept) |
| 12 | Cap – People (role coverage) | ✅ PASS | cap rows 159 across 159 roles — unknown roles 0, roles with no assigned person 0 |
| 13 | Cap – App Usage / Deliverables bridges | ❌ FAIL | workbook real rows: usage 4, deliverables 3; db: StepAppUsage table MISSING, StepDeliverable table MISSING |

## Cap – Application Catalog (Application) — FAIL

workbook 30 vs db 35 — missing 26, db-only 31 (db-only rows are pre-existing illustrative apps; kept)

- MISSING in db: Billing & Receivables System
- MISSING in db: Underwriting Workbench
- MISSING in db: Rating & Pricing Engine
- MISSING in db: CRM
- MISSING in db: Document & Forms Management
- MISSING in db: Actuarial Reserving Platform
- MISSING in db: Catastrophe Modeling
- MISSING in db: Finance ERP / General Ledger
- MISSING in db: FP&A Planning Tool
- MISSING in db: HCM / HR System
- MISSING in db: Procurement / Vendor Mgmt
- MISSING in db: Treasury Management
- MISSING in db: Legal / Contract Lifecycle
- MISSING in db: E-Signature
- MISSING in db: GRC / Risk & Compliance
- … and 42 more

## Cap – App Usage / Deliverables bridges — FAIL

workbook real rows: usage 4, deliverables 3; db: StepAppUsage table MISSING, StepDeliverable table MISSING

- Step-lens tables/import pending (plan phases 2–3).
