---
name: sox-itgc-sdlc-compliance
description: >
  Enforce and evidence the Sarbanes-Oxley Act build-time control set — IT general controls (Access,
  Change, Operations), automated application controls, and the entity-level §302/§404/§802 evidence
  hooks — for any system that is financially significant or feeds the financial statements and
  Internal Control over Financial Reporting (ICFR). Use this skill whenever delivery work touches a
  general ledger, policy-administration, claims, billing, premium-posting, or financial-reporting
  system, or any interface, batch job, or automated calculation that lands in the GL — even if the
  user does not say "SOX," "ITGC," or "404." Use it when writing user stories, access/role models,
  change-management and CI/CD pipelines, automated-posting or reconciliation logic, or test plans for
  financial systems, and whenever the goal is to produce evidence that backs the CEO/CFO §302 and
  §404 certifications, the §802 records-retention obligation, and the external auditor's AS 2201
  attestation. When unsure whether a system is financially significant, run the scope gate in this
  skill rather than skipping it. This is engineering guidance, not a legal or audit opinion.
---

# SOX Across the SDLC — ITGCs, Automated Application Controls, and ICFR Evidence

## What this skill does — and its honest boundary

SOX is **mostly a financial-reporting and ICFR program**, not an engineering regulation. The Act's
weight sits in management's §404 assessment, the CEO/CFO §302 and §906 certifications, the disclosure
committee, the COSO 2013 governance framework, and the external auditor's AS 2201 attestation — all
owned by the **CFO / Controller** and the **SOX program**, not by a delivery team.

Engineering owns a **real but bounded slice**: the **IT general controls (ITGCs)** that make the
financial systems trustworthy, the **automated application controls** embedded in those systems, and
the **evidence** that proves both ran and worked. That slice is exactly where an engineering team can
either create or destroy the support behind the certifications.

This skill enforces the **build-time / IT-controlled** portion as SDLC gates and routes the rest to a
**Run / program handoff**:

| Enforced as SDLC gates (engineering slice) | Routed to Run / program (CFO + SOX program) |
|---|---|
| ITGC Access (AC-01..05) · ITGC Change (CM-01..03) · ITGC Operations (OP-01..02) · Automated application controls (APP-01..02) · the engineering *inputs* to RET-802-01 (retention/legal-hold/deletion config) | §302 disclosure certification & sub-certifications (ELC-302-01) · §404 ICFR assessment & control-matrix testing (ELC-404-01) · COSO program governance · disclosure committee · external-auditor AS 2201 attestation |

> **Do not let "we have a SOX SDLC skill" stand in for "the company is SOX compliant."** The ICFR
> opinion, materiality and deficiency-severity judgements, and the certifications themselves belong
> to the CFO/Controller and the SOX program. This skill secures and evidences the IT control layer
> that those judgements rely on.

Source obligations are in `references/sox-reference.md`; a one-line-per-item cheat sheet is in
`references/sox-section-quick-reference.md`.

## Operating principle (read once, apply always)

> **A certification is only as strong as the controls it rests on, and a control is only as strong as
> the evidence it leaves.** The CEO and CFO personally certify, under §302 and §906, that they have
> evaluated the controls and that the financial statements are fairly presented; under §404
> management asserts ICFR is effective and the external auditor attests to it under AS 2201. Every IT
> control in scope must therefore leave a stored, timestamped, **retrievable** artifact and re-prove
> itself each cycle. A control with no current evidence weakens those signatures and is, for audit
> purposes, not operating.

The 15 machine-testable controls in `controls/` are the spine. Each one names its required evidence,
its owner, its SDLC gates, and its assertions. The phase gates below write into the same evidence
chain; the Cascade Control Framework runs and evidences them (see "How to use in practice").

## STEP 0 — Scope gate (always run first)

Answer these before applying any phase gate:

1. **SEC registrant / issuer?** Is Meridian (or the relevant entity) an SEC registrant or issuer
   subject to SOX — or a private entity that follows SOX-equivalent ICFR expectations (e.g., for a
   future filing, lenders, regulators, or rating agencies)? As an SEC-registered insurance carrier,
   Meridian is in scope; private subsidiaries may inherit the expectation.
2. **Financially significant?** Does the system process, calculate, store, or transmit data that is
   **material to the financial statements** — a general ledger, policy administration, claims,
   billing, premium-posting, reinsurance, or financial-reporting system, or a feeder to any of them?
   Meridian's standing in-scope set is **General Ledger, Policy Admin, Claims, Billing**, plus the
   integration bus and batch jobs that move data into the GL.
3. **Feeds ICFR?** Does the system support an assertion in management's §404 ICFR scope — e.g., it
   posts revenue, computes reserves, reconciles interfaces, or holds records relied on for the
   financial statements?

- If **not financially significant and not an ICFR feeder** → record the determination (rationale +
  date) and stop. (It may still be in scope for NYDFS, GDPR, or other regimes — do not read "SOX
  N/A" as "no compliance obligations.")
- If **in scope** → walk the four gates and bind the system to the relevant `controls/` ids.
- If **unsure** → treat as in-scope and escalate to the **Controller / SOX Program Manager**.

## The four phase gates

Each gate lists the **mandatory checks**, the **evidence** each leaves behind, and the **controls**
(`controls/<id>.control.json`) it enforces. Open the matching reference for the full checklist and
insurance examples. A phase is not "done" until its evidence exists and the bound controls can run.

### 1. Requirements → `references/requirements-phase.md`
Establish whether the system is financially significant, which financial assertions it touches, and
which ITGC and application controls it must satisfy.
- Confirm the STEP 0 financial-significance determination; record the financial-statement assertions
  affected (completeness, accuracy, validity, restricted access).
- Identify the access model, change-governance, operational, and automated-control requirements as
  acceptance criteria, and the records that will be subject to §802 retention.
- **Controls:** scoping inputs to **AC-01, CM-01, APP-01, APP-02, RET-802-01, ELC-404-01.**
- **Evidence:** financial-significance memo, assertion map, control-applicability list, retention
  requirement.

### 2. Design → `references/design-phase.md`
Bake the ITGCs and automated controls into the architecture.
- **Access:** least-privilege role model, **segregation of duties** designed into the role set, an
  approval-before-grant path, and a deprovisioning/recertification design.
- **Change:** branch protection and an approval-before-promotion design that prevents self-approval
  and self-deploy.
- **Operations:** monitoring/alerting for financially-relevant batch jobs; backup and **restore-test**
  design.
- **Application controls:** design the automated premium-to-GL recalculation/reconciliation and the
  interface control-total tie-out so they are testable.
- **Retention:** design the records repository to enforce the **7-year** minimum, legal holds, and a
  deletion-audit trail.
- **Controls:** **AC-01, AC-04, CM-01, CM-02, OP-02, APP-01, APP-02, RET-802-01.**
- **Evidence:** SoD-aware role model, change-governance design, operations/backup design, application-
  control design notes, retention/legal-hold design.

### 3. Development → `references/development-phase.md`
Implement the controls and instrument them so they emit auditable proof.
- Implement access provisioning that records the approving ticket; enforce branch protection so
  authors cannot approve or deploy their own changes; capture emergency-change and post-implementation
  records.
- Implement the automated premium-to-GL posting and interface reconciliations with control totals;
  emit timestamped logs and reconciliation outputs.
- Ensure all change, deployment, and posting activity writes immutable, time-stamped records to the
  evidence repositories named in the controls.
- **Controls:** **AC-01, CM-01, CM-02, CM-03, APP-01, APP-02.**
- **Evidence:** control-to-code map, PR-approval logs citing SOX criteria, deployment-actor logs,
  reconciliation workpapers, calculation-config exports.

### 4. Testing → `references/testing-phase.md`
Prove each control operates — including the negative cases — and that its assertions pass.
- Verify approval-before-grant and approval-before-promotion; verify no self-approval/self-deploy;
  verify SoD ruleset blocks conflicts; verify timely deprovisioning.
- Verify the premium-to-GL recalculation matches 100% with **$0 unexplained variance** and that
  interface control totals tie out to zero; verify batch-failure alerting and backup/restore.
- Run each control's `validation.assertions` against fixture or live data and confirm the rolled-up
  status; wire control runs into CI so a failing SOX control blocks release of a financial system.
- **Controls:** **AC-01..05, CM-01..03, OP-01, OP-02, APP-01, APP-02.**
- **Evidence:** tests mapped to control ids, passing assertion results with timestamps,
  reconciliation/variance reports, restore-test record, traceability matrix.

## Run / program handoff (not a build gate, but you must hand these off)

These are owned by the CFO/Controller and the SOX program — engineering supplies the evidence feed,
not the sign-off:

- **§302 disclosure certification** (CEO/CFO) backed by **quarterly sub-certifications** — control
  **ELC-302-01** (owner: Controller; approval: CFO). Engineering supplies ITGC/application-control run
  results so sub-certifiers can attest.
- **§404 ICFR assessment** — management's annual assessment and the **control-matrix completeness /
  key-control testing** — control **ELC-404-01** (owner: SOX Program Manager; approval: CFO). The IT
  controls in `controls/` are rows in that matrix.
- **External-auditor attestation under PCAOB AS 2201** — the auditor independently tests the same
  ITGCs and application controls; hand them the evidence packs, not a verbal assurance.
- **§802 records retention** — **RET-802-01** (owner: Records Manager; approval: General Counsel) runs
  continuously; engineering owns the repository configuration and deletion-audit feed.
- **COSO 2013 program governance** — the five components and 17 principles (esp. **Principle 11**,
  technology general controls) are the program's responsibility, not a build gate.

Each handoff needs a named owner and a live telemetry signal — see `references/audit-evidence-map.md`.

## How to use this skill in practice

The 15 controls in `controls/` are **machine-testable** and live one layer below this skill, in the
**Cascade Control Framework** (`../../control-framework/`). The skill tells an agent *what to enforce
and evidence at each gate*; the framework *runs the controls, evaluates the assertions, and produces
the auditor-facing artifacts*.

- **Reviewing/authoring an artifact** (story, role model, change pipeline, posting routine, test
  plan): load the matching phase reference, run its checklist, bind the artifact to the relevant
  control ids, and confirm the evidence each control requires will exist.
- **New financial system kickoff:** run STEP 0, walk all four gates, and register the system against
  its controls.
- **Run the controls and build the evidence:** from the repo root,
  `node standards/control-framework/cli/report.mjs sox` validates, runs, and evidences the pack,
  emitting `registry.json` (definitions + runs + issues + evidence), `evidence-pack.md` (the
  auditor-facing pack), and `tech-debt-backlog.md` (unmet controls, missing sources, manual steps,
  failed runs). Tests: `node --test "standards/skills/sox-itgc-sdlc-compliance/tests/*.test.mjs"`.
- **Certification / audit prep:** open `references/audit-evidence-map.md`; confirm every control has a
  current, in-cycle, 7-year-retained artifact and a live telemetry signal **before** the §302 / §404
  cycle closes and before the external auditor's AS 2201 fieldwork.

## Boundaries

Engineering guidance, **not legal or audit opinion**. Financial-statement materiality, control
**deficiency severity** (deficiency vs. significant deficiency vs. material weakness), the §404 ICFR
conclusion, the §302/§906 certification language, §802 legal-hold scope, and the scoping of "key"
controls are **CFO / Controller / SOX program / Legal / external-auditor** judgements. This skill
enforces the IT control layer and produces the evidence; it does not replace the program-level
assessment or the certifications.
