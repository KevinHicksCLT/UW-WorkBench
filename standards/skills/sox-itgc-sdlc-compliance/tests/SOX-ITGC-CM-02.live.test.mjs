// Live-binding regression test for SOX-ITGC-CM-02. Unlike the synthetic-fixture test, this
// exercises the real git collector against this repository's actual merge history and confirms
// the control evaluates to a schema-valid, Failed run (solo-developer repo → every merge is
// self-authored with no independent-review evidence).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../../../control-framework/lib/collectors/git-merge-approval.mjs';
import { runControl } from '../../../control-framework/lib/run-control.mjs';
import { validate } from '../../../control-framework/lib/schema-validate.mjs';
import { resolvePack, loadControls } from '../../../control-framework/lib/load-controls.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(HERE, '../../../..'); // transform-platform repo root
const runSchema = JSON.parse(readFileSync(resolve(HERE, '../../../control-framework/schemas/control-run.schema.json'), 'utf8'));

test('SOX-ITGC-CM-02 live — git collector binds and the control produces a schema-valid run', async () => {
  const res = await collect({ repoDir: repoRoot, defaultBranch: 'master' });
  assert.ok(res.metrics.production_merges >= 1, 'expected at least one PR merge in history');
  // No review source available locally → no merge can be evidenced as independently approved.
  assert.equal(res.metrics.self_approved_merges, res.metrics.production_merges);

  const control = loadControls(resolvePack('sox')).find((c) => c.control.control_id === 'SOX-ITGC-CM-02').control;
  const run = runControl(control, {
    assessment_cycle: 'LIVE',
    metrics: res.metrics,
    source_availability: res.source_availability,
    evidence_present: res.evidence_present,
  });
  const { valid, errors } = validate(run, runSchema);
  assert.ok(valid, `live run failed schema validation:\n${errors.join('\n')}`);
  assert.equal(run.run_status, 'Failed', 'a solo-dev repo with no independent review should fail CM-02');
});
