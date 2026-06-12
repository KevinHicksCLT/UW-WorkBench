# Spreadsheet-vs-App Gap Analysis — Evidence Base (2026-06-09)

**Source of truth:** `IT_Roles_Analytics_v16.xlsx` (256 sheets) + `standards_extended/` (regulatory extension).
**Application:** https://transform-platform.vercel.app — tenant *Meridian Insurance Group*, logged in as Kevin Hicks (ADMIN). Live numbers re-captured 2026-06-09 (unchanged from the 2026-06-08 audit).
**Initiatives benchmark:** *Shibumi Platform Analysis — Blueprint for Building an Enterprise Transformation Management Clone* (16 pp).
**Method:** Counts extracted programmatically from the workbook (openpyxl); app numbers read verbatim from the live DOM; Initiatives capabilities walked tab-by-tab (Programs → program detail → initiative detail → Financials/Workplan/RAID). No app data or code modified.

---

## A. Master count reconciliation (workbook = source of truth)

| Metric | Workbook (source of truth) | App (live) | Verdict |
|---|---|---|---|
| Divisions | **14** (Role Assignment List / Org Chart View 2) | 14 | ✅ match |
| Departments / teams | **97** (distinct Division/Department combos) | 97 | ✅ match |
| Roles | **159** (Role Assignment List; Role_by_Category; Cap–People) | **240** (Org) / **249** (Home) | ❌ app +81 / +90, and app-internal mismatch |
| People / headcount | **159** (Cap–People rows; ΣFTE = 159) | **717** (Org) / **743** (Home) | ❌ app ~4.6×, and app-internal mismatch |
| Region split (on/near/offshore) | **absent from source** | 235 / 80 / 428 | ❌ no basis in source |
| Employment type (employee/contingent) | **absent from source** | 541 / 202 | ❌ no basis in source |
| Value streams | **26** (Value Streams sheet) / **29** (L4 Process Master) | **21** (Value Streams tab) / **29** (Telemetry) | ⚠️ Telemetry matches L4; Value Streams tab does not |
| Value-stream domains | **13** (L4 Process Master) | 3 (org categories) / 6 (Telemetry) | ❌ neither matches source taxonomy |
| Sub-processes | **131** (L4 Process Master rows) | 43 | ❌ app ~33% |
| Process steps | **711** (L5 Process Steps rows) | 256 | ❌ app ~36% |
| Applications | **30** (Cap–Application Catalog) | 35 | ⚠️ app +5 |
| Standards (total) | **343** (Standards Index) **+ 65** (standards_extended) = **408** | 408 | ✅ reconciles (see §D) |
| Standards — Cybersecurity & ISO | **48** (workbook) **+ 65** (extended) = **113** | 113 | ✅ reconciles |

---

## B. App-internal contradictions (independent of source)

- **Roles:** Home stat = **249**; Organization header = **240**. Same tenant/session.
- **People:** Home = **743** (Employees 541 + Contingent 202 = 743; Onshore 235 + Nearshore 80 + Offshore 428 = 743 — both breakdowns self-consistent at 743); Organization header = **717**. Gap = 26.
- **Value streams:** Value Streams tab header = **21 VALUE STREAMS, 43 SUB-PROCESSES, 256 STEPS**; Telemetry = **29/29 value streams** across **6 domains**.

## C. Value-stream detail (source vs app)

The workbook's **L4 Process Master** carries **29** L2 value streams. The app's **Telemetry** tab shows the **same 29** with the **same names** (verified 1:1, incl. *AIOps & Intelligent Operations, MLOps / ML Lifecycle Management, FinOps / Cloud Financial Management, Service Operations Incident & Production Support, Claims Recoveries & Subrogation*). The app's **Value Streams** tab shows only **21**, with **shortened/renamed** labels. Examples of the rename drift (Value Streams tab → workbook/Telemetry):

- "Distribution Management" → **Distribution & Channel Management**
- "Submission-to-Bind" → **Submission-to-Bind / Underwriting**
- "Actuarial & Reserving" → **Actuarial Pricing, Reserving & Capital Modeling**
- "Reinsurance Management" → **Reinsurance & Retrocession Management**
- "Customer Service & Experience" → **Customer Service, Complaints & Experience**
- "Product Design & Management" → **Product & Proposition Management**
- "Data & Analytics" → **Data, Analytics & AI Management**
- "Human Capital Management" → **Talent & Workforce Management**
- "Legal & Compliance" → **Legal, Governance & Privacy Management**

Streams present in the source (and in Telemetry) but **absent from the Value Streams tab** include: *Audit & Assurance; Change Management & Adoption; Claims Recoveries & Subrogation; Marketing, Growth & Customer Insights; Service Operations, Incident & Production Support; Technology Strategy, Architecture & Delivery; Enterprise Strategy & Portfolio Management; Third-Party & Vendor Management; AIOps; MLOps; FinOps.*

**Implication:** against the source of truth, **Telemetry is correct and the Value Streams tab is the divergent screen** — the inverse of what an app-internal-only review would assume.

## D. Standards reconciliation (RESOLVED — not a defect)

The workbook **Standards Index** totals **343** across 13 areas; the per-department **detail sheets** ("extended" standards in the workbook: *Cybersecurity Standards … Actuarial Standards*) independently total **343** with the same per-area split, so both workbook views agree.

The repo's **`standards_extended/`** directory adds three regulatory packs, each tagged `"area": "Cybersecurity & ISO"`:

| Pack | Standards | Source regulation |
|---|---|---|
| GDPR | **21** | Regulation (EU) 2016/679 |
| CCPA / CPRA | **22** | Cal. Civ. Code 1798.100–199 (+ CPPA 2025 rules) |
| NYDFS-500 | **22** | 23 NYCRR Part 500 (2nd Amendment) |
| **Total** | **65** | all loaded into *Cybersecurity & ISO* |

**Arithmetic:** 48 (workbook Cyber) + 65 = **113** = app's Cybersecurity & ISO. 343 + 65 = **408** = app total. Every other 12 areas match the workbook exactly (Architecture 55, Engineering 24, Claims 20, Underwriting 20, Actuarial 22, etc.). **No standards defect** — the app's 408/113 is the workbook plus the documented regulatory extension.

## E. Initiatives tab vs Shibumi blueprint

App Initiatives module (left rail): **Application Rationalization Workspace (default landing), Programs, Risks, RAID Log**.

- **Programs view:** PROGRAMS 3 · INITIATIVES 5 (Data & AI Enablement — On Track; Claims Modernization — **At Risk**; Digital Underwriting Transformation — On Track).
- **Program detail (Claims Modernization):** TOTAL BENEFIT $1.8M · Cost $1.3M · NET BENEFIT $438.2K. Workstream *Intake & Triage* On Track (initiative *Automated FNOL Triage* On Track, $1.3M / $623.9K); Workstream *Claims Data Platform* **On Track** but its only initiative *Unified Claims Data Platform* = **Off Track, −$185.7K**. Flat workstream→initiative table; no Pipeline/Prioritization/Roadmap/Resources/Scenarios tabs.
- **Initiative detail (Automated FNOL Triage):** stage gate Idea→Plan→Execute→Realize→Complete (Submit for approval / Move back), Status On/At Risk/Off, **3** cards (Cumulative Benefit/Cost/Net). Tabs present: **Summary, Financials, Workplan, RAID, Audit**.
  - *Financials:* monthly **Benefit/Cost Actual vs Target** chart + line items with Category/Range/Actual/Target. (No Forecast/Variance/Scenario datasets; no Funding Requests.)
  - *Workplan:* flat **Milestones** list (no Gantt, activities, or dependencies).

**Shibumi blueprint expectations** — Initiative has **8** tabs (Summary, Charter, Strategic Alignment, Financials, Initiative KPIs, Workplan-Gantt, RAID, Resources) with **4** Summary cards; Program has **7** tabs (Summary, Initiative Pipeline, Prioritization, Roadmap, RAID, Resources, Scenarios); plus **EPMO** aggregation, an **OKR** module (Strategic Objective→KPI, Initiative↔Objective M2M driving **Value Score**), a **Scenario** module (S1–S3 overlays + "Approve to Baseline"), a **Resource** module (capacity vs demand, over-utilization), **time-phased Metrics** with Actual/Target/**Forecast/Variance** datasets, and **auto-refreshing Presentations → PDF** (its #1 executive deliverable).

Note: the backend domain (per `CLAUDE.md`) already models OKR (`StrategicObjective`, `Kpi`, `InitiativeObjective` with impact, `InitiativeKpi`), the stage-gate workflow, a rules engine, and `MetricValue` with a FORECAST dataset — several blueprint gaps are **surface/wiring** gaps, not greenfield builds. Cumulative roll-ups recompute only via an explicit recompute call (no write-path trigger), so executive money can be stale.
