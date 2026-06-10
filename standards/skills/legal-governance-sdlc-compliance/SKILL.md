---
name: legal-governance-sdlc-compliance
description: >
  Enforce and evidence the Legal & Governance standards area (22 standards owned by the General
  Counsel) across the software delivery lifecycle — requirements, design, development, and testing —
  for any system that touches contracts, corporate governance, litigation, privacy obligations, or
  legal operations. Use this skill whenever delivery work involves contract review, templates,
  execution, or lifecycle management (CLM), board materials and minutes, entity management,
  litigation holds and matter management, outside-counsel and legal-spend tooling, privacy impact
  assessments, data-subject requests, and data processing agreements, employment agreements and
  termination review, trademark/IP processes, or e-billing — even if the user does not say "legal
  standard." Also use when a new system itself creates legal touchpoints (a new vendor needs a DPA;
  new personal-data processing needs a PIA; new records need hold capability), and whenever the
  goal is evidence that legal workflows are enforced and retained. When unsure whether work has a
  legal dimension, run the scope gate rather than skipping it.
---

# Legal Standards Across the SDLC — Holds, Contracts, and Privilege Built Into the Systems

## What this skill does

The Legal & Governance area defines **22 standards** across Contracts, Governance, Litigation,
Regulatory, Privacy, Employment, IP, Legal Ops, and Training. They are **Run-phase standards** run
by the legal department — but they bind engineering in two directions: (a) the **systems built for
Legal** (CLM, matter management, e-billing, entity management) must enforce the standards' workflows
and retention, and (b) **every other system** must be able to honor a litigation hold, support a
data-subject request, and route new contracts/vendors through legal review. This skill turns both
into **SDLC gates** with named **evidence**.

The source standards live in the app's Standards area (**Data Admin → Standards → Legal &
Governance**), each with category, phase, and responsible role (Contracts Manager, Corporate
Secretary, Litigation/Regulatory/Privacy/Employment/IP Counsel, Legal Ops Manager).

## Operating principle (read once, apply always)

> **A litigation hold beats every retention schedule, and a 24-hour clock starts at the trigger.**
> *Litigation Hold* requires the hold notice within 24 hours and custodian acknowledgment tracking —
> which means **every system that stores business records must be able to suspend deletion for
> identified data on demand**. Design that capability in; retrofitting it during discovery is how
> spoliation happens.

Maintain one **Legal Compliance Record** per system/feature mapping each touched standard to its
enforcing control and evidence.

## STEP 0 — Scope gate (always run first)

1. **Is the system legal-department tooling** (CLM, matter management, entity management,
   e-billing, IP portfolio, board portal)? → direction (a): the gates govern its workflows.
2. **Does the work create legal touchpoints?** New vendor contract > $50K → *Contract Review
   Process*; vendor handling personal data → *Data Processing Agreements*; new personal-data
   processing → *Privacy Impact Assessments*; new record stores → litigation-hold and *Data Subject
   Requests* capability.
3. **Does the system store business records or personal data at all?** Then hold capability and
   DSR support are baseline requirements — direction (b).

- If neither direction applies → record the determination and stop.
- If unsure → treat as in-scope and escalate to Legal Ops.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- For legal tooling: encode the workflow rules as requirements — *Contract Review Process*
  (> $50K → Legal review; playbook; redline tracking), *Contract Execution* (signature authority
  matrix; executed copies retained; CLM required), *Matter Management* (all matters logged; budget
  tracking; monthly status), *Board Materials*/*Board Minutes* timing (distribute 5 days ahead;
  draft minutes ≤ 7 days).
- For any system: capture hold-capability and DSR-support requirements (*Litigation Hold*, *Data
  Subject Requests* — documented process, response within regulatory timeline, logging required).
- Run the PIA screen: new processing of personal data → *Privacy Impact Assessments* (standard
  template, approval workflow) before build.
- **Evidence:** workflow requirements, hold/DSR acceptance criteria, PIA screening result.

### 2. Design
- Hold design: per-custodian/per-matter preservation that overrides retention and purge jobs;
  acknowledgment tracking; release workflow.
- Contract lifecycle design per *Contract Lifecycle* (renewal tracking, obligation monitoring,
  termination/expiration management) and *Contract Templates* (approved templates; deviation flags
  requiring legal approval).
- Privilege and confidentiality walls in matter/investigation data; *Regulatory Inquiries* response
  protocol support (privilege review step, timeline tracking).
- DSR design: locate, export, correct, and delete personal data across stores, with logging; DPA
  terms reflected in vendor data flows.
- Entity/IP registers per *Entity Management* (inventory, filings calendar) and *Trademark
  Management* (renewal tracking).
- **Evidence:** hold design review by Litigation Counsel, lifecycle/renewal design, privilege-wall design, DSR data map.

### 3. Development
- Implement hold enforcement (deletion suppressed, verified by test), acknowledgment tracking, and
  audit logging of hold scope changes.
- Implement signature-authority checks and template-deviation flags in contract flows; retained,
  searchable executed copies.
- Implement DSR execution paths with response-timeline tracking and full logging; obligation and
  renewal alerting per *Contract Lifecycle*.
- E-billing/spend data per *Legal Spend Management* and *Outside Counsel* (panel validation,
  billing-guideline checks, invoice review workflow).
- **Evidence:** control→code map, hold-enforcement test log, deviation-flag samples, DSR run logs.

### 4. Testing
- Hold tests: a held record survives every purge/retention job; release restores normal retention;
  custodian acknowledgments tracked end-to-end.
- Contract tests: > $50K contract cannot reach execution without legal review; out-of-authority
  signer blocked; template deviation flagged.
- DSR tests: full locate/export/delete across stores within the configured timeline; actions logged.
- Privilege tests: matter and investigation records invisible outside the authorized group.
- **Evidence:** purge-survival proofs, blocked-execution proofs, DSR end-to-end results, access-control test results.

## Run / operate handoff (not build gates)
Board calendar operation, annual entity filings, *Outside Counsel* panel and engagement-letter
management, *Invention Disclosure* and patentability assessment, *Termination Review* and
*Employment Agreements* execution, *Legal Training* for the business, and spend analysis. The
systems supply workflows, registers, and alerts; the legal department owns the practice.

## How to use this skill in practice
- **Building legal tooling:** run the gates over each workflow — authority, timing, retention,
  privilege.
- **Any new system kickoff:** run STEP 0.2/0.3 — hold capability, DSR support, PIA, and DPA needs
  go into the backlog before build.
- **Discovery/audit readiness:** confirm hold-enforcement and DSR evidence is current in the Legal
  Compliance Record.

## Boundaries
Engineering guidance, not legal advice. Privilege calls, hold scope, contract-term judgement, PIA
approval, and regulatory-response strategy belong to counsel. Regulation-specific privacy build
obligations (GDPR, CCPA/CPRA) have their own skills — invoke them when their scope gates trigger.
This skill ensures the systems enforce and evidence the standards; it does not practice law.
