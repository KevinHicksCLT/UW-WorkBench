# Design Phase — ACORD Conformance Gate

**Purpose:** choose the ACORD canonical entities, message standards, code lists, forms, and API
patterns **up front**, so conformance is designed in rather than retrofitted. Design is where field
mappings, schema selection, code-list pinning, and reference-model alignment become concrete — and
where the evidence each control will leave is decided.

## Checklist

### A. Canonical entities & data-dictionary mapping
- [ ] Select the **ACORD reference-model entities** (party, policy, coverage, claim, account) the
      system will expose; avoid per-partner models.
- [ ] Map every **exchange-bound internal field to an ACORD data-dictionary element** and author the
      mapping specification (DICT-01).
- **Evidence:** canonical entity selection, field-to-dictionary mapping spec.

### B. Message standards per family
- [ ] **P&C:** design message construction against the published **ACORD P&C XSD** and conformant
      transaction envelopes; identify the ACORD-mandatory elements that must be populated
      (PC-01, PC-02, PC-03).
- [ ] **Life & Annuity:** design messages to the **TXLife** standard (LAH-01).
- [ ] **Reinsurance:** design messages to the **GRLC** schema (RI-01).
- **Evidence:** per-family message standard decisions, mandatory-element list.

### C. Code lists & versioning
- [ ] Pin every referenced **ACORD code list** to a **current** ACORD version (DICT-02); for Life,
      pin the **OLI / OLI_LU** code list to the current OLI release (LAH-02).
- **Evidence:** code-list version decisions.

### D. Forms
- [ ] Design the ACORD **form set** to the current release: certificates on the current **ACORD 25**
      revision (FORM-01) and every active ACORD form on the current ACORD release version (FORM-02).
- **Evidence:** forms set with target release versions.

### E. API / ADAPT alignment
- [ ] Design partner-facing **policy APIs to the ACORD reference model and ADAPT patterns** so
      endpoints map to ACORD entities with no divergence (API-01).
- [ ] Require that every message schema is **registered and pinned to an explicit version** (API-02).
- **Evidence:** API reference-model alignment design, schema-registration intent.

### F. Evidence & traceability design
- [ ] For each in-scope control, confirm **where** its required evidence artifacts will be stored
      (the control's `required_evidence.evidence_repository`) and that artifacts are timestamped,
      sign-off-able, and retained.
- [ ] Design control activity to emit the **machine-checkable signals** the assertions need (schema
      validation failures, envelope conformance failures, null counts in mandatory elements, invalid/
      outdated code counts, non-current form versions, unmapped fields, nonconformant endpoints,
      unregistered/unpinned schemas).
- **Evidence:** control-to-evidence mapping.

## Controls in scope at this gate
**PC-03, LAH-02, FORM-01, FORM-02, DICT-01, DICT-02, RI-01, API-01, API-02** (plus design-time
preparation for PC-01, PC-02, LAH-01).

## Exit criteria
The design gate is complete when the canonical entity selection and data-dictionary mapping exist,
the per-family message standards and forms releases are chosen, code lists are pinned to current
versions, the API reference-model alignment is designed, and a control-to-evidence mapping exists for
every in-scope control. Anything missing blocks build.
