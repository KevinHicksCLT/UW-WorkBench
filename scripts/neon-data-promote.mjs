#!/usr/bin/env node
/**
 * Pipeline data-promotion step (charter Task 21 extension).
 *
 * Whole-DATASET promotions are deliberate: this script only acts when the
 * triggering commit message contains the literal marker `[promote-data]`.
 * Without the marker it exits 0 as a no-op, so the pipeline stage is always
 * green and ordinary merges never touch data.
 *
 * With the marker:
 *   push to master  -> restore the Neon `production` branch from `develop`
 *   push to develop -> restore the Neon `develop` branch from the merged
 *                      feature's same-name Neon branch (if one exists)
 *
 * Every restore first preserves the target's current state as a backup branch
 * (backup/<target>-<shortsha>), so the operation is reversible from the Neon
 * console. Schema, data, and the _prisma_migrations ledger all arrive from
 * the source, which keeps the subsequent `migrate` stage truthful.
 *
 * Env: NEON_API_KEY, NEON_PROJECT_ID, GITHUB_REF_NAME, COMMIT_MESSAGE,
 *      COMMIT_SHA.
 */
const API = 'https://console.neon.tech/api/v2';
const KEY = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const REF = process.env.GITHUB_REF_NAME ?? '';
const MSG = process.env.COMMIT_MESSAGE ?? '';
const SHA = (process.env.COMMIT_SHA ?? 'manual').slice(0, 7);

if (!MSG.includes('[promote-data]')) {
  console.log('No [promote-data] marker in the commit message — data promotion skipped.');
  process.exit(0);
}
if (!KEY || !PROJECT) {
  console.error('[promote-data] requested but NEON_API_KEY / NEON_PROJECT_ID are not configured.');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, init) {
  const res = await fetch(`${API}${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`Neon API ${init?.method ?? 'GET'} ${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function featureNameFromMergeCommit() {
  // "Merge pull request #N from owner/<branch>" (github merge commits)
  const m = MSG.match(/Merge pull request #\d+ from [^/\s]+\/(\S+)/);
  return m ? m[1] : null;
}

const { branches } = await api(`/projects/${PROJECT}/branches`);
const byName = new Map(branches.map((b) => [b.name, b]));

let targetName;
let sourceName;
if (REF === 'master') {
  targetName = 'production';
  sourceName = 'develop';
} else if (REF === 'develop') {
  targetName = 'develop';
  sourceName = featureNameFromMergeCommit();
  if (!sourceName) {
    console.error('[promote-data] on develop but no feature branch found in the merge commit message.');
    process.exit(1);
  }
} else {
  console.log(`[promote-data] only acts on develop/master pushes (ref: ${REF}) — skipped.`);
  process.exit(0);
}

const target = byName.get(targetName);
const source = byName.get(sourceName);
if (!target) throw new Error(`Target Neon branch "${targetName}" not found.`);
if (!source) {
  console.error(`[promote-data] source Neon branch "${sourceName}" not found — nothing to promote.`);
  process.exit(1);
}

console.log(`Promoting DATA: ${sourceName} (${source.id}) -> ${targetName} (${target.id})`);
const backupName = `backup/${targetName}-${SHA}`;
const result = await api(`/projects/${PROJECT}/branches/${target.id}/restore`, {
  method: 'POST',
  body: JSON.stringify({ source_branch_id: source.id, preserve_under_name: backupName }),
});
console.log(`Restore accepted. Previous ${targetName} state preserved as "${backupName}".`);
console.log(JSON.stringify(result.branch ? { restored: result.branch.name, backup: backupName } : result));
