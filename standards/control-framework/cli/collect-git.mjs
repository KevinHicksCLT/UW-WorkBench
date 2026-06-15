#!/usr/bin/env node
// collect-git.mjs <pack> <controlId> [repoDir] — bind a change-management control to the LIVE
// local Git source, capture an immutable evidence snapshot, and write a live fixture the runner
// can evaluate. Usage:
//   node cli/collect-git.mjs sox SOX-ITGC-CM-02
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolvePack, STANDARDS_ROOT } from '../lib/load-controls.mjs';
import { collect } from '../lib/collectors/git-merge-approval.mjs';

const slug = process.argv[2];
const controlId = process.argv[3];
const repoDir = process.argv[4] || resolve(STANDARDS_ROOT, '..'); // the transform-platform clone
if (!slug || !controlId) { console.error('usage: node cli/collect-git.mjs <pack> <controlId> [repoDir]'); process.exit(2); }

const pack = resolvePack(slug);
const now = new Date().toISOString();

// Derive owner/repo from the git remote if possible.
let ownerRepo;
try {
  const { execFileSync } = await import('node:child_process');
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoDir, encoding: 'utf8' }).trim();
  const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
  if (m) ownerRepo = m[1];
} catch { /* no remote */ }

const result = await collect({ repoDir, defaultBranch: process.env.BRANCH || 'master', ownerRepo });

// 1. Immutable evidence snapshot.
const liveDir = join(pack.path, 'live');
mkdirSync(liveDir, { recursive: true });
const snapshot = { control_id: controlId, collected_at: now, ...result };
writeFileSync(join(liveDir, `${controlId}.snapshot.json`), JSON.stringify(snapshot, null, 2) + '\n');

// 2. Live fixture (same shape the framework expects; no expected_status — this is real).
const fixture = {
  control_id: controlId,
  assessment_cycle: process.env.CYCLE || 'LIVE',
  as_of_date: now.slice(0, 10),
  client: ownerRepo || 'local-repo',
  live: true,
  provenance: result.provenance,
  source_availability: result.source_availability,
  metrics: result.metrics,
  evidence_present: result.evidence_present,
  downstream: [{ artifact_type: 'ICFR Assertion', artifact_id: `icfr-live-${controlId}`, target_system: 'GRC', expected_link: 'Linked' }],
};
const fixturePath = join(pack.path, 'fixtures', `${controlId}.live.fixture.json`);
writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n');

console.log(`Bound ${controlId} to LIVE git source: ${result.provenance.repo}`);
console.log(`  HEAD ${result.provenance.head_sha.slice(0, 12)} · ${result.metrics.production_merges} PR merges · ${result.metrics.self_deploys} self-merged · ${result.metrics.distinct_contributors} contributor(s)`);
console.log(`  review source: ${result.provenance.review_source}`);
console.log(`Wrote ${join(liveDir, controlId + '.snapshot.json')}`);
console.log(`Wrote ${fixturePath}`);
