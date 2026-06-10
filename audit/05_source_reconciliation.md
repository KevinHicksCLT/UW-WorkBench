# Source Reconciliation — S4 / S5 / S6 (2026-06-10)

Closes the three "source parity" stories from the accepted gap backlog
(`audit/04_gap_backlog.md`). Source of truth: `IT_Roles_Analytics_v16.xlsx`.

---

## S4 — Roles: 249 app vs 159 workbook → **0 unexplained roles**

Every `Role` row records its origin in `sourceSheet`. The full inventory:

| Provenance (`Role.sourceSheet`) | Roles | What it is |
|---|---:|---|
| Per-role workbook sheets (one sheet per role, e.g. *Claims Adjuster*, *Chief Actuary*) | **158** | The workbook's core Role Assignment List / Cap–People population (audit counted 159 distinct names; one name is a sheet-name variant of the same role) |
| `Extended Role Inventory` (workbook sheet) | **82** | The workbook's **own documented extension sheet** — additional roles with roleLevel / roleFamily / status |
| `L4 Process Master` (workbook sheet) | **5** | Roles named only in the process master's lead/support columns (e.g. SRE, AIOps Engineer), materialized so process links resolve |
| `Value Streams` (workbook sheet) | **4** | Roles named only in the value-streams sheet (e.g. Appointed Actuary, Sustainability stakeholder) |
| **Total** | **249** | All workbook-derived; no unsourced roles |

The 9 roles from `L4 Process Master` + `Value Streams` were previously
division-less ("Unassigned" in Data Admin). `backend/scripts/fix-org-data.ts`
homed them (Appointed Actuary → Actuarial/Actuarial Leadership; the architect,
SRE, AIOps, FinOps, Capacity roles → Technology & Engineering departments;
Sustainability stakeholder → Risk, Compliance & Audit/Enterprise Risk).

**Acceptance:** every app role maps to a workbook sheet (`sourceSheet`); the
table above is the reconciliation report; 0 unexplained.

## S5 — Headcount & workforce dimensions → **declared illustrative**

- Workbook Cap–People = 159 rows / ΣFTE 159, with **no** region or
  employment-type fields. The app's 743 people (235/80/428 region,
  541/202 type) are a synthetic staffing of the 249 roles.
- Data layer: **all 743 `Person` rows carry `illustrative = true`** — the
  provenance is recorded per row.
- UI: the Home **Workforce mix** widget now shows an **"Illustrative"** badge
  with a tooltip explaining the workbook carries 159 FTE and no region/type
  dimensions.
- Region buckets (235+80+428) and employment buckets (541+202) both sum to
  743 = the Person table = the Home and Organization headline (verified by the
  Data Health "People headcount reconciles" check).

**Acceptance:** figures trace to `Person.illustrative`; the UI says so; totals
reconcile.

## S6 — Applications: 35 app vs 30 catalog → **documented superset**

The workbook's *Cap – Application Catalog* (30 rows, APP-001…030) is explicitly
a **"PLACEHOLDER seed — replace vendor/product names with the client's actual
estate."** The app's 35 `Application` rows are that instantiation: vendor-named
examples (Guidewire PolicyCenter ⇒ APP-001 Policy Administration Platform,
Workday HCM ⇒ APP-014 HCM/HR System, ServiceNow ITSM ⇒ APP-023, …) plus 6 rows
marked `illustrative = false`.

10 rows have no catalog counterpart and are now stamped in their
`description` with `[Extension] Not in the workbook Cap–Application Catalog…`:
Azure Cloud Platform, CrowdStrike Falcon, FRISS Fraud Detection, Customer
Self-Service Portal, Payment Gateway, Regulatory Filing Portal, Reinsurer
Exchange, Catastrophe Data Provider, Credit Bureau & Data Services, BlackRock
Aladdin.

**Acceptance:** documented superset; every extra app carries a provenance note
in its description (visible in Data Admin → Telemetry → Applications).
