// Live-binding regression test for SOX-ELC-404-02. Feeds the captured Linear MCP evidence
// (live/SOX-ELC-404-02.linear-raw.json) through the pure collector and the control, confirming a
// schema-valid Failed run (the workspace's open items have no owner/priority/due-date).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveMetrics } from '../../../control-framework/lib/collectors/linear-remediation.mjs';
import { runControl } from '../../../control-framework/lib/run-control.mjs';
import { validate } from '../../../control-framework/lib/schema-validate.mjs';
import { resolvePack, loadControls } from '../../../control-framework/lib/load-controls.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(resolve(HERE, '../live/SOX-ELC-404-02.linear-raw.json'), 'utf8'));
const runSchema = JSON.parse(readFileSync(resolve(HERE, '../../../control-framework/schemas/control-run.schema.json'), 'utf8'));

test('SOX-ELC-404-02 live — Linear collector derives metrics and the control produces a schema-valid run', () => {
  const { metrics } = deriveMetrics(raw.issues, { now: '2026-06-15T00:00:00Z' });
  assert.equal(metrics.remediation_items_total, raw.issues.length);
  assert.equal(metrics.items_without_owner, raw.issues.length, 'all captured items are unassigned');

  const control = loadControls(resolvePack('sox')).find((c) => c.control.control_id === 'SOX-ELC-404-02').control;
  const run = runControl(control, {
    assessment_cycle: 'LIVE',
    metrics,
    source_availability: { 'Remediation Tracker (Linear)': true },
    evidence_present: { remediation_register_export: true, owner_assignment_log: false, due_date_report: false },
  });
  const { valid, errors } = validate(run, runSchema);
  assert.ok(valid, `live run failed schema validation:\n${errors.join('\n')}`);
  assert.equal(run.run_status, 'Failed', 'unowned, undated open items should fail the control');
});
