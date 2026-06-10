---
name: operations-customer-service-sdlc-compliance
description: >
  Enforce and evidence the Operations & Customer Service standards area (22 standards owned by the
  COO) across the software delivery lifecycle — requirements, design, development, and testing —
  for any system that supports contact-center, policy-service, billing, or back-office operations.
  Use this skill whenever delivery work touches phone/email/chat service levels, policy
  endorsements/certificates/cancellations, call and transaction quality monitoring, customer
  satisfaction and NPS, invoicing, collections, and payment application, SOPs and process
  documentation, workforce management and staffing, complaint handling and escalation, BPO/vendor
  operations, document management, operational reporting, or business continuity — even if the
  user does not say "operations standard" or "SLA." Also use when writing user stories, workflow
  designs, APIs, or test plans for operational systems, and whenever the goal is evidence that
  service levels are measured and enforced by the system. When unsure whether a system supports an
  operational process, run the scope gate rather than skipping it.
---

# Operations Standards Across the SDLC — Service Levels the System Can Prove

## What this skill does

The Operations & Customer Service area defines **22 standards** across Service Levels, Quality,
Billing, Process, Training, Workforce, Complaints, Vendor, Document, Reporting, and Business
Continuity. They are **Run-phase standards** executed on the operational floor — but every SLA,
quality sample, and escalation depends on systems that timestamp, route, measure, and report. This
skill translates those dependencies into **SDLC gates** and names the **evidence** each must leave,
so "80% of calls answered in 30 seconds" is a dashboard fact, not a manager's estimate.

The source standards live in the app's Standards area (**Data Admin → Standards → Operations &
Customer Service**), each with category, phase, and responsible role (Contact Center Manager,
Policy Admin Manager, Quality Manager, Billing/Collections/AR Manager, Operations Manager, WFM
Manager, Customer Experience Lead).

## Operating principle (read once, apply always)

> **An SLA the system can't measure is already breached.** *Phone SLA* (80% in 30 s, abandonment
> < 5%), *Email/Chat SLA* (email ≤ 4 h, chat wait < 2 min, FCR > 70%), and *Policy Service SLA*
> (endorsements ≤ 48 h, certificates same day, cancellations per state requirements) all start with
> instrumentation: accurate clock-start events, queue telemetry, and breach alerting designed in
> from the first story.

Maintain one **Operations Compliance Record** per system/feature mapping each touched standard to
its measuring/enforcing control and report.

## STEP 0 — Scope gate (always run first)

1. **Does the system serve or support an operational process** — contact channels, policy
   servicing, billing/collections, document handling, workforce scheduling, vendor/BPO workflows?
2. **Which categories does it touch?** Only touched categories' gates apply.
3. **Customer-facing or money-touching?** Customer-facing → complaint capture and CSAT/NPS hooks
   are mandatory; money-touching → *Invoice Accuracy* and *Payment Processing* controls are
   mandatory (and see the finance-accounting skill for GL-side controls).
4. **State-regulated timing?** Cancellations and certain notices follow state requirements —
   timing rules must be configurable per state, not hardcoded.

- If no operational touchpoint → record the determination and stop.
- If unsure → treat as in-scope and escalate to the Operations Manager.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Convert each touched SLA into acceptance criteria with explicit clock-start/stop events and
  measurement points (*Phone SLA*, *Email/Chat SLA*, *Policy Service SLA*, *Payment Processing*:
  same-day cash application, suspense cleared ≤ 48 h).
- Require quality-sampling support: *Call Quality Monitoring* (5 calls/agent/month) and
  *Transaction Quality* (5% sample, accuracy > 99%) need selectable, reviewable records.
- Capture complaint requirements: logged ≤ 24 h, acknowledgment sent, resolution tracked
  (*Complaint Handling*), with *Escalation Process* criteria.
- **Evidence:** SLA criteria with clock definitions, sampling requirements, complaint data model.

### 2. Design
- Workflow design enforces routing and timing: queue/skill routing, SLA timers with breach
  alerting, escalation paths with management notification (*Escalation Process*).
- Design the measurement layer per *Operational Reporting* (daily dashboard, weekly scorecard,
  monthly business review, trend analysis) — metrics defined with the report, not retrofitted.
- *Document Management* design: indexing standards, retention schedules, retrieval SLA,
  destruction protocols.
- *Workforce Management* feeds: forecast vs. actual volumes, schedule adherence, real-time data.
- Survey and feedback loops per *Customer Satisfaction* (post-interaction surveys, NPS, verbatim
  analysis, closed-loop follow-up).
- BCP per *BCP/DR Plans*: documented continuity behavior, alternate-site capability assumptions.
- **Evidence:** workflow + timer design, metric definitions, document-lifecycle design, WFM data contract, BCP notes.

### 3. Development
- Implement server-side SLA clocks and breach events; suspense-item aging; dunning schedule
  automation (*Collections Process*).
- Implement *Invoice Accuracy* controls (validation before issue; dispute workflow with 5-business-
  day resolution tracking).
- Emit quality-sampling datasets, complaint lifecycle events, and survey triggers; recordings and
  transactions retrievable for review.
- Keep procedures and system behavior aligned: changes that alter a process step flag the affected
  SOP (*Standard Operating Procedures*: version control, annual review).
- **Evidence:** control→code map, breach-alert samples, dispute/complaint lifecycle logs, SOP-impact notes.

### 4. Testing
- Timing tests: each SLA clock measures from the correct event; breach alerts fire; state-specific
  cancellation timing honored per configuration.
- Volume tests: dashboards and WFM feeds stay accurate at production-scale load.
- Lifecycle tests: complaint logged → acknowledged → resolved with full audit trail; dispute
  resolution tracked; document retrieval meets its SLA.
- Continuity test: degraded-mode/alternate-site behavior matches the BCP design.
- **Evidence:** timing-test results mapped to standards, load-test report, lifecycle proofs, continuity-test record.

## Run / operate handoff (not build gates)
Quality scorecards and coaching (*Call Quality Monitoring*), *Continuous Improvement*
(Kaizen/Lean, benefits measured), *New Hire Training* and *Ongoing Training*, staffing ratios and
cross-training (*Staffing Standards*), *BPO Management* governance (SLAs, audit rights), annual
SOP review, and annual BCP testing. The system supplies the measurements; Operations owns the floor.

## How to use this skill in practice
- **Reviewing/authoring an operations story or design:** run the matching gate; every touched SLA
  must have a clock, an alert, and a report.
- **New operational-system work kickoff:** run STEP 0, map touched categories, walk the gates.
- **Business-review prep:** confirm dashboard metrics trace to system events listed in the
  Operations Compliance Record.

## Boundaries
Engineering guidance, not operational management. SLA targets, staffing models, quality-score
calibration, and vendor governance belong to the COO's organization. Regulatory complaint-reporting
interpretation belongs to Compliance (see the compliance-risk-management skill). This skill ensures
the systems measure and enforce the standards; it does not run the operation.
