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
 * Trigger policy:
 *   - develop push: ALWAYS promotes — source <feature> (same-name Neon branch
 *     from the merge commit) -> target develop. Skips gracefully when the push
 *     is not a PR merge or the feature has no Neon branch.
 *   - master push:  ONLY when the merge TITLE (first line) ENDS with
 *     `[promote-data]` — source develop -> target production.
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

// Production promotion stays opt-in: the marker must TERMINATE the merge
// title. Mid-sentence mentions (e.g. a PR about this feature) must never
// trigger a promotion. Feature -> develop promotes automatically (no marker).
const title = MSG.split('\n', 1)[0].trim();
if (REF === 'master' && !/\[promote-data\]$/.test(title)) {
  console.log('Merge title does not END with [promote-data] — production data promotion skipped.');
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
  // Auto-promotion: not every develop push is a PR merge with a Neon branch —
  // direct pushes, squash merges, or DB-less features skip without failing.
  const featureName = featureNameFromMergeCommit();
  if (!featureName) {
    console.log('Develop push is not a PR merge commit — data promotion skipped.');
    process.exit(0);
  }
  const feature = byName.get(featureName);
  if (!feature) {
    console.log(`No Neon branch named "${featureName}" — data promotion skipped.`);
    process.exit(0);
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

// ── Platform-managed schemas are NEVER part of a promotion. Neon features
// (Neon Auth → `auth`/`neon_auth`, Data API → `pgrst`, …) install schemas the
// connected role does not own — DROP fails with "must be owner of schema" and
// they hold platform state, not app data. The app's dataset is exactly the
// schemas owned by the connected role; everything else is preserved on the
// target and excluded from the dump so the restore never collides with it.
const capture = (cmd, args) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const UNOWNED_SQL = `
  SELECT n.nspname FROM pg_catalog.pg_namespace n
   WHERE pg_catalog.pg_get_userbyid(n.nspowner) <> current_user
     AND n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\\_%'`;
const unownedSchemas = (url) =>
  capture('psql', [url, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', UNOWNED_SQL])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
const preserved = [...new Set([...unownedSchemas(sourceUrl), ...unownedSchemas(targetUrl)])];
if (preserved.length)
  console.log(`Platform-managed schemas preserved (not dumped, not dropped): ${preserved.join(', ')}`);

console.log('Dumping source…');
run('pg_dump', [
  '--format=custom',
  '--no-owner',
  '--no-privileges',
  ...preserved.flatMap((s) => ['--exclude-schema', s]),
  '--file=promote.dump',
  sourceUrl,
]);

console.log('Resetting target schemas…');
// Drop every schema the connected role OWNS (public + legacy operating_model +
// any future app schemas) so the restore lands on an empty dataset — a partial
// reset collides with objects the dump also carries ("already exists",
// pg_restore exit 1). Unowned (platform) schemas are left in place.
const RESET_SQL = `
  DO $$ DECLARE s text; BEGIN
    FOR s IN SELECT n.nspname FROM pg_catalog.pg_namespace n
             WHERE pg_catalog.pg_get_userbyid(n.nspowner) = current_user
               AND n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\\_%'
    LOOP EXECUTE format('DROP SCHEMA %I CASCADE', s); END LOOP;
  END $$;
  CREATE SCHEMA IF NOT EXISTS public;`;
run('psql', [targetUrl, '-v', 'ON_ERROR_STOP=1', '-c', RESET_SQL]);

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
