# ACORD Quick Reference

One line per ACORD family/artifact → what conformance requires → enforcing control. Full detail in
`acord-reference.md`. This is engineering shorthand, not a substitute for the ACORD specifications.

## Reference Architecture & canonical model
- **ACORD Reference Architecture** — canonical entities (party/policy/coverage/claim); internal data
  and APIs map to them, not to per-partner models. → DICT-01, API-01, API-02.
- **ACORD Data Dictionary** — every exchange-bound internal field maps to an ACORD element so
  semantics survive system boundaries. → DICT-01.

## P&C (ACORD XML / AL3)
- **P&C Data Standard (ACORD XML)** — P&C policy messages validate cleanly against the published
  ACORD P&C XSD. → PC-01.
- **ACORD Transaction Standards** — transaction envelopes are well-formed and structurally
  conformant (routing/correlation/ack metadata). → PC-02.
- **P&C mandatory elements** — all elements the P&C standard / data dictionary marks mandatory are
  populated; no nulls in critical elements. → PC-03.

## Life & Annuity (TXLife + OLI)
- **TXLife** — Life & Annuity messages validate against the TXLife standard. → LAH-01.
- **OLI / OLI_LU code lists** — every Life coded value uses a valid OLI_LU code from the current OLI
  code list. → LAH-02.

## Reinsurance (GRLC)
- **Global Reinsurance & Large Commercial (GRLC)** — reinsurance/large-commercial messages
  (placements, bordereaux, technical accounts) conform to the registered GRLC schema. → RI-01.

## Forms
- **ACORD 25 (Certificate of Liability Insurance)** — certificates issued on the current ACORD 25
  revision. → FORM-01.
- **ACORD Forms / Release Bulletin** — every ACORD form in active use is on the current ACORD release
  version; no superseded forms. → FORM-02.

## Code lists
- **ACORD Code Lists** — every referenced ACORD code list is pinned to a current version across
  systems; no outdated enumerations in use. → DICT-02 (Life-specific: LAH-02).

## APIs (ADAPT)
- **ACORD ADAPT (API) / Reference Model** — policy API endpoints align to ACORD reference-model
  entities and ADAPT patterns; no divergent endpoints. → API-01.
- **Schema registration & pinning** — every message schema is registered and pinned to an explicit
  version so producers/consumers evolve compatibly. → API-02.

## The conformance principle in one line
A standard you cannot re-validate against and evidence is not conformance — it is an assertion. Every
in-scope message, form, field, and endpoint re-proves itself each assessment cycle and leaves a
timestamped, retained artifact.
