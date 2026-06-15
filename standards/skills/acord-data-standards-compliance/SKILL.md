---
name: acord-data-standards-compliance
description: >
  Enforce and evidence conformance to the ACORD insurance data standards across the SDLC for any
  system that exchanges insurance data with external parties (carriers, agencies/brokers, reinsurers,
  cedents, BGAs, distribution platforms, or regulators) or maintains canonical insurance data that
  should align to ACORD. Use this skill whenever delivery work touches a policy, claims, or billing
  integration; a message schema (ACORD XML, AL3, TXLife, GRLC, or JSON); an ACORD form (e.g., ACORD
  25 certificates) or forms library; a data dictionary, canonical entity model, or code list (OLI /
  OLI_LU and other ACORD enumerations); or a partner/reinsurer API built on ACORD ADAPT, REST, or the
  ACORD reference model — across P&C, Life & Annuity, and Global Reinsurance & Large Commercial
  (GRLC) data exchange. Reach for it when writing user stories, integration designs, schema/field
  mappings, message-construction code, forms-rendering logic, or test plans for any of the above —
  even if the user does not say "ACORD," "conformance," or "data standard." When unsure whether a
  system is in scope, run STEP 0 in this skill rather than skipping it. This is engineering and
  data-quality guidance, not a legal or regulatory opinion.
---

# ACORD Data Standards Across the SDLC — Message, Forms, Data-Dictionary & API Conformance

## What ACORD is

ACORD (the Association for Cooperative Operations Research and Development) is the **insurance
industry's data-standards body** — a non-profit standards organization, **not a law, regulator, or
supervisory authority**. It publishes the shared vocabulary and message formats that let carriers,
agencies, brokers, reinsurers, and their technology platforms exchange insurance data without
bespoke point-to-point translation. The pieces this skill cares about:

- **ACORD Reference Architecture** — the conceptual, logical, and physical reference models
  (Information, Capability, Component models) that define canonical insurance entities and the shape
  of a standards-aligned estate.
- **P&C Data Standard (ACORD XML / AL3)** — the message and transaction standards for Property &
  Casualty policy, billing, and claims exchange between agencies and carriers.
- **Life & Annuity Data Standard (TXLife)** — the message standard for new-business, in-force, and
  distribution transactions across Life & Annuity, including the **OLI / OLI_LU** code lists that
  enumerate its coded values.
- **Global Reinsurance & Large Commercial (GRLC)** — the standard for placements, bordereaux, and
  technical accounts exchanged with brokers, cedents, and reinsurers.
- **ACORD Forms** — the standard insurance forms (e.g., **ACORD 25**, Certificate of Liability
  Insurance), each carrying a current release version that downstream parties expect.
- **Code lists / OLI** — the controlled enumerations that keep coded values interpretable across
  partners.
- **ADAPT APIs** — ACORD's API standards and reference-model-aligned API patterns for modern
  REST/JSON partner integration.

## What this skill does — and its honest boundary

ACORD conformance is a **build-time and run-time data-quality concern**, not a legal obligation.
A message that validates against the ACORD XSD, a field that maps to the ACORD data dictionary, a
form on the current release, and an API aligned to the reference model all make the integration
estate **interoperable and straight-through** — they do **not**, by themselves, satisfy any
regulator, statute, or filing requirement.

> **Do not let "we are ACORD-conformant" stand in for "we are compliant."** Regulatory obligations
> (SOX, NYDFS, GDPR, state filing rules, statutory reporting) are separate regimes with their own
> skills and owners. ACORD conformance reduces integration risk, rework, and E&O exposure and is a
> precondition for clean partner exchange — it is not a substitute for any legal or regulatory
> control.

This skill enforces the **conformance gates** as SDLC checks and evidences them through the
machine-testable controls in `controls/`. Source families are summarized in
`references/acord-reference.md`; a one-line-per-item cheat sheet is in
`references/acord-quick-reference.md`.

## Operating principle (read once, apply always)

> **Conformance is only real if a message, form, field, or endpoint can be re-validated against the
> published ACORD standard and leave a stored, timestamped artifact proving it did.** Every
> in-scope artifact must validate against a registered schema, map to the ACORD data dictionary, sit
> on a current release version, or align to the reference model — and re-prove that each assessment
> cycle. A conformance claim with no current evidence is, for audit and partner-certification
> purposes, not operating.

The 12 machine-testable controls in `controls/` are the spine. Each names its required evidence, its
owner, its SDLC gates, and its assertions. The phase gates below write into the same evidence chain;
the Cascade Control Framework runs and evidences them (see "How to use in practice").

## STEP 0 — Applicability check (always run first)

ACORD is a standards body, so there is **no scope gate for legal applicability**. Instead, answer:

1. **External insurance-data exchange?** Does this system send or receive insurance data to or from
   **external parties** — carriers, agencies/brokers, reinsurers, cedents, BGAs, distribution
   platforms, or regulators — as policy, billing, claims, Life & Annuity, or reinsurance messages,
   ACORD forms, or partner APIs?
2. **Canonical data alignment?** Does the system **maintain canonical insurance data** (a policy book
   of record, a claims store, a party/coverage model, a data dictionary, or a schema registry) that
   should align to the ACORD reference model and data dictionary so semantics are preserved across
   boundaries?

- If **neither** → record the determination (rationale + date) and stop. (The system may still be in
  scope for other regimes — do not read "ACORD N/A" as "no obligations.")
- If **either** → walk the four gates and bind the system to the relevant `controls/` ids.
- If **unsure** → treat as in-scope and escalate to the **Enterprise Architect / Integration
  Architect**.

## The four phase gates

Each gate lists the **mandatory checks**, the **evidence** each leaves behind, and the **controls**
(`controls/<id>.control.json`) it enforces. Open the matching reference for the full checklist. A
phase is not "done" until its evidence exists and the bound controls can run.

### 1. Requirements → `references/requirements-phase.md`
Establish that the system exchanges or maintains insurance data, which ACORD families apply (P&C,
Life & Annuity, GRLC, Forms, API), and which canonical entities and exchanges are in scope.
- Confirm the STEP 0 determination; identify the exchange partners and message/form/API surfaces.
- Capture, as acceptance criteria, that exchange-bound fields must map to the ACORD data dictionary
  and that schemas will be registered and version-pinned.
- **Controls:** scoping inputs to **DICT-01**, plus the family applicability for **PC-01/02/03,
  LAH-01/02, FORM-01/02, RI-01, API-01/02.**
- **Evidence:** ACORD applicability determination, in-scope exchange/entity list, canonical-mapping
  requirement.

### 2. Design → `references/design-phase.md`
Choose the ACORD canonical entities, code lists, schemas, forms, and API patterns up front.
- Select the ACORD reference-model entities the system will expose and map internal fields to the
  ACORD data dictionary (**DICT-01**); pin every referenced code list to a current ACORD version
  (**DICT-02**, **LAH-02**).
- Decide the message standard per family — ACORD P&C XML (**PC-01/02/03**), TXLife (**LAH-01**),
  GRLC (**RI-01**) — and design the ACORD form set on current releases (**FORM-01/02**).
- Design partner APIs to the ACORD reference model / ADAPT (**API-01**) and require schema
  registration with explicit version pinning (**API-02**).
- **Controls:** **PC-03, LAH-02, FORM-01, FORM-02, DICT-01, DICT-02, RI-01, API-01, API-02.**
- **Evidence:** canonical entity selection, field-to-dictionary mapping spec, code-list version
  decisions, forms set, API reference-model alignment design.

### 3. Development → `references/development-phase.md`
Implement against registered schemas and the ACORD data dictionary.
- Build message construction against the **registered XSD/JSON schema** and emit validation results
  for P&C (**PC-01/02**), Life & Annuity (**LAH-01**), and the mandatory-element population for P&C
  (**PC-03**).
- Implement field mappings to the ACORD data dictionary (**DICT-01**) and use only current code-list
  values (**DICT-02, LAH-02**).
- Implement APIs against the ACORD reference model and register + pin every schema
  (**API-01, API-02**).
- **Controls:** **PC-01, PC-02, PC-03, LAH-01, LAH-02, DICT-01, DICT-02, API-01, API-02.**
- **Evidence:** schema-to-code mapping, mapping specification, validation/profile outputs,
  schema-registry export.

### 4. Testing → `references/testing-phase.md`
Prove conformance against the published standards before release.
- **Schema-validate** message samples for each family (**PC-01, PC-02, LAH-01, RI-01**) and confirm
  mandatory-element population (**PC-03**).
- **Validate forms versions** against the current ACORD release (**FORM-01, FORM-02**).
- **Check API/ADAPT alignment** to the reference model and confirm schema registration + version
  pinning (**API-01, API-02**).
- Run each control's `validation.assertions` against fixture or live data and wire control runs into
  CI so a failing ACORD control blocks promotion of a partner-facing integration.
- **Controls:** **PC-01, PC-02, LAH-01, RI-01, FORM-02, API-01, API-02** (plus re-test of PC-03,
  FORM-01, DICT-02 outputs).
- **Evidence:** schema-validation reports, forms version-currency report, API alignment matrix,
  passing assertion results with timestamps, traceability matrix.

## How to use this skill in practice

The 12 controls in `controls/` are **machine-testable** and live one layer below this skill, in the
**Cascade Control Framework** (`../../control-framework/`). The skill tells an agent *what to enforce
and evidence at each gate*; the framework *runs the controls, evaluates the assertions, and produces
the conformance artifacts*.

- **Reviewing/authoring an artifact** (story, integration design, mapping spec, message-construction
  code, forms config, API contract, test plan): load the matching phase reference, run its checklist,
  bind the artifact to the relevant control ids, and confirm the evidence each control requires will
  exist.
- **New integration kickoff:** run STEP 0, walk all four gates, and register the system against its
  controls.
- **Run the controls and build the evidence:** from the repo root,
  `node standards/control-framework/cli/report.mjs acord` validates, runs, and evidences the pack,
  emitting `registry.json` (definitions + runs + issues + evidence), `evidence-pack.md` (the
  conformance pack), and `tech-debt-backlog.md` (unmet controls, missing sources, manual steps,
  failed runs). Tests:
  `node --test "standards/skills/acord-data-standards-compliance/tests/*.test.mjs"`.
- **Partner certification / conformance review:** open `references/audit-evidence-map.md`; confirm
  every control has a current, in-cycle, retained artifact and a live telemetry signal **before**
  recertifying a carrier, agency, or reinsurer integration or submitting a forms filing.

## Boundaries

Engineering and data-quality guidance, **not a legal or regulatory opinion**. ACORD conformance does
not by itself satisfy SOX, NYDFS, GDPR, statutory reporting, or state filing requirements — those are
separate regimes with their own owners and skills. This skill enforces and evidences the data-
standards conformance layer that clean, straight-through insurance exchange depends on.
