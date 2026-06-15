# Transformation Bridge — ACORD Integration Notes

## What this delivers

`data/acord-standards.json` and `data/acord-standards.csv` contain **12 ACORD standards** — one per
machine-testable control in `controls/` — packaged for the Transformation Bridge **Standards** area
as the category **"ACORD Data Standards"** under the **Enterprise & Solution Architecture** area,
accountable to the **CTO / Enterprise Architect**. They mirror the fields the Standards UI surfaces so
they load as rows alongside the existing standards set.

ACORD is a **data-standards body, not a regulator** — so these rows describe *conformance gates*
(message/schema, forms, data-dictionary/code-lists, API/ADAPT), not legal sections. There is no
scope gate for legal applicability; the skill's STEP 0 instead asks whether the system exchanges
insurance data externally or maintains canonical data that should align to ACORD.

## Field mapping (StandardItem model ← data field)

| Transformation Bridge UI / StandardItem | Data field | Notes |
|---|---|---|
| Standards area | `area` | "Enterprise & Solution Architecture" |
| Category header | `category` | "ACORD Data Standards" |
| Standard title | `standard` | the control's `control_name` |
| "WHAT IT MEANS" | `whatItMeans` | one-sentence plain-English from the control's `control_objective` |
| Build / Run / Build/Run chip | `phase` | Build = enforced during delivery; Run = operational/continuous |
| "RESPONSIBLE ROLE" | `responsibleRole` | the control's `control_owner.primary_role` |
| "APPLIES TO VALUE STREAMS" tags | `appliesToValueStreams` | from each control's `regulatory_mapping.applies_to_value_streams` |
| *(extension)* `regCitation` | `acordCitations` | from `regulatory_mapping.citation` — ACORD family/standard traceability |
| *(extension)* `sdlcGates` | `sdlcGates` | from `regulatory_mapping.sdlc_gates` — names the phases that enforce it |
| *(extension)* `agentSkill` | (constant) | every control's `agent_skill` is `acord-data-standards-compliance`; set this on the rows so the app links each standard back to this skill |

## How to load

1. **Confirm the import schema.** Field names follow the documented `standards-import.v1` shape
   (`$schema` is set in the JSON). Confirm against the live loader before running.
2. Register the pack and load:
   ```bash
   npm run load:standards -w cascade-backend
   ```
   (Equivalently, register `acord` in `backend/scripts/load-standards.ts` as described in
   `../../control-framework/README.md`, step 5.) Use the **CSV** for a bulk paste into Data Admin or
   the **JSON** for a structured payload — the two files are generated from the same source and are
   identical in content.
3. `acordCitations`, `sdlcGates`, and `agentSkill` are extension/traceability fields. If the app
   rejects unknown columns, drop them on import and keep them here for traceability — but `agentSkill`
   and `sdlcGates` are what wire the standard rows to this skill and to the control library, so prefer
   to add the columns rather than drop them.
4. After load, expect the **Enterprise & Solution Architecture** area to gain a new **ACORD Data
   Standards** category with **12** standards.

## Which area/category it lands in

The pack manifest (`pack.json`) and the standards file agree: **area = "Enterprise & Solution
Architecture"**, **category = "ACORD Data Standards"**, **owner = "CTO / Enterprise Architect"**.
ACORD is filed under Enterprise & Solution Architecture because canonical-model ownership and the
reference-architecture decisions sit with the **CTO / Enterprise Architect** — even though
*enforcement* is shared with the **Integration Architect** (message/transaction/forms/GRLC
conformance), the **Data Architect** (data dictionary, code lists, mandatory elements), and the **API
Product Owner** (ADAPT alignment, schema registration). If the platform supports multi-area tagging,
the API and message-conformance rows also belong conceptually under **Technology Delivery & Change**;
the recommendation is noted, the decision is yours.

## Phase semantics

"Build" standards are enforced during delivery (design/dev/test); "Run" standards are
operational/continuous; "Build/Run" applies in both. The message-conformance, data-quality,
code-list, and forms controls are **Build/Run** because they are *designed and built in* and then
*validate continuously* (e.g., continuous XSD/TXLife/GRLC validation, quarterly forms and code-list
currency checks). The pure design-time conformance controls — **data-dictionary mapping (acord-008)**
and the **API controls (acord-011, acord-012)**, whose gates are Design/Development/Testing and whose
frequency is per release — are **Build**. This matches the control library: each standard's `phase` is
consistent with its control's `sdlc_gates` and `control_frequency`.

## Roles

The data uses the controls' own owner roles — **Integration Architect, Data Architect, API Product
Owner**. If your role taxonomy lacks any of these (notably **API Product Owner**), add them before
load or accountability for the API conformance standards will be mis-assigned. The accountable owner
for the category as a whole is the **CTO / Enterprise Architect**.

## Telemetry

The app has a Telemetry tab. For each standard, wire the signal that proves the control is live —
e.g., schema validation failures (acord-001), envelope conformance failures (acord-002),
critical-element nulls and mandatory-element population % (acord-003), TXLife validation failures
(acord-004), invalid OLI_LU codes (acord-005), non-current ACORD 25 issuances (acord-006), superseded
forms in use (acord-007), unmapped internal fields (acord-008), outdated code-list versions
(acord-009), GRLC message failures (acord-010), nonconformant API endpoints (acord-011), and
unregistered / version-pinned schemas (acord-012). The starter set per control is in
`references/audit-evidence-map.md`.

## Relationship to the deeper control library

The app's **standards rows are the *what*** — the conformance statement an architect or partner-
certification reviewer reads. The **`controls/` definitions are the *proof engine*** — each standard
corresponds 1:1 to a `controls/<id>.control.json` carrying its data sources (integration bus, schema
registry, forms library, data dictionary, API gateway), method, **machine-checkable assertions**,
required evidence, retention, and downstream linkage (e.g., Carrier Integration Certification, Data
Quality Scorecard, Filing Package, API/Schema Governance Attestation). The Cascade Control Framework
(`../../control-framework/`) runs those controls, evaluates the assertions, and emits `registry.json`,
`evidence-pack.md`, and `tech-debt-backlog.md`.

The standard's `sdlcGates` field names the phases where it is enforced; the SDLC skill
(`SKILL.md` + `references/`) operationalizes those gates and defines the **evidence artifact** each
must produce. That closes the conformance loop from "we have an ACORD standard" → "the control ran and
passed this cycle" → "we can hand a partner-certification reviewer or architecture board a current,
retained, traceable artifact." A standards row without a running control is an assertion; a running
control without a standards row is invisible to the business — the pack is designed so both always
exist together.

## Boundary

Engineering and data-quality integration guidance, **not a legal or regulatory opinion**. ACORD
conformance does not by itself satisfy SOX, NYDFS, GDPR, statutory reporting, or state filing
requirements; those are separate regimes with their own owners and skills.
