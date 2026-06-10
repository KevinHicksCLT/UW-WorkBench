# Spreadsheet & Document Gap Backlog — Coding-Agent Stories (2026-06-09)

**33 findings** comparing the application against **`IT_Roles_Analytics_v16.xlsx` (the source of truth)** + **`standards_extended/`**, plus the **Initiatives** tab against the **Shibumi blueprint**. Format: **Evidence/Proof → Why it's wrong → Suggested fix → Approach → Acceptance Criteria (DoD)**. The interactive `gap-review-board.html` (same folder) is generated from this same set.

> ⚠️ **SEPARATE from yesterday's application-defect backlog (`../02_backlog.md` / `../review-board.html`, 43 findings), which another agent is already implementing.** Everything here comes **only** from comparing the app to the spreadsheet (source of truth) and the Shibumi document. Where a symptom also appeared in yesterday's list it is re-grounded here against the source and cross-noted — triage to whichever backlog the owning agent prefers, but do not double-implement.

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · ✅ Resolved (no action)
**Status:** `PROPOSED` (awaiting accept/decline)
**Counts:** 32 actionable (0 Critical, 12 High, 15 Medium, 5 Low) + 1 Resolved.
**Areas:** Cross-tab Consistency (X), Source Parity (S), Org Credibility (O), Initiatives vs Shibumi (I), Deliverables/Metrics/Financials/External drill-down (DT/MET/FIN/EXT).

> Ground rule (project): these documents **do not modify the application or `master`**. Analysis only — implement per-story on its own branch.
> Cadence note: a sibling agent is working this repo concurrently (it added `standards_extended/` and writes into `audit/` root); this list lives in `audit/spreadsheet-gap/` to stay isolated.

---

## 1. Cross-Tab Internal Contradictions (X)

### X1 — Role count disagrees between Home (249) and Organization (240) 🟠 `PROPOSED`
- **Area:** Cross-tab · **Tabs:** Home, Organization
- **Proof:** Home stat **ROLES 249**; Organization header **240 ROLES**. Same tenant/session.
- **Why it's wrong:** One entity must return one count everywhere. A 9-role gap means two different queries/filters feed the screens; users lose trust in headline numbers.
- **Suggested fix:** Both screens read role count from one shared tenant-scoped query; document the canonical definition (all roles vs roles-with-people).
- **Approach:** Single `getOperatingModelCounts(companyId)` consumed by Home and Organization; add a reconciliation test.
- **Acceptance Criteria:** (1) Home == Organization role count for Meridian. (2) Count comes from one shared function. (3) Test asserts equality.

### X2 — Headcount disagrees between Home (743) and Organization (717) 🟠 `PROPOSED`
- **Area:** Cross-tab · **Tabs:** Home, Organization
- **Proof:** Home **743** (Employees 541 + Contingent 202 = 743; Onshore 235 + Nearshore 80 + Offshore 428 = 743 — both internally consistent); Organization **717**. Gap = 26.
- **Why it's wrong:** Two totals for one population. Home is internally consistent at 743, so Org's 717 likely drops people unattached to a team/role.
- **Suggested fix:** Reconcile to one source; if some people are unassigned, show an explicit "Unassigned" bucket so the org total still equals the headline.
- **Approach:** Use the shared counts service (X1) for `people`; integrity check `Σregion == ΣemploymentType == people-in-tree (+ unassigned)`.
- **Acceptance Criteria:** (1) Home == Organization people total. (2) Any unassigned people appear in a labeled bucket, not silently dropped. (3) Test asserts the totals are equal.

### X3 — Value-stream count disagrees: Value Streams tab (21) vs Telemetry (29) 🟠 `PROPOSED`
- **Area:** Cross-tab · **Tabs:** Value Streams, Telemetry
- **Proof:** Value Streams `/overview` header **21**; Telemetry `/active-ai` **29/29**.
- **Why it's wrong:** "Value stream" is the core object; two inventories means the two tabs read different lists. Against the source the **29** is correct.
- **Suggested fix:** Drive both tabs from one canonical value-stream list (the 29 that already matches the L4 source).
- **Approach:** Point `/overview` at the same canonical `ValueStream` set Telemetry uses; remove the reduced 21-list. Cross-links: S1, S2.
- **Acceptance Criteria:** (1) One value-stream count across the app. (2) Every Value Streams-tab row maps to a canonical stream. (3) Telemetry and Value Streams list the same names 1:1.

---

## 2. Divergence From Source of Truth (S)

### S1 — Value Streams tab is incomplete vs the workbook (21 vs 26/29) 🟠 `PROPOSED`
- **Area:** Source parity · **Tab:** Value Streams
- **Proof:** Workbook **Value Streams** sheet = **26** unique streams; **L4 Process Master** = **29**; Telemetry already shows the matching **29**; the Value Streams tab shows only **21**. Missing incl. *Audit & Assurance, Change Management & Adoption, Claims Recoveries & Subrogation, Marketing Growth & Customer Insights, Service Operations Incident & Production Support, Technology Strategy Architecture & Delivery, Enterprise Strategy & Portfolio Management, Third-Party & Vendor Management, AIOps, MLOps, FinOps.*
- **Why it's wrong:** The canonical operating-model map omits ~8–11 value streams that exist in the source and in the app's own Telemetry — so the map under-represents the enterprise and can't be navigated to those streams.
- **Suggested fix:** Load the full canonical value-stream set from the workbook (align to the 29 used by L4/Telemetry); decide whether the 3 ops-tech streams (AIOps/MLOps/FinOps) are real streams or capability tags.
- **Approach:** Seed/import canonical `ValueStream` rows from the L4 master; rebuild the `/overview` tree from them; recompute the 21→29 header counter.
- **Acceptance Criteria:** (1) Value Streams tab count == source canonical count. (2) Each source stream appears exactly once. (3) Telemetry and Value Streams agree.

### S2 — Value-stream names are renamed/shortened vs the source 🟠 `PROPOSED`
- **Area:** Source parity · **Tabs:** Value Streams, Deliverables & Tasks
- **Proof:** Value Streams tab uses short labels that don't match the workbook (Telemetry does): "Distribution Management" vs **Distribution & Channel Management**; "Actuarial & Reserving" vs **Actuarial Pricing, Reserving & Capital Modeling**; "Reinsurance Management" vs **Reinsurance & Retrocession Management**; etc.
- **Why it's wrong:** A stream has two names depending on the screen, breaking filtering, joins, and the user's ability to follow one stream across tabs.
- **Suggested fix:** Adopt the workbook's canonical names everywhere; the Value Streams tab and the `/work` value-stream filter should use the same strings as Telemetry.
- **Approach:** Replace hard-coded short names with canonical `ValueStream.name`; one-time data migration of existing rows.
- **Acceptance Criteria:** (1) Each stream has exactly one name app-wide. (2) `/work` filter options == Value Streams tab == Telemetry == workbook names.

### S3 — Process taxonomy coverage is ~⅓ of the source 🟡 `PROPOSED`
- **Area:** Source parity · **Tabs:** Value Streams, Home
- **Proof:** App **43 sub-processes / 256 steps**; workbook **L4 Process Master = 131 sub-processes**, **L5 Process Steps = 711 steps**.
- **Why it's wrong:** The app shows ~33% of sub-processes and ~36% of steps in the source. Either the app is an intentional curated subset (then label it) or the import is incomplete.
- **Suggested fix:** Confirm intent. If full fidelity is wanted, import the full L4/L5 taxonomy; otherwise mark the app view as a curated subset and show "X of Y" coverage.
- **Approach:** Importer that maps L4→sub-process and L5→step keyed by Process ID (e.g. `CI-01-01-S01`); idempotent re-run.
- **Acceptance Criteria:** (1) Decision recorded (full vs subset). (2) If full: counts == 131 / 711. (3) If subset: UI states coverage explicitly.

### S4 — Role inventory diverges from source (240 vs 159) 🟡 `PROPOSED`
- **Area:** Source parity · **Tab:** Organization
- **Proof:** App **240** roles (Org); workbook **159** distinct roles (Role Assignment List / Role_by_Category / Cap–People). Divisions (14) and departments (97) match exactly.
- **Why it's wrong:** +81 roles beyond the source with no recorded provenance. Given the standards precedent (S7), the extra roles may be a legitimate enrichment **or** unsourced — that ambiguity itself is the defect.
- **Suggested fix:** Reconcile the role list to the workbook, or document the enrichment source (as `standards_extended/` documents the extra standards) so every role traces to a source.
- **Approach:** Diff app roles vs `Role Assignment List`; tag each extra role with a provenance note or remove; add a roles-reconciliation report.
- **Acceptance Criteria:** (1) Every app role maps to a workbook role or a documented extension. (2) Reconciliation report shows 0 unexplained roles.

### S5 — Headcount & workforce dimensions not grounded in source 🟡 `PROPOSED`
- **Area:** Source parity · **Tabs:** Home, Organization
- **Proof:** App **717/743** people; workbook **Cap–People = 159 rows, ΣFTE = 159**, with **no** region (onshore/nearshore/offshore) and **no** employment-type (employee/contingent) fields anywhere in the workbook (keyword scan). App shows Onshore 235 / Nearshore 80 / Offshore 428 and Employees 541 / Contingent 202.
- **Why it's wrong:** The headline workforce (and its 58%-offshore / 27%-contingent splits) has no basis in the source of truth; it cannot be reconciled or refreshed from the workbook.
- **Suggested fix:** Either source these dimensions (extend the workbook / a documented dataset like `standards_extended/`) or relabel the app figures as illustrative until a real workforce source is wired in.
- **Approach:** Add a documented workforce dataset with PersonId→region/employmentType, or gate the Home workforce panel behind an "illustrative" badge.
- **Acceptance Criteria:** (1) Each workforce figure traces to a documented source. (2) If illustrative, the UI says so. (3) Region/type totals reconcile to the people total (ties to X2).

### S6 — Application count diverges (35 vs 30) ⚪ `PROPOSED`
- **Area:** Source parity · **Tabs:** Home, Initiatives
- **Proof:** App **35** applications; workbook **Cap–Application Catalog = 30**.
- **Why it's wrong:** Minor (+5) but unexplained vs the catalog.
- **Suggested fix:** Reconcile the app's application list to the catalog or document the 5 extras.
- **Approach:** Diff app apps vs catalog; annotate or remove extras.
- **Acceptance Criteria:** (1) App count == catalog or a documented superset. (2) Each extra app has a provenance note.

### S7 — Standards counts (408 / Cyber 113) reconcile to source + extension ✅ `RESOLVED`
- **Area:** Source parity · **Tab:** Standards
- **Proof:** Workbook Standards Index **343** (and the per-department detail sheets independently total 343); `standards_extended/` adds **GDPR 21 + CCPA/CPRA 22 + NYDFS-500 22 = 65**, all tagged `area: "Cybersecurity & ISO"`. 48 + 65 = **113** (app Cyber); 343 + 65 = **408** (app total); all other 12 areas match exactly.
- **Why it's listed:** A counts-only review would flag the app as inflated (+65). With `standards_extended` accounted for, the numbers are **exactly correct**. **No action** — recorded so the team doesn't "fix" a correct figure. If a counts test is added, it must include the `standards_extended` packs in the expected total.

---

## 3. Org Data Credibility (O)

### O1 — Singular executive roles show 2–4 incumbents 🟠 `PROPOSED`
- **Area:** Org credibility · **Tab:** Organization
- **Proof (verbatim, live):** Chief Actuary **4**, Chief Information Officer **4**, Chief Data Officer **4**, Chief HR Officer **4**, Chief Marketing Officer **4**, Chief Underwriting Officer **4**, Chief Claims Officer **4**, Chief Product Officer **4**, Chief Risk Officer **4**, General Counsel **4**, Head of Reinsurance **4**; CFO **2**, COO **2**, CISO **2**. In the workbook each role maps to **1** person (Cap–People ΣFTE = 159 over 159 roles).
- **Why it's wrong:** An enterprise has exactly one CFO, one Chief Actuary, one General Counsel. 2–4 incumbents per singular role is the most visible "this data is fake" signal and contradicts the source's 1-per-role model.
- **Suggested fix:** Constrain singleton leadership roles to 1 incumbent; reassign surplus people to correct subordinate roles. Add a validation flag for singleton roles with >1 person.
- **Approach:** Tag leadership roles `singleton: true`; data-fix seed/import; admin validation warns on violation.
- **Acceptance Criteria:** (1) Each C-level / "Head of" / "Chief" / "General Counsel" shows exactly 1 person. (2) Validation flags >1 on a singleton. (3) Reassigned people still reconcile to headcount.

---

## 4. Initiatives Tab vs Shibumi Blueprint (I)

### I1 — Default landing is Application Rationalization, not a portfolio roll-up 🟠 `PROPOSED`
- **Area:** Initiatives / UX · **Tab:** Initiatives
- **Proof:** `/portfolio` opens on **Application Rationalization Workspace** (a CAPDAN flow board); Programs is the 2nd rail item.
- **Why it's wrong:** Per the blueprint the Initiatives entry point is an executive **portfolio/EPMO roll-up** (status, benefits, RAID across programs). App Rationalization is a narrow sub-tool and a poor default for the "strategic portfolio" header.
- **Suggested fix:** Make Programs / a portfolio summary the default; demote App Rationalization to a sub-tool.
- **Approach:** Change the default sub-route; add a portfolio summary landing (ties to I2).
- **Acceptance Criteria:** (1) `/portfolio` lands on a portfolio/Programs summary. (2) App Rationalization still reachable from the rail.

### I2 — No EPMO / portfolio-level aggregation across programs 🟠 `PROPOSED`
- **Area:** Initiatives · **Tab:** Initiatives
- **Proof:** App rolls up at program level only (program detail shows $1.8M/$1.3M/$438.2K for Claims Modernization); there is no cross-program EPMO view. Blueprint specifies an EPMO level aggregating financial/status/schedule/RAID across all programs.
- **Why it's wrong:** Executives need one portfolio number (total benefit/cost/net, at-risk count) across the 3 programs / 5 initiatives; the app forces per-program navigation.
- **Suggested fix:** Add a portfolio summary aggregating all programs (totals, status mix, RAID heatmap, top risks).
- **Approach:** `summarizePortfolio(tenantId)` aggregating program roll-ups; dashboard cards + status/RAID widgets.
- **Acceptance Criteria:** (1) Portfolio view shows total benefit/cost/net across all programs. (2) Status and open-RAID counts roll up. (3) Numbers tie to the sum of program details.

### I3 — Initiative detail missing Strategic Alignment tab (OKR link / Value Score) 🟠 `PROPOSED`
- **Area:** Initiatives · **Tab:** Initiative detail
- **Proof:** Initiative tabs present = Summary, Financials, Workplan, RAID, Audit. No **Strategic Alignment** tab. Backend already has `InitiativeObjective` (impact Low/Med/High) and `Kpi`/`StrategicObjective` per `CLAUDE.md`.
- **Why it's wrong:** The blueprint ties initiatives to Strategic Objectives via a Level-of-Impact M2M that drives the **Value Score** — the core "are we funding the right work" lens. It's modeled in the backend but not surfaced.
- **Suggested fix:** Add a Strategic Alignment tab listing supported objectives + "+ Initiative Objective" with a Low/Med/High impact picklist; compute and show Value Score.
- **Approach:** Wire `InitiativeObjective` to a tab; compute Value Score from impact ratings; surface on Summary/Charter.
- **Acceptance Criteria:** (1) Tab lists linked objectives with impact. (2) Adding/removing a link updates Value Score. (3) Value Score appears on the initiative.

### I4 — Initiative detail missing Charter tab (Complexity / Value Score) 🟡 `PROPOSED`
- **Area:** Initiatives · **Tab:** Initiative detail
- **Proof:** No Charter tab; Summary shows description + details only. Blueprint Charter = Complexity Score, Value Score, deeper details.
- **Why it's wrong:** No place for prioritization inputs (complexity vs value) the blueprint and Program "Prioritization" view depend on.
- **Suggested fix:** Add a Charter tab with Complexity Score and Value Score (latter from I3).
- **Approach:** Charter section/tab; Complexity as an entered/derived score; Value Score from strategic alignment.
- **Acceptance Criteria:** (1) Charter tab renders both scores. (2) Scores feed a Program-level prioritization (ties to I11).

### I5 — Initiative detail missing Initiative KPIs tab 🟡 `PROPOSED`
- **Area:** Initiatives · **Tab:** Initiative detail
- **Proof:** No Initiative KPIs tab. Backend has `InitiativeKpi` per `CLAUDE.md`.
- **Why it's wrong:** Initiative-level KPI tracking (Actual/Target) is a standard blueprint tab and is modeled but not surfaced.
- **Suggested fix:** Add an Initiative KPIs tab listing linked KPIs with Actual/Target.
- **Approach:** Wire `InitiativeKpi`/`Kpi` to a tab.
- **Acceptance Criteria:** (1) Tab lists linked KPIs with Actual/Target and achievement. (2) Add/remove KPI persists.

### I6 — No Resource module / Resources tab 🟠 `PROPOSED`
- **Area:** Initiatives · **Tabs:** Initiative & Program
- **Proof:** No Resources tab on initiative; no capacity/demand anywhere in Initiatives. Blueprint: Resource pool, Individual Resource, Initiative Resource with capacity-vs-demand and over-utilization.
- **Why it's wrong:** Transformation portfolios are resource-constrained; without demand vs capacity there's no way to see over-allocation or staff scenarios.
- **Suggested fix:** Add a Resource module (role pool, individual resources, initiative resource demand) with over-utilization calc; Resources tab on initiative + Program.
- **Approach:** New entities + weekday-aware capacity calc; over-utilization flag. (Larger build — Stage-2 per blueprint.)
- **Acceptance Criteria:** (1) Initiative shows assigned resources with effort. (2) Over-utilization computed and flagged. (3) Program Resources tab aggregates demand vs capacity.

### I7 — No Scenario module 🟠 `PROPOSED`
- **Area:** Initiatives · **Tabs:** Program / Initiative
- **Proof:** No scenarios anywhere. Blueprint: up to 3 scenarios overlaying alternate Start/Due dates and Include/Exclude flags onto baseline initiatives, with "Approve Scenario to Baseline".
- **Why it's wrong:** What-if portfolio modeling without mutating real dates is a headline differentiator; absent it, planning is destructive/manual.
- **Suggested fix:** Add S1–S3 scenario overlays (per-initiative S# dates + Include flags), scenario roll-ups, and a promote-to-baseline action.
- **Approach:** Scenario entity under Workstream; S# fields on initiative; scenario-aware roll-up; promotion writes back to baseline. (Stage-2.)
- **Acceptance Criteria:** (1) User models ≥1 scenario without changing real dates. (2) Scenario net benefit vs baseline shown. (3) "Approve to Baseline" promotes the scenario.

### I8 — Financials missing Forecast/Variance datasets & Funding Requests 🟡 `PROPOSED`
- **Area:** Initiatives · **Tab:** Financials
- **Proof:** Financials shows monthly Benefit/Cost **Actual vs Target** only; no Forecast/Variance series, no Funding Requests. Backend `MetricValue` already supports a FORECAST dataset per `CLAUDE.md`.
- **Why it's wrong:** Benefits realization tracking (the blueprint's #1 differentiator) needs Forecast + Variance to show drift; Funding Requests belong on the Financials tab.
- **Suggested fix:** Add Forecast and Variance datasets to the chart/table; add a Funding Requests section.
- **Approach:** Surface the existing FORECAST dataset; compute Variance = Actual − Target; add Funding Request child type.
- **Acceptance Criteria:** (1) Chart/table show Actual/Target/Forecast/Variance. (2) Funding Requests can be added and roll into cost.

### I9 — Workplan is a flat milestone list, not a Gantt 🟡 `PROPOSED`
- **Area:** Initiatives · **Tab:** Workplan
- **Proof:** Workplan = a "Milestones" list with Due dates and GATE flags; no activities, dependencies, or timeline. Blueprint: interactive Gantt with milestone/activity hierarchy, drag-to-reschedule, drag-to-create dependencies.
- **Why it's wrong:** No schedule view or dependencies means no critical-path or roadmap; "Workplan" overstates what's there.
- **Suggested fix:** Add an interactive Gantt (license a component, per blueprint's make/buy note) with activities + dependencies; keep milestones as gates.
- **Approach:** Integrate a Gantt lib (DHTMLX/Bryntum); activity + dependency entities; drag-reschedule persists.
- **Acceptance Criteria:** (1) Gantt renders milestones/activities on a timeline. (2) Dependencies can be created. (3) Reschedule persists and updates dates.

### I10 — No Presentations / auto-refreshing executive pack → PDF 🟠 `PROPOSED`
- **Area:** Initiatives / Reporting · **Tab:** (new)
- **Proof:** No presentation/slide-deck/PDF export anywhere in Initiatives. Blueprint calls auto-refreshing Presentations the "#1 executive deliverable".
- **Why it's wrong:** Executives buy the tool to stop hand-assembling status decks; without live → PDF/slide export the value-tracking data can't leave the app as a board pack.
- **Suggested fix:** Add a Presentation builder (dashboard-derived slides) with Publish (point-in-time) and PDF/PPTX export.
- **Approach:** Headless slide rendering (reveal.js + headless Chromium for PDF, or pptxgenjs for PPTX) bound to live program/initiative data. (Stage-2.)
- **Acceptance Criteria:** (1) User composes a deck from live data. (2) Publish produces an immutable PDF. (3) Re-open reflects refreshed data.

### I11 — Program detail missing Pipeline/Prioritization/Roadmap/Resources/Scenarios tabs 🟡 `PROPOSED`
- **Area:** Initiatives · **Tab:** Program detail
- **Proof:** Program detail is a single flat workstream→initiative table. Blueprint Program has 7 tabs: Summary, Initiative Pipeline, Prioritization, Roadmap, RAID, Resources, Scenarios.
- **Why it's wrong:** No pipeline (idea funnel), prioritization (value vs complexity), or roadmap (timeline) at program level — the core program-management lenses.
- **Suggested fix:** Add Pipeline, Prioritization (uses I4 scores), Roadmap (uses I9 dates), Resources (I6), Scenarios (I7) tabs.
- **Approach:** Compose from existing data + the new modules; build incrementally.
- **Acceptance Criteria:** (1) Program shows Pipeline, Prioritization, Roadmap at minimum. (2) Resources/Scenarios appear once those modules land.

### I12 — Initiative Summary shows 3 achievement cards, blueprint has 4 ⚪ `PROPOSED`
- **Area:** Initiatives · **Tab:** Initiative Summary
- **Proof:** Cards = Cumulative Benefit, Cumulative Cost, Net Benefit. Blueprint Summary = Estimated Annual Benefit, Cumulative Net Benefit, Cumulative Benefit, Cumulative Cost.
- **Why it's wrong:** Missing **Estimated Annual Benefit** — the run-rate figure executives anchor on.
- **Suggested fix:** Add an Estimated Annual Benefit card.
- **Approach:** Compute annualized benefit from the monthly metric; add the 4th card.
- **Acceptance Criteria:** (1) Four cards render. (2) Estimated Annual Benefit matches the annualized series.

### I13 — Parent/child health does not roll up (program At Risk vs On-Track workstreams) 🟠 `PROPOSED`
- **Area:** Initiatives / data logic · **Tab:** Initiatives
- **Proof (live):** Program "Claims Modernization" = **At Risk**; both workstreams = **On Track**; workstream "Claims Data Platform" = On Track while its only initiative "Unified Claims Data Platform" = **Off Track, −$185.7K**.
- **Why it's wrong:** A workstream whose only initiative is Off Track cannot be On Track; health is hand-set and unsynced or the rollup is missing. (Also surfaced in yesterday's list as D6 — re-confirmed live here; implement in whichever backlog the owner chooses, not both.)
- **Suggested fix:** Deterministic health rollup (worst-child or weighted) so parent derives from children, or mark parent health as an explicit, visible manual override.
- **Approach:** `computeHealth()` for workstream (from initiatives) and program (from workstreams); recompute on child status write; show computed vs override.
- **Acceptance Criteria:** (1) No parent healthier than its worst child without a visible override. (2) Changing an initiative status updates parents. (3) Test covers the Claims Modernization case.

### I14 — Value-capture roll-ups can go stale (no write-path recompute) 🟡 `PROPOSED`
- **Area:** Initiatives / architecture · **Tab:** Initiatives
- **Proof:** Per `CLAUDE.md`, denormalized `cumulative*` recompute only via an explicit recompute call; no write path triggers it.
- **Why it's wrong:** Editing a benefit/cost line won't update the cumulative figures executives see — stale money on the #1 differentiator. (Overlaps yesterday's ARCH note — re-grounded here against the Financials tab; implement once.)
- **Suggested fix:** Recompute roll-ups transactionally on any benefit/cost/objective-link write (or via a reliable async trigger).
- **Approach:** Call `recomputeInitiative()` after relevant writes; add a test that an edit changes the cumulative.
- **Acceptance Criteria:** (1) Editing a line updates cumulative figures without a manual recompute. (2) Test asserts the recompute fires on write.

---

## 5. Deliverables, Tasks, Metrics, Financials & External — Drill-Down (DT / MET / FIN / EXT)

### DT1 — App tasks are generic templates; the workbook's 4,743 specific role-tasks are unused 🟠 `PROPOSED`
- **Area:** Deliverables & Tasks parity · **Tab:** Deliverables & Tasks
- **Proof:** Workbook **`Items` = 4,743** role-task rows of real, role-specific responsibilities (e.g. *"Set enterprise technology strategy"*, *"Oversee technology standards"*), each tagged Role / Role Family / Category; **`Aligned Role Tasks` = 4,743** maps the same items to Division/Department/Role. The app `/work` shows **5,454 tasks** that are generic repeating templates — *Validate & Review, Approve & Publish, Develop Approach, Define Requirements, Build & Configure* — reused across deliverables.
- **Why it's wrong:** The source carries a rich, role-specific task/responsibility inventory; the app replaces it with ~5–6 boilerplate task names cloned across every deliverable, so role-level work analytics are meaningless and none of the workbook's actual responsibilities surface.
- **Suggested fix:** Seed tasks from the workbook's role-task `Items` (categorized, per role) instead of a fixed template set; keep templates only where the source genuinely repeats.
- **Approach:** Importer mapping `Items` (Role, Category, Item) → task records linked to role + deliverable; dedupe true cross-role items (`* = cross-role`).
- **Acceptance Criteria:** (1) Task text reflects workbook role responsibilities, not 5–6 templates. (2) Each task traces to an `Items` row or a documented template. (3) Tasks-per-role distribution matches the source within tolerance.

### DT2 — Deliverables not tied to the source I/O inventory; inputs entirely absent 🟡 `PROPOSED`
- **Area:** Deliverables & Tasks parity · **Tab:** Deliverables & Tasks
- **Proof:** Workbook **`Inputs & Outputs Inventory` = 835** rows (**421 inputs**, **414 outputs/deliverables**) keyed to L4 sub-processes with Data Elements and Key Roles. The app shows **441 deliverables** but **no inputs**, and deliverables aren't keyed to the 414 source outputs.
- **Why it's wrong:** Half the source I/O model (the 421 inputs) is missing, and the 441 app deliverables can't be reconciled to the 414 documented outputs — breaking upstream/downstream traceability that the workbook supports.
- **Suggested fix:** Import outputs as deliverables keyed to their L4 sub-process; add inputs (with data elements) so each deliverable shows its inputs and producing/consuming roles.
- **Approach:** Map `Inputs & Outputs Inventory` rows → deliverable/input records on the value-stream→sub-process tree (ties to S3).
- **Acceptance Criteria:** (1) Inputs exist and are linked to sub-processes. (2) Deliverables reconcile to the source outputs (count + names). (3) Each deliverable shows inputs, data elements, and roles.

### MET1 — Value-stream KPI catalog (267) not represented in Trackable Metrics 🟡 `PROPOSED`
- **Area:** Metrics parity · **Tab:** Telemetry → Trackable Metrics
- **Proof:** Workbook **`Value Stream Metrics` = 267** KPIs with Formula, Target/Benchmark, Measurement Level, Reporting Frequency, Owner Role, keyed to each value stream. The app's Trackable Metrics shows **"429 of 429 signals"** described as *workforce telemetry (Viva Insights, Microsoft 365, GitHub)* and execution signals — a different composition; the 267 value-stream KPIs (with their formulas/targets/owners) don't appear tied to their streams.
- **Why it's wrong:** The app's metric set is weighted to generic workforce telemetry while the source's value-stream-specific KPIs (the ones tied to the operating model) aren't surfaced or linked to streams — so a stream can't show its own benchmarked KPIs.
- **Suggested fix:** Load the 267 value-stream metrics (formula/target/owner/frequency) and attach them to their value streams; show them on each stream and in Trackable Metrics.
- **Approach:** Import `Value Stream Metrics` keyed by L2 Value Stream; render per-stream KPI section; reconcile the 429-signal catalog's composition.
- **Acceptance Criteria:** (1) Each value stream shows its source KPIs with target + owner. (2) Trackable Metrics composition is documented (workforce vs value-stream vs external). (3) The 267 value-stream metrics are present.

### MET2 — Trackable-metrics provenance vs the workbook metric catalogs ⚪ `PROPOSED`
- **Area:** Metrics parity · **Tab:** Telemetry → Trackable Metrics
- **Proof:** Workbook defines a measurement framework: **`Metric_Catalog_Expanded` = 151** (+ `Metric_Catalog` 102 subset) with SourceSystem and RecommendedFactTable, and **`External_Metric_Catalog` = 52** (Jira/ServiceNow/Pega, with calculation patterns). App shows 429 signals.
- **Why it's wrong:** Unclear whether the 429 signals derive from these catalogs or are a separate hard-coded list — risking metrics that can't be sourced or computed.
- **Suggested fix:** Map each app signal to a catalog entry (source system + calculation); flag any signal with no source.
- **Approach:** Reconciliation report: app signals ↔ `Metric_Catalog_Expanded` + `External_Metric_Catalog`.
- **Acceptance Criteria:** (1) Every signal maps to a catalog entry or is flagged. (2) Source system + calculation shown per signal.

### FIN1 — Application TCO and the 30-app catalog aren't surfaced for rationalization 🟡 `PROPOSED`
- **Area:** Financials parity · **Tab:** Initiatives → Application Rationalization
- **Proof:** Workbook **`Application TCO` = 8** apps with full cost breakdown (License/Subscription, Internal Labor, Vendor Services, Infrastructure, Depreciation, Allocated Overhead) totalling **$5.335M**; **`Cap – Application Catalog` = 30** apps with SoR flags and domains. The app's Application Rationalization workspace shows **2** apps (Claims Platform, Underwriting Platform) on a CAPDAN board with **no TCO**.
- **Why it's wrong:** Rationalization decisions need TCO and the full application portfolio; the app shows 2 of 30 apps and none of the source cost data, so the workspace can't support the decision it's named for.
- **Suggested fix:** Load the 30-app catalog and the TCO breakdown; show per-app TCO in the rationalization workspace.
- **Approach:** Import `Cap – Application Catalog` + `Application TCO`; surface TCO columns + totals.
- **Acceptance Criteria:** (1) App catalog count == 30 (ties to S6). (2) Each app shows its TCO components and total. (3) Portfolio TCO total reconciles to $5.335M (or documented current figure).

### FIN2 — Scenario / Financial-Impact model not represented in the portfolio 🟡 `PROPOSED`
- **Area:** Financials parity · **Tab:** Initiatives
- **Proof:** Workbook **`Scenario Inputs` = 6** operating-model scenarios (One-Time Cost, Annual Benefit, Annual Added Cost, Annual Net Impact) and **`Financial Impact Overview`** (Annual net impact **$1.22M**, one-time **$1.365M**, total app TCO **$5.335M**, payback **1.12 yrs**, 6 scenarios). The app portfolio money is initiative-based ($1.8M/$1.3M/$438.2K for Claims Modernization) and unrelated to the workbook's scenario/impact model.
- **Why it's wrong:** The source's directional change-impact model (the scenarios executives would compare) has no home in the app; the portfolio shows different, unreconciled figures.
- **Suggested fix:** Represent the 6 scenarios + financial-impact summary (ties to the Scenario module, **I7**); reconcile or clearly separate "change-impact model" from "initiative benefits."
- **Approach:** Load `Scenario Inputs` + `Financial Impact Overview`; surface as portfolio scenarios / an impact dashboard.
- **Acceptance Criteria:** (1) The 6 scenarios are viewable with their financial fields. (2) Financial-impact summary figures match the workbook. (3) Initiative benefits vs change-impact model are clearly distinguished.

### EXT1 — External interactions inventory not surfaced in the app ⚪ `PROPOSED`
- **Area:** External parity · **Tab:** (none in main nav)
- **Proof:** Workbook **`External Interactions` = 27** external relationships (brokers, reinsurers, regulators, vendors) with Internal Role Owner, Interaction Type, Inputs Received, Deliverables Sent, Related Value Stream, Dependency Type, Frequency, Risks. The app has **no External view in the main nav** (only a Data Admin "External" config tab).
- **Why it's wrong:** A material part of the operating model (external dependencies and their risks, keyed to value streams) is invisible to end users.
- **Suggested fix:** Surface external interactions (read view) keyed to value streams, with dependency/frequency/risk.
- **Approach:** Import `External Interactions`; add a view or a section on each value stream.
- **Acceptance Criteria:** (1) External interactions are viewable outside Data Admin. (2) Each is linked to its value stream and internal owner. (3) Count == 27 (or documented current figure).

---

### Sources
- Workbook: `IT_Roles_Analytics_v16.xlsx` — *Role Assignment List, Role_by_Category, Cap–People, Org Chart View 2, Value Streams, L4 Process Master, L5 Process Steps, Cap–Application Catalog, Standards Index,* per-department *Standards* sheets, *Items (4,743), Aligned Role Tasks (4,743), Inputs & Outputs Inventory (835), Value Stream Metrics (267), Metric_Catalog (102) / Metric_Catalog_Expanded (151) / External_Metric_Catalog (52), Application TCO (8), Cap–Application Catalog (30), Scenario Inputs (6), Financial Impact Overview, External Interactions (27).*
- Extension: `standards_extended/` — `gdpr-standards.json` (21), `ccpa-cpra-standards.json` (22), `nydfs-500-standards.json` (22).
- App: https://transform-platform.vercel.app — `/`, `/roles`, `/overview`, `/active-ai`, `/standards`, `/portfolio` (+ program & initiative detail), Telemetry → Trackable Metrics.
- Blueprint: *Shibumi Platform Analysis — Blueprint for Building an Enterprise Transformation Management Clone.pdf*.
- Evidence base: `gap_evidence.md` (same folder).
