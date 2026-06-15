# Transformation Bridge — SOX Integration Notes

## What this delivers

`data/sox-standards.json` and `data/sox-standards.csv` contain **15 SOX standards** — one per
machine-testable control in `controls/` — packaged for the Transformation Bridge **Standards** area
as the category **"Sarbanes-Oxley (ITGC & ICFR)"** under the **Finance & Accounting** area,
accountable to **CFO / Controller (ICFR); CISO (ITGC)**. They mirror the fields the Standards UI
surfaces so they load as rows alongside the existing standards set.

## Field mapping (StandardItem model ← data field)

| Transformation Bridge UI / StandardItem | Data field | Notes |
|---|---|---|
| Standards area | `area` | "Finance & Accounting" |
| Category header | `category` | "Sarbanes-Oxley (ITGC & ICFR)" |
| Standard title | `standard` | the control's `control_name` |
| "WHAT IT MEANS" | `whatItMeans` | one-sentence plain-English from the control's `control_objective` |
| Build / Run / Build/Run chip | `phase` | Build = enforced during delivery; Run = operational/continuous |
| "RESPONSIBLE ROLE" | `responsibleRole` | the control's `control_owner.primary_role` |
| "APPLIES TO VALUE STREAMS" tags | `appliesToValueStreams` | from each control's `regulatory_mapping.applies_to_value_streams` |
| *(extension)* `regCitation` | `soxSections` | from `regulatory_mapping.citation` — §/COSO/ITGC traceability |
| *(extension)* `sdlcGates` | `sdlcGates` | from `regulatory_mapping.sdlc_gates` — names the phases that enforce it |
| *(extension)* `agentSkill` | (constant) | every control's `agent_skill` is `sox-itgc-sdlc-compliance`; set this on the rows so the app links each standard back to this skill |

## How to load

1. **Confirm the import schema.** Field names follow the documented `standards-import.v1` shape
   (`$schema` is set in the JSON). Confirm against the live loader before running.
2. Register the pack and load:
   ```bash
   npm run load:standards -w cascade-backend
   ```
   (Equivalently, register `sox` in `backend/scripts/load-standards.ts` as described in
   `../../control-framework/README.md`, step 5.) Use the **CSV** for a bulk paste into Data Admin or
   the **JSON** for a structured payload — the two files are generated from the same source and are
   identical in content.
3. `soxSections`, `sdlcGates`, and `agentSkill` are extension/traceability fields. If the app rejects
   unknown columns, drop them on import and keep them here for traceability — but `agentSkill` and
   `sdlcGates` are what wire the standard rows to this skill and to the control library, so prefer to
   add the columns rather than drop them.
4. After load, expect the **Finance & Accounting** area to gain a new **Sarbanes-Oxley (ITGC & ICFR)**
   category with **15** standards.

## Which area/category it lands in

The pack manifest (`pack.json`) and the standards file agree: **area = "Finance & Accounting"**,
**category = "Sarbanes-Oxley (ITGC & ICFR)"**, **owner = "CFO / Controller (ICFR); CISO (ITGC)"**.
SOX is deliberately filed under Finance & Accounting because ICFR ownership sits with the
CFO/Controller — even though the *enforcement* of most controls is shared with the CISO (ITGC
Access/Operations), Engineering (ITGC Change, application controls), and Legal/Records (§802). If the
platform supports multi-area tagging, the ITGC rows (sox-001..010) also belong conceptually under
**Cybersecurity & ISO** and **Technology Delivery & Change**; the recommendation is noted, the
decision is yours.

## Phase semantics

"Build" standards are enforced during delivery (design/dev/test); "Run" standards are
operational/continuous; "Build/Run" applies in both. The access, change, and application controls are
**Build/Run** because they are *designed and built in* and then *operate continuously*; the pure
operations and entity-level controls (recertification, batch monitoring, backups, §302
sub-certifications, §404 matrix testing) are **Run**. This matches the control library: each
standard's `phase` is consistent with its control's `sdlc_gates` and `control_frequency`.

## Roles

The data uses the controls' own owner roles — **IT Security Manager, Access Administrator, Release
Manager, IT Operations Manager, Financial Systems Analyst, Controller, SOX Program Manager, Records
Manager**. If your role taxonomy lacks any of these (notably **SOX Program Manager** and **Records
Manager**), add them before load or accountability for the entity-level and retention standards will
be mis-assigned. The accountable owner for the category as a whole is the **CFO / Controller** for
ICFR and the **CISO** for the ITGC layer.

## Telemetry

The app has a Telemetry tab. For each standard, wire the signal that proves the control is live —
e.g., unapproved-grant count (sox-001), recertification-completion % (sox-002), self-approved-merge
count (sox-007), premium-to-GL recalculation match % and unexplained-variance $ (sox-011),
sub-certifications-received % (sox-013), key-controls-tested % (sox-014). The starter set per control
is in `references/audit-evidence-map.md`.

## Relationship to the deeper control library

This is the key distinction for SOX. The app's **standards rows are the *what*** — the policy
statement an examiner or executive reads. The **`controls/` definitions are the *proof engine*** —
each standard corresponds 1:1 to a `controls/<id>.control.json` carrying its data sources, method,
**machine-checkable assertions**, required evidence, retention, and downstream linkage to the
**ICFR Assertion / 404 Control Matrix Row / 302 Certification**. The Cascade Control Framework
(`../../control-framework/`) runs those controls, evaluates the assertions, and emits `registry.json`,
`evidence-pack.md`, and `tech-debt-backlog.md`.

The standard's `sdlcGates` field names the phases where it is enforced; the SDLC skill
(`SKILL.md` + `references/`) operationalizes those gates and defines the **evidence artifact** each
must produce. That closes the SOX loop from "we have a standard" → "the control ran and passed this
cycle" → "we can hand the §302 sub-certifier and the AS 2201 auditor a current, retained, traceable
artifact." A standards row without a running control is an assertion; a running control without a
standards row is invisible to the business — the pack is designed so both always exist together.

## Boundary

Engineering integration guidance, **not a legal or audit opinion**. The §404 ICFR conclusion,
deficiency-severity classification, §302/§906 certification language, materiality, and §802
legal-hold scope are CFO / Controller / SOX program / Legal / external-auditor judgements.
