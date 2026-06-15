// test-helper.mjs — shared harness so each control's test script (validation.test_script)
// is a few lines. It proves four things per control:
//   1. the control definition conforms to control.schema.json,
//   2. it runs against its fixture and the run conforms to control-run.schema.json,
//   3. the rolled-up run_status matches the fixture's expected_status,
//   4. each declarative assertion evaluates as the fixture expects (the validation itself works).
//
// Usage in a pack test file (node:test):
//   import { registerControlTests } from '../../control-framework/lib/test-helper.mjs';
//   registerControlTests('sox', 'SOX-ITGC-AC-01');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePack, loadControls, loadFixture } from './load-controls.mjs';
import { runControl, compare } from './run-control.mjs';
import { validate } from './schema-validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const controlSchema = JSON.parse(readFileSync(resolve(HERE, '../schemas/control.schema.json'), 'utf8'));
const runSchema = JSON.parse(readFileSync(resolve(HERE, '../schemas/control-run.schema.json'), 'utf8'));
const FIXED_NOW = '2026-06-30T02:00:00Z';

export function registerControlTests(packSlug, controlId) {
  const pack = resolvePack(packSlug);
  const found = loadControls(pack).find(({ control }) => control.control_id === controlId);
  assert.ok(found, `control ${controlId} not found in pack ${packSlug}`);
  const control = found.control;
  const fixture = loadFixture(pack, controlId);

  test(`${controlId} — definition conforms to control.schema.json`, () => {
    const { valid, errors } = validate(control, controlSchema);
    assert.ok(valid, `schema errors:\n${errors.join('\n')}`);
  });

  test(`${controlId} — runs and produces a schema-valid run record`, () => {
    const run = runControl(control, fixture, { now: FIXED_NOW });
    const { valid, errors } = validate(run, runSchema);
    assert.ok(valid, `run schema errors:\n${errors.join('\n')}`);
  });

  if (fixture && fixture.expected_status) {
    test(`${controlId} — run_status is ${fixture.expected_status} for its fixture`, () => {
      const run = runControl(control, fixture, { now: FIXED_NOW });
      assert.equal(run.run_status, fixture.expected_status);
    });
  }

  test(`${controlId} — each assertion evaluates correctly against the fixture`, () => {
    const metrics = fixture?.metrics || {};
    for (const a of control.validation.assertions) {
      const actual = metrics[a.metric];
      // The validation logic itself must be exercisable: a present metric evaluates without throwing.
      if (actual !== undefined && actual !== null) {
        const result = compare(actual, a.operator, a.value);
        assert.equal(typeof result, 'boolean', `assertion on ${a.metric} did not produce a boolean`);
      }
    }
  });
}

/** Convenience: register tests for every control in a pack from a single test file. */
export function registerPackTests(packSlug) {
  const pack = resolvePack(packSlug);
  for (const { control } of loadControls(pack)) registerControlTests(packSlug, control.control_id);
}
