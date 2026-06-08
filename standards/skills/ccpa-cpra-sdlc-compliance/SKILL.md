---
name: ccpa-cpra-sdlc-compliance
description: >
  Enforce and evidence CCPA/CPRA (the California Consumer Privacy Act as amended by the California
  Privacy Rights Act, plus the 2025 CPPA regulations on ADMT, risk assessments, and cybersecurity
  audits) across the software delivery lifecycle — requirements, design, development, and testing —
  for any system that handles California consumers' personal information. Use this skill whenever
  delivery work touches personal or sensitive personal information, consumer privacy rights
  (know/access, delete, correct, opt-out of sale/sharing, limit sensitive PI), Global Privacy Control
  / opt-out signals, automated decision-making (ADMT) such as automated underwriting or pricing, data
  minimization, retention, reasonable security, or service-provider data sharing — even if the user
  does not say "CCPA" or "California." Also use when writing user stories, designs, APIs, or test
  plans for consumer-facing or PI-processing systems, and whenever the goal is evidence for a CCPA
  risk assessment or the annual cybersecurity-audit certification. When unsure whether California PI
  is in scope (note the GLBA-exemption nuance for insurers), run the scope gate rather than skipping it.
---

# CCPA/CPRA Across the SDLC — Privacy-by-Design and Audit Evidence

## What this skill does

California's privacy regime is **rights-centric and opt-out-based**, and since the 2025 CPPA
regulations it now also includes **formal risk assessments, ADMT rules, and an annual cybersecurity
audit**. This skill turns those obligations into **SDLC gates** and, for each gate, names the
**evidence artifact** to produce — so the capability backs the CPPA risk-assessment documentation and
the cybersecurity-audit certification, and survives an examiner's review.

Source obligations are in `references/ccpa-cpra-reference.md`; a quick cheat sheet is in
`references/ccpa-cpra-quick-reference.md`.

## Operating principle (read once, apply always)

> **In California, silence isn't consent — a missed opt-out signal is a violation.** The model is
> opt-out (sale/sharing), limit-use (sensitive PI), and honor-the-signal (Global Privacy Control).
> Design for the "no" you didn't explicitly hear. And under the 2025 regs, **what you can't document
> in a risk assessment, you can't lawfully do** for high-risk processing.

Maintain one **CCPA Compliance Record** per feature/system. The four gates write into it. Template +
the citation→evidence crosswalk are in `references/audit-evidence-map.md`.

## STEP 0 — Scope gate (always run first)

1. **Business? (§1798.140(d))** Does Meridian meet any threshold (> $25M revenue; 100,000+ consumers/
   households bought/sold/shared; or 50%+ revenue from selling/sharing PI)? Usually yes for a carrier.
2. **California PI in scope — and is it GLBA-exempt?** Identify the personal information the system
   handles for California consumers, then apply the **GLBA-exemption analysis**: PI collected/
   processed under GLBA is exempt, but the exemption is **information-level, not entity-level**.
   Non-GLBA PI (web visitors, prospects, marketing, employees/applicants, B2B contacts) **stays in
   scope**. Record which data flows are exempt vs covered.
3. **Sensitive PI? (§1798.140(ae))** Health, biometric, precise geolocation, financial credentials,
   etc. — triggers limit-use rights and a risk assessment.
4. **ADMT for a significant decision?** Does the system use automated decision-making that
   substantially replaces human judgement in underwriting, pricing, claims, or eligibility? → ADMT
   notice/opt-out/access/appeal **and** a mandatory risk assessment.
5. **Risk-assessment trigger?** Selling/sharing PI, processing SPI, ADMT for significant decisions,
   training ADMT, or automated inference of sensitive traits → **written risk assessment required
   before processing**.

- If **no in-scope California PI** → record the determination (and the GLBA analysis) and stop; but
  check other obligations (GDPR pack, other US state laws).
- If **unsure** → treat as in-scope and escalate to the Privacy Officer.

## The four phase gates

Each gate lists **mandatory checks** and the **evidence** each leaves behind. Open the matching
reference for the full checklist and insurance examples. A phase isn't "done" until its evidence
exists in the CCPA Compliance Record.

### 1. Requirements → `references/requirements-phase.md`
- Identify/classify PI and **SPI**; complete the **GLBA-exemption mapping** per data element.
- Define **notice at collection** content (categories, purposes, retention, sale/share).
- Capture rights acceptance criteria: know/access, delete, correct, opt-out of sale/sharing,
  limit SPI, non-discrimination, and (if applicable) ADMT notice/opt-out/access/appeal.
- Apply **data minimization & purpose limitation** to the requirements themselves.
- Run the **risk-assessment screening**; open a risk assessment if triggered.
- **Evidence:** PI/SPI inventory + GLBA map, notice content, rights acceptance criteria, risk-assessment screening result.

### 2. Design → `references/design-phase.md`
- Minimization/purpose-limitation by design; retention/deletion schedules (§1798.100).
- **Rights machinery:** how access, deletion (incl. directing service providers), correction,
  opt-out of sale/sharing, and limit-SPI actually execute across stores, logs, and processors.
- **Honor opt-out preference signals (GPC)** at the platform layer (§7025).
- **Reasonable security** design (note the §1798.150 breach private right of action).
- **Service-provider/contractor** data flows and required contract terms; mark sale/sharing paths.
- For ADMT: design pre-use notice, opt-out, access-to-logic, and **appeal/human-review** paths.
- Complete the **written risk assessment** (purposes, benefits, risks, safeguards, retention, impact).
- **Evidence:** completed risk assessment, data-flow + sale/share map, privacy design-decision records, GPC-handling design, ADMT design.

### 3. Development → `references/development-phase.md`
- Implement rights endpoints (know/delete/correct/opt-out/limit-SPI) and **GPC signal honoring**.
- Propagate opt-out of sale/sharing and deletion to service providers; enforce SPI limit-use.
- Field-level minimization; **no PI in logs/URLs/analytics** by default; reasonable security controls.
- Emit **audit logs** for PI access, export, deletion, and opt-out state changes.
- For ADMT: implement the human-review/appeal route and store the logic/version per decision.
- **Evidence:** control→code map, audit-log samples, opt-out/GPC propagation tests, scan results, PR approvals citing privacy criteria.

### 4. Testing → `references/testing-phase.md`
- Functional + timing tests for each right (acknowledge ≤ 10 business days; respond ≤ 45 days).
- **GPC test:** an opt-out signal is detected and stops sale/sharing.
- Deletion reaches service providers; opt-out persists across sessions/systems.
- Minimization/leak tests (no PI in logs/URLs); SPI limit-use enforced; security tests.
- ADMT: opt-out and appeal/human-review reachable; decision logic stored.
- Breach-readiness test feeding incident response (informs the §1798.150 exposure and cyber audit).
- **Evidence:** tests mapped to citations, timestamped pass results, leak-scan reports, in the record.

## Run / operate handoff (not build gates)
Privacy-policy 12-month refresh (§1798.130), **consumer-request handling & 24-month recordkeeping**
(§7101), **service-provider reassessment**, **risk-assessment submission to the CPPA** (from 1 Apr
2028), and the **annual independent cybersecurity audit + CPPA certification** (phased; > $100M cohort
first cert 1 Apr 2028). Each needs an owner and a telemetry signal — see `references/audit-evidence-map.md`.

## How to use this skill in practice
- **Reviewing/authoring an artifact:** load the matching phase reference, run its checklist, write
  missing items + evidence pointers into the CCPA Compliance Record.
- **New feature kickoff:** run STEP 0 (including the GLBA map), then walk all four gates.
- **Risk-assessment / audit prep:** open `references/audit-evidence-map.md`; confirm every control has
  stored, in-date evidence and a live telemetry signal.

## Boundaries
Engineering guidance, not legal advice. The **GLBA-exemption determination**, ADMT "significant
decision" calls, risk-assessment sufficiency, and the cybersecurity-audit certification are Privacy
Officer / Legal judgement. The skill enforces build-time controls and produces evidence; it does not
replace the program-level obligations or the legal scoping.
