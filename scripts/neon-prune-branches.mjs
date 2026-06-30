#!/usr/bin/env node
// Hygiene: prune Neon branches down to the canonical keepers, leaf-first.
// Keepers: production, develop, atomic-processes, and any preview/pr-<N> (transient PR previews).
// Everything else is deleted bottom-up (Neon refuses to delete a branch with children).
//
// Dry-run by default. Pass --apply to actually delete.
//   node scripts/neon-prune-branches.mjs            # show what WOULD be deleted
//   node scripts/neon-prune-branches.mjs --apply    # delete them
//
// Encodes the anti-deadlock rule from the neon-db-branch-ops skill: only the 3 keepers
// (+ open-PR previews) should exist, and production must stay the root/default branch.

import { execSync } from 'node:child_process';

const PROJECT = 'billowing-salad-46113160';
const ORG = 'org-misty-bar-64403461';
const KEEP = new Set(['production', 'develop', 'atomic-processes']);
const isKeeper = (name) => KEEP.has(name) || /^preview\/pr-\d+$/.test(name);

const APPLY = process.argv.includes('--apply');
const neon = (args) =>
  execSync(`neon ${args} --project-id ${PROJECT} --org-id ${ORG}`, { encoding: 'utf8' });

function listBranches() {
  const json = JSON.parse(neon('branches list --output json'));
  const branches = json.branches || json;
  return branches.map((b) => ({ id: b.id, name: b.name, parent: b.parent_id || null, default: !!b.default }));
}

let branches = listBranches();
const childCount = (id, all) => all.filter((b) => b.parent === id).length;

const doomed = branches.filter((b) => !isKeeper(b.name) && !b.default);
if (doomed.length === 0) {
  console.log('✓ Clean — only keepers present:', branches.map((b) => b.name).join(', '));
  process.exit(0);
}
console.log(`${APPLY ? 'DELETING' : 'WOULD DELETE'} ${doomed.length} non-keeper branch(es):`);
doomed.forEach((b) => console.log('  -', b.name, `(${b.id})`));
if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to delete leaf-first.');
  process.exit(0);
}

// Delete leaf-first: repeat passes, each pass deleting current leaves among the doomed set.
let remaining = new Set(doomed.map((b) => b.id));
let guard = 0;
while (remaining.size > 0 && guard++ < 50) {
  const all = listBranches();
  const leaves = [...remaining].filter((id) => childCount(id, all) === 0);
  if (leaves.length === 0) {
    console.error('No deletable leaves left but some remain (a keeper may depend on them):', [...remaining]);
    process.exit(1);
  }
  for (const id of leaves) {
    const name = all.find((b) => b.id === id)?.name ?? id;
    neon(`branches delete ${id}`);
    console.log('  deleted', name, `(${id})`);
    remaining.delete(id);
  }
}
console.log('✓ Prune complete. Remaining:', listBranches().map((b) => b.name).join(', '));
