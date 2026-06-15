# Testing Phase — ACORD Conformance Gate

**Purpose:** prove conformance against the **published ACORD standards** before release — schema-
validate message samples, validate forms versions, and check API/ADAPT alignment — and run each
control's assertions so a failing ACORD control blocks promotion of a partner-facing integration.

## Checklist

### A. Schema-validate message samples
- [ ] Validate sampled **P&C messages** against the registered ACORD P&C XSD: **0 schema validation
      failures** (PC-01).
- [ ] Validate sampled **transaction envelopes** for well-formedness and ACORD envelope conformance:
      **0 envelope conformance failures** (PC-02).
- [ ] Validate sampled **Life & Annuity messages** against TXLife: **0 TXLife validation failures**
      (LAH-01).
- [ ] Validate sampled **reinsurance / large-commercial messages** against GRLC: **0 GRLC failures**
      (RI-01).
- [ ] Profile **ACORD-mandatory P&C elements**: **0 nulls in critical elements** (PC-03).

### B. Validate forms versions
- [ ] Confirm issued certificates use the **current ACORD 25 revision**: 0 non-current issuances
      (FORM-01).
- [ ] Reconcile every active ACORD form to the current ACORD release: **0 superseded forms in use**
      (FORM-02).

### C. Check API / ADAPT alignment
- [ ] Confirm policy API endpoints align to the **ACORD reference model**: 0 nonconformant endpoints
      (API-01).
- [ ] Confirm every message schema is **registered and version-pinned**: 0 unregistered schemas,
      100% pinned (API-02).

### D. Code-list & mapping checks
- [ ] Confirm **0 invalid OLI_LU codes** and a current OLI code list (LAH-02).
- [ ] Confirm **0 outdated ACORD code-list versions** in use (DICT-02) and full data-dictionary
      mapping coverage (DICT-01).

### E. Run the controls in CI
- [ ] Run each control's `validation.assertions` against fixture or live data and confirm the
      rolled-up status.
- [ ] Wire control runs into CI so a **failing ACORD control blocks release** of the partner-facing
      integration; capture the negative cases (a malformed message, a superseded form, an unmapped
      field, an unpinned schema) and confirm they are caught.

## Evidence this gate leaves
- Schema-validation reports per family; mandatory-element report.
- Forms version-currency report / COI sample set.
- API alignment matrix; schema-registry / version-pin report.
- OLI and code-list validation reports; mapping coverage report.
- Passing assertion results with timestamps; traceability matrix; CI gate config.

## Controls in scope at this gate
**PC-01, PC-02, PC-03, LAH-01, LAH-02, FORM-01, FORM-02, DICT-01, DICT-02, RI-01, API-01, API-02.**

## Exit criteria
The testing gate is complete when every in-scope message family schema-validates with zero failures,
forms reconcile to the current ACORD release, APIs align to the reference model with all schemas
registered and pinned, code lists and mappings are current and complete, and each bound control's
assertions pass with timestamped evidence wired into CI. A failing control blocks promotion.
