#!/usr/bin/env node
/**
 * ONE-SHOT lineage repair: rebuild `develop` as a direct child of
 * `production`, carrying its exact current data, then remove the welded
 * lineage nodes left by the (now-banned) branch-restore promotion.
 *
 * End state: production -> develop, byte-equal data, same branch NAME but a
 * NEW endpoint (connection strings rotate — handled by the operator after).
 *
 * Order of operations (nothing is deleted until the copy is VERIFIED):
 *   1. create `develop-new` from production (+ read-write endpoint)
 *   2. pg_dump develop -> pg_restore into develop-new (schema reset first)
 *   3. verify row counts across every public table — abort on any mismatch
 *   4. delete old `develop` (leaf), then `pipeline-fix`, then
 *      `backup/develop-*` (each becomes a leaf as its child goes)
 *   5. rename develop-new -> develop
 *
 * Env: NEON_API_KEY, NEON_PROJECT_ID, DEVELOP_DIRECT_URL (source).
 * Requires pg_dump/pg_restore/psql >= server major on PATH.
 */
import { execFileSync } from 'node:child_process';

const API = 'https://console.neon.tech/api/v2';
const KEY = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const SOURCE_URL = process.env.DEVELOP_DIRECT_URL;
if (!KEY || !PROJECT || !SOURCE_URL) {
  console.error('NEON_API_KEY / NEON_PROJECT_ID / DEVELOP_DIRECT_URL required.');
  process.exit(1);
}
const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, init) {
  const res = await fetch(`${API}${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`Neon API ${init?.method ?? 'GET'} ${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });

const { branches } = await api(`/projects/${PROJECT}/branches`);
const byName = new Map(branches.map((b) => [b.name, b]));
const production = byName.get('production');
const develop = byName.get('develop');
const welded = branches.filter((b) => b.name === 'pipeline-fix' || b.name.startsWith('backup/develop-'));
if (!production || !develop) throw new Error('production/develop branch not found');
if (byName.get('develop-new')) throw new Error('develop-new already exists — clean up a previous attempt first');

// ── 1. Fresh branch under production ──
const created = await api(`/projects/${PROJECT}/branches`, {
  method: 'POST',
  body: JSON.stringify({ branch: { name: 'develop-new', parent_id: production.id }, endpoints: [{ type: 'read_write' }] }),
});
const newId = created.branch.id;
console.log(`Created develop-new (${newId}) as child of production.`);
// Neon provisions the endpoint asynchronously; poll until the connection URI works.
const params = new URLSearchParams({ branch_id: newId, database_name: 'neondb', role_name: 'neondb_owner', pooled: 'false' });
const targetUrl = (await api(`/projects/${PROJECT}/connection_uri?${params}`)).uri;
for (let i = 0; ; i++) {
  try {
    capture('psql', [targetUrl, '-tAc', 'SELECT 1']);
    break;
  } catch (e) {
    if (i > 20) throw e;
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ── 2. Logical copy ──
console.log('Dumping develop…');
run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file=develop.dump', SOURCE_URL]);
console.log('Resetting develop-new schema…');
run('psql', [targetUrl, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;']);
console.log('Restoring into develop-new…');
run('pg_restore', ['--no-owner', '--no-privileges', '--dbname=' + targetUrl, 'develop.dump']);

// ── 3. Verify EVERY table's row count before touching anything ──
// Exact per-table counts (pg_stat estimates lag right after a restore).
const exactSql = `
  SELECT string_agg(table_name || '=' || cnt, ',' ORDER BY table_name)
  FROM (
    SELECT table_name,
           (xpath('/row/cnt/text()',
                  query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name),
                               false, true, '')))[1]::text AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ) counts`;
const src = capture('psql', [SOURCE_URL, '-tAc', exactSql]).trim();
const dst = capture('psql', [targetUrl, '-tAc', exactSql]).trim();
if (!src || src !== dst) {
  console.error('ROW COUNT MISMATCH — aborting BEFORE any deletion. develop is untouched.');
  console.error(`source: ${src.slice(0, 500)}…`);
  console.error(`target: ${dst.slice(0, 500)}…`);
  process.exit(1);
}
const tableCount = src.split(',').length;
console.log(`Verified: ${tableCount} tables, all row counts identical.`);

// ── 4. Dissolve the welded chain, leaf by leaf ──
for (const name of ['develop', 'pipeline-fix']) {
  const b = byName.get(name);
  await api(`/projects/${PROJECT}/branches/${b.id}`, { method: 'DELETE' });
  console.log(`Deleted "${name}" (${b.id}).`);
}
for (const b of welded.filter((w) => w.name.startsWith('backup/develop-'))) {
  await api(`/projects/${PROJECT}/branches/${b.id}`, { method: 'DELETE' });
  console.log(`Deleted "${b.name}" (${b.id}).`);
}

// ── 5. develop-new takes the name ──
await api(`/projects/${PROJECT}/branches/${newId}`, {
  method: 'PATCH',
  body: JSON.stringify({ branch: { name: 'develop' } }),
});
console.log('Renamed develop-new -> develop. Lineage is now production -> develop.');
console.log('NOTE: develop has a NEW endpoint — rotate DEVELOP connection strings (Vercel env, GitHub secret, local .env).');
