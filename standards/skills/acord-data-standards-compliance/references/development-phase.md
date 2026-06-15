# Development Phase — ACORD Conformance Gate

**Purpose:** implement against the **registered schemas and the ACORD data dictionary**, and
instrument the code so conformance emits auditable proof. Development is where messages are
constructed to the XSD/TXLife/GRLC schema, internal fields are mapped to ACORD elements, code-list
values are validated, and APIs are built to the reference model.

## Checklist

### A. Implement against registered schemas
- [ ] Build P&C message construction against the **registered ACORD P&C XSD**, emitting validation
      results (PC-01) and well-formed conformant transaction envelopes (PC-02).
- [ ] Build Life & Annuity message construction against the **registered TXLife schema** (LAH-01).
- [ ] Resolve schema versions from the **schema registry** at build time, not hard-coded copies.

### B. Map fields to the ACORD data dictionary
- [ ] Implement the **field-to-dictionary mappings** authored at design (DICT-01) and register
      internal field definitions in the schema registry.
- [ ] Ensure **ACORD-mandatory P&C elements are populated** end to end — no nulls in critical
      elements (PC-03).

### C. Use current code-list values
- [ ] Use only **valid, current ACORD code-list values** across systems (DICT-02); for Life, use
      valid **OLI_LU** codes from the current OLI code list (LAH-02).

### D. APIs & schema governance
- [ ] Implement partner-facing **policy APIs against the ACORD reference model / ADAPT** so each
      endpoint maps to ACORD entities (API-01).
- [ ] **Register every message schema and pin it to an explicit version** in the schema registry so
      producers and consumers evolve compatibly (API-02).

### E. Instrument for evidence
- [ ] Ensure validation, mapping, profiling, and registration activity writes **timestamped artifacts**
      to the evidence repositories named in the controls (schema-validation reports, mapping
      specifications, data-quality profiles, schema-registry exports).

## Evidence this gate leaves
- Schema-to-code mapping; field-to-ACORD mapping specification.
- P&C / TXLife validation outputs; mandatory-element population profile.
- Code-list validation outputs; schema-registry export with version pins.
- API-to-ACORD entity mapping.

## Controls in scope at this gate
**PC-01, PC-02, PC-03, LAH-01, LAH-02, DICT-01, DICT-02, API-01, API-02.**

## Exit criteria
The development gate is complete when messages are constructed against registered schemas, internal
fields are mapped to the ACORD data dictionary and registered, mandatory elements are populated, only
current code-list values are used, APIs map to ACORD entities, every schema is registered and
version-pinned, and each control's evidence artifacts are being emitted. Anything missing blocks
testing.
