// connected-additions rule — the L4s created by separate-process-areas.ts
// (sourceSheet 'vs-l4-separation') shipped with tasks + (some) roles but NO
// deliverables, NO applications, NO step-deliverables, and a few leads that don't
// resolve to a roster Role. This back-fills the missing connections so every one
// of those L4/L5 nodes is tied to deliverables, roles, and applications too.
//
// Per affected stream: a domain-appropriate Execution + System-of-Record app.
// Per L4: an Input + Output IoItem (keyRoles = lead), a StepDeliverable on the
// terminal step (SoR app + approver = lead), and a StepAppUsage on every step
// (Execution; SoR on the first). Leads that don't resolve are remapped to a close
// roster role or created as a real specialist Role + linked via RoleValueStream.
//
// Idempotent: skips an L4 already carrying its IoItems. Run from backend/:
//   npx tsx scripts/wire-separation-additions.ts
import { PrismaClient } from '@prisma/client';
import { roleMatcher } from '../src/lib/roleMatch.js';

const prisma = new PrismaClient();

// stream → (Execution app, System-of-Record app) from the live catalog.
const APP: Record<string, [string, string]> = {
  'Actuarial Reserving': ['SAS Actuarial Platform', 'FIS Prophet'],
  'Actuarial Capital Modeling': ['Catastrophe Modeling', 'FIS Prophet'],
  'Treasury & Liquidity': ['Kyriba', 'SAP S/4HANA Finance'],
  'Capital Management': ['SAP S/4HANA Finance', 'Regulatory Filing Portal'],
  'Compliance & Regulatory': ['Archer', 'Regulatory Filing Portal'],
  'Data Management & Governance': ['Databricks Lakehouse', 'Snowflake'],
  'Analytics & AI': ['Databricks Lakehouse', 'Snowflake'],
  'Technology Strategy & Architecture': ['ServiceNow ITSM', 'GitHub'],
  'Cybersecurity & Threat Management': ['CrowdStrike Falcon', 'Archer'],
  'Identity & Access Management': ['SailPoint IGA', 'Microsoft Entra ID'],
  'Operational Resilience & Continuity': ['ServiceNow ITSM', 'Archer'],
  'Privacy & Data Protection': ['Archer', 'Microsoft 365 (Office, SharePoint)'],
};

// Leads with a close roster equivalent → remap (avoid near-duplicate roles).
const REMAP: Record<string, string> = {
  'Capital Actuary': 'Capital Model Actuary',
  'Catastrophe Modeling Analyst': 'Catastrophe & Exposure Manager',
};

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const { id: companyId, tenantId } = company;

  const apps = await prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } });
  const appId = new Map(apps.map((a) => [a.name, a.id]));
  const allRoles = await prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true } });
  const matchers = allRoles.map((r) => ({ id: r.id, m: roleMatcher(r) }));
  const resolveRole = (name: string) => matchers.find((x) => x.m(name))?.id ?? null;

  // role-name → id, creating the role when it neither resolves nor exists.
  const roleCache = new Map<string, string>();
  async function ensureRole(name: string): Promise<{ id: string; name: string }> {
    const target = REMAP[name] ?? name;
    if (roleCache.has(target)) return { id: roleCache.get(target)!, name: target };
    let id = resolveRole(target);
    if (!id) {
      const created = await prisma.role.create({ data: {
        tenantId, companyId, name: target, roleFamily: 'Specialist', roleLevel: 'Individual Contributor',
        status: 'New', sourceSheet: 'wire-additions',
      } });
      id = created.id;
      matchers.push({ id, m: roleMatcher({ name: target }) });
      console.log(`  + role ${target}`);
    }
    roleCache.set(target, id);
    return { id, name: target };
  }

  let wired = 0;
  for (const [streamName, [execApp, sorApp]] of Object.entries(APP)) {
    const vs = await prisma.valueStream.findFirst({ where: { companyId, name: streamName }, select: { id: true } });
    if (!vs) { console.log(`SKIP (stream not found): ${streamName}`); continue; }
    const execId = appId.get(execApp), sorId = appId.get(sorApp);
    if (!execId || !sorId) throw new Error(`app missing for ${streamName}: ${execApp} / ${sorApp}`);

    const l4s = await prisma.subValueStream.findMany({ where: { valueStreamId: vs.id, level: 4, sourceSheet: 'vs-l4-separation' }, select: { id: true, name: true } });
    for (const l4 of l4s) {
      const steps = await prisma.processStep.findMany({ where: { valueStreamId: vs.id, l4: l4.name }, orderBy: { stepNumber: 'asc' }, select: { id: true, l3: true, leads: true, supporting: true } });
      if (!steps.length) continue;
      const already = await prisma.ioItem.count({ where: { valueStreamId: vs.id, l4: l4.name } });
      if (already) continue; // idempotent

      const l3name = steps[0].l3 ?? '';
      const lead = await ensureRole(steps[0].leads ?? 'Process Owner');

      // Re-point leads to the resolved role name + link the role to the L3.
      if (REMAP[steps[0].leads ?? ''] || steps[0].leads !== lead.name) {
        await prisma.processStep.updateMany({ where: { valueStreamId: vs.id, l4: l4.name }, data: { leads: lead.name } });
      }
      await prisma.roleValueStream.create({ data: { tenantId, roleId: lead.id, valueStreamId: vs.id, subStream: l3name, participationType: 'Lead', notes: 'wire-additions', sourceSheet: 'wire-additions' } }).catch((e: any) => { if (e.code !== 'P2002') throw e; });

      // Deliverables (IoItem): one Input + the L4 Output.
      await prisma.ioItem.create({ data: { tenantId, valueStreamId: vs.id, l3: l3name, l4: l4.name, type: 'Input', name: `${l4.name} inputs`, keyRoles: lead.name, illustrative: true } });
      await prisma.ioItem.create({ data: { tenantId, valueStreamId: vs.id, l3: l3name, l4: l4.name, type: 'Output / Deliverable', name: l4.name, keyRoles: lead.name, illustrative: true } });

      // Applications per step (Execution everywhere; SoR on the first step).
      for (let i = 0; i < steps.length; i++) {
        const ps = steps[i];
        await prisma.stepAppUsage.create({ data: { tenantId, companyId, activityCode: ps.id, processStepId: ps.id, applicationId: execId, usageType: 'Execution', isPrimary: true, illustrative: true } });
        if (i === 0) await prisma.stepAppUsage.create({ data: { tenantId, companyId, activityCode: ps.id, processStepId: ps.id, applicationId: sorId, usageType: 'System of Record', isPrimary: false, illustrative: true } });
      }
      // Step deliverable on the terminal step.
      const last = steps[steps.length - 1];
      await prisma.stepDeliverable.create({ data: { tenantId, companyId, activityCode: last.id, processStepId: last.id, name: l4.name, sorApplicationId: sorId, approverRoleId: lead.id, approvalType: 'Manual Sign-off', illustrative: true } });
      wired++;
    }
    console.log(`wired ${streamName}: ${l4s.length} L4`);
  }
  console.log(`\nDone. Wired connections for ${wired} L4s.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
