#!/usr/bin/env node
/**
 * Ensure a Neon DB branch exists for a git feature branch (pipeline
 * deploy-preview step) and print its connection strings.
 *
 * Convention: ONE Neon branch per feature, named exactly like the git branch,
 * always forked from `develop` — the same branch a developer creates locally
 * with scripts/neon-branch-create.mjs. If it already exists it is reused
 * untouched (local dev state preserved); if not, it is created from develop.
 * The pipeline's neon-cleanup job deletes it when the feature merges.
 *
 * Output (stdout, KEY=VALUE lines consumed by the workflow):
 *   POOLED_URL=...   (runtime DATABASE_URL for the preview deployment)
 *   DIRECT_URL=...   (prisma migrate/direct connections)
 *
 * Env: NEON_API_KEY, NEON_PROJECT_ID. Arg: git branch name.
 */
const API = 'https://console.neon.tech/api/v2';
const KEY = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const name = process.argv[2];
const PROTECTED = new Set(['production', 'develop', 'main', 'master']);

if (!KEY || !PROJECT || !name) {
  console.error('usage: NEON_API_KEY=… NEON_PROJECT_ID=… node scripts/neon-ensure-branch.mjs <git-branch>');
  process.exit(1);
}
if (PROTECTED.has(name)) {
  console.error(`"${name}" is a protected environment branch — refusing.`);
  process.exit(1);
}

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, init) {
  const res = await fetch(`${API}${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`Neon API ${init?.method ?? 'GET'} ${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const { branches } = await api(`/projects/${PROJECT}/branches`);
let branch = branches.find((b) => b.name === name);

if (branch) {
  console.error(`Reusing existing Neon branch "${name}" (${branch.id}).`);
} else {
  const develop = branches.find((b) => b.name === 'develop');
  if (!develop) throw new Error('No Neon branch named "develop" — cannot fork a feature branch.');
  const created = await api(`/projects/${PROJECT}/branches`, {
    method: 'POST',
    body: JSON.stringify({
      branch: { name, parent_id: develop.id },
      endpoints: [{ type: 'read_write' }],
    }),
  });
  branch = created.branch;
  console.error(`Created Neon branch "${name}" (${branch.id}) from develop.`);
}

async function uri(pooled) {
  const params = new URLSearchParams({
    branch_id: branch.id,
    database_name: 'neondb',
    role_name: 'neondb_owner',
    pooled: String(pooled),
  });
  const r = await api(`/projects/${PROJECT}/connection_uri?${params}`);
  return r.uri;
}

console.log(`POOLED_URL=${await uri(true)}`);
console.log(`DIRECT_URL=${await uri(false)}`);
