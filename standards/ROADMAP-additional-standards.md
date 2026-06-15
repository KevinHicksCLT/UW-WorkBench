# Roadmap — Additional Standards & Regulations to Codify

This is deliverable **#2**: a prioritized view of the standards and regulations a global insurance
carrier should consider codifying next, using the same control-library pattern as SOX and ACORD
(`control-framework/` + a pack under `skills/`). Each row is a candidate *pack*: a regulation/standard
decomposed into individually testable controls with source-system bindings, evidence, and tech-debt.

## How to read the priority score

Priority = **Impact × Applicability ÷ Effort**, scored 1–5 each (5 = highest impact / broadest
applicability / lowest effort).

- **Impact** — regulatory teeth or business risk if absent (fines, license, restatement, breach).
- **Applicability** — how much of a *global* carrier's footprint it touches.
- **Effort** — relative build cost as a pack (5 = cheap because it reuses existing controls/sources).

Already shipped: **GDPR**, **CCPA/CPRA**, **NYDFS 23 NYCRR 500** (infosec packs), **SOX**, **ACORD**,
and the **Actuarial Loss Analysis** control library that seeded the framework.

## Prioritized backlog

| Rank | Standard | Domain | Impact | Applic. | Effort | Why it matters for a carrier | Reuses |
|---|---|---|---|---|---|---|---|
| 1 | **ISO/IEC 27001 + 27002** | Infosec / ISMS | 5 | 5 | 3 | The ISMS backbone; most enterprise security controls map here. Anchors the other infosec packs and is contract/RFP table-stakes. | NYDFS, GDPR controls; IAM/ITSM/SIEM connectors |
| 2 | **NAIC Model Audit Rule (MAR) + ORSA** | Insurance / financial | 5 | 4 | 3 | The insurance-specific "SOX": ICFR over statutory reporting + own-risk solvency assessment. Direct regulator (state DOI) consumption via the filing systems already catalogued. | SOX ITGC/app controls; SERFF/MCAS connectors |
| 3 | **HIPAA (Privacy + Security)** | Data / health | 5 | 3 | 4 | Health/medical data in claims, underwriting, group benefits. High breach penalties; overlaps GDPR special-category controls. | GDPR special-category & access controls |
| 4 | **PCI-DSS v4.0** | Data / payments | 4 | 3 | 4 | Premium/claims card payments. Prescriptive, highly testable controls (segmentation, encryption, key mgmt) — ideal for automation. | Encryption/access/logging controls |
| 5 | **SOC 2 (Trust Services Criteria)** | Infosec / assurance | 4 | 4 | 4 | The report carriers' vendors (and the carrier's own SaaS) must produce; criteria map cleanly onto existing ITGC + monitoring controls. | SOX ITGC, NYDFS, ISO 27001 |
| 6 | **NIST CSF 2.0 / 800-53** | Infosec / governance | 4 | 4 | 3 | The crosswalk hub — lets one control satisfy many frameworks. Worth building as a *mapping layer* over existing packs. | All infosec packs |
| 7 | **IFRS 17 / LDTI** | Finance / actuarial | 5 | 4 | 2 | Insurance-contract accounting; deep data-lineage and calculation controls. High effort but high value; pairs with the Actuarial library. | Actuarial controls; GL/ERP, Actuarial Mart |
| 8 | **Solvency II (Pillars 1–3)** | Insurance / capital (EU) | 5 | 3 | 2 | Capital adequacy, governance, and disclosure for EU operations. Data-quality and reporting controls dominate. | Actuarial, data-quality controls |
| 9 | **EU DORA** | Operational resilience (EU) | 4 | 3 | 4 | ICT risk, incident reporting, third-party (ICT) register, resilience testing — much overlaps NYDFS/ISO. | NYDFS, ISO 27001 controls |
| 10 | **EU AI Act + ISO/IEC 42001** | AI governance | 4 | 3 | 3 | Pricing/underwriting/claims models are increasingly in scope; AI management-system controls (inventory, risk, human oversight, monitoring). | Data-analytics, model-governance controls |
| 11 | **ISO 27701** | Privacy (PIMS) | 3 | 4 | 4 | Extends 27001 to privacy; bridges GDPR/CCPA to the ISMS. | GDPR, CCPA, ISO 27001 |
| 12 | **ISO 22301** | Business continuity | 3 | 4 | 4 | BC/DR program; pairs with the SOX OP backup/restore controls. | SOX OP controls |
| 13 | **BCBS 239** | Risk data aggregation | 3 | 2 | 3 | Banking-origin but influential for group risk-data lineage and quality. | Data-quality, data-lineage controls |
| 14 | **COSO ERM + COBIT 2019** | Governance overlays | 3 | 4 | 3 | Governance frameworks that *organize* the others; best as overlays/crosswalks rather than standalone control sets. | SOX, ISO mappings |
| 15 | **50-State Insurance Regulatory Filings** | Insurance / regulatory ops | 4 | 5 | 3 | Operationalize the 50-state source-system catalogue (SERFF/NIPR/SBS/MCAS/EDI) as controls: filing currency, license status, market-conduct data submission. Uniquely automatable via the regulator connectors already defined. | `reg.*` connectors; ACORD forms controls |

## Recommended next 3–5 (the sequence to build)

1. **ISO/IEC 27001 + 27002** — highest leverage: becomes the spine the infosec packs map to, and a
   NIST/SOC2 crosswalk falls out of it.
2. **NAIC Model Audit Rule + ORSA** — the insurance-specific complement to the SOX pack, consumed
   directly by state regulators through the filing systems already in the connector catalogue.
3. **HIPAA** — closes the health-data gap that GDPR special-category controls only partly cover; high
   penalty exposure for a carrier touching medical evidence.
4. **NIST CSF 2.0 as a crosswalk layer** — not a standalone pack but a mapping that lets one control
   run satisfy NYDFS + ISO + SOC 2 simultaneously (multiplies the value of everything already built).
5. **50-State Regulatory Filings pack** — turns the regulator source-system catalogue into live,
   testable controls; the most uniquely automatable and demo-friendly of the insurance options.

## Pattern for adding any of these

Every candidate above is built the same way (see `control-framework/README.md` → "Add a new standard"):
decompose the standard into controls, bind each control's `required_data_sources` to connectors in
`control-framework/source-connectors.md`, write fixtures + tests, register a `data/<std>-standards.json`
pack and add it to `backend/scripts/load-standards.ts`. A **NIST/ISO crosswalk** is the one exception —
it is best modeled as a mapping table referencing existing control ids rather than a fresh control set.
