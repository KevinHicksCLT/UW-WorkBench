---
name: compliance-risk-management-sdlc-compliance
description: >
  Enforce and evidence the Compliance & Risk Management standards area (22 standards owned by the
  CRO / CCO) across the software delivery lifecycle — requirements, design, development, and
  testing — for any system that creates, monitors, or reports regulatory or enterprise risk. Use
  this skill whenever delivery work touches risk registers and risk reporting, regulatory inventory
  and change management, examination or regulatory-finding workflows, compliance testing and
  training tracking, policy and exception management, code-of-conduct and conflicts disclosures,
  whistleblower channels, market-conduct (sales practices, claims handling, consumer complaints),
  third-party/vendor risk, or regulatory reporting — even if the user does not say "compliance
  standard" or "ERM." Also use when a new system itself introduces regulatory obligations, and
  whenever the goal is evidence that compliance workflows track items to closure. When unsure
  whether a system has a compliance dimension, run the scope gate rather than skipping it.
---

# Compliance & Risk Standards Across the SDLC — Tracked to Closure, Evidenced by Design

## What this skill does

The Compliance & Risk Management area defines **22 standards** across ERM, Regulatory, Compliance,
Policy, Ethics, Market Conduct, Vendor, and Reporting. They are **Run-phase program standards** —
but they run on systems: risk registers, complaint trackers, policy repositories, disclosure tools,
reporting pipelines. This skill applies in two directions: (a) **building the systems** that the
compliance program runs on, and (b) **catching the compliance obligations a new system itself
creates** (a new product flow can trigger market-conduct, complaint-handling, and regulatory-
reporting duties). Each gate names the **evidence** an examiner or internal audit would request.

The source standards live in the app's Standards area (**Data Admin → Standards → Compliance &
Risk Management**), each with category, phase, and responsible role (CRO, CCO, ERM Director,
Compliance Manager, Ethics Officer, Market Conduct Lead, Vendor Risk Manager).

## Operating principle (read once, apply always)

> **Compliance items don't close themselves — "tracked to closure" is a system property.**
> *Regulatory Findings* (root cause, preventive measures), *Consumer Complaints* (timelines, root
> cause, regulatory reporting), and *Policy Exceptions* (time-limited, compensating controls) all
> share one failure mode: an item that ages out silently. Every compliance workflow we build must
> make silent aging impossible — owner, deadline, escalation, and immutable history on every item.

Maintain one **Compliance & Risk Record** per system/feature mapping each touched standard to its
enforcing control and evidence.

## STEP 0 — Scope gate (always run first)

1. **Is the system part of the compliance/risk toolchain** (risk register, complaint management,
   policy repo, disclosure tool, exam workspace, regulatory-reporting pipeline)? → direction (a):
   the gates govern what you build.
2. **Does the new system create compliance obligations of its own?** New customer-facing flows →
   *Sales Practice Standards*, *Claims Handling Standards* (unfair-claims-practices timing),
   *Consumer Complaints* capture; new vendors → *Third-Party Risk Management* (due diligence, risk
   tiering before engagement); new regulated activity → *Regulatory Inventory* update.
3. **Does it feed Board or regulator reporting?** → *Risk Reporting* (monthly dashboard, quarterly
   Board report) and *Regulatory Reporting* (accuracy controls, timely submission) data contracts apply.

- If neither direction applies → record the determination and stop.
- If unsure → treat as in-scope and escalate to the Compliance Manager.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- For compliance tooling: every tracked item type (risk, finding, complaint, exception, disclosure)
  gets owner, severity/tier, deadline, escalation trigger, and closure criteria as first-class
  fields — per *Risk Mitigation* (action plans tracked, owners accountable), *Regulatory Findings*,
  *Issue/complaint timelines*.
- For any new system: run the obligation screen from STEP 0.2 and write resulting requirements
  (complaint capture, disclosure points, reporting feeds) as acceptance criteria.
- Capture *Regulatory Inventory* linkage: which regulations the system implements or affects.
- **Evidence:** item lifecycle model, obligation-screen result, regulation linkage list.

### 2. Design
- Risk scoring per *Risk Assessment* (likelihood × impact; inherent vs. residual; heat-map data).
- Workflow design enforces timelines and escalation: complaints logged ≤ 24 h with acknowledgment
  (*Consumer Complaints* via Operations), exceptions time-limited with expiry alerts (*Policy
  Exceptions*), findings carry root-cause and preventive-measure fields (*Regulatory Findings*).
- *Whistleblower Program* support designed for anonymity and non-retaliation: no identifying
  metadata leakage, strict access walls.
- *Policy Management* repository design: owner, review cycle (annual minimum), version control,
  acknowledgment tracking; *Conflicts of Interest* annual-disclosure workflow with recusal tracking.
- Reporting feeds match the *Risk Reporting* and *Regulatory Reporting* calendars and accuracy
  controls; *Examination Management* support (document-request tracking, response review).
- **Evidence:** scoring design, workflow diagrams with timers/escalations, anonymity design review, reporting data contracts.

### 3. Development
- Implement immutable audit history on every compliance item; no hard deletes; closure requires the
  defined criteria (root cause, preventive measures, approver).
- Implement expiry and escalation jobs (aging exceptions, overdue findings, breached complaint
  timelines) with alerting that cannot be muted without record.
- Implement completion tracking for *Compliance Training* (annual, role-specific modules) and *Code
  of Conduct* acknowledgments.
- **Evidence:** control→code map, audit-history samples, escalation-job test logs, tracking feeds.

### 4. Testing
- Lifecycle tests: an exception expires and escalates; a finding cannot close without root cause; a
  complaint past its response timeline alerts and reports.
- Confidentiality tests: whistleblower submissions carry no identifying metadata; conflicts and ER
  data walled to authorized roles.
- Reporting tests: dashboard and regulatory extracts reconcile to the underlying items (accuracy
  controls per *Regulatory Reporting*).
- **Evidence:** lifecycle test results, anonymity verification, reconciliation worksheet.

## Run / operate handoff (not build gates)
*Risk Appetite Statement* (Board-approved, annual review), *Risk Identification* (annual
assessment, emerging risks), *Compliance Program* effectiveness review, *Compliance Testing*
(risk-based plan and calendar), *Regulatory Change Management* (alerts, impact assessments),
vendor ongoing monitoring, and ethics-program operation. The systems supply tracking and signals;
the CRO/CCO organization owns the program.

## How to use this skill in practice
- **Building compliance tooling:** run the gates over the item lifecycle — owner, deadline,
  escalation, immutable history, closure criteria.
- **Any new system kickoff:** run STEP 0.2's obligation screen; write the obligations into the
  backlog before build.
- **Exam/audit prep:** confirm every item type shows tracked-to-closure evidence and reconciled
  reporting in the Compliance & Risk Record.

## Boundaries
Engineering guidance, not legal or regulatory advice. Risk-appetite content, finding severity,
exception approval, and regulatory interpretations belong to the CRO/CCO and counsel. Regulation-
specific build obligations (GDPR, CCPA/CPRA, NYDFS 500) have their own skills — invoke them when
their scope gates trigger. This skill ensures compliance work is systematized and evidenced; it
does not make the compliance judgement.
