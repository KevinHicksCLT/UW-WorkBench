---
name: underwriting-sdlc-compliance
description: >
  Enforce and evidence the Underwriting standards area (20 standards owned by the Chief Underwriting
  Officer) across the software delivery lifecycle — requirements, design, development, and testing —
  for any system that supports risk selection, pricing, quoting, binding, or renewal. Use this skill
  whenever delivery work touches submission intake and turnaround, risk appetite and prohibited
  risks, rating and pricing tools, deviation and referral workflows, authority matrices, binding,
  underwriting file documentation, renewals, OFAC/sanctions screening, or rate/form filing
  compliance — even if the user does not say "underwriting standard." Also use when writing user
  stories, workflow designs, APIs, or test plans for underwriting or policy systems, and whenever
  the goal is evidence that the system enforces filed rates and authority limits. When unsure
  whether a system touches the underwriting lifecycle, run the scope gate rather than skipping it.
---

# Underwriting Standards Across the SDLC — Appetite, Authority, and Filed Rates as Code

## What this skill does

The Underwriting area defines **20 standards** across Risk Appetite, Submission, Pricing, Authority,
Quality, Renewal, Compliance, and Training. They are **Run-phase operational standards**, but the
underwriting platform either enforces them or quietly lets them erode: an unenforced *Prohibited
Risks* list, a bypassable *Authority Matrix*, or an unfiled rate applied in production are exactly
the findings a regulator or internal audit will surface. This skill translates the standards into
**SDLC gates** and names the **evidence** each must leave.

The source standards live in the app's Standards area (**Data Admin → Standards → Underwriting**),
each with category, phase, and responsible role (Chief UW Officer, UW Manager, Underwriter).

## Operating principle (read once, apply always)

> **Filed rates and authority limits are law inside the platform.** *Rating Standards* (filed rates
> applied correctly, schedule rating documented) and *Binding Authority* (only authorized personnel
> can bind) are not configurable preferences — the system must make a deviation impossible without
> a recorded, authorized exception (*Deviation Authority*: per matrix, documented, audit trail).

Maintain one **Underwriting Compliance Record** per system/feature mapping each touched standard to
its enforcing control and evidencing report.

## STEP 0 — Scope gate (always run first)

1. **Does the system quote, rate, bind, renew, or decline business** — or feed those decisions
   (submission portals, rating engines, workbenches, broker integrations, renewal batch jobs)?
2. **Which categories does it touch?** Risk Appetite, Submission, Pricing, Authority, Quality,
   Renewal, Compliance, Training — only touched categories' gates apply.
3. **Does it apply rates or bind coverage?** → filed-rate fidelity, *OFAC/Sanctions Screening*
   before binding, and authority enforcement become hard requirements.

- If no underwriting touchpoint → record the determination and stop.
- If unsure → treat as in-scope and escalate to the UW Manager.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Encode appetite as data: *Risk Appetite Statement* (by LOB, geography, industry; updated annually)
  and *Prohibited Risks* (no-write list enforced; exceptions need CUO approval) must be maintainable
  configuration, not hardcoded rules.
- Convert SLAs to acceptance criteria with clock-start events: *Submission Turnaround* (acknowledge
  ≤ 4 h, indication ≤ 48 h, firm quote ≤ 5 business days), *Declination Standards* (documented
  reason, decline letter ≤ 24 h, no silent non-renewals), *Renewal Timeline* (review 90 days out,
  quote 60 days out, non-renewal notice per state requirement).
- Require *Minimum Submission Requirements* (application, 5-year loss runs, supplemental
  questionnaire, inspection where required) as completeness validation.
- **Evidence:** appetite/no-write data model, SLA acceptance criteria, submission-completeness rules.

### 2. Design
- *Authority Matrix* as configuration (by premium, limit, LOB) driving automatic *Referral Process*
  routing (decision documented ≤ 24 h) and *Binding Authority* checks (verbal binders documented
  ≤ 24 h).
- Rating design preserves filed-rate fidelity: *Rating Standards* (schedule rating documented,
  minimum premium enforced), *Deviation Authority* (matrix-gated with mandatory documentation and
  audit trail), *Pricing Adequacy* hooks (mandatory pricing-tool usage; actuarial review trigger for
  large accounts).
- Design the underwriting file per *File Documentation* (application, analysis worksheet, pricing
  rationale, approvals — all system-captured) and the *Peer Review* trigger (> $100K premium before
  binding).
- *OFAC/Sanctions Screening* designed into bind and renewal flows (screen before binding; ongoing
  monitoring).
- **Evidence:** authority/referral routing design, rating-deviation control design, file-completeness model, screening integration design.

### 3. Development
- Implement appetite/no-write checks at submission intake; CUO-exception path with recorded approval.
- Implement rate calculation against approved, versioned rate tables (*Regulatory Compliance*: rate
  filings approved before use; form filings current) — rate-table changes are auditable deployments.
- Implement hard authority checks server-side; deviation and referral events fully logged.
- Emit the datasets for *Underwriting Audit* (5% monthly management sample, annual Internal Audit)
  and *Retention Targets* / hit-ratio reporting (*Target Market Definition*).
- **Evidence:** control→code map, versioned rate-table changelog, referral/deviation audit logs, audit-sample feed.

### 4. Testing
- Negative tests: a prohibited risk cannot be quoted without a CUO exception; an unauthorized user
  cannot bind; a deviation outside the matrix is blocked; an unscreened insured cannot bind.
- Rating regression: calculated premiums match the filed rates for a curated scenario set; minimum
  premium enforced; schedule-rating credits/debits documented.
- Timing tests: submission, declination, and renewal clocks fire correctly, including
  state-specific non-renewal notice windows.
- **Evidence:** rating-regression results, blocked-transaction proofs, timing-test results mapped to standards.

## Run / operate handoff (not build gates)
*Underwriting Audit* execution, *Peer Review* operation, *Retention Targets* and win-back processes,
appetite-statement annual refresh, *Continuing Education* (40 h CE annually; authority tied to
competency), and surplus-lines compliance monitoring. The system supplies the data and the controls;
UW leadership owns the operation.

## How to use this skill in practice
- **Reviewing/authoring an underwriting story or design:** run the matching gate; every touched
  SLA, authority rule, and rate control must be enforced and evidenced.
- **New underwriting-system work kickoff:** run STEP 0, map touched categories, walk the gates.
- **Audit/exam prep:** confirm rate-table version history, authority logs, and screening evidence
  exist in the Underwriting Compliance Record.

## Boundaries
Engineering guidance, not underwriting judgement. Appetite content, authority-matrix values, pricing
targets, and individual risk decisions belong to the CUO's organization; rate-filing strategy
belongs to Actuarial and Compliance (see the actuarial and compliance-risk-management skills). This
skill ensures the systems enforce and evidence the standards; it does not set them.
