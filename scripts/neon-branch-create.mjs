#!/usr/bin/env node
/**
 * Create a Neon DB branch for a new feature branch (promotion pipeline,
 * charter Task 21) and print the connection strings to paste into
 * backend/.env.
 *
 * Convention: the Neon branch carries the same name as the git branch and is
 * forked from `develop` (data + schema + migration ledger).
 *
 * Usage: NEON_API_KEY=… NEON_PROJECT_ID=… node scripts/neon-branch-create.mjs <branch-name>
 */
const API = 'https://console.neon.tech/api/v2';
const KEY = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const name = process.argv[2];

if (!KEY || !PROJECT || !name) {
  console.error('usage: NEON_API_KEY=… NEON_PROJECT_ID=… node scripts/neon-branch-create.mjs <branch-name>');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const list = await fetch(`${API}/projects/${PROJECT}/branches`, { headers });
const { branches } = await list.json();
const develop = branches.find((b) => b.name === 'develop');
if (!develop) {
  console.error('No Neon branch named "develop" found — check the project.');
  process.exit(1);
}
if (branches.some((b) => b.name === name)) {
  console.error(`Neon branch "${name}" already exists.`);
  process.exit(1);
}

const res = await fetch(`${API}/projects/${PROJECT}/branches`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    branch: { name, parent_id: develop.id },
    endpoints: [{ type: 'read_write' }],
  }),
});
if (!res.ok) {
  console.error(`Neon API error creating branch: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const created = await res.json();
const host = created.endpoints?.[0]?.host;
console.log(`Created Neon branch "${name}" (${created.branch.id})`);
if (host) {
  const pooler = host.replace(/^(ep-[^.]+)/, '$1-pooler');
  console.log('\nPaste into backend/.env:');
  console.log(`DATABASE_URL="postgresql://<user>:<password>@${pooler}/neondb?sslmode=require&channel_binding=require"`);
  console.log(`DIRECT_URL="postgresql://<user>:<password>@${host}/neondb?sslmode=require&channel_binding=require"`);
}
