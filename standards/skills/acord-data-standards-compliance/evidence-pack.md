# Compliance Evidence Pack — ACORD

**Client:** Meridian Insurance Group  •  **Cycle:** 2026-Q2  •  **Generated:** 2026-06-30T02:00:00Z  •  **By:** Cascade Control Framework

> The single artifact to hand an auditor or regulator first. It answers: *"Show me each control is real, was applied this cycle, and is still working — with the evidence behind it."*

## Attestation summary

| Controls | Passed | Warning | Failed | Automation coverage | Evidence coverage | Open issues |
|---|---|---|---|---|---|---|
| 12 | 9 | 2 | 1 | 92% | 100% | 3 |

## ✅ ACORD-API-01 — Policy APIs align to the ACORD reference model (ADAPT)

- **Family / framework:** API — ACORD
- **Citation:** ACORD Reference Architecture; ACORD ADAPT (API)
- **Objective:** Every policy API endpoint exposed by the organization aligns to the ACORD reference model and the ACORD ADAPT API patterns so that partners can integrate against standard, predictable insurance entities.
- **Owner:** API Product Owner (approver: Chief Architect)
- **Frequency / type:** Each release · Preventive / Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No endpoints diverge from the ACORD reference model. | 0 | eq | 0 | Pass |
  | All endpoints mapped to ACORD entities. | 100 | gte | 100 | Pass |

  **Evidence**

  - api_spec_export: `sharepoint://controls/acord/api/ACORD-API-01/api_spec_export` (immutable)
  - acord_alignment_matrix: `sharepoint://controls/acord/api/ACORD-API-01/acord_alignment_matrix` (immutable)
  - Source systems: API Gateway [API], Schema Registry [API]
  - Retention: 7 years

## ✅ ACORD-API-02 — Message schemas are registered and version-pinned

- **Family / framework:** API — ACORD
- **Citation:** ACORD XML; ACORD Reference Architecture
- **Objective:** Every message schema used by policy and partner integrations is registered in the schema registry and pinned to an explicit version so that producers and consumers evolve compatibly.
- **Owner:** API Product Owner (approver: Chief Architect)
- **Frequency / type:** Each release · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | All message schemas are registered. | 0 | eq | 0 | Pass |
  | All schemas are version-pinned. | 100 | gte | 100 | Pass |

  **Evidence**

  - schema_registry_export: `sharepoint://controls/acord/api/ACORD-API-02/schema_registry_export` (immutable)
  - version_pin_report: `sharepoint://controls/acord/api/ACORD-API-02/version_pin_report` (immutable)
  - Source systems: Schema Registry [API], API Gateway [API]
  - Retention: 7 years

## ⚠️ ACORD-DICT-01 — Internal data fields map to the ACORD data dictionary

- **Family / framework:** Data-Dictionary — ACORD
- **Citation:** ACORD Data Dictionary; ACORD Reference Architecture
- **Objective:** Every internal data field that participates in carrier, agency, or regulatory exchange is mapped to a corresponding element in the ACORD data dictionary so that semantics are preserved across the integration estate.
- **Owner:** Data Architect (approver: Enterprise Architect)
- **Frequency / type:** Quarterly · Detective · automation: Partial
- **Run status:** Warning

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | Every internal field maps to an ACORD element. | 31 | eq | 0 | Warn |
  | Full data-dictionary mapping coverage. | 97 | gte | 100 | Warn |

  **Evidence**

  - mapping_specification: `confluence://controls/acord/data-dictionary/ACORD-DICT-01/mapping_specification` (immutable)
  - coverage_report: `confluence://controls/acord/data-dictionary/ACORD-DICT-01/coverage_report` (immutable)
  - Source systems: Mapping Specs (Confluence) [Confluence], Schema Registry [API]
  - Retention: 7 years

  **Open issue ISS-ACORD-DICT-01-2026-Q2** (Medium) — Observed 31 violates eq 0; Observed 97 violates gte 100
  - Downstream impact: No downstream artifacts blocked.

## ✅ ACORD-DICT-02 — ACORD code lists are version-current across systems

- **Family / framework:** Data-Dictionary — ACORD
- **Citation:** ACORD Code Lists; ACORD Data Dictionary
- **Objective:** Every ACORD code list referenced by registered schemas and mapping specifications is pinned to a current ACORD code-list version so that enumerations remain interoperable across systems.
- **Owner:** Data Architect (approver: Enterprise Architect)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No outdated ACORD code-list versions in use. | 0 | eq | 0 | Pass |

  **Evidence**

  - codelist_inventory: `confluence://controls/acord/code-lists/ACORD-DICT-02/codelist_inventory` (immutable)
  - version_check_report: `confluence://controls/acord/code-lists/ACORD-DICT-02/version_check_report` (immutable)
  - Source systems: Schema Registry [API], Mapping Specs (Confluence) [Confluence]
  - Retention: 7 years

## ✅ ACORD-FORM-01 — Certificates of insurance use the current ACORD 25 form

- **Family / framework:** Forms — ACORD
- **Citation:** ACORD Forms; ACORD 25 (Certificate of Liability Insurance)
- **Objective:** Every certificate of liability insurance issued uses the current revision of the standard ACORD 25 form, so that certificate holders, agencies, and carriers exchange legally compliant, up-to-date certificates.
- **Owner:** Data Architect (approver: Enterprise Architect)
- **Frequency / type:** Quarterly · Preventive / Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No certificates issued on a non-current ACORD 25 revision. | 0 | eq | 0 | Pass |
  | All COIs use the standard ACORD 25 form. | 100 | gte | 100 | Pass |

  **Evidence**

  - forms_inventory: `sharepoint://standards/acord/forms/ACORD-FORM-01/forms_inventory` (immutable)
  - coi_sample_set: `sharepoint://standards/acord/forms/ACORD-FORM-01/coi_sample_set` (immutable)
  - Source systems: Forms Library (SharePoint) [SharePoint], Policy Admin System [API]
  - Retention: 7 years

## ❌ ACORD-FORM-02 — ACORD forms in use are on the current release version

- **Family / framework:** Forms — ACORD
- **Citation:** ACORD Forms; ACORD Forms Release Bulletin
- **Objective:** Every ACORD form rendered, ingested, or filed by the organization is on the current ACORD release version so that downstream carriers, agents, and regulators receive standard-conformant document layouts.
- **Owner:** Integration Architect (approver: Chief Architect)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Failed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No superseded ACORD form versions remain in use. | 4 | eq | 0 | Fail |
  | All forms are on the latest ACORD release. | 92 | gte | 100 | Warn |

  **Evidence**

  - form_version_inventory: `sharepoint://controls/acord/forms/ACORD-FORM-02/form_version_inventory` (immutable)
  - acord_release_bulletin: `sharepoint://controls/acord/forms/ACORD-FORM-02/acord_release_bulletin` (immutable)
  - Source systems: Forms Library (SharePoint) [SharePoint]
  - Retention: 7 years

  **Open issue ISS-ACORD-FORM-02-2026-Q2** (High) — Observed 4 violates eq 0; Observed 92 violates gte 100
  - Downstream impact: Blocks: filing-2026-forms

## ✅ ACORD-LAH-01 — Life & Annuity messages conform to ACORD TXLife

- **Family / framework:** Message-Conformance — ACORD
- **Citation:** ACORD Life & Annuity Data Standard; TXLife
- **Objective:** Every Life & Annuity message exchanged over the integration platform validates against the ACORD TXLife standard, so that new-business, in-force, and distribution partners exchange structurally conformant Life & Annuity transactions.
- **Owner:** Integration Architect (approver: Chief Architect)
- **Frequency / type:** Continuous · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No TXLife messages fail validation. | 0 | eq | 0 | Pass |

  **Evidence**

  - txlife_validation_report: `confluence://standards/acord/message-conformance/ACORD-LAH-01/txlife_validation_report` (immutable)
  - message_sample_set: `confluence://standards/acord/message-conformance/ACORD-LAH-01/message_sample_set` (immutable)
  - Source systems: Integration Bus [API], Schema Registry [API]
  - Retention: 7 years

## ✅ ACORD-LAH-02 — Life OLI_LU code lists are valid and current

- **Family / framework:** Data-Dictionary — ACORD
- **Citation:** ACORD OLI Code Lists; ACORD Life & Annuity Data Standard
- **Objective:** Every coded value carried on a Life & Annuity message uses a valid OLI_LU code drawn from the current ACORD OLI code list, so that enumerated values are interpreted consistently across carriers, BGAs, and distribution platforms.
- **Owner:** Data Architect (approver: Enterprise Architect)
- **Frequency / type:** Quarterly · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No invalid OLI_LU code usages. | 0 | eq | 0 | Pass |
  | OLI code list version is current. | 1 | eq | 1 | Pass |

  **Evidence**

  - oli_code_validation: `confluence://standards/acord/data-dictionary/ACORD-LAH-02/oli_code_validation` (immutable)
  - codelist_version_record: `confluence://standards/acord/data-dictionary/ACORD-LAH-02/codelist_version_record` (immutable)
  - Source systems: Data Dictionary (Confluence) [Confluence], Schema Registry [API]
  - Retention: 7 years

## ✅ ACORD-PC-01 — P&C policy messages validate against the ACORD P&C XML schema

- **Family / framework:** Message-Conformance — ACORD
- **Citation:** ACORD P&C Data Standard; ACORD XML
- **Objective:** Every outbound and inbound P&C policy message exchanged over the integration platform validates cleanly against the published ACORD P&C XML (XSD) schema, so that carrier and agency partners receive structurally conformant transactions.
- **Owner:** Integration Architect (approver: Chief Architect)
- **Frequency / type:** Continuous · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No P&C messages fail ACORD XSD validation. | 0 | eq | 0 | Pass |
  | All sampled messages were schema-validated. | 100 | gte | 100 | Pass |

  **Evidence**

  - xsd_validation_report: `confluence://standards/acord/message-conformance/ACORD-PC-01/xsd_validation_report` (immutable)
  - message_sample_set: `confluence://standards/acord/message-conformance/ACORD-PC-01/message_sample_set` (immutable)
  - schema_version_record: `confluence://standards/acord/message-conformance/ACORD-PC-01/schema_version_record` (immutable)
  - Source systems: Integration Bus [API], Schema Registry [API]
  - Retention: 7 years

## ✅ ACORD-PC-02 — ACORD transaction envelopes are well-formed and conformant

- **Family / framework:** Message-Conformance — ACORD
- **Citation:** ACORD Transaction Standards; ACORD XML
- **Objective:** Every ACORD transaction exchanged over the integration platform is wrapped in a well-formed, conformant ACORD transaction envelope, so that routing, correlation, and acknowledgement metadata are reliably interpreted by partner endpoints.
- **Owner:** Integration Architect (approver: Chief Architect)
- **Frequency / type:** Continuous · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | All transaction envelopes conform to the ACORD envelope structure. | 0 | eq | 0 | Pass |

  **Evidence**

  - envelope_conformance_report: `confluence://standards/acord/message-conformance/ACORD-PC-02/envelope_conformance_report` (immutable)
  - transaction_log: `confluence://standards/acord/message-conformance/ACORD-PC-02/transaction_log` (immutable)
  - Source systems: Integration Bus [API]
  - Retention: 7 years

## ⚠️ ACORD-PC-03 — Mandatory ACORD data elements are populated on P&C messages

- **Family / framework:** Data-Quality — ACORD
- **Citation:** ACORD P&C Data Standard; ACORD Data Dictionary
- **Objective:** Every P&C message carries fully populated values for all data elements that the ACORD P&C Data Standard and Data Dictionary mark as mandatory, so that downstream carriers and analytics consumers receive complete, usable policy data.
- **Owner:** Data Architect (approver: Enterprise Architect)
- **Frequency / type:** Monthly · Detective · automation: Full
- **Run status:** Warning

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No nulls in critical ACORD elements. | 0 | eq | 0 | Pass |
  | All ACORD-mandatory elements populated. | 97 | gte | 100 | Warn |

  **Evidence**

  - data_quality_profile: `confluence://standards/acord/data-quality/ACORD-PC-03/data_quality_profile` (immutable)
  - mandatory_element_report: `confluence://standards/acord/data-quality/ACORD-PC-03/mandatory_element_report` (immutable)
  - Source systems: Policy Admin System [API], Integration Bus [API]
  - Retention: 7 years

  **Open issue ISS-ACORD-PC-03-2026-Q2** (Medium) — Observed 97 violates gte 100
  - Downstream impact: No downstream artifacts blocked.

## ✅ ACORD-RI-01 — Reinsurance messaging conforms to ACORD GRLC

- **Family / framework:** Reinsurance — ACORD
- **Citation:** ACORD Global Reinsurance and Large Commercial (GRLC); ACORD Reinsurance Standards
- **Objective:** Every reinsurance message exchanged with brokers, cedents, and reinsurers conforms to the ACORD Global Reinsurance and Large Commercial (GRLC) standard so that placements, bordereaux, and technical accounts process straight-through.
- **Owner:** Integration Architect (approver: Chief Architect)
- **Frequency / type:** Continuous · Detective · automation: Full
- **Run status:** Passed

  **Assertions tested**

  | Test | Actual | Operator | Threshold | Result |
  |---|---|---|---|---|
  | No reinsurance messages fail GRLC conformance. | 0 | eq | 0 | Pass |

  **Evidence**

  - grlc_validation_report: `sharepoint://controls/acord/reinsurance/ACORD-RI-01/grlc_validation_report` (immutable)
  - reinsurance_message_set: `sharepoint://controls/acord/reinsurance/ACORD-RI-01/reinsurance_message_set` (immutable)
  - Source systems: Integration Bus [API], Schema Registry [API]
  - Retention: 7 years
