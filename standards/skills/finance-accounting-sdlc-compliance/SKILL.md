---
name: finance-accounting-sdlc-compliance
description: >
  Enforce and evidence the Finance & Accounting standards area (22 standards owned by the CFO /
  Controller) across the software delivery lifecycle — requirements, design, development, and
  testing — for any system that posts, moves, reconciles, or reports money. Use this skill whenever
  delivery work touches the general ledger, journal entries, month-end close, reconciliations,
  accounts payable/receivable, payment processing, treasury and cash, budgeting/forecasting, tax,
  statutory or GAAP reporting, or SOX controls and segregation of duties — even if the user does not
  say "finance standard" or "SOX." Also use when writing user stories, integration designs, APIs,
  or test plans for financial systems, and whenever the goal is evidence that automated controls
  (approval workflows, dual approvals, SOD) actually operate. When unsure whether a system has a
  financial-reporting or payment impact, run the scope gate rather than skipping it.
---

# Finance Standards Across the SDLC — Controls That Auditors Can Test

## What this skill does

The Finance & Accounting area defines **22 standards** across Close Process, Reporting, AP/AR,
Treasury, Budgeting, Tax, Controls, and Audit. They are **Run-phase standards** executed by finance
teams — but most of them depend on system-enforced controls: approval workflows, three-way match,
dual approvals, SOD enforcement, and reconciliation feeds. This skill translates those dependencies
into **SDLC gates** and names the **evidence** each must leave, so the *SOX Compliance* key-control
documentation and the external auditor's control testing point at real, testable mechanisms.

The source standards live in the app's Standards area (**Data Admin → Standards → Finance &
Accounting**), each with category, phase, and responsible role (Controller, FP&A Manager, AP/AR
Manager, Treasurer, Tax Director, CFO).

## Operating principle (read once, apply always)

> **A financial control that can be bypassed in the system doesn't exist for the auditor.**
> *Journal Entry Controls* (approval per authority matrix, supporting documentation, no backdating)
> and *Payment Controls* (dual approval > $10K; callback verification for bank-account changes) are
> only as strong as their system enforcement — and SOX testing will sample the system's records,
> not the policy document.

Maintain one **Finance Compliance Record** per system/feature mapping each touched standard to its
enforcing control and the report/log an auditor would test.

## STEP 0 — Scope gate (always run first)

1. **Does the system post to or feed the GL, move money, or produce financial reports** (billing,
   payments, payroll feeds, claims payments, premium booking, expense, treasury, reporting marts)?
2. **Is it SOX-relevant?** Any system in the financial-reporting flow → *SOX Compliance* (key
   controls documented and testable) and *Segregation of Duties* (SOD matrix, conflicts mitigated)
   are mandatory gates.
3. **Which categories does it touch?** Close, Reporting, AP/AR, Treasury, Budgeting, Tax, Controls,
   Audit — only touched categories' gates apply.

- If no financial impact → record the determination and stop.
- If unsure → treat as SOX-relevant and escalate to the Controller.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Identify every financial posting/flow the system creates and its place in the close: feeds must
  respect the *Close Calendar* (published milestones) and support the *Close Checklist* sign-offs.
- Capture control requirements as acceptance criteria: JE approval matrix (*Journal Entry
  Controls*), *Invoice Processing* (approval workflow, 3-way match for PO items), *Payment Controls*
  (dual approval, callback verification), *Segregation of Duties* (which combinations of actions a
  single user must never hold).
- State the reporting basis: *GAAP Compliance* (documented policies; changes approved by CFO) and,
  for insurance entities, *Statutory Reporting* (NAIC, Annual Statement accuracy).
- **Evidence:** posting-flow inventory, control acceptance criteria, SOD requirement matrix.

### 2. Design
- Design approval workflows with the authority matrix as configuration; no backdating (posting-date
  controls); document retention attached to transactions.
- Design *Reconciliation Standards* support: system feeds reconcilable balances with audit trail;
  aging of open items; materiality-threshold flags.
- Treasury touchpoints per *Cash Management* (daily position, 13-week forecast feed) and *Bank
  Account Controls* (signer data current; account inventory).
- Reporting designs meet the calendar: *Management Reporting* (flash WD+3, full P&L WD+10),
  *Board Reporting* (package 5 days ahead), *Tax Provision* (quarterly ASC 740 data needs).
- SOD enforced in the role model, with documented compensating controls where unavoidable.
- **Evidence:** workflow/approval design, reconciliation data-contract, SOD role-model analysis, reporting-calendar fit.

### 3. Development
- Implement approval and dual-approval checks server-side; every override and approval logged with
  user, timestamp, and supporting-document link.
- Implement 3-way match (PO/receipt/invoice) and payment-release controls; bank-detail changes
  require the verification step (*Payment Controls*).
- Build immutable audit trails on journal entries and payments; *Collections Standards* and
  *Forecast Standards* data feeds emitted for AR aging and rolling forecasts.
- **Evidence:** control→code map, approval/override logs, match-exception reports, audit-trail samples.

### 4. Testing
- Control tests an auditor could rerun: JE above threshold without approval is blocked; payment
  > $10K with a single approver is blocked; an SOD-conflicting role assignment is rejected;
  backdated posting is rejected.
- Reconciliation tests: system totals tie to GL postings for a closed period; aging buckets correct.
- Reporting tests: flash/P&L extracts complete within the WD+3/WD+10 windows on production-scale data.
- **Evidence:** blocked-transaction proofs, tie-out worksheet, timed reporting runs — filed in the record for *External Audit Support* (PBC requests answered ≤ 48 h).

## Run / operate handoff (not build gates)
*Close Calendar*/*Close Checklist* execution, monthly *Reconciliation Standards* operation,
*Collections Standards* cadence, *Investment Policy* monitoring, *Budget Process* and *Forecast
Standards* cycles, *Tax Compliance* filing calendar, SOX testing calendar and deficiency
remediation, and *Internal Audit Coordination* (management response ≤ 30 days). The system supplies
controls and data; Finance owns the operation.

## How to use this skill in practice
- **Reviewing/authoring a finance-system story or design:** run the matching gate; every touched
  control must be system-enforced and auditor-testable.
- **New financial-system work kickoff:** run STEP 0 (including the SOX determination), walk the gates.
- **Audit prep:** confirm every key control has logs/reports an auditor can sample, listed in the
  Finance Compliance Record.

## Boundaries
Engineering guidance, not accounting advice. GAAP/statutory policy, authority-matrix values,
materiality, ASC 740 positions, and SOX scoping are Controller/CFO judgement. This skill ensures the
systems enforce and evidence the standards; it does not set accounting policy.
