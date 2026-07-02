#!/usr/bin/env node
/**
 * Pipeline data-promotion step — LOGICAL COPY, never branch restore.
 *
 * Neon's branch-restore API re-parents the target under the source, welding
 * feature branches into the environment lineage (undeletable "chain
 * deadlock"). This script therefore promotes datasets as a logical copy:
 * pg_dump the source, drop + recreate the target's public schema, pg_restore
 * into it. Branch parentage NEVER changes; feature branches stay deletable;
 * environment branches are never re-parented or deleted.
 *
 * Safety: before overwriting, the target's current state is snapshotted as a
 * plain CHILD branch `backup/<target>-<shortsha>` (computeless, instant,
 * leaf-deletable). After a successful copy, older backups of the same target
 * are pruned so exactly one backup per target exists.
 *
 * Trigger policy (unchanged):
 *   - only when the merge TITLE (first line) ENDS with `[promote-data]`
 *   - master push:  source develop        -> target production
 *   - develop push: source <feature>      -> target develop (same-name branch)
 *
 * Requires pg_dump/pg_restore/psql >= the server major version on PATH.
 * Env: NEON_API_KEY, NEON_PROJECT_ID, GITHUB_REF_NAME, COMMIT_MESSAGE,
 *      COMMIT_SHA, DEVELOP_DIRECT_URL, PRODUCTION_DIRECT_URL.
 */
import { execFileSync } from 'node:child_process';

const API = 'https://console.neon.tech/api/v2';
const KEY = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const REF = process.env.GITHUB_REF_NAME ?? '';
const MSG = process.env.COMMIT_MESSAGE ?? '';
const SHA = (process.env.COMMIT_SHA ?? 'manual').slice(0, 7);

// The marker must TERMINATE the merge title. Mid-sentence mentions (e.g. a PR
// about this feature) must never trigger a promotion.
const title = MSG.split('\n', 1)[0].trim();
if (!/\[promote-data\]$/.test(title)) {
  console.log('Merge title does not END with [promote-data] — data promotion skipped.');
  process.exit(0);
}
if (!KEY || !PROJECT) {
  console.error('Data promotion requested but NEON_API_KEY / NEON_PROJECT_ID are not configured.');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, init) {
  const res = await fetch(`${API}${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`Neon API ${init?.method ?? 'GET'} ${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function featureNameFromMergeCommit() {
  const m = MSG.match(/Merge pull request #\d+ from [^/\s]+\/(\S+)/);
  return m ? m[1] : null;
}

const { branches } = await api(`/projects/${PROJECT}/branches`);
const byName = new Map(branches.map((b) => [b.name, b]));

let targetName;
let sourceUrl;
let targetUrl;
if (REF === 'master') {
  targetName = 'production';
  sourceUrl = process.env.DEVELOP_DIRECT_URL;
  targetUrl = process.env.PRODUCTION_DIRECT_URL;
  if (!sourceUrl || !targetUrl) {
    console.error('DEVELOP_DIRECT_URL / PRODUCTION_DIRECT_URL not configured.');
    process.exit(1);
  }
} else if (REF === 'develop') {
  targetName = 'develop';
  targetUrl = process.env.DEVELOP_DIRECT_URL;
  const featureName = featureNameFromMergeCommit();
  if (!featureName) {
    console.error('[promote-data] on develop but no feature branch found in the merge commit message.');
    process.exit(1);
  }
  const feature = byName.get(featureName);
  if (!feature) {
    console.error(`[promote-data] source Neon branch "${featureName}" not found — nothing to promote.`);
    process.exit(1);
  }
  const params = new URLSearchParams({
    branch_id: feature.id,
    database_name: 'neondb',
    role_name: 'neondb_owner',
    pooled: 'false',
  });
  sourceUrl = (await api(`/projects/${PROJECT}/connection_uri?${params}`)).uri;
  if (!targetUrl) {
    console.error('DEVELOP_DIRECT_URL not configured.');
    process.exit(1);
  }
} else {
  console.log(`[promote-data] only acts on develop/master pushes (ref: ${REF}) — skipped.`);
  process.exit(0);
}

const target = byName.get(targetName);
if (!target) throw new Error(`Target Neon branch "${targetName}" not found.`);

// ── 1. Snapshot the target as a plain child branch (instant, computeless,
//       leaf-deletable — parentage of the TARGET itself is untouched). ──
const backupName = `backup/${targetName}-${SHA}`;
await api(`/projects/${PROJECT}/branches`, {
  method: 'POST',
  body: JSON.stringify({ branch: { name: backupName, parent_id: target.id } }),
});
console.log(`Snapshot backup created: "${backupName}" (child of ${targetName}).`);

// ── 2. Logical copy: dump source → reset target schema → restore. ──
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });

console.log('Dumping source…');
run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file=promote.dump', sourceUrl]);

console.log('Resetting target schema…');
run('psql', [targetUrl, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;']);

console.log('Restoring into target…');
run('pg_restore', ['--no-owner', '--no-privileges', '--dbname=' + targetUrl, 'promote.dump']);
console.log(`Dataset promoted into ${targetName} (branch parentage untouched).`);

// ── 3. Rotate: keep exactly ONE backup per target. Never fatal. ──
const stale = branches.filter((b) => b.name.startsWith(`backup/${targetName}-`) && b.name !== backupName);
for (const b of stale) {
  try {
    await api(`/projects/${PROJECT}/branches/${b.id}`, { method: 'DELETE' });
    console.log(`Pruned superseded backup "${b.name}" (${b.id}).`);
  } catch (err) {
    console.warn(`Could not prune old backup "${b.name}": ${err.message} — leaving it in place.`);
  }
}
