#!/usr/bin/env node
/**
 * Delete the Neon DB branch that corresponds to a just-merged git feature
 * branch (promotion pipeline, charter Task 21).
 *
 * Convention: a feature's Neon branch carries the same name as its git branch.
 * On a merge commit to develop, this script extracts the source branch name
 * from the merge commit message ("Merge pull request #N from user/<branch>")
 * and deletes the matching Neon branch if one exists. Protected names are
 * never deleted.
 *
 * Env: NEON_API_KEY, NEON_PROJECT_ID. Also usable locally:
 *   node scripts/neon-branch-cleanup.mjs <branch-name>
 */
import { execSync } from 'node:child_process';

const API = 'https://console.neon.tech/api/v2';
const KEY = process.env.NEON_API_KEY;
const PROJECT = process.env.NEON_PROJECT_ID;
const PROTECTED = new Set(['production', 'develop', 'main', 'master']);

if (!KEY || !PROJECT) {
  console.log('NEON_API_KEY / NEON_PROJECT_ID not configured — skipping Neon cleanup.');
  process.exit(0);
}

function mergedBranchName() {
  if (process.argv[2]) return process.argv[2];
  const msg = execSync('git log -1 --pretty=%s').toString().trim();
  // "Merge pull request #25 from KevinHicksCLT/atomic-processes"
  const m = msg.match(/Merge pull request #\d+ from [^/\s]+\/(\S+)/);
  return m ? m[1] : null;
}

const name = mergedBranchName();
if (!name) {
  console.log('No merged feature branch detected in HEAD commit — nothing to clean up.');
  process.exit(0);
}
if (PROTECTED.has(name)) {
  console.log(`Branch "${name}" is protected — refusing to delete.`);
  process.exit(0);
}

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const list = await fetch(`${API}/projects/${PROJECT}/branches`, { headers });
if (!list.ok) {
  console.error(`Neon API error listing branches: HTTP ${list.status}`);
  process.exit(1);
}
const { branches } = await list.json();
const target = branches.find((b) => b.name === name);
if (!target) {
  console.log(`No Neon branch named "${name}" — nothing to clean up.`);
  process.exit(0);
}

const del = await fetch(`${API}/projects/${PROJECT}/branches/${target.id}`, {
  method: 'DELETE',
  headers,
});
if (!del.ok) {
  console.error(`Failed to delete Neon branch "${name}" (${target.id}): HTTP ${del.status}`);
  process.exit(1);
}
console.log(`Deleted Neon branch "${name}" (${target.id}).`);
