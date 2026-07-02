// seedOrgFromDevelop — restores the Department org tier (OrgLevelType L3) into the
// existing generic OrgUnit tree, brings the Role roster to develop/prod parity
// (257 → 299), homes EVERY role to its department, and wires the 42 imported roles
// to the org (department homing) + the value-stream spine where domain-clear.
//
// SOURCE: backend/data/seed/org-from-develop.json (extracted ONCE from the develop
// branch by scripts/extract-org-from-develop.ts — this loader never hits develop).
//
// This SUPERSEDES homeRoles.ts for any role develop covers (explicit role→dept home);
// homeRoles is no longer called from the orchestrator (its modal-division fallback
// is folded in here for the handful of roles develop leaves un-homed).
//
// Idempotent: it deletes + recreates the L3 OrgLevelType, all L3 OrgUnits, the
// Executive Office L2 division, and the imported roles' org/VS wiring on every run,
// then re-homes all roles. seedMaster has already rebuilt the company graph, so this
// runs on a fresh L1/L2 org tree (3 segments + 17 divisions, 257 roles) each time.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/seed/org-from-develop.json');

type DevRole = {
  name: string; division: string | null; department: string | null;
  roleLevel: string | null; roleFamily: string | null; description: string | null;
};
type DevData = {
  divisions: { name: string }[];
  departments: { name: string; division: string }[];
  roles: DevRole[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ── develop division name → NEW division name (the 12 direct + Executive Office) ──
// The 2 split divisions are handled per-department in DEPT_TO_NEW_DIVISION below;
// they are intentionally absent here so a department always wins the assignment.
const DIVISION_NAME_MAP: Record<string, string> = {
  'Actuarial': 'Actuarial',
  'Claims': 'Claims',
  'Cybersecurity & IAM': 'Cybersecurity & IAM',
  'Data & AI': 'Data & AI',
  'Executive Office': 'Executive Office', // NEW L2 division created by this seeder
  'Finance & Investments': 'Finance & Investments',
  'Human Resources & Talent': 'Human Resources & Talent',
  'Legal & Corporate Governance': 'Legal & Corporate Governance',
  'Reinsurance': 'Reinsurance',
  'Risk, Compliance & Audit': 'Risk, Compliance & Audit',
  'Sales, Distribution & Marketing': 'Sales, Distribution & Marketing',
  'Technology & Engineering': 'Technology & Engineering',
  'Underwriting': 'Underwriting',
};

// ── department (in a SPLIT develop division) → NEW division ──
// Keyed by `${developDivision}␟${department}`. Every department of the 2 split
// divisions is listed explicitly so the distribution is auditable.
const DEPT_TO_NEW_DIVISION: Record<string, string> = {
  // Operations & Customer Service → {Business Operations, Call Center, Corporate Functions Operations}
  'Operations & Customer Service␟Billing & Receivables': 'Business Operations',
  'Operations & Customer Service␟Customer Service': 'Call Center',
  'Operations & Customer Service␟Operations Leadership': 'Business Operations',
  'Operations & Customer Service␟Policy Operations': 'Corporate Functions Operations',
  'Operations & Customer Service␟Vendor & Resilience': 'Corporate Functions Operations',
  // Product, Delivery & PMO → {Product & Delivery, Program Management Office}
  'Product, Delivery & PMO␟Agile Delivery': 'Product & Delivery',
  'Product, Delivery & PMO␟Analysis & Quality': 'Program Management Office',
  'Product, Delivery & PMO␟Product Analysis': 'Product & Delivery',
  'Product, Delivery & PMO␟Product Delivery': 'Product & Delivery',
  'Product, Delivery & PMO␟Product Leadership': 'Product & Delivery',
  'Product, Delivery & PMO␟Program Governance': 'Program Management Office',
  'Product, Delivery & PMO␟Release Management': 'Product & Delivery',
};

const SPLIT_DIVISIONS = new Set(['Operations & Customer Service', 'Product, Delivery & PMO']);

// Resolve a develop (division, department) to its NEW division name, logging the
// decision. Returns null if it cannot be mapped (caller logs + falls back).
function resolveNewDivision(
  devDivision: string | null,
  department: string | null,
  log: (m: string) => void,
): string | null {
  if (!devDivision) return null;
  if (SPLIT_DIVISIONS.has(devDivision)) {
    if (!department) {
      log(`  [split] ${devDivision} role with NO department → cannot split; left for fallback`);
      return null;
    }
    const mapped = DEPT_TO_NEW_DIVISION[`${devDivision}␟${department}`];
    if (!mapped) {
      log(`  [split-MISS] ${devDivision} ␟ ${department} → no mapping rule`);
      return null;
    }
    return mapped;
  }
  return DIVISION_NAME_MAP[devDivision] ?? null;
}

// ── value-stream wiring: imported role → L2 value-stream ProcessNode name ──
// A coarse but REAL participation link (NodeRole role_='Participant') so the 42
// imported roles aren't org-only orphans. Only domain-clear roles are wired;
// executive/governance roles stay org-only (their department homing is the wiring).
// The L2 value-stream names are the 17 listed in the spine (see seedMaster).
const ROLE_TO_VALUE_STREAM: Record<string, string> = {
  // Life / Annuity / Disability / Retirement specialists
  'Life Underwriter': 'Underwriting',
  'Annuity Suitability Analyst': 'Underwriting',
  'New Business Case Manager': 'Underwriting',
  'Disability Case Manager': 'Claims',
  'Disability Claims Intake Specialist': 'Claims',
  'SIU Investigator': 'Claims',
  'Life Policy Service Representative': 'Call Center',
  'Annuity Service Specialist': 'Call Center',
  'Retirement Operations Administrator': 'Corporate Functions Operations',
  'Retirement Recordkeeping Specialist': 'Corporate Functions Operations',
  'Billing Operations Manager': 'Business Operations',
  'Workforce Analyst': 'Call Center',
  'Vendor Coordinator': 'Corporate Functions Operations',
  // Cybersecurity
  'Penetration Tester': 'Cybersecurity & IAM',
  'Incident Response Lead': 'Cybersecurity & IAM',
  // Technology & Engineering
  'Senior Developer': 'Technology & Engineering',
  'Junior Developer': 'Technology & Engineering',
  'Mobile Developer': 'Technology & Engineering',
  'Network Administrator': 'Technology & Engineering',
  'Disaster Recovery Engineer': 'Technology & Engineering',
  'Resilience Manager': 'Technology & Engineering',
  // Data & AI
  'Analytics Lead': 'Data & AI',
  'Data Governance Lead': 'Data & AI',
  'Data Privacy Steward': 'Data & AI',
  'Data Product Owner': 'Data & AI',
  'Data Quality Analyst': 'Data & AI',
  // Reinsurance
  'Reinsurance Underwriter': 'Reinsurance',
  'Treaty Analyst': 'Reinsurance',
  'Catastrophe & Exposure Manager': 'Reinsurance',
  'Reinsurance Credit & Security Analyst': 'Reinsurance',
  // Finance / Risk
  'Tax Manager': 'Finance & Investments',
  'Head of Capital Management': 'Finance & Investments',
  'Regulatory Reporting Manager': 'Finance & Investments',
  'Compliance Manager': 'Risk, Compliance & Audit',
  // Sales / Legal
  'Head of Broker Distribution': 'Sales, Distribution & Marketing',
  'Litigation Manager': 'Legal & Corporate Governance',
  // (CEO, Chief of Staff, Investor Relations Director, Chief Strategy Officer,
  //  Corporate Development Manager, Strategic Planning Analyst, Executive Assistant,
  //  Executive Communications Manager → Executive Office: org-only, intentionally
  //  NOT in this map.)
};

export interface SeedOrgResult {
  departmentsCreated: number;
  rolesCreated: number;
  rolesHomed: number;
  rolesHomedToDept: number;
  rolesHomedToDivisionFallback: number;
  rolesUnhomed: number;
  vsLinksCreated: number;
  deptDivisionLog: string[];
  unmappableRoles: string[];
}

export async function seedOrgFromDevelop(
  prisma: PrismaClient,
  { companyId }: { companyId: string },
): Promise<SeedOrgResult> {
  const c = companyId;
  const dev: DevData = JSON.parse(readFileSync(SRC, 'utf8'));
  const log: string[] = [];
  const push = (m: string) => { log.push(m); };

  // ── 0. Level-type ids: org L1, L2; ensure L3 "Department" ──
  const [oL1, oL2] = await Promise.all([
    prisma.orgLevelType.findFirst({ where: { companyId: c, levelNumber: 1 }, select: { id: true } }),
    prisma.orgLevelType.findFirst({ where: { companyId: c, levelNumber: 2 }, select: { id: true } }),
  ]);
  if (!oL1 || !oL2) throw new Error('seedOrgFromDevelop: missing org L1/L2 level type');

  // Idempotent reset of everything this seeder owns (L3 dept units cascade their
  // roleAssignments; Executive Office div is re-created): delete L3 units, L3 type,
  // and the Executive Office L2 division (its OrgUnitClosure rows cascade).
  const existingL3 = await prisma.orgLevelType.findFirst({ where: { companyId: c, levelNumber: 3 }, select: { id: true } });
  if (existingL3) {
    const l3Units = await prisma.orgUnit.findMany({ where: { companyId: c, orgLevelTypeId: existingL3.id }, select: { id: true } });
    const l3Ids = l3Units.map((u) => u.id);
    if (l3Ids.length) {
      // Un-home any roles currently homed to an L3 unit so the FK delete is clean.
      await prisma.role.updateMany({ where: { companyId: c, orgUnitId: { in: l3Ids } }, data: { orgUnitId: null } });
      await prisma.roleOrgAssignment.deleteMany({ where: { orgUnitId: { in: l3Ids } } });
      await prisma.orgUnitClosure.deleteMany({ where: { OR: [{ ancestorId: { in: l3Ids } }, { descendantId: { in: l3Ids } }] } });
      await prisma.orgUnit.deleteMany({ where: { id: { in: l3Ids } } });
    }
    await prisma.orgLevelType.delete({ where: { id: existingL3.id } });
  }

  // L3 label is seed-time configuration (charter Task 1): another company may
  // call this level "Team"/"Unit" — override via SEED_L3_LABEL. The runtime UI
  // always reads OrgLevelType.displayValue, never a hardcoded string.
  const l3Type = await prisma.orgLevelType.create({
    data: { companyId: c, levelNumber: 3, dbValue: 'L3', displayValue: process.env.SEED_L3_LABEL ?? 'Department' },
  });

  // ── 1. Ensure the "Executive Office" L2 division (org-side only) ──
  // develop has Executive Office; the new spine doesn't. Add it as an OrgUnit L2
  // under the segment that best fits (Corporate Functions). Its dbValue matches
  // the segment-less develop division name.
  const segUnits = await prisma.orgUnit.findMany({ where: { companyId: c, orgLevelTypeId: oL1.id }, select: { id: true, dbValue: true } });
  const corpSeg = segUnits.find((s) => norm(s.dbValue) === norm('Corporate Functions')) ?? segUnits[0];

  let execDiv = await prisma.orgUnit.findFirst({ where: { companyId: c, orgLevelTypeId: oL2.id, dbValue: 'Executive Office' }, select: { id: true } });
  if (!execDiv) {
    const maxSort = await prisma.orgUnit.aggregate({ where: { companyId: c, orgLevelTypeId: oL2.id }, _max: { sortOrder: true } });
    execDiv = await prisma.orgUnit.create({
      data: {
        companyId: c, orgLevelTypeId: oL2.id, parentId: corpSeg?.id ?? null,
        dbValue: 'Executive Office', displayValue: 'Executive Office', sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    // closure rows for the new division: self + segment ancestor edge.
    await prisma.orgUnitClosure.createMany({
      data: [
        { ancestorId: execDiv.id, descendantId: execDiv.id, depth: 0 },
        ...(corpSeg ? [{ ancestorId: corpSeg.id, descendantId: execDiv.id, depth: 1 }] : []),
      ],
      skipDuplicates: true,
    });
    push(`  [division+] Executive Office (new L2 division under "${corpSeg?.dbValue ?? '—'}")`);
  }

  // ── 2. NEW division name → OrgUnit id (L2), now including Executive Office ──
  const divUnits = await prisma.orgUnit.findMany({ where: { companyId: c, orgLevelTypeId: oL2.id }, select: { id: true, dbValue: true } });
  const divIdByName = new Map(divUnits.map((d) => [norm(d.dbValue), d.id] as const));
  const divNameById = new Map(divUnits.map((d) => [d.id, d.dbValue] as const));

  // ── 3. Departments → OrgUnit L3 (one per develop department, under its NEW division) ──
  // Build (newDivisionName, departmentName) → key; LOG every mapping decision.
  type DeptPlan = { dept: string; devDivision: string; newDivision: string; divisionUnitId: string };
  const deptPlans: DeptPlan[] = [];
  const seenDeptKey = new Set<string>(); // dedupe identical dept-name under same new division
  for (const d of dev.departments) {
    const newDiv = resolveNewDivision(d.division, d.name, push);
    if (!newDiv) {
      push(`  [dept-UNMAPPED] "${d.name}" (develop division "${d.division}") → no NEW division`);
      continue;
    }
    const divUnitId = divIdByName.get(norm(newDiv));
    if (!divUnitId) {
      push(`  [dept-UNMAPPED] "${d.name}" → NEW division "${newDiv}" has no OrgUnit`);
      continue;
    }
    const key = `${divUnitId}␟${norm(d.name)}`;
    if (seenDeptKey.has(key)) continue;
    seenDeptKey.add(key);
    deptPlans.push({ dept: d.name, devDivision: d.division, newDivision: newDiv, divisionUnitId: divUnitId });
    push(`  [dept] "${d.name}"  →  ${newDiv}${SPLIT_DIVISIONS.has(d.division) ? `  (split from "${d.division}")` : d.division !== newDiv ? `  (was "${d.division}")` : ''}`);
  }

  // Create the L3 units + closure rows (self + division ancestor; + segment ancestor).
  // Pull each division's ancestors (depth 0/1) so the dept closure includes segment.
  const divAncEdges = await prisma.orgUnitClosure.findMany({
    where: { descendantId: { in: [...new Set(deptPlans.map((p) => p.divisionUnitId))] } },
    select: { ancestorId: true, descendantId: true, depth: true },
  });
  const ancestorsOfDiv = new Map<string, { ancestorId: string; depth: number }[]>();
  for (const e of divAncEdges) {
    if (!ancestorsOfDiv.has(e.descendantId)) ancestorsOfDiv.set(e.descendantId, []);
    ancestorsOfDiv.get(e.descendantId)!.push({ ancestorId: e.ancestorId, depth: e.depth });
  }

  const deptIdByKey = new Map<string, string>(); // `${divisionUnitId}␟${norm(dept)}` → deptUnitId
  let sortOrder = 0;
  for (const p of deptPlans) {
    const unit = await prisma.orgUnit.create({
      data: {
        companyId: c, orgLevelTypeId: l3Type.id, parentId: p.divisionUnitId,
        dbValue: p.dept, displayValue: p.dept, sortOrder: sortOrder++,
      },
      select: { id: true },
    });
    deptIdByKey.set(`${p.divisionUnitId}␟${norm(p.dept)}`, unit.id);
    // closure: self (depth 0) + every ancestor of the division shifted by +1.
    const rows = [{ ancestorId: unit.id, descendantId: unit.id, depth: 0 }];
    for (const a of ancestorsOfDiv.get(p.divisionUnitId) ?? []) {
      rows.push({ ancestorId: a.ancestorId, descendantId: unit.id, depth: a.depth + 1 });
    }
    await prisma.orgUnitClosure.createMany({ data: rows, skipDuplicates: true });
  }

  // ── 4. Roles → 299 parity: create the 42 missing develop roles ──
  const existingRoles = await prisma.role.findMany({ where: { companyId: c }, select: { id: true, dbValue: true } });
  const roleIdByNorm = new Map(existingRoles.map((r) => [norm(r.dbValue), r.id] as const));
  const created: string[] = [];
  for (const r of dev.roles) {
    if (roleIdByNorm.has(norm(r.name))) continue;
    const role = await prisma.role.create({
      data: { companyId: c, dbValue: r.name, displayValue: r.name },
      select: { id: true, dbValue: true },
    });
    roleIdByNorm.set(norm(role.dbValue), role.id);
    created.push(r.name);
  }

  // ── 5. Home EVERY role to its DEPARTMENT (explicit develop role→dept→new-div→dept).
  //    Fallback: role with no resolvable department keeps homeRoles' modal-division
  //    home if it already has one; else home to the develop division directly. ──
  const devRoleByNorm = new Map(dev.roles.map((r) => [norm(r.name), r] as const));

  let homedToDept = 0;
  let homedToDivisionFallback = 0;
  let unhomed = 0;

  // Re-read all roles (now 299) for homing.
  const allRoles = await prisma.role.findMany({ where: { companyId: c }, select: { id: true, dbValue: true, orgUnitId: true } });
  for (const role of allRoles) {
    const dr = devRoleByNorm.get(norm(role.dbValue));
    let targetUnitId: string | null = null;

    if (dr) {
      const newDiv = resolveNewDivision(dr.division, dr.department, () => {});
      if (newDiv && dr.department) {
        const divUnitId = divIdByName.get(norm(newDiv));
        if (divUnitId) targetUnitId = deptIdByKey.get(`${divUnitId}␟${norm(dr.department)}`) ?? null;
      }
      // No department (or unmapped split): home to the NEW division directly.
      if (!targetUnitId && newDiv) {
        const divUnitId = divIdByName.get(norm(newDiv));
        if (divUnitId) { targetUnitId = divUnitId; homedToDivisionFallback++; }
      }
    }

    // Division-less develop role (the 17 "Specialist"/"Reinsurance" family roles
    // with no org home in develop): fall back to the division implied by its
    // value-stream wiring (VS names == division names), so it still lands in the
    // org tree at the division level rather than orphaned.
    if (!targetUnitId) {
      const vsName = ROLE_TO_VALUE_STREAM[role.dbValue];
      const divUnitId = vsName ? divIdByName.get(norm(vsName)) : undefined;
      if (divUnitId) {
        targetUnitId = divUnitId;
        homedToDivisionFallback++;
        push(`  [home-fallback] ${role.dbValue} → division "${divNameById.get(divUnitId)}" (via VS wiring; develop had no division)`);
      }
    }

    if (targetUnitId && deptIdByKey.size && [...deptIdByKey.values()].includes(targetUnitId)) homedToDept++;

    if (!targetUnitId) {
      // develop didn't cover this role (or left it division-less + un-wired). Keep
      // any existing home (from seedMaster/prior homeRoles); otherwise leave un-homed.
      if (role.orgUnitId) continue;
      unhomed++;
      push(`  [un-homed] ${role.dbValue} — no develop division/department and no VS wiring`);
      continue;
    }

    await prisma.role.update({ where: { id: role.id }, data: { orgUnitId: targetUnitId } });
    // Make the dept (or division-fallback) the PRIMARY assignment; demote others.
    await prisma.roleOrgAssignment.updateMany({ where: { roleId: role.id }, data: { isPrimary: false } });
    await prisma.roleOrgAssignment.upsert({
      where: { roleId_orgUnitId: { roleId: role.id, orgUnitId: targetUnitId } },
      update: { isPrimary: true },
      create: { roleId: role.id, orgUnitId: targetUnitId, isPrimary: true },
    });
  }

  // ── 6. Wire the imported roles to the value-stream spine (NodeRole Participant) ──
  const procL2 = await prisma.processLevelType.findFirst({ where: { companyId: c, levelNumber: 2 }, select: { id: true } });
  const vsNodes = procL2
    ? await prisma.processNode.findMany({ where: { companyId: c, processLevelTypeId: procL2.id }, select: { id: true, dbValue: true } })
    : [];
  const vsIdByName = new Map(vsNodes.map((n) => [norm(n.dbValue), n.id] as const));

  let vsLinks = 0;
  const importedSet = new Set(created.map((n) => norm(n)));
  for (const [roleName, vsName] of Object.entries(ROLE_TO_VALUE_STREAM)) {
    if (!importedSet.has(norm(roleName))) continue; // only wire roles we actually imported
    const roleId = roleIdByNorm.get(norm(roleName));
    const vsId = vsIdByName.get(norm(vsName));
    if (!roleId || !vsId) { push(`  [vs-MISS] ${roleName} → ${vsName} (role or VS not found)`); continue; }
    await prisma.nodeRole.upsert({
      where: { processNodeId_roleId_role_: { processNodeId: vsId, roleId, role_: 'Participant' } },
      update: {},
      create: { companyId: c, processNodeId: vsId, roleId, role_: 'Participant', ownerLevel: null },
    });
    vsLinks++;
    push(`  [vs] ${roleName}  →  ${vsName} (Participant @ L2)`);
  }
  // Executive/governance imported roles intentionally left org-only.
  const execOnly = created.filter((n) => !ROLE_TO_VALUE_STREAM[n]);
  for (const n of execOnly) push(`  [vs-skip] ${n} — org-only (department homing is its wiring)`);

  const finalRoleCount = await prisma.role.count({ where: { companyId: c } });
  const result: SeedOrgResult = {
    departmentsCreated: deptPlans.length,
    rolesCreated: created.length,
    rolesHomed: finalRoleCount - unhomed,
    rolesHomedToDept: homedToDept,
    rolesHomedToDivisionFallback: homedToDivisionFallback,
    rolesUnhomed: unhomed,
    vsLinksCreated: vsLinks,
    deptDivisionLog: log,
    unmappableRoles: [],
  };

  // Roles that ended up truly UN-homed (no orgUnitId after this seeder) — for review.
  const stillUnhomed = await prisma.role.findMany({ where: { companyId: c, orgUnitId: null }, select: { dbValue: true } });
  result.unmappableRoles = stillUnhomed.map((r) => r.dbValue);

  console.log(
    `   seedOrgFromDevelop: +${result.departmentsCreated} departments (L3), +${result.rolesCreated} roles → ${finalRoleCount} total; ` +
    `homed-to-dept ${homedToDept}, division-fallback ${homedToDivisionFallback}, un-homed ${result.unmappableRoles.length}; +${vsLinks} VS links`,
  );
  // Full per-decision mapping log (dept→division, role→VS, fallbacks). Set
  // SEED_ORG_LOG=1 to print every decision for review (default: summary only).
  if (process.env.SEED_ORG_LOG) {
    console.log('   ── seedOrgFromDevelop decision log ──');
    for (const line of log) console.log(line);
  }
  if (result.unmappableRoles.length) console.log(`   ⚠ un-homed roles: ${result.unmappableRoles.join(', ')}`);
  return result;
}
