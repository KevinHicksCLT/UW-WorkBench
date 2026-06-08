---
name: gdpr-sdlc-compliance
description: >
  Enforce and evidence GDPR (Regulation (EU) 2016/679) compliance across the software delivery
  lifecycle — requirements, design, development, and testing — for any system that processes
  personal data. Use this skill whenever work touches personal data, data subjects, consent,
  privacy, DSARs/erasure/portability, profiling or automated decisions (incl. automated
  underwriting, pricing, or claims), data retention, breach handling, cross-border transfers, or
  DPIAs — even if the user does not say "GDPR." Also use when writing user stories, acceptance
  criteria, architecture/design docs, data models, APIs, or test plans for personal-data systems,
  and whenever the goal is to produce audit-ready evidence that privacy controls were applied. When
  in doubt about whether a system handles personal data, run the scope gate in this skill rather
  than skipping it.
---

# GDPR Across the SDLC — Compliance-by-Design and Audit Evidence

## What this skill does

It turns GDPR obligations into **gates** at each SDLC phase and, for every gate, names the
**evidence artifact** that must be produced. The goal is not just "build privately" — it is to
leave a defensible trail so the capability **stands up to a regulator's audit**. GDPR's Art. 5(2)
accountability principle makes evidence mandatory, not optional: you must be able to *demonstrate*
compliance, not merely assert it.

Source obligations are summarised in `references/gdpr-reference.md`. A one-line-per-article cheat
sheet is in `references/gdpr-article-quick-reference.md`.

## Operating principle (read once, apply always)

> **Every control produces an artifact, and every artifact is traceable forward and back.**
> A requirement links to a design decision, which links to code, which links to a test, which links
> to a stored evidence record. If a control has no artifact, for audit purposes it did not happen.

Maintain one **GDPR Compliance Record** per feature/system (a living document or ticket-linked
record). It is the spine that the four phase gates write into. Template and the full
control→article→evidence crosswalk are in `references/audit-evidence-map.md`.

## STEP 0 — Scope gate (always run first)

Answer three questions before applying any phase gate:

1. **Personal data? (Art. 2/4)** Does the system process data relating to an identified or
   identifiable natural person — directly or via pseudonymisation? Pseudonymised data is still
   personal data. Truly anonymised data is out of scope.
2. **In territorial scope? (Art. 3)** Is there an EU establishment, OR are goods/services offered
   to, or behaviour monitored of, data subjects in the EU/EEA?
3. **Elevated-risk triggers?** Special-category data (Art. 9 — e.g., health/claims data),
   large-scale processing, or **solely automated decisions with significant effect (Art. 22 — e.g.,
   automated underwriting/pricing/claims triage)?**

- If **(1) and (2) are "no"** → GDPR does not apply; record that determination (with rationale and
  date) and stop. **But check which regime *does* apply** (US state privacy laws, GLBA, NYDFS, NAIC,
  HIPAA). Do not treat "GDPR N/A" as "no privacy obligations."
- If **unsure** → treat as in-scope and escalate to the DPO.
- If **any elevated-risk trigger fires** → a **DPIA (Art. 35) is mandatory** and the Art. 22 / AI
  Act controls in the design and development gates apply.

## The four phase gates

Each gate below lists the **mandatory checks** and the **evidence each check must leave behind**.
Open the matching reference file for the full checklist, anti-patterns, and insurance-specific
examples. Do not mark a phase "done" until its evidence exists in the GDPR Compliance Record.

### 1. Requirements → `references/requirements-phase.md`
Establish *what* personal data, *why*, on *what lawful basis*, and *whose rights* must be served.
- Identify and classify every personal-data element; flag special categories (Art. 9).
- Assign a lawful basis per purpose (Art. 6); minimise to purpose (Art. 5).
- Capture data-subject-rights requirements (access, rectification, erasure, portability, objection).
- Run the **DPIA screening** (Art. 35); open a DPIA if triggered.
- Capture transparency/notice and retention requirements.
- **Evidence:** data inventory, lawful-basis register entry, DPIA screening result, privacy acceptance criteria on each story.

### 2. Design → `references/design-phase.md`
Bake privacy into the architecture (Art. 25) and complete the DPIA before build.
- Data-flow & boundary diagram; mark EEA egress points (transfers, Ch. V).
- Choose minimisation, pseudonymisation, encryption, and access-control patterns (Art. 25, 32).
- Design the **rights machinery**: how access/erasure/portability/restriction actually execute,
  including across backups, logs, caches, and processors (Art. 17 + 19).
- Design retention/deletion jobs (Art. 5(1)(e)); design consent capture/withdrawal (Art. 7).
- For Art. 22 systems: design human-in-the-loop, logic-explanation, and contest paths.
- **Evidence:** completed DPIA, data-flow diagram, privacy design-decision records, transfer mechanism record, processor/DPA list.

### 3. Development → `references/development-phase.md`
Implement the designed controls and instrument them so they emit proof.
- Enforce field-level minimisation; no personal data in logs, URLs, or analytics by default.
- Implement DSAR/erasure/portability/restriction endpoints and consent storage.
- Apply encryption at rest/in transit and pseudonymisation per design (Art. 32); secrets vaulted.
- Emit **audit logs** for every access to and export/deletion of personal data.
- For Art. 22: implement the human-review route and store the decision logic/version used.
- **Evidence:** code references mapped to controls, audit-log samples, secret-scan/SAST results, peer-review approvals citing privacy criteria.

### 4. Testing → `references/testing-phase.md`
Prove each control works — including the negative cases — and that effectiveness is *tested* (Art. 32).
- Functional tests for each data-subject right (with timing assertions, e.g., ≤ 1 month).
- Erasure/retention tests that verify deletion reaches backups/logs/processors.
- Minimisation/leak tests: assert no personal data in logs, URLs, errors, or non-prod data.
- Consent lifecycle tests (grant, withdraw, downstream stop); transfer-control tests.
- For Art. 22: tests that human review is reachable and that contested decisions are handled.
- Breach-detection/alerting test feeding the 72-hour notification process (Art. 33).
- **Evidence:** test cases mapped to articles, pass results with timestamps, leak-scan reports, retained in the compliance record.

## Run / operate (handoff, not a build gate)

Some obligations are continuous, not build-time: RoPA upkeep (Art. 30), breach notification (Art.
33/34), DPA lifecycle (Art. 28), DPO involvement (Art. 37–39), and periodic re-testing of Art. 32
measures. Ensure each has a named owner and a telemetry signal. See `references/audit-evidence-map.md`.

## How to use this skill in practice

- **Reviewing/authoring an artifact** (story, design doc, PR, test plan): load the matching phase
  reference, run its checklist against the artifact, and write the missing items + evidence pointers
  back into the GDPR Compliance Record.
- **New feature kickoff:** run STEP 0, then walk all four gates in order, creating the record as you go.
- **Audit prep:** open `references/audit-evidence-map.md` and confirm every control has a stored,
  in-date artifact and a live telemetry signal.

## Boundaries

This skill is **engineering guidance, not legal advice**. Lawful-basis selection, DPIA sign-off,
Art. 22 lawfulness, and transfer mechanisms require DPO/Legal approval. The skill enforces process
and produces evidence; it does not replace the DPO's judgement.
