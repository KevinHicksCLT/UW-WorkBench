# Cascade Control Framework

A framework-agnostic layer that turns any standard or regulation into **individually testable
controls an agent can execute, evidence, and audit** — and that surfaces the **technical debt**
standing between "we have a policy" and "we can prove the control ran and works."

It generalizes the Actuarial Loss Analysis control library so the same model serves SOX, ACORD,
ISO, GDPR, and anything else, and it plugs into the existing SDLC-skill packs under
[`../skills/`](../skills/).

## The model (three schemas)

| Schema | Purpose |
|---|---|
| [`schemas/control.schema.json`](schemas/control.schema.json) | Design-time **control definition** — one testable validation: source systems + access method, data elements, method, thresholds, **machine-checkable assertions**, evidence, downstream linkage, regulatory citation, audit metadata. |
| [`schemas/control-run.schema.json`](schemas/control-run.schema.json) | Run-time **execution result** — who/what ran it, dataset snapshots, assertion-by-assertion comparison, immutable evidence links, approval/override, remediation, downstream impact, immutable audit trail. |
| [`schemas/unified-registry.schema.json`](schemas/unified-registry.schema.json) | The **registry** tying definitions + runs + issues + evidence + technical-debt + a portfolio summary into one auditor-ready object. |

What makes a control *testable*: the `validation` block carries declarative `assertions`
(`{ metric, operator, value, severity }`) plus a `test_script` path. `lib/run-control.mjs` evaluates
the assertions against data; `node --test` exercises the same logic.

## The end-to-end flow ("how deep the rabbit hole goes")

```
acquire        evaluate        evidence            surface debt
 sources  ──▶  assertions ──▶  immutable links ──▶ technical-debt backlog
 (API/MCP/      (run-control)   (registry)          (unmet controls,
  SQL/Git/                                           missing sources,
  SharePoint/                                        manual steps,
  EDI/portal)                                        failed runs)
```

Connectors that bind each source are catalogued in
[`source-connectors.md`](source-connectors.md) (machine mirror: `lib/source-connectors.mjs`).

## CLI

```bash
# one command does everything for a pack (validate → run → tech-debt → evidence pack):
node standards/control-framework/cli/report.mjs sox

# or individually:
node standards/control-framework/cli/validate.mjs sox        # controls vs schema
node standards/control-framework/cli/run.mjs sox             # → standards/skills/<pack>/registry.json
node standards/control-framework/cli/tech-debt.mjs sox       # → tech-debt-backlog.{json,md}
node standards/control-framework/cli/evidence-pack.mjs sox   # → evidence-pack.md
```

Runs use a fixed clock (`$NOW`, default `2026-06-30T02:00:00Z`) and cycle (`$CYCLE`, default
`2026-Q2`) so committed artifacts stay reproducible. Override via env vars for a real cycle.

## Tests

```bash
node --test standards/skills/sox-itgc-sdlc-compliance/tests/
```

Each control has a test (`validation.test_script`) that asserts: the definition conforms to the
schema, it runs to a schema-valid run record, the rolled-up status matches the fixture's
`expected_status`, and every assertion evaluates. Zero dependencies — built-in `node:test` and a
tiny JSON-Schema-subset validator (`lib/schema-validate.mjs`); swap in `ajv` if you want full
draft-2020-12 coverage.

## Add a new standard (pack)

1. Create `../skills/<name>/` with a `pack.json` manifest (`slug`, `name`, `framework`).
2. Add `controls/*.control.json` (start from `templates/control.template.yaml`).
3. Add a `fixtures/<CONTROL_ID>.fixture.json` per control (synthetic or pulled via a connector).
4. Add `tests/*.test.mjs` using `registerControlTests` / `registerPackTests` from
   `lib/test-helper.mjs`.
5. (Optional) Add `data/<name>-standards.json` and register the pack in
   `backend/scripts/load-standards.ts` to surface it in the app's Standards UI.

The packs that ship today: [`sox-itgc-sdlc-compliance`](../skills/sox-itgc-sdlc-compliance/) and
[`acord-data-standards-compliance`](../skills/acord-data-standards-compliance/).
