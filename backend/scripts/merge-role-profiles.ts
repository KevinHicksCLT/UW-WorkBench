/**
 * Merge the per-batch research outputs (documents/role-research/batches/
 * batch-NN.json) into the committed enrichment file
 * backend/data/seed/role-profiles.json.
 *
 * Gates (fails loudly):
 *   • every batch parses against roleProfileBatchSchema (zod)
 *   • profiles dedupe to exactly the 299-role roster (org-from-develop.json),
 *     matched via lib/roleMatch candidates()
 *   • no proposedOrgUnit on a role that already has an org home
 *   • proposedOrgUnit division/department must exist in the develop catalog
 * Research gaps (a role zod rejects or missing) fall back to develop priors
 * when those are complete; otherwise the merge fails and names the batch.
 *
 * Run: npx tsx scripts/merge-role-profiles.ts   (from backend/)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidates } from '../src/lib/roleMatch.js';
import {
  roleProfileBatchSchema,
  roleProfileSchema,
  type RoleProfile,
} from '../src/lib/roleProfileSchema.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const BATCH_DIR = resolve(repo, 'documents/role-research/batches');
const OUT = resolve(here, '../data/seed/role-profiles.json');

type DevelopRole = {
  name: string;
  division: string | null;
  department: string | null;
  roleLevel: string | null;
  roleFamily: string | null;
  description: string | null;
};
type Develop = {
  divisions: { name: string }[];
  departments: { name: string }[];
  roles: DevelopRole[];
};

function main() {
  const develop = JSON.parse(
    readFileSync(resolve(here, '../data/seed/org-from-develop.json'), 'utf8'),
  ) as Develop;
  const roster = develop.roles;
  const divisionNames = new Set(develop.divisions.map((d) => d.name));
  const departmentNames = new Set(develop.departments.map((d) => d.name));

  const aliasToRoster = new Map<string, string>();
  for (const r of roster)
    for (const c of candidates(r.name)) if (!aliasToRoster.has(c)) aliasToRoster.set(c, r.name);
  const toRoster = (name: string): string | null => {
    for (const c of candidates(name)) {
      const hit = aliasToRoster.get(c);
      if (hit) return hit;
    }
    return null;
  };
  const developByName = new Map(roster.map((r) => [r.name, r]));

  const errors: string[] = [];
  const byRoster = new Map<string, RoleProfile>();

  const files = readdirSync(BATCH_DIR)
    .filter((f) => /^batch-\d+\.json$/.test(f))
    .sort();
  if (files.length === 0) {
    console.error(`No batch files in ${BATCH_DIR}`);
    process.exit(1);
  }

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(BATCH_DIR, file), 'utf8'));
    const parsed = roleProfileBatchSchema.safeParse(raw);
    if (!parsed.success) {
      // Salvage per-profile: keep valid profiles, report the invalid ones.
      const profiles = Array.isArray((raw as { profiles?: unknown[] }).profiles)
        ? (raw as { profiles: unknown[] }).profiles
        : [];
      let salvaged = 0;
      for (const p of profiles) {
        const one = roleProfileSchema.safeParse(p);
        if (one.success) {
          const rosterName = toRoster(one.data.roleName);
          if (rosterName && !byRoster.has(rosterName)) {
            byRoster.set(rosterName, one.data);
            salvaged++;
          }
        } else {
          const name = (p as { roleName?: string }).roleName ?? '<unnamed>';
          errors.push(
            `${file} → ${name}: ${one.error.issues[0]?.path.join('.')} ${one.error.issues[0]?.message}`,
          );
        }
      }
      console.warn(`⚠ ${file}: schema errors; salvaged ${salvaged}/${profiles.length} profiles`);
      continue;
    }
    for (const profile of parsed.data.profiles) {
      const rosterName = toRoster(profile.roleName);
      if (!rosterName) {
        errors.push(`${file} → "${profile.roleName}": not in the 299-role roster`);
        continue;
      }
      if (byRoster.has(rosterName)) {
        errors.push(`${file} → "${profile.roleName}": duplicate of roster role "${rosterName}"`);
        continue;
      }
      // proposedOrgUnit sanity: only for un-homed roster roles, real units only.
      const dev = developByName.get(rosterName)!;
      if (profile.proposedOrgUnit) {
        if (dev.division) {
          errors.push(`${file} → "${rosterName}": proposedOrgUnit on an already-homed role`);
          continue;
        }
        if (!divisionNames.has(profile.proposedOrgUnit.division)) {
          errors.push(
            `${file} → "${rosterName}": unknown division "${profile.proposedOrgUnit.division}"`,
          );
          continue;
        }
        if (
          profile.proposedOrgUnit.department &&
          !departmentNames.has(profile.proposedOrgUnit.department)
        ) {
          errors.push(
            `${file} → "${rosterName}": unknown department "${profile.proposedOrgUnit.department}"`,
          );
          continue;
        }
      }
      byRoster.set(rosterName, { ...profile, roleName: rosterName });
    }
  }

  // Fill research gaps from develop priors where complete.
  const missing = roster.filter((r) => !byRoster.has(r.name));
  let priorFilled = 0;
  // Develop priors predate the controlled vocab — normalize their level tokens.
  const LEVEL_ALIASES: Record<string, string> = {
    Management: 'Manager',
    'Senior Management': 'Senior Leadership',
  };
  for (const r of missing) {
    if (r.description && r.roleFamily && r.roleLevel) {
      const prior = roleProfileSchema.safeParse({
        roleName: r.name,
        description: r.description,
        roleFamily: r.roleFamily,
        roleLevel: LEVEL_ALIASES[r.roleLevel] ?? r.roleLevel,
        sources: [
          {
            title: 'Develop-dataset prior (no research output)',
            url: 'https://internal.invalid/develop-prior',
            supports: 'description',
          },
        ],
        proposedOrgUnit: null,
        classificationFlags: [],
        confidence: 'low',
        notes: 'Filled from develop prior — research batch missing/invalid for this role.',
      });
      if (prior.success) {
        byRoster.set(r.name, prior.data);
        priorFilled++;
      }
    }
  }

  const still = roster.filter((r) => !byRoster.has(r.name)).map((r) => r.name);
  console.log(
    `merged: ${byRoster.size}/${roster.length} roles (${priorFilled} filled from develop priors)`,
  );
  if (errors.length > 0) {
    console.error(`\n${errors.length} issue(s):`);
    for (const e of errors.slice(0, 40)) console.error('  •', e);
  }
  if (still.length > 0) {
    console.error(`\n✗ ${still.length} roster roles have NO profile: ${still.join(', ')}`);
    process.exit(1);
  }

  const profiles = roster.map((r) => byRoster.get(r.name)!);
  const flagged = profiles.filter((p) => p.classificationFlags.length > 0).length;
  const proposed = profiles.filter((p) => p.proposedOrgUnit).length;
  writeFileSync(
    OUT,
    JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), profiles }, null, 2),
  );
  console.log(`✓ wrote ${OUT}`);
  console.log(
    `  org proposals: ${proposed} · classification flags on ${flagged} roles · confidence: ` +
      ['high', 'medium', 'low']
        .map((c) => `${c}=${profiles.filter((p) => p.confidence === c).length}`)
        .join(' '),
  );
  if (errors.length > 0) process.exit(1);
}

main();
