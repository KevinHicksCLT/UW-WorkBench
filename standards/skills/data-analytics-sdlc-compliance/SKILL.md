---
name: data-analytics-sdlc-compliance
description: >
  Enforce and evidence the Data & Analytics standards area (22 standards owned by the Chief Data
  Officer) across the software delivery lifecycle — requirements, design, development, and testing —
  for any work that creates, moves, models, or visualizes data. Use this skill whenever delivery
  work touches data pipelines (ETL/ELT/CDC), data lakes and medallion layers, data quality rules and
  SLAs, the data catalog and metadata, master and reference data, BI reports and dashboards,
  self-service analytics, ML/analytics model development, validation, and monitoring, or data
  classification, PII handling, and retention — even if the user does not say "data standard" or
  "governance." Also use when writing user stories, pipeline designs, data contracts, or test plans
  for data products, and whenever the goal is evidence for data-governance review (ownership,
  lineage, quality scores). When unsure whether work creates a governed data asset, run the scope
  gate rather than skipping it.
---

# Data & Analytics Standards Across the SDLC — Governed Pipelines, Trusted Models

## What this skill does

The Data & Analytics area defines **22 standards** across Governance, Quality, Catalog, MDM,
Engineering, BI/Reporting, Analytics, and Privacy. This skill turns the build-time subset into
**SDLC gates** for pipelines, datasets, reports, and models, and names the **evidence artifact**
each leaves behind (catalog entry, DQ scorecard, lineage record, model validation report) — so a
dataset's trustworthiness is checkable, not asserted.

The source standards live in the app's Standards area (**Data Admin → Standards → Data &
Analytics**), each with category, Build/Run phase, and responsible role (CDO, Data Quality Manager,
Data Architect, Data Engineer Lead, BI Lead, Data Science Lead, Data Privacy Officer).

## Operating principle (read once, apply always)

> **No owner, no catalog entry, no production.** *Data Ownership* (every dataset has an assigned
> owner and steward) and *Data Catalog Standards* (all datasets registered, glossary-linked,
> lineage captured) are the admission ticket. An unregistered dataset with no owner is shadow data —
> it can't carry a quality SLA, can't be governed, and can't be trusted.

Maintain one **Data Compliance Record** per data product/pipeline/model. The four gates write into it.

## STEP 0 — Scope gate (always run first)

1. **Does the work create or change a dataset, pipeline, report, or model** that others will
   consume? Then it is a governed asset and the gates apply.
2. **Classify the data (Data Classification):** Public / Internal / Confidential / Restricted.
   Confidential+ triggers *PII Handling* (inventory, encryption/masking, access logging) and
   *Data Retention* (schedules, automated purge, legal hold).
3. **Master or reference data involved?** (Customer, Policy, Claim, Product golden records; code
   tables) → *Master Data Standards* and *Reference Data Management* apply — no local overrides.
4. **An analytics/ML model?** → the full *Model Development Lifecycle* gate set applies.

- If purely exploratory and never shared → record that determination; revisit if it ships.
- If unsure → treat as governed and escalate to the Data Governance Lead.

## The four phase gates

Each gate lists mandatory checks (named standards in italics) and the evidence each leaves behind.

### 1. Requirements
- Name the **owner and steward** before build starts (*Data Ownership*).
- Define *Data Quality Rules* for the domain up front, with targets from the *Data Quality SLAs*
  (completeness > 99%, accuracy > 99%, timeliness per business SLA, remediation ≤ 24 h).
- Capture *Metadata Standards* requirements: classification, refresh frequency, business terms.
- For models: document the problem definition per the *Model Development Lifecycle*.
- **Evidence:** named owner/steward, DQ rule set with targets, metadata sheet, model problem statement.

### 2. Design
- Pipeline design per *Pipeline Standards* and *ETL/ELT Standards*: idempotent, incremental loads,
  CDC for real-time, schema evolution handled, **data contracts enforced**, audit columns in all
  tables, monitoring/alerting designed in.
- Lake placement per *Data Lake Standards*: medallion architecture (Bronze/Silver/Gold),
  partitioning strategy, approved formats (Parquet/Delta).
- MDM design: golden-record match/merge and survivorship rules documented (*Master Data
  Standards*); reference data sourced from the central, versioned store.
- BI design per *Report Development Standards* and *Dashboard Standards* (consistent design
  language, load < 5 s, drill-down); self-service consumers get **certified datasets only**
  (*Self-Service Guidelines*).
- Privacy by design: masking/encryption per classification; retention and purge path designed.
- **Evidence:** pipeline design + data contract, medallion placement, MDM rules doc, dashboard spec, privacy design notes.

### 3. Development
- Implement automated profiling and DQ checks in the pipeline; publish DQ scores (*Data Quality
  Rules*); route failures to *Data Issue Management* (logged, root-caused).
- Register the asset: catalog entry with glossary links, lineage captured end-to-end (*Data
  Catalog Standards*); ownership and classification recorded.
- For models: data prep and modeling documented; code and features versioned (*Model Development
  Lifecycle*).
- **Evidence:** DQ checks in code, published catalog/lineage entry, issue-management hook, model repo.

### 4. Testing
- DQ validation against the SLA targets on production-like data; reconciliation to source.
- Report/dashboard *data validation and UAT sign-off* (*Report Development Standards*); performance
  test against the 5-second load target.
- For models: *Model Validation* — holdout validation, **bias testing**, explainability
  requirements, model-risk review sign-off; *Model Monitoring* hooks (drift detection, performance
  metrics, retraining triggers) verified before deployment.
- Privacy tests: masked in non-prod, access logged, purge job works.
- **Evidence:** DQ test results vs. SLA, UAT sign-off, model validation report + monitoring proof, privacy test results.

## Run / operate handoff (not build gates)
*Data Governance Framework* operation (Data Council monthly), annual ownership review, *Data
Policies* communication, ongoing DQ score publication and remediation, *Reference Data Management*
change control, *Model Monitoring* response (retraining), and retention/purge operation. The asset
must emit the signals; the governance organization owns the response.

## How to use this skill in practice
- **Reviewing/authoring a pipeline, report, or model:** run the matching gate; no asset ships
  unowned, uncatalogued, or without DQ checks.
- **New data-product kickoff:** run STEP 0, then walk all four gates.
- **Governance review prep:** confirm catalog entry, lineage, DQ scores, and (for models) the
  validation report are current in the Data Compliance Record.

## Boundaries
Engineering guidance, not governance authority. Ownership assignments, policy content, golden-record
survivorship disputes, and model-risk acceptance are CDO / Data Council judgement. Regulatory
privacy obligations (GDPR/CCPA) have their own skills — invoke them when personal data of EU/
California residents is in scope. This skill enforces build-time data standards and produces
evidence; it does not adjudicate governance disputes.
