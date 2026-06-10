---
name: claims-operations-sdlc-compliance
description: >
  Enforce and evidence the Claims Operations standards area (20 standards owned by the Chief Claims
  Officer) across the software delivery lifecycle — requirements, design, development, and testing —
  for any system that supports claims intake, adjudication, or payment. Use this skill whenever
  delivery work touches FNOL intake, coverage verification, reserving, claim investigation and
  documentation, settlement and payment processing, claim file quality review, fraud/SIU referral,
  subrogation, litigation, or reinsurance notification — even if the user does not say "claims
  standard." Also use when writing user stories, workflow designs, APIs, or test plans for claims
  systems, and whenever the goal is evidence that the system enforces the claims-handling SLAs and
  authority limits rather than relying on adjuster memory. When unsure whether a system touches the
  claims lifecycle, run the scope gate rather than skipping it.
---

# Claims Standards Across the SDLC — SLAs and Authority Limits Built Into the System

## What this skill does

The Claims Operations area defines **20 standards** across FNOL, Reserving, Investigation,
Settlement, Quality, Fraud/SIU, Subrogation, Litigation, and Reinsurance. They are **Run-phase
operational standards** — but every one of them is either enforced, measured, or silently broken by
the claims systems we build. This skill translates them into **SDLC gates**: the system must encode
the SLAs as timers and alerts, the authority limits as hard controls, and the documentation rules as
required fields — and leave **evidence** that it does, which is exactly what a market-conduct exam
or claims audit will ask for.

The source standards live in the app's Standards area (**Data Admin → Standards → Claims
Operations**), each with category, phase, and responsible role (Claims Manager, Claims Adjuster,
SIU Manager).

## Operating principle (read once, apply always)

> **If the system doesn't enforce the SLA, the SLA is a hope.** "*Intake SLA*: FNOL acknowledged
> within 4 hours, assigned within 24" and "*Settlement Authority*: manager approval for policy-limit
> settlements" are control failures waiting to happen unless the workflow makes the compliant path
> the only path — with a timestamped audit trail.

Maintain one **Claims Compliance Record** per system/feature mapping each touched standard to the
control that enforces it and the report that evidences it.

## STEP 0 — Scope gate (always run first)

1. **Does the system create, route, modify, or pay claims** — or feed data into a system that does
   (FNOL portals, adjuster workbenches, payment engines, document intake, vendor integrations)?
2. **Which lifecycle stages does it touch?** Map to the categories: FNOL, Reserving, Investigation,
   Settlement, Quality, Fraud/SIU, Subrogation, Litigation, Reinsurance — only the touched
   categories' gates apply.
3. **Does it move money or set reserves?** → the authority-matrix and dual-control standards become
   hard requirements, not nice-to-haves.

- If no claims-lifecycle touchpoint → record the determination and stop.
- If unsure → treat as in-scope and escalate to the Claims Manager.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Convert every touched SLA into a measurable acceptance criterion with its clock-start event:
  *Intake SLA* (acknowledge ≤ 4 h, assign ≤ 24 h), *Coverage Verification* (confirm ≤ 24 h, denial
  letter ≤ 72 h), *Initial Contact* (≤ 24 h, attempts documented), *Initial Reserve Standards*
  (reserve ≤ 72 h with documented rationale), *Payment Processing* (≤ 5 business days from
  settlement).
- Capture the authority rules as data, not prose: *Settlement Authority*, *Large Loss Threshold*
  (> $100K senior adjuster, > $500K manager oversight), *Reserve Adequacy Review* (manager approval
  for changes > $25K).
- Require the *Red Flag Indicators* checklist and the 48-hour SIU-referral trigger in intake flows.
- **Evidence:** SLA acceptance criteria with clock definitions, authority matrix as configuration, red-flag requirement.

### 2. Design
- Workflow design enforces sequence and timing: SLA timers, escalation on breach, diary reviews at
  30/60/90 days (*Reserve Adequacy Review*), renewal of contact attempts.
- Authority enforced at the transaction: settlement and reserve changes route to the right approval
  level automatically; *Release Documentation* (signed release before payment, subrogation rights
  preserved) is a blocking step; *Payment Processing* includes payee verification.
- Design the audit trail per *Documentation Requirements*: all claim activity recorded within 24 h,
  photos/evidence linked to the file; *Expert Engagement* per the authority matrix.
- Design data capture for *Subrogation* (*Recovery Standards*: potential evaluated on every claim),
  *Litigation Management* (panel counsel, litigation plan, reserve adjustment), and *Reinsurance
  Notification* (treaty terms; facultative reported ≤ 72 h).
- **Evidence:** workflow diagrams with timers/approvals, authority-routing design, audit-trail design, notification design.

### 3. Development
- Implement SLA clocks server-side with timezone-safe timestamps; breaches generate alerts and are
  reportable (feeds *Cycle Time Targets*: Auto 30d / Property 45d / Liability 90d / Complex 180d).
- Implement hard authority checks — no client-side-only enforcement; overrides require recorded
  approval.
- Emit the quality-review dataset for *File Review Standards* (10% monthly sample, quality
  scorecard) and *Customer Satisfaction* (post-claim survey trigger, complaint escalation ≤ 24 h).
- **Evidence:** control→code map, SLA-breach alert samples, authority-override audit log, survey/complaint event feed.

### 4. Testing
- Timing tests: each SLA clock starts/stops on the right events; breach alerts fire; diary reviews
  appear at 30/60/90 days.
- Authority tests: a policy-limit settlement cannot be issued without manager approval; a > $25K
  reserve change without approval is blocked; > $100K claims route to senior adjusters.
- Negative tests: payment blocked without signed release; SIU referral fires within 48 h of red-flag
  triggers; facultative reinsurance notice generated within 72 h.
- **Evidence:** test cases mapped to standards, timestamped pass results, blocked-transaction proofs.

## Run / operate handoff (not build gates)
*File Review Standards* execution and quarterly calibration, *Cycle Time Targets* monitoring, NPS
tracking (*Customer Satisfaction*, target > 40), *SIU Investigation Standards* (plan within 5 days,
law-enforcement coordination), subrogation recovery tracking, and litigation panel management. The
system must emit the data; claims leadership owns the operation.

## How to use this skill in practice
- **Reviewing/authoring a claims story or design:** run the matching gate; every touched SLA and
  authority rule must appear as an enforced control with evidence.
- **New claims-system work kickoff:** run STEP 0, map touched categories, walk the four gates.
- **Audit/exam prep:** confirm each standard maps to a control and a report in the Claims
  Compliance Record.

## Boundaries
Engineering guidance, not claims-handling advice. Authority-matrix values, reserve philosophy,
settlement decisions, and SIU referral judgement belong to the Chief Claims Officer's organization.
Unfair-claims-practices regulatory interpretation belongs to Compliance (see the
compliance-risk-management skill). This skill ensures the systems enforce and evidence the
standards; it does not set them.
