# Audit Evidence Map — ACORD Conformance Controls

The artifact to hand a partner-certification reviewer, an internal data-governance audit, or an
enterprise-architecture review board, and the one to review **before recertifying a carrier, agency,
or reinsurer integration or submitting a forms filing**. It crosswalks every control to its ACORD
citation, the SDLC gate (or owner) that enforces it, the evidence it leaves, and the live telemetry
signal.

## How to read it
- **Control** — the id in `../controls/<id>.control.json`. **Citation** — the control's
  `regulatory_mapping.citation`. **Gate / Owner** — the control's `sdlc_gates` plus the
  `control_owner.primary_role`.
- **Evidence artifact(s)** — the control's `required_evidence.artifacts` (the stored proof; retained
  7 years across the pack). **Telemetry signal** — the ongoing metric for the app's Telemetry tab,
  derived from the control's pass assertions.

| Control | Citation | Gate / Owner | Evidence artifact(s) | Telemetry signal |
|---|---|---|---|---|
| ACORD-PC-01 | ACORD P&C Data Standard · ACORD XML | Development/Testing/Run · Integration Architect | xsd_validation_report; message_sample_set; schema_version_record | schema validation failures (target 0); messages validated % |
| ACORD-PC-02 | ACORD Transaction Standards · ACORD XML | Development/Testing/Run · Integration Architect | envelope_conformance_report; transaction_log | envelope conformance failures (0) |
| ACORD-PC-03 | ACORD P&C Data Standard · ACORD Data Dictionary | Design/Development/Run · Data Architect | data_quality_profile; mandatory_element_report | critical-element nulls (0); mandatory-element population % |
| ACORD-LAH-01 | ACORD Life & Annuity Data Standard · TXLife | Development/Testing/Run · Integration Architect | txlife_validation_report; message_sample_set | TXLife validation failures (0) |
| ACORD-LAH-02 | ACORD OLI Code Lists · ACORD Life & Annuity Data Standard | Design/Development/Run · Data Architect | oli_code_validation; codelist_version_record | invalid OLI_LU codes (0); OLI code list current (yes) |
| ACORD-FORM-01 | ACORD Forms · ACORD 25 (Certificate of Liability Insurance) | Design/Run · Data Architect | forms_inventory; coi_sample_set | non-current ACORD 25 issuances (0); COIs using ACORD 25 % |
| ACORD-FORM-02 | ACORD Forms · ACORD Forms Release Bulletin | Design/Testing/Run · Integration Architect | form_version_inventory; acord_release_bulletin | superseded forms in use (0); forms on latest version % |
| ACORD-DICT-01 | ACORD Data Dictionary · ACORD Reference Architecture | Requirements/Design/Development · Data Architect | mapping_specification; coverage_report | unmapped internal fields (0); dictionary mapping coverage % |
| ACORD-DICT-02 | ACORD Code Lists · ACORD Data Dictionary | Design/Development/Run · Data Architect | codelist_inventory; version_check_report | outdated code-list versions in use (0) |
| ACORD-RI-01 | ACORD Global Reinsurance and Large Commercial (GRLC) · ACORD Reinsurance Standards | Design/Testing/Run · Integration Architect | grlc_validation_report; reinsurance_message_set | GRLC message failures (0) |
| ACORD-API-01 | ACORD Reference Architecture · ACORD ADAPT (API) | Design/Development/Testing · API Product Owner | api_spec_export; acord_alignment_matrix | nonconformant API endpoints (0); endpoints mapped to ACORD % |
| ACORD-API-02 | ACORD XML · ACORD Reference Architecture | Design/Development/Testing · API Product Owner | schema_registry_export; version_pin_report | unregistered message schemas (0); schemas version-pinned % |

> **The conformance principle in one line:** the published standard is the reference; the controls are
> the spine; the evidence keeps the spine upright. Build the evidence as a by-product of delivery, run
> the controls every assessment cycle, and partner certifications and architecture reviews rest on a
> live dashboard rather than a point-in-time document hunt.

---

## ACORD Conformance Record — template

Maintain one per in-scope integration / canonical-data system. The four gates write into it; the
framework runs the bound controls into it.

```
# ACORD Conformance Record — <system/integration name>
Conformance owner: <name>     Data Architect: <name>     Integration Architect: <name>
Status: <Req | Design | Dev | Test | Live>     Cycle: <e.g., 2026-Q2>     Last updated: <date>

## Applicability (STEP 0)
- External insurance-data exchange? <yes/no — partners>
- Maintains canonical insurance data to align to ACORD? <yes/no — which entities>
- ACORD families in scope: <P&C / Life & Annuity / GRLC / Forms / API>
- Bound controls: <PC-.., LAH-.., FORM-.., DICT-.., RI-01, API-..>

## Requirements gate
- ACORD applicability determination: <link>
- In-scope exchange / entity / family list: <link>
- Canonical-mapping + schema-pinning acceptance criteria: <link>

## Design gate
- Canonical entity selection + data-dictionary mapping spec (DICT-01): <link>
- Per-family message standard decisions (PC-01/02/03, LAH-01, RI-01): <link>
- Code-list version decisions (DICT-02, LAH-02): <link>
- Forms set + target releases (FORM-01, FORM-02): <link>
- API reference-model alignment design (API-01, API-02): <link>
- Control-to-evidence mapping: <link>

## Development gate
- Schema-to-code map + field-to-ACORD mapping spec (DICT-01): <link>
- P&C / TXLife validation outputs (PC-01, PC-02, LAH-01): <link>
- Mandatory-element population profile (PC-03): <link>
- Code-list validation outputs (DICT-02, LAH-02): <link>
- Schema-registry export with version pins (API-02); API-to-entity mapping (API-01): <link>

## Testing gate
- Schema-validation reports per family (with timestamps): <link>
- Forms version-currency report (FORM-01, FORM-02): <link>
- API alignment matrix + version-pin report (API-01, API-02): <link>
- Negative-case results (malformed message, superseded form, unmapped field, unpinned schema): <link>
- Traceability matrix + CI gate config: <link>
- Generated registry.json / evidence-pack.md: <link>

## Sign-offs
- Integration Architect: <name/date>   Data Architect: <name/date>
- API Product Owner: <name/date>       Enterprise / Chief Architect: <name/date>
```

## Wiring into Transformation Bridge
- The **Standards** area holds the 12 ACORD standards (the *what*) under **Enterprise & Solution
  Architecture → ACORD Data Standards**.
- This record + crosswalk are the *evidence layer*. The deeper, machine-testable definitions live in
  `../controls/` and are run by the **Cascade Control Framework** (`../../../control-framework/`),
  which emits `registry.json`, `evidence-pack.md`, and `tech-debt-backlog.md`.
- Attach the record to the relevant **Initiative / Deliverable** and surface the telemetry signals on
  the **Telemetry** tab so partner certifications and architecture reviews are backed by a live
  dashboard.
