#!/usr/bin/env node
// run-one.mjs <pack> <controlId> [fixtureFile] — run a SINGLE control against a specific fixture
// (e.g. a live fixture produced by collect-git.mjs) and write a run record. Usage:
//   node cli/run-one.mjs sox SOX-ITGC-CM-02 fixtures/SOX-ITGC-CM-02.live.fixture.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePack, loadControls } from '../lib/load-controls.mjs';
import { runControl } from '../lib/run-control.mjs';
import { validate } from '../lib/schema-validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];
const controlId = process.argv[3];
const fixtureArg = process.argv[4];
if (!slug || !controlId) { console.error('usage: node cli/run-one.mjs <pack> <controlId> [fixtureFile]'); process.exit(2); }

const pack = resolvePack(slug);
const control = loadControls(pack).find(({ control }) => control.control_id === controlId)?.control;
if (!control) { console.error(`control ${controlId} not found in pack ${slug}`); process.exit(1); }

const fixturePath = fixtureArg
  ? (existsSync(fixtureArg) ? fixtureArg : join(pack.path, fixtureArg))
  : join(pack.path, 'fixtures', `${controlId}.fixture.json`);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const run = runControl(control, fixture, { cycle: fixture.assessment_cycle });
if (fixture.provenance) run.input_context.scope_note = `LIVE — ${fixture.provenance.source} @ ${fixture.provenance.head_sha?.slice(0, 12)}`;

const runSchema = JSON.parse(readFileSync(resolve(HERE, '../schemas/control-run.schema.json'), 'utf8'));
const { valid, errors } = validate(run, runSchema);
if (!valid) { console.error('run failed schema validation:'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }

const liveDir = join(pack.path, 'live');
mkdirSync(liveDir, { recursive: true });
const tag = basename(fixturePath).includes('.live.') ? 'live-run' : 'run';
const out = join(liveDir, `${controlId}.${tag}.json`);
writeFileSync(out, JSON.stringify(run, null, 2) + '\n');

const mark = { Passed: 'PASS', Warning: 'WARN', Failed: 'FAIL', Error: 'ERROR', 'Not Run': 'NOT RUN' };
console.log(`\n${controlId} — ${control.control_name}`);
console.log(`Run status: ${mark[run.run_status]}  (${fixture.live ? 'LIVE' : 'fixture'}: ${basename(fixturePath)})`);
console.log('Assertions:');
for (const t of run.threshold_comparison)
  console.log(`  [${t.status}] ${t.test_name} — actual ${JSON.stringify(t.actual_value)} ${t.threshold_operator} ${JSON.stringify(t.threshold_value)}`);
if (run.remediation_workflow)
  console.log(`Issue ${run.remediation_workflow.issue_id} (${run.remediation_workflow.severity}); downstream: ${run.remediation_workflow.downstream_impact_assessment}`);
console.log(`Wrote ${out}`);
