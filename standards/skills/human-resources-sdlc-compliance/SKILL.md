---
name: human-resources-sdlc-compliance
description: >
  Enforce and evidence the Human Resources standards area (22 standards owned by the CHRO) across
  the software delivery lifecycle — requirements, design, development, and testing — for any system
  that touches employee data or HR processes. Use this skill whenever delivery work involves
  recruiting and requisition workflows, interviews and offers, onboarding/offboarding and access
  provisioning, performance and goal management, compensation, bonus, or equity administration,
  benefits and leave (FMLA/ADA), learning and training tracking, employee relations and
  investigations, HR compliance (I-9, EEO, wage and hour), or HRIS data and integrations — even if
  the user does not say "HR standard." Also use when writing user stories, workflow designs, APIs,
  or test plans for HR systems, and whenever the goal is evidence that employee-data controls and
  process steps actually execute. When unsure whether a system handles employee data, run the scope
  gate rather than skipping it.
---

# HR Standards Across the SDLC — Employee Data and Process Controls Built In

## What this skill does

The Human Resources area defines **22 standards** across Recruiting, Onboarding, Performance,
Compensation, Benefits, L&D, Employee Relations, Compliance, Offboarding, and HRIS. They are
**Run-phase standards** executed by HR teams — but the HR systems either enforce the workflows,
approvals, and recordkeeping or leave HR exposed (an offer without background-check completion, a
termination without same-day access cutoff, an unauditable personnel file). This skill translates
those dependencies into **SDLC gates** with named **evidence**, with special weight on the two
highest-risk seams: **compensation data confidentiality** and the **HR↔IT access lifecycle**.

The source standards live in the app's Standards area (**Data Admin → Standards → Human
Resources**), each with category, phase, and responsible role (Talent Acquisition Lead, HR
Operations, HR Business Partner, Compensation Manager, Benefits Manager, Employee Relations Lead).

## Operating principle (read once, apply always)

> **Employee data is Restricted by default, and the joiner–mover–leaver clock is a control.**
> *Exit Process* requires **access termination the same day**; *Day One Readiness* requires access
> provisioned by day one. Both are system-enforced events, not emails — and *Recordkeeping*
> (personnel files, retention per policy, access controls) means every HR action must leave an
> auditable trace visible only to those who need it.

Maintain one **HR Compliance Record** per system/feature mapping each touched standard to its
enforcing control and evidence.

## STEP 0 — Scope gate (always run first)

1. **Does the system store or process employee/candidate data** (HRIS, ATS, payroll feeds,
   performance tools, benefits portals, LMS, badge/access integrations)?
2. **Which categories does it touch?** Recruiting, Onboarding, Performance, Compensation, Benefits,
   L&D, Employee Relations, Compliance, Offboarding, HRIS — only touched categories' gates apply.
3. **Compensation, health, or investigation data?** → strictest confidentiality controls: role-based
   visibility, field-level protection, access logging.
4. **Does it grant or revoke system access?** → the joiner–mover–leaver integration gates apply.

- If no employee data and no HR process → record the determination and stop.
- If unsure → treat as in-scope and escalate to HR Operations.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Capture workflow preconditions as blocking rules: *Requisition Process* (approved req before
  posting; validated comp range), *Offer Process* (approval workflow; **background check complete**
  before start), *Performance Improvement* (HR involvement; tracked timeline).
- Define the data model for compliance artifacts: *Employment Law Compliance* (I-9 records, EEO
  categories, wage-and-hour data), *Leave Management* (FMLA/ADA tracking, return-to-work),
  *Policy Administration* (acknowledgment tracking).
- State confidentiality requirements per data class (comp, health, ER investigations).
- **Evidence:** workflow precondition list, compliance data model, confidentiality matrix.

### 2. Design
- *Data Integrity* (HRIS as single source of truth; integrations with payroll/benefits; regular
  audits) — design every other system to consume, not duplicate, HRIS records.
- Design the joiner–mover–leaver event flow: *Day One Readiness* (equipment, access, buddy,
  orientation triggered from hire event) and *Exit Process* (exit checklist; **same-day access
  termination** event to IAM; knowledge transfer; exit interview).
- Approval routing as configuration: offer approvals, *Salary Administration* (pay grades, equity
  analysis), *Bonus Programs* (eligibility, methodology, approval), *Equity Administration*
  (grants, vesting).
- Design *Investigation Process* support with strict confidentiality walls and documentation
  standards; *Interview Process* artifacts (structured scorecards) captured systematically.
- **Evidence:** HRIS integration design, JML event design, approval-routing config, confidentiality design.

### 3. Development
- Implement blocking preconditions server-side (no posting without approved req; no start date
  without completed background check; no PIP without HR record).
- Implement field-level security and access logging on comp/health/ER data; *Recordkeeping*
  retention rules and access controls on personnel files.
- Emit completion/tracking events for *Training Programs* (mandatory training tracked), *Goal
  Setting* (documented by Q1), *Performance Reviews* (mid-year + annual, calibration), and
  *30-60-90 Plan* check-ins.
- **Evidence:** control→code map, access-log samples on sensitive fields, retention config, tracking-event feeds.

### 4. Testing
- Negative tests: posting blocked without approved requisition; offer release blocked pre-background
  check; comp fields invisible to unauthorized roles; ER investigation records walled off.
- JML tests: hire event provisions day-one access; termination event revokes **all** access the
  same day (verify against the access systems, not just the HR record).
- Compliance tests: I-9 completeness validation, EEO report extract accuracy, policy-acknowledgment
  tracking, leave-accrual and FMLA-clock calculations.
- **Evidence:** blocked-action proofs, JML end-to-end test record, compliance-report validation results.

## Run / operate handoff (not build gates)
*Sourcing Standards* (diverse slates), calibration sessions, *Benefits Administration* annual
enrollment, *Leadership Development* and succession planning, handbook updates, HRIS *Data
Integrity* periodic audits, and required-posting compliance. The system supplies workflows and
records; HR owns the operation.

## How to use this skill in practice
- **Reviewing/authoring an HR-system story or design:** run the matching gate; every touched
  precondition and confidentiality rule must be enforced and evidenced.
- **New HR-system work kickoff:** run STEP 0, map touched categories, walk the gates.
- **Audit prep:** confirm access logs, retention configs, and compliance extracts exist per the HR
  Compliance Record.

## Boundaries
Engineering guidance, not HR or employment-law advice. Comp philosophy, PIP decisions,
investigation conduct, and accommodation determinations belong to the CHRO's organization and
Employment Counsel (see the legal-governance skill). This skill ensures the systems enforce and
evidence the standards; it does not make people decisions.
