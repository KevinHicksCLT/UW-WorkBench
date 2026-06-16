# Cascade — Product Guide

A walkthrough of the Cascade platform using the demo seed data.

## Signing in

Open `http://localhost:5173` and sign in with:
- **Email:** `demo@cascade.io`
- **Password:** `demo1234`

You'll land on the Portfolio page — the executive snapshot.

Other seeded users (same password):
- `sponsor@cascade.io` — Marcus Reed (Sponsor / Manager role)
- `priya@cascade.io` — Priya Patel (Initiative owner)
- `jamal@cascade.io` — Jamal Rivera (Initiative owner)

## Portfolio (the home page)

Four KPI tiles sit at the top: **Programs**, **Initiatives**, **Cumulative Benefit**, **Net Benefit**. Below them, a stacked area chart shows monthly Actual vs Target vs Forecast benefits across the entire portfolio. Side-by-side bar charts break initiatives down by status and stage. At the bottom, the top 5 open risks by severity link directly to the affected initiative.

## Programs

Click **Programs** in the sidebar. You'll see two demo programs:
- **Digital Operations Transformation** — three workstreams (Finance, Supply Chain, Customer)
- **Northwind M&A Integration** — three workstreams (IT, Cost Synergies, Revenue Synergies)

Click **Digital Operations Transformation** to enter the Program detail. Each workstream is rendered as a card with its initiatives in a table: stage progress bar, status pill, benefit, net, and owner.

Click **+ New Workstream** to add a workstream. Click **+ Initiative** in any workstream's header to add an initiative with a name, description, start, and due date.

## Initiative detail — the heart of the app

Click any initiative name (e.g., **Procurement Synergies**) to open its detail page.

### Top of page
The page header shows:
- Breadcrumb (Programs › Program name › Workstream name › Initiative name)
- Action buttons: **Submit for Approval**, **Move Back**

Below that, the **stage strip** shows the current stage as a horizontal progress bar across IDEA → PLAN → EXECUTE → REALIZE → COMPLETE. The status dropdown lets you set RAG status directly.

Four KPI tiles: Cumulative Benefit, Cumulative Cost, Net Benefit, Value Score.

### Tab: Summary
The description and key details (owner, sponsor, dates, state, workstream).

### Tab: Financials
A line chart of monthly Actual vs Target for both benefits and costs. Below the chart:
- A **Benefits** section with the line items (e.g., "Run-rate benefits"). Click a row to open the monthly grid.
- A **Costs** section, same shape.

In the monthly grid, switch between **ACTUAL**, **TARGET**, and **FORECAST** datasets at the top. Edit any month's amount and click **Save** for the chosen dataset. The Initiative's cumulative totals refresh automatically and the page reloads.

Click **+ Add Benefit** or **+ Add Cost** to create new lines.

### Tab: Workplan
Milestones with checkbox to mark complete. The **GATE** badge marks stage-gate milestones. Click **+ Milestone** to add one.

### Tab: RAID
Risks, Assumptions, Issues, Decisions for this initiative. Each row shows type, title, severity (computed from probability × impact), and a status dropdown to mark Open / Mitigated / Closed.

Click **+ RAID Item** to log a new one with probability and impact on a 1–5 scale.

### Tab: Alignment
Strategic Objectives this initiative supports, with Low/Medium/High impact. The objective's current achievement is shown for context. Use the dropdown at the bottom to link a new objective.

When you change the impact rating, the initiative's `valueScore` recomputes (Low=1, Medium=2, High=3) and you'll see it update in the KPI tile at the top.

### Tab: Audit
Every action on this initiative — created, status changed, stage advanced, etc. — with timestamp, actor, and JSON diff.

## Trying the workflow end-to-end

1. As `priya@cascade.io`, open one of her initiatives that's currently in PLAN. Click **Submit for Approval**. The initiative's `workflowAction` becomes "SUBMIT" and a notification is queued for the sponsor.
2. Sign out, sign in as `sponsor@cascade.io`. Open the same initiative. The header now shows an **Approve → Execute** button. Click it. Stage advances to EXECUTE; the audit log records `STAGE_ADVANCED` from PLAN to EXECUTE.

## RAID Log (cross-portfolio)

Click **RAID** in the sidebar. The 5×5 heatmap on the left counts open Risks in each (probability × impact) cell. Filter by type (RISK / ASSUMPTION / ISSUE / DECISION) and status (OPEN / MITIGATED / CLOSED) using the buttons. The table on the right lists all matching items with links to the affected initiative.

## OKRs

Click **OKRs**. You'll see three demo objectives:
- Accelerate Profitable Growth
- Drive Cost Transformation
- Improve Customer Experience

Each objective card shows its overall achievement bar (weighted average of its KPIs), a list of KPIs with their current vs target values and individual achievement bars, and the supporting initiatives with their impact rating.

Click **+ KPI** within an objective to add a new KPI. Set the unit (Number / Currency / Percent), direction (Higher or Lower is better), starting value, current value, and target value. The achievement is computed automatically.

## Business Rules

Click **Rules** in the sidebar. The demo seed includes one rule: **Notify sponsor on Off Track**. Click the rule name to inspect.

To test it: open any initiative and change its status from On Track to Off Track. The rule fires automatically; sign in as the sponsor (`sponsor@cascade.io`) and call `GET /api/notifications` (or check the audit log) to see the new notification.

Click **+ New Rule** to author a new rule:
- Pick the entity (Initiative, RAID, Program, Workstream).
- Pick the trigger (On Create, On Update, On Field Change).
- Pick the action (Notify, Set Value, Run Rule).
- Edit the JSON action config — `recipientField` can be `sponsorId` or `ownerId`; subject and body support `{!fieldName}` token interpolation.

## Audit Trail

Click **Audit** in the sidebar to see the entire tenant's audit history. Filter by entity type using the buttons at the top. Each row shows when, what entity, what action, who did it, and a JSON diff.

## What's intentionally not in the MVP

- **Resource Management** (capacity vs demand charts).
- **Scenario Management** (S1/S2/S3 alternative-future overlays).
- **Auto-refreshing executive PowerPoint Presentations.**
- **Interactive Gantt with dependency arrows** (we ship a milestone list, not a Gantt).
- **Email delivery** of notifications (in-app only today).
- **SAML SSO**.

These are mapped out in `docs/FUNCTIONAL.md` § Roadmap and represent the obvious stage-2 build.
