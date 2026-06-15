# Requirements Phase — ACORD Conformance Gate

**Purpose:** establish that the system exchanges or maintains insurance data, identify which ACORD
families apply, and capture conformance as **acceptance criteria** before any design is locked. This
is where the STEP 0 applicability determination is recorded and the in-scope exchanges, entities, and
controls are bound.

## Checklist

### A. Applicability (STEP 0)
- [ ] Record whether the system performs **external insurance-data exchange** (carriers, agencies/
      brokers, reinsurers, cedents, BGAs, distribution platforms, regulators) and/or **maintains
      canonical insurance data** that should align to ACORD.
- [ ] If neither, record the determination (rationale + date) and stop. If unsure, treat as in-scope
      and escalate to the Enterprise/Integration Architect.

### B. Identify the ACORD families in scope
- [ ] **P&C** (ACORD XML / AL3) — policy, billing, claims exchange with agencies/carriers
      (PC-01, PC-02, PC-03).
- [ ] **Life & Annuity** (TXLife + OLI) — new-business, in-force, distribution (LAH-01, LAH-02).
- [ ] **Reinsurance / Large Commercial** (GRLC) — placements, bordereaux, technical accounts (RI-01).
- [ ] **Forms** — ACORD 25 certificates and other standard forms (FORM-01, FORM-02).
- [ ] **APIs** — partner-facing policy APIs on ADAPT / the reference model (API-01, API-02).

### C. Canonical-mapping requirements
- [ ] State, as acceptance criteria, that **every exchange-bound internal field must map to the ACORD
      data dictionary** (DICT-01) and that ACORD entities — not per-partner models — are the canonical
      target.
- [ ] Require that **schemas will be registered and version-pinned** and **code lists pinned to a
      current ACORD version** (API-02, DICT-02, LAH-02).
- [ ] List the exchange partners and the message/form/API surfaces each one touches.

## Evidence this gate leaves
- ACORD applicability determination (rationale + date).
- In-scope exchange / entity / family list.
- Canonical-mapping and schema/code-list-currency acceptance criteria.

## Controls in scope at this gate
Scoping input to **DICT-01**; family applicability captured for **PC-01, PC-02, PC-03, LAH-01,
LAH-02, FORM-01, FORM-02, DICT-02, RI-01, API-01, API-02.**

## Exit criteria
The requirements gate is complete when the applicability determination is recorded, the in-scope
ACORD families and partner surfaces are listed, and canonical-mapping / schema-pinning / code-list-
currency requirements are written as acceptance criteria. Anything missing blocks design.
