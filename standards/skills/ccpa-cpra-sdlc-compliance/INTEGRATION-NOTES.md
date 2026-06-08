# Transformation Bridge — CCPA/CPRA Integration Notes

## What this delivers (Goal #1)

`ccpa-cpra-standards.json` and `ccpa-cpra-standards.csv` contain **22 standards** packaged as a new
category — **"Data Privacy (CCPA/CPRA)"** — under **Cybersecurity & ISO**, owned by **Privacy Officer
/ ISO Security Architect**. Fields mirror the Standards UI.

## Field mapping (UI label → data field)

| Transformation Bridge UI | Data field |
|---|---|
| Standards area | `area` ("Cybersecurity & ISO") |
| Category header | `category` ("Data Privacy (CCPA/CPRA)") |
| Standard title | `standard` |
| "WHAT IT MEANS" | `whatItMeans` |
| Build / Run / Build/Run chip | `phase` |
| "RESPONSIBLE ROLE" | `responsibleRole` |
| "APPLIES TO VALUE STREAMS" tags | `appliesToValueStreams` |
| *(extension)* | `ccpaCitations`, `complianceDate`, `sdlcGates` |

## How to load
1. **Confirm the real import schema** (likely Data Admin) and rename fields if they differ.
2. Use the CSV for bulk import or the JSON for a structured payload — both from the same source.
3. Drop extension columns if the importer rejects unknown fields; keep them in this project.
4. After load, Cybersecurity & ISO gains a category. Loaded alongside GDPR and NYDFS, the area would
   hold 48 + 21 + 22 + 22 = **113 standards across 13 categories** — at which point the cross-regime
   control-library approach (below) becomes important to avoid duplicate-control sprawl.

## Decisions to validate (CCPA-specific)

- **The GLBA-exemption analysis (ccpa-001) gates everything.** Much of a carrier's customer PI is
  collected/processed under GLBA and therefore exempt from the CCPA — but the exemption is
  **information-level, not entity-level**. Before treating any standard as "N/A," map which data
  flows are GLBA-covered and which are not (web visitors, prospects, marketing, employees/applicants,
  B2B contacts). Mis-scoping here either over-builds (applying CCPA to exempt GLBA data) or
  under-builds (ignoring CCPA for non-GLBA data). This is the single most consequential decision.
- **Phased compliance dates are live.** `complianceDate` reflects the staggered CPPA timeline: risk
  assessments in force since 1 Jan 2026; ADMT obligations by **1 Jan 2027**; cybersecurity-audit
  certifications to the CPPA from **1 April 2028** (> $100M revenue cohort — likely Meridian).
  Consider surfacing `complianceDate` on the Telemetry tab as a countdown.
- **Roles.** CCPA does not mandate a DPO; the data uses "Privacy Officer" plus existing app roles. If
  your taxonomy lacks a Privacy Officer, add one or the accountability for rights/notice standards is
  mis-assigned.
- **Thresholds for the new regs differ.** The cyber-audit and risk-assessment regs have their own
  revenue/processing thresholds and schedules distinct from the base "business" test — confirm which
  apply to Meridian.

## Cross-regime note (GDPR + NYDFS + CCPA/CPRA)
These three packs overlap heavily (access/deletion, retention, reasonable security, third-party,
automated decisions). They **diverge** in model: GDPR is opt-in/consent + rights + DPIA; NYDFS is
security/NPI + certification; CCPA is **opt-out** + sale/sharing + GPC signals + a breach private
right of action, now plus risk assessments, ADMT rules, and cyber audits. **Build one shared control
library with regime tags** so a single implemented control (e.g., a deletion pipeline, encryption at
rest, an ADMT human-review path) evidences **GDPR Art. 17 / NYDFS 500.13 / CCPA 1798.105**
simultaneously — while keeping the three **filings/certifications separate**, because the triggers,
deadlines, and evidence formats differ. (A crosswalk file would make this concrete — ask if you want it.)

## Relationship to the SDLC skill (Goal #2)
Each standard's `sdlcGates` field names the enforcing phases; the skill defines the evidence each gate
produces — the evidence that backs the CPPA risk assessments and the annual cybersecurity-audit
certification.
