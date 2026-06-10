---
name: actuarial-sdlc-compliance
description: >
  Enforce and evidence the Actuarial standards area (22 standards owned by the Chief Actuary)
  across the software delivery lifecycle — requirements, design, development, and testing — for any
  system that implements, feeds, or reports actuarial work. Use this skill whenever delivery work
  touches pricing methodologies and rating engines, rate adequacy and filing support, reserving and
  IBNR development, loss triangles and development factors, capital models and stress testing,
  catastrophe (CAT) models and exposure management, reinsurance pricing and ceded calculations,
  actual-vs-expected experience monitoring, or actuarial data quality and reconciliation — even if
  the user does not say "actuarial standard" or "ASOP." Also use when writing user stories, model
  or pipeline designs, APIs, or test plans for actuarial systems, and whenever the goal is evidence
  of model governance (documentation, change control, validation). When unsure whether a system
  carries actuarial logic or feeds actuarial data, run the scope gate rather than skipping it.
---

# Actuarial Standards Across the SDLC — Model Governance From Spreadsheet to Production

## What this skill does

The Actuarial area defines **22 standards** across Pricing, Reserving, Capital, CAT, Reinsurance,
Product, Standards (ASOPs), Analysis, and Reporting. The actuarial judgement is Run-phase — but the
**models, engines, and data pipelines that carry it are built**, and the area's own *Capital Model
Governance* standard states the build-time bar for all of them: **model documentation, change
control, independent validation, and version control**. This skill applies that bar across every
actuarial system and names the **evidence artifact** each gate leaves, so an actuarial opinion or
rate filing rests on systems whose lineage is provable.

The source standards live in the app's Standards area (**Data Admin → Standards → Actuarial**),
each with category, Build/Run phase, and responsible role (Chief Actuary, Pricing/Reserving/Capital
Actuary Leads, CAT Model Lead, Reinsurance Actuary, Actuarial Analyst Lead).

## Operating principle (read once, apply always)

> **An actuarial number nobody can reproduce is an opinion, not an estimate.** *Reserve
> Documentation* (key assumptions, variance explanation) and *Actuarial Standards of Practice*
> (ASOP compliance, peer review, opinion sign-off) require that every produced figure traces to a
> versioned model, versioned assumptions, and reconciled data (*Data Quality*: validation,
> reconciliation to source systems, known limitations documented). Build reproducibility in —
> model version + assumption set + input snapshot → same output, every time.

Maintain one **Actuarial Compliance Record** per model/system. The four gates write into it.

## STEP 0 — Scope gate (always run first)

1. **Does the system compute or carry actuarial figures** — rating engines, reserving platforms,
   IBNR calculators, capital/stress models, CAT modeling pipelines, ceded-reinsurance calculators,
   experience-monitoring marts?
2. **Or does it feed them?** Source systems sending premiums, losses, exposures → the *Data
   Quality* gate (validation, reconciliation, documented limitations) applies to the feed.
3. **Which categories does it touch?** Pricing, Reserving, Capital, CAT, Reinsurance, Product,
   Analysis, Reporting — only touched categories' gates apply.
4. **Regulatory output?** Rate filings, statutory statements, ORSA → filing-support and
   certification evidence requirements attach (*Rate Filing Support*, *Filing Support*,
   *Actuarial Reporting*).

- If no actuarial computation or feed → record the determination and stop.
- If unsure → treat as in-scope and escalate to the relevant Actuary Lead.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Capture the documented methodology the system must implement: *Pricing Methodology* (approach by
  LOB, indication basis, loss development factors) or *Reserve Methodology* (methods by LOB,
  triangle selection, factor derivation) — the methodology document is the requirements baseline.
- Define data contracts with the *Data Quality* standard: validation rules, reconciliation to
  source systems, and a register of known data limitations.
- State reproducibility requirements: versioned assumptions, input snapshots, audit trail.
- For new products: *Product Pricing Review* (actuarial sign-off, profit testing) is a named
  approval in the plan.
- **Evidence:** methodology-to-requirements traceability, data contracts, reproducibility criteria.

### 2. Design
- Apply *Capital Model Governance* to every model-bearing system: documentation, change control,
  independent validation path, version control — assumptions and factors as versioned data, never
  hardcoded.
- Design sensitivity and range support where the standards demand it: *IBNR Development*
  (sensitivity analysis, range of estimates), *Capital Requirements* (stress testing), *Risk
  Aggregation* (correlation assumptions, diversification benefit).
- CAT design per *CAT Model Selection* (approved vendor models, version control, documented
  blending) and *Exposure Management* (aggregate tracking, concentration limits, PML, zonal
  reporting).
- Design the feedback loops: *Experience Monitoring* (actual vs. expected, pricing feedback) and
  *Reserve Review Process* (monthly review, quarterly deep dive, year-end external review) need the
  system to produce comparable, dated snapshots.
- **Evidence:** model design doc, versioned-assumption data model, validation plan, snapshot/AvE design.

### 3. Development
- Implement full computation lineage: model version, assumption-set version, and input snapshot
  stamped on every output; immutable run history.
- Implement reconciliation checks against source systems in the pipelines; failures block
  downstream publication (*Data Quality*).
- Factor/assumption changes deploy through change control with approver identity (*Capital Model
  Governance*; *Deviation*-style audit trail for rating factors per *Rate Adequacy Review* inputs).
- Build the regulatory exhibit outputs: *Rate Filing Support* (actuarial memorandum exhibits),
  *Reinsurance Credit* (ceded reserve calculation, collectability data), *Actuarial Reporting*
  (board/management/ORSA feeds).
- **Evidence:** lineage-stamped outputs, reconciliation logs, change-control records, exhibit generators.

### 4. Testing
- Reproducibility test: rerun of a historical valuation/rating with its recorded versions matches
  the recorded output exactly.
- Validation per the standards: backtesting against historical events (*CAT Model Validation*),
  holdout/benchmark comparison, sensitivity runs produce documented ranges (*IBNR Development*).
- Independent validation sign-off recorded before production (*Capital Model Governance*); peer
  review per *Actuarial Standards of Practice*.
- Reconciliation test: pipeline totals tie to source-system control totals; known-limitations
  register current.
- **Evidence:** reproducibility proof, validation report with sign-off, backtest results, tie-out worksheet.

## Run / operate handoff (not build gates)
*Reserve Review Process* cadence, *Rate Adequacy Review* (annual), *Experience Monitoring* analysis
and recommendations, *Exposure Management* monitoring, annual *CAT Model Validation* comparison,
*Reinsurance Pricing* analyses, regulatory *Filing Support* and objection responses, and the
actuarial opinion itself. The systems supply reproducible numbers; the actuaries supply the
judgement.

## How to use this skill in practice
- **Reviewing/authoring actuarial-system work:** run the matching gate; every model artifact gets
  versioning, validation, and lineage.
- **New model/system kickoff:** run STEP 0, then walk the gates with the owning Actuary Lead.
- **Opinion/filing prep:** confirm reproducibility proofs, validation sign-offs, and reconciliation
  evidence are current in the Actuarial Compliance Record.

## Boundaries
Engineering guidance, not actuarial judgement. Method selection, assumption setting, ranges,
reserve picks, and ASOP interpretation belong to the credentialed actuaries; this skill ensures the
systems that carry their work are governed, versioned, validated, and reproducible. Rating-engine
regulatory compliance also intersects the underwriting skill; data-pipeline standards intersect the
data-analytics skill — invoke them where their scope gates trigger.
