# ACORD Data Standards — Reference Overview

ACORD (the Association for Cooperative Operations Research and Development) is the **insurance
industry's data-standards body** — a non-profit standards organization, **not a regulator**. Its
standards let carriers, agencies, brokers, reinsurers, and platforms exchange insurance data without
bespoke point-to-point translation. This reference summarizes the families this pack governs and what
**conformance** means for each, with the control ids (`controls/<id>.control.json`) that enforce them.

> **Binding text is ACORD's published standards, schemas, code lists, and forms releases.** This is
> engineering shorthand for SDLC use, not a substitute for the ACORD specifications themselves.

---

## ACORD Reference Architecture
The conceptual/logical/physical reference models (Information, Capability, and Component models) that
define **canonical insurance entities** — party, policy, coverage, claim, account — and the shape of
a standards-aligned estate.
- **Conformance means:** internal data and APIs map to ACORD reference-model entities so semantics
  are preserved across system and partner boundaries, rather than fragmenting into per-partner models.
- **Enforced by:** **DICT-01** (internal fields map to the ACORD data dictionary), **API-01** (policy
  APIs align to the ACORD reference model / ADAPT), **API-02** (message schemas registered and
  version-pinned).

## P&C Data Standard (ACORD XML / AL3)
The message and transaction standards for Property & Casualty policy, billing, and claims exchange
between agencies and carriers. Transactions are carried in conformant **ACORD transaction envelopes**
that hold routing, correlation, and acknowledgement metadata.
- **Conformance means:** every P&C message validates against the published ACORD P&C XSD; envelopes
  are well-formed and conformant; and all ACORD-mandatory data elements are populated.
- **Enforced by:** **PC-01** (P&C messages validate against the ACORD P&C XSD), **PC-02** (transaction
  envelopes are well-formed and conformant), **PC-03** (mandatory ACORD elements are populated).

## Life & Annuity Data Standard (TXLife) and OLI code lists
The message standard for new-business, in-force, and distribution transactions across Life & Annuity,
exchanged with carriers, BGAs, and distribution platforms. Its coded values draw on the ACORD
**OLI / OLI_LU** code lists.
- **Conformance means:** Life & Annuity messages validate against the TXLife standard, and every
  coded value uses a valid OLI_LU code from the **current** OLI code list.
- **Enforced by:** **LAH-01** (Life & Annuity messages conform to TXLife), **LAH-02** (Life OLI_LU
  code lists are valid and current).

## Global Reinsurance & Large Commercial (GRLC)
The standard for placements, bordereaux, and technical accounts exchanged with brokers, cedents, and
reinsurers.
- **Conformance means:** every reinsurance / large-commercial message conforms to the registered
  GRLC schema so placements, bordereaux, and technical accounts process straight-through.
- **Enforced by:** **RI-01** (reinsurance messaging conforms to ACORD GRLC).

## ACORD Forms
The standard insurance forms (e.g., **ACORD 25**, Certificate of Liability Insurance). Each form
carries a current **release version** per the ACORD Forms Release Bulletin; superseded versions can
omit required disclosures and carry stale legal language.
- **Conformance means:** certificates are issued on the current ACORD 25 revision, and every ACORD
  form in active use is on the current ACORD release version.
- **Enforced by:** **FORM-01** (certificates use the current ACORD 25 form), **FORM-02** (ACORD forms
  in use are on the current release version).

## Code lists / OLI
The controlled enumerations that keep coded values interpretable across partners. Outdated code-list
versions cause valid values to be rejected or misinterpreted.
- **Conformance means:** every ACORD code list referenced by registered schemas and mapping specs is
  pinned to a **current** ACORD code-list version across systems.
- **Enforced by:** **DICT-02** (ACORD code lists are version-current across systems); the Life-specific
  case is **LAH-02** (OLI_LU).

## ADAPT APIs
ACORD's API standards and reference-model-aligned API patterns for modern REST/JSON partner
integration.
- **Conformance means:** partner-facing policy APIs align to the ACORD reference model and ADAPT
  patterns, and the schemas behind them are registered and version-pinned so producers and consumers
  evolve compatibly.
- **Enforced by:** **API-01** (policy APIs align to the ACORD reference model / ADAPT), **API-02**
  (message schemas are registered and version-pinned).

---

## What "conformance" buys — and what it does not
Conformance makes the integration estate **interoperable and straight-through**, reduces rework and
reconciliation load, and lowers E&O exposure from malformed or stale exchanges. It is a **build-time
and run-time data-quality property**, evidenced each assessment cycle. It is **not** a regulatory
control: achieving ACORD conformance does not by itself satisfy SOX, NYDFS, GDPR, statutory reporting,
or state filing requirements. Treat those as separate regimes with their own owners and skills.
