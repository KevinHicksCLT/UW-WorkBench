// ── Role profiles (research-sourced enrichment) ──
// Applies backend/data/seed/role-profiles.json (built by
// scripts/merge-role-profiles.ts from the per-role web-research batches):
//   • description / roleFamily / roleLevel on every matched Role
//   • homes roles that are STILL un-homed after seedOrgFromDevelop using the
//     research's proposedOrgUnit (never overrides an existing home)
//   • classificationFlags are LOGGED only — Owner/Participant/Contributor data
//     is never mutated by research proposals (curators act on the log)
// Idempotent: pure field updates + upserts; safe to re-run. Missing file is a
// soft skip (fresh clones before the research lands still seed cleanly).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { buildRoleResolver } from '../lib/roleMatch.js';
import { roleProfilesFileSchema } from '../lib/roleProfileSchema.js';

const here = dirname(fileURLToPath(import.meta.url));
const PROFILES = resolve(here, '../../data/seed/role-profiles.json');

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export async function seedRoleProfiles(p: PrismaClient, ctx: { companyId: string }) {
  if (!existsSync(PROFILES)) {
    console.log('   (role-profiles.json not present — skipping profile enrichment)');
    return;
  }
  const file = roleProfilesFileSchema.parse(JSON.parse(readFileSync(PROFILES, 'utf8')));

  const roles = await p.role.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true, dbValue: true, orgUnitId: true },
  });
  const resolveRole = buildRoleResolver(roles.map((r) => ({ id: r.id, name: r.dbValue })));
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const orgUnits = await p.orgUnit.findMany({
    where: { companyId: ctx.companyId },
    select: {
      id: true,
      dbValue: true,
      displayValue: true,
      orgLevelType: { select: { levelNumber: true } },
    },
  });
  const unitByName = (level: number) => {
    const m = new Map<string, string>();
    for (const u of orgUnits) {
      if (u.orgLevelType.levelNumber !== level) continue;
      m.set(norm(u.displayValue), u.id);
      m.set(norm(u.dbValue), u.id);
    }
    return m;
  };
  const divisionsByName = unitByName(2);
  const departmentsByName = unitByName(3);

  let updated = 0;
  let homed = 0;
  let unmatched = 0;
  let flagCount = 0;
  const flagLines: string[] = [];

  for (const profile of file.profiles) {
    const match = resolveRole(profile.roleName);
    if (!match) {
      unmatched++;
      console.log(`   ⚠ no DB role for profile "${profile.roleName}"`);
      continue;
    }
    await p.role.update({
      where: { id: match.id },
      data: {
        description: profile.description,
        roleFamily: profile.roleFamily,
        roleLevel: profile.roleLevel,
      },
    });
    updated++;

    // Home ONLY roles that are still un-homed (research proposal, dept > division).
    const dbRole = roleById.get(match.id);
    if (profile.proposedOrgUnit && dbRole && !dbRole.orgUnitId) {
      const deptId = profile.proposedOrgUnit.department
        ? departmentsByName.get(norm(profile.proposedOrgUnit.department))
        : undefined;
      const divId = divisionsByName.get(norm(profile.proposedOrgUnit.division));
      const targetUnitId = deptId ?? divId;
      if (targetUnitId) {
        await p.role.update({ where: { id: match.id }, data: { orgUnitId: targetUnitId } });
        await p.roleOrgAssignment.updateMany({
          where: { roleId: match.id },
          data: { isPrimary: false },
        });
        await p.roleOrgAssignment.upsert({
          where: { roleId_orgUnitId: { roleId: match.id, orgUnitId: targetUnitId } },
          update: { isPrimary: true },
          create: { roleId: match.id, orgUnitId: targetUnitId, isPrimary: true },
        });
        homed++;
      } else {
        console.log(
          `   ⚠ proposedOrgUnit for "${profile.roleName}" did not resolve: ${profile.proposedOrgUnit.division} / ${profile.proposedOrgUnit.department ?? '—'}`,
        );
      }
    }

    for (const flag of profile.classificationFlags) {
      flagCount++;
      flagLines.push(
        `   [flag:${flag.confidence}] ${profile.roleName} · ${flag.scope} "${flag.item}": ${flag.current} → ${flag.proposed} (${flag.rationale})`,
      );
    }
  }

  console.log(
    `   + role profiles: ${updated} descriptions applied, ${homed} newly homed, ${unmatched} unmatched`,
  );
  if (flagCount > 0) {
    console.log(`   classification proposals (logged only, NOT applied): ${flagCount}`);
    for (const line of flagLines.slice(0, 25)) console.log(line);
    if (flagLines.length > 25) console.log(`   … ${flagLines.length - 25} more`);
  }
}
