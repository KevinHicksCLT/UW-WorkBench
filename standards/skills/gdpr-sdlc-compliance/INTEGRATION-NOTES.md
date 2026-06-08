# Transformation Bridge — GDPR Integration Notes

## What this delivers (Goal #1)

`gdpr-standards.json` and `gdpr-standards.csv` contain **21 GDPR standards** packaged as a new
category — **"Data Privacy (GDPR)"** — under the existing **Cybersecurity & ISO** standards area,
owned by **DPO / ISO Security Architect**. They are formatted to mirror the fields visible in the
Standards UI so they can be loaded as additional rows alongside the current 48.

## Field mapping (UI label → data field)

| Transformation Bridge UI | Data field | Notes |
|---|---|---|
| Standards area | `area` | "Cybersecurity & ISO" |
| Category header (e.g., "Application Security") | `category` | "Data Privacy (GDPR)" |
| Standard title | `standard` | |
| "WHAT IT MEANS" | `whatItMeans` | one-to-two sentence operational definition |
| Build / Run / Build/Run chip | `phase` | Build = project/initiative, Run = operational |
| "RESPONSIBLE ROLE" | `responsibleRole` | see role caveat below |
| "APPLIES TO VALUE STREAMS" tags | `appliesToValueStreams` | reuses the three tags seen in the UI |
| *(extension)* | `gdprArticles` | traceability to the regulation |
| *(extension)* | `sdlcGates` | traceability to the SDLC skill phases |

## How to load

1. **Confirm the real import schema.** The field names above are *inferred from the screenshots*,
   not from the application's documented import format. Before loading, check the actual schema
   (likely under **Data Admin**) and rename fields if they differ.
2. Use the **CSV** for a bulk paste/import into Data Admin, or the **JSON** if the app accepts a
   structured standards payload. The two files are generated from the same source and are identical
   in content.
3. The `gdprArticles` and `sdlcGates` columns are extension fields. If the app rejects unknown
   columns, drop them on import and keep them only in this project for traceability.
4. After load, expect the Cybersecurity & ISO area count to rise from 48 → 69, and category count
   from 10 → 11.

## Assumptions and decisions (validate these)

- **Placement.** The screenshots show GDPR named only inside the Cybersecurity & ISO *scope*
  ("Security compliance: SOX, PCI-DSS, HIPAA, GDPR"), so the standards are filed there. **GDPR is
  genuinely cross-functional**, though — several standards arguably belong in **Compliance & Risk
  Management** (RoPA, breach, DPO) and **Legal & Governance** (DPAs, lawful basis, transfers). If
  the platform supports it, consider tagging standards to multiple areas rather than forcing them
  all into Cybersecurity. Recommendation noted, decision is yours.
- **Roles.** The app currently uses roles like "ISO Architect" and "Application Security Lead." GDPR
  introduces the **DPO** as the accountable role for many obligations. The data uses combined roles
  (e.g., "DPO / ISO Architect"). If your role taxonomy has no DPO, add one before load, or the
  accountability for several standards will be mis-assigned.
- **Phase semantics.** "Build" standards are enforced during delivery (design/dev/test); "Run"
  standards are operational/continuous; "Build/Run" applies in both. This matches how the existing
  Application Security ("Build") vs Compliance/Data Protection ("Run", "Build/Run") chips are used.
- **Telemetry.** The app has a Telemetry tab. For each standard, decide the signal that proves it is
  live (e.g., DSAR median fulfilment time, % features with a completed DPIA, breach-notification
  SLA). The `audit-evidence-map.md` in the SDLC skill proposes a starter set.

## Relationship to the SDLC skill (Goal #2)

Each standard's `sdlcGates` field names the SDLC phases where it is enforced. The skill in
`../sdlc-gdpr-skill/` operationalises these gates and, critically, defines the **evidence artifact**
each gate must produce — which is what closes the loop from "we have a standard" to "we can prove it
to an auditor."
