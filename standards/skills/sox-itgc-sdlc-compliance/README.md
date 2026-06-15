# SOX ITGC & ICFR SDLC Compliance Pack — Meridian Insurance Group

A Sarbanes-Oxley compliance pack for an SEC-registered insurance carrier, covering the **engineering
slice** of SOX: the IT general controls (Access, Change, Operations), the automated application
controls, and the entity-level §302/§404/§802 evidence hooks that the financial-reporting program
relies on. It is two things at once:

1. **An SDLC agent skill** (`SKILL.md` + `references/`) — drives SOX-by-design and produces audit
   evidence across requirements, design, development, and testing.
2. **A machine-testable control library** (`controls/` + `fixtures/` + `tests/`) — 15 individually
   runnable controls executed and evidenced by the Cascade Control Framework.

## File layout

```
sox-itgc-sdlc-compliance/
├── SKILL.md                      ← scope gate + four phase gates + Run handoff + evidence principle
├── README.md                     ← you are here
├── INTEGRATION-NOTES.md          ← how the standards rows map into the app + relationship to controls/
├── pack.json                     ← pack manifest (slug "sox", framework SOX, owner, area)
├── references/
│   ├── sox-reference.md                  ← the obligations: §302/§404/§409/§802/§906, COSO 2013, ITGC, AS 2201
│   ├── sox-section-quick-reference.md    ← one-line-per-item cheat sheet
│   ├── requirements-phase.md             ← phase gate checklist + evidence + control ids
│   ├── design-phase.md
│   ├── development-phase.md
│   ├── testing-phase.md
│   └── audit-evidence-map.md             ← the crosswalk + SOX Control Record template (the audit spine)
├── data/
│   ├── sox-standards.json        ← 15 standards mapped to the Standards import schema
│   └── sox-standards.csv         ← same data, flattened for bulk import
├── controls/                     ← 15 *.control.json definitions (the testable controls)
├── fixtures/                     ← one *.fixture.json per control (synthetic/connector-pulled data)
├── tests/                        ← one *.test.mjs per control
├── registry.json                ← GENERATED: definitions + runs + issues + evidence + portfolio summary
├── evidence-pack.md             ← GENERATED: the auditor-facing evidence pack
├── tech-debt-backlog.json/.md   ← GENERATED: unmet controls, missing sources, manual steps, failed runs
```

The 15 controls, in order: `SOX-ITGC-AC-01..05` (Access), `SOX-ITGC-CM-01..03` (Change),
`SOX-ITGC-OP-01..02` (Operations), `SOX-APP-01..02` (automated application controls),
`SOX-ELC-302-01` (§302 sub-certifications), `SOX-ELC-404-01` (§404 ICFR matrix), `SOX-RET-802-01`
(§802 records retention).

## How to run it

All commands run from the repository root.

```bash
# Run the whole pack: validate definitions → run controls → tech-debt → evidence pack
node standards/control-framework/cli/report.mjs sox

# Run the control tests
node --test "standards/skills/sox-itgc-sdlc-compliance/tests/*.test.mjs"
```

`report.mjs` regenerates `registry.json`, `evidence-pack.md`, and `tech-debt-backlog.{json,md}`. Runs
use a fixed clock (`$NOW`) and cycle (`$CYCLE`, default `2026-Q2`) so committed artifacts stay
reproducible; override the env vars for a real assessment cycle. See
`../../control-framework/README.md` for the framework model and the individual `validate.mjs` /
`run.mjs` / `tech-debt.mjs` / `evidence-pack.mjs` commands.

## How it loads into the app

The 15 standards in `data/sox-standards.json` (or `.csv`) surface in the Transformation Bridge
**Standards** area under **Finance & Accounting → Sarbanes-Oxley (ITGC & ICFR)**, owned by **CFO /
Controller (ICFR); CISO (ITGC)**:

```bash
npm run load:standards -w cascade-backend
```

See `INTEGRATION-NOTES.md` for the field mapping, the relationship between the app's standards rows
and the deeper control library, and the assumptions to validate before load.

## Boundary

This pack is **engineering guidance, not a legal or audit opinion**. Materiality, control
deficiency-severity classification (deficiency / significant deficiency / material weakness), the
§404 ICFR conclusion, the §302/§906 certification language, and §802 legal-hold scope are CFO /
Controller / SOX program / Legal / external-auditor judgements. The pack enforces and evidences the
IT control layer those judgements rely on.
