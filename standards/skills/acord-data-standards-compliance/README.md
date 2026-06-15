# ACORD Data Standards Compliance Pack — Meridian Insurance Group

An ACORD conformance pack for an insurer's integration estate, covering the **data-standards
conformance layer**: ACORD message schemas (P&C XML, TXLife, GRLC), the ACORD data dictionary and
code lists (OLI / OLI_LU), ACORD forms, and ADAPT / reference-model-aligned partner APIs. ACORD is a
**data-standards body, not a regulator** — this pack governs build-time and run-time conformance, not
legal compliance. It is two things at once:

1. **An SDLC agent skill** (`SKILL.md` + `references/`) — drives ACORD-conformance-by-design and
   produces conformance evidence across requirements, design, development, and testing.
2. **A machine-testable control library** (`controls/` + `fixtures/` + `tests/`) — 12 individually
   runnable controls executed and evidenced by the Cascade Control Framework.

## File layout

```
acord-data-standards-compliance/
├── SKILL.md                      ← STEP 0 applicability check + four phase gates + conformance principle
├── README.md                     ← you are here
├── INTEGRATION-NOTES.md          ← how the standards rows map into the app + relationship to controls/
├── pack.json                     ← pack manifest (slug "acord", framework ACORD, owner, area)
├── references/
│   ├── acord-reference.md                 ← the standards families: Reference Architecture, P&C, L&A/TXLife, GRLC, Forms, code lists, ADAPT
│   ├── acord-quick-reference.md           ← one-line-per-item cheat sheet
│   ├── requirements-phase.md              ← phase gate checklist + evidence + control ids
│   ├── design-phase.md
│   ├── development-phase.md
│   ├── testing-phase.md
│   └── audit-evidence-map.md              ← the crosswalk + ACORD Conformance Record template
├── data/
│   ├── acord-standards.json      ← 12 standards mapped to the Standards import schema
│   └── acord-standards.csv       ← same data, flattened for bulk import
├── controls/                     ← 12 *.control.json definitions (the testable controls)
├── fixtures/                     ← one *.fixture.json per control (synthetic/connector-pulled data)
├── tests/                        ← one *.test.mjs per control
├── registry.json                ← GENERATED: definitions + runs + issues + evidence + portfolio summary
├── evidence-pack.md             ← GENERATED: the conformance evidence pack
├── tech-debt-backlog.json/.md   ← GENERATED: unmet controls, missing sources, manual steps, failed runs
```

The 12 controls, in order: `ACORD-PC-01..03` (P&C message & data-quality conformance), `ACORD-LAH-01`
(TXLife) and `ACORD-LAH-02` (OLI code lists), `ACORD-FORM-01..02` (forms governance), `ACORD-DICT-01`
(data-dictionary mapping) and `ACORD-DICT-02` (code-list currency), `ACORD-RI-01` (GRLC reinsurance),
`ACORD-API-01` (ADAPT / reference-model alignment) and `ACORD-API-02` (schema registration & pinning).

## How to run it

All commands run from the repository root.

```bash
# Run the whole pack: validate definitions → run controls → tech-debt → evidence pack
node standards/control-framework/cli/report.mjs acord

# Run the control tests
node --test "standards/skills/acord-data-standards-compliance/tests/*.test.mjs"
```

`report.mjs` regenerates `registry.json`, `evidence-pack.md`, and `tech-debt-backlog.{json,md}`. Runs
use a fixed clock (`$NOW`) and cycle (`$CYCLE`, default `2026-Q2`) so committed artifacts stay
reproducible; override the env vars for a real assessment cycle. See
`../../control-framework/README.md` for the framework model and the individual `validate.mjs` /
`run.mjs` / `tech-debt.mjs` / `evidence-pack.mjs` commands.

## How it loads into the app

The 12 standards in `data/acord-standards.json` (or `.csv`) surface in the Transformation Bridge
**Standards** area under **Enterprise & Solution Architecture → ACORD Data Standards**, accountable to
the **CTO / Enterprise Architect**:

```bash
npm run load:standards -w cascade-backend
```

See `INTEGRATION-NOTES.md` for the field mapping, the relationship between the app's standards rows
and the deeper control library, and the assumptions to validate before load.

## Boundary

This pack is **engineering and data-quality guidance, not a legal or regulatory opinion**. ACORD
conformance makes the integration estate interoperable and straight-through and lowers rework and E&O
exposure — it does **not** by itself satisfy SOX, NYDFS, GDPR, statutory reporting, or state filing
requirements. Those are separate regimes with their own owners and skills. The pack enforces and
evidences the ACORD data-standards conformance layer that clean partner exchange depends on.
