# Regulatory-compliance standards, SDLC agent skills & the control framework

Two layers work together here:

1. **SDLC agent-skill packs** — one self-contained skill per regulation/standard
   (`skills/<reg>/`), each governing the standards dataset it loads into the operating model.
2. **The control framework** (`control-framework/`) — a framework-agnostic layer that decomposes a
   standard into **individually testable controls** an agent can execute, evidence, and audit, and
   that surfaces the **technical debt** between "we have a policy" and "we can prove it works."

## Packs

| Skill folder | `agentSkill` | Standards area › category | # | Owner | Layer |
|---|---|---|---|---|---|
| `skills/gdpr-sdlc-compliance/` | `gdpr-sdlc-compliance` | Information Security › Data Privacy (GDPR) | 21 | DPO / ISO Security Architect | skill |
| `skills/ccpa-cpra-sdlc-compliance/` | `ccpa-cpra-sdlc-compliance` | Information Security › Data Privacy (CCPA/CPRA) | 22 | Privacy Officer / ISO Security Architect | skill |
| `skills/nydfs-500-sdlc-compliance/` | `nydfs-500-sdlc-compliance` | Information Security › NYDFS 23 NYCRR 500 | 22 | CISO / ISO Security Architect | skill |
| `skills/sox-itgc-sdlc-compliance/` | `sox-itgc-sdlc-compliance` | Finance & Accounting › Sarbanes-Oxley (ITGC & ICFR) | 15 | CFO / Controller; CISO | skill **+ control library** |
| `skills/acord-data-standards-compliance/` | `acord-data-standards-compliance` | Enterprise & Solution Architecture › ACORD Data Standards | 12 | CTO / Enterprise Architect | skill **+ control library** |

The first three are SDLC-skill-only. **SOX** and **ACORD** additionally carry a full control library
(`controls/`, `fixtures/`, `tests/`, generated `registry.json` / `evidence-pack.md` /
`tech-debt-backlog.md`) — they are the reference implementations of the merged pattern.

Each skill folder contains `SKILL.md`, the four SDLC phase guides
(`requirements/design/development/testing-phase.md`), `audit-evidence-map.md`, `references/`, and
`data/<reg>-standards.{json,csv}`.

## The control framework (the deep layer)

See [`control-framework/README.md`](control-framework/README.md). In one command:

```bash
node control-framework/cli/report.mjs sox     # validate → run → tech-debt → evidence pack
node control-framework/cli/report.mjs acord
```

This runs every control against its (synthetic or connector-pulled) data, writes a schema-valid
**unified registry**, an auditor-ready **evidence pack**, and a **technical-debt backlog** — the full
acquire → evaluate → evidence → surface-debt loop. Source-system bindings (API/MCP/SQL/Git/SharePoint/
Confluence/EDI/regulator portals) are catalogued in
[`control-framework/source-connectors.md`](control-framework/source-connectors.md).

Tests (zero-dependency, built-in `node:test`):

```bash
node --test "skills/sox-itgc-sdlc-compliance/tests/*.test.mjs"
node --test "skills/acord-data-standards-compliance/tests/*.test.mjs"
```

## Load / reload into the database

```bash
npm run load:standards -w cascade-backend
```

Idempotent. Each pack declares its Standards area and owner in
[`backend/scripts/load-standards.ts`](../backend/scripts/load-standards.ts); the script reloads each
pack's category and recomputes every touched area's item count. Each standard maps to the Standards UI
fields (name, "WHAT IT MEANS", Build/Run, responsible role) plus the traceability fields `agentSkill`,
`sdlcGates`, `regCitation`, and `appliesToValueStreams`.

## What to build next

[`ROADMAP-additional-standards.md`](ROADMAP-additional-standards.md) ranks the standards a global
carrier should codify next (ISO 27001, NAIC MAR/ORSA, HIPAA, PCI-DSS, SOC 2, NIST CSF, IFRS 17,
Solvency II, DORA, EU AI Act, and a 50-state regulatory-filings pack) with a recommended sequence.

## Decomposition tooling

`decomposition/` holds the original workbook-derived standards (input/output JSON for 16 domains) and
the scripts that slice and validate them — the source of the department-standards skills. The control
framework is the next maturity step: from *described* standards to *executable, evidenced* controls.
