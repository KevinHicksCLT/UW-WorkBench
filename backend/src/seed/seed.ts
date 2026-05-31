// Phase 1/4 seed — loads the normalized operating-model spine (spine.json,
// produced by transform-workbook.ts from IT_Roles_Analytics_v13.xlsx) into
// Postgres for one company: org spine + value-stream domains, KPIs, process
// flows, I/O inventory, role reporting hierarchy, and department standards.
//
// Idempotent: each run deletes the company's spine (FK-cascades through every
// child) and rebuilds it deterministically. Tenant + demo user are preserved.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedIllustrative, seedDeepLevels, metricReading } from './illustrative.js';

const prisma = new PrismaClient();
const SPINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/seed/spine.json');

type RoleRec = {
  name: string; itemRole: string | null; roleFamily: string | null; sourceSheet: string | null;
  divisionName: string | null; departmentName: string | null;
  roleLevel: string | null; description: string | null; responsibilities: string | null;
  status: string | null; primaryDomain: string | null; primaryValueStream: string | null;
  managerRoleName: string | null; sourceRow: number;
};
type Spine = {
  company: { name: string; slug: string };
  domains: { name: string; sourceRow: number }[];
  divisions: { code: string; name: string; sourceRow: number }[];
  departments: { divisionName: string; name: string; sourceRow: number }[];
  roles: RoleRec[];
  categories: string[];
  valueStreams: { name: string; domain: string | null; sourceRow: number }[];
  subValueStreams: {
    valueStreamName: string; l3: string | null; l4: string | null;
    inputs: string | null; outputs: string | null; upstream: string | null; downstream: string | null;
    notes: string | null; sourceRow: number;
  }[];
  metrics: {
    domain: string | null; valueStreamName: string; l3: string | null; category: string | null; name: string;
    description: string | null; formula: string | null; target: string | null; measurementLevel: string | null;
    frequency: string | null; ownerRole: string | null; framework: string | null; notes: string | null; sourceRow: number;
  }[];
  processSteps: {
    valueStreamName: string; l3: string | null; l4: string | null; stepNumber: number; name: string;
    description: string | null; leads: string | null; supporting: string | null; inputs: string | null;
    outputs: string | null; notes: string | null; externalParticipants: string | null; sourceRow: number;
  }[];
  ioItems: {
    valueStreamName: string; l3: string | null; l4: string | null; type: string; name: string;
    keyRoles: string | null; dataElements: string | null; sourceRow: number;
  }[];
  standards: { department: string; count: number; charterIncluded: boolean; owner: string | null; link: string | null; sourceRow: number }[];
  checklistItems: { roleName: string; category: string | null; text: string; crossRole: boolean; sourceRow: number }[];
  roleTasks: { roleName: string; category: string | null; text: string; sourceRow: number }[];
  roleValueStreams: {
    roleName: string; valueStreamName: string; subStream: string | null; participationType: string;
    inputs: string | null; outputs: string | null; upstream: string | null; downstream: string | null;
    notes: string | null; sourceRow: number;
  }[];
  externalInteractions: {
    partyType: string; externalRole: string; internalRoleOwner: string | null; internalRoleName: string | null;
    divisionFunction: string | null; interactionType: string | null; inputs: string | null; outputs: string | null;
    relatedValueStream: string | null; dependencyType: string | null; frequency: string | null; notes: string | null;
    sourceRow: number;
  }[];
};

async function chunked<T>(rows: T[], fn: (c: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  const spine: Spine = JSON.parse(readFileSync(SPINE, 'utf8'));
  console.log('Seeding operating-model spine from', SPINE);

  const tenant = await prisma.tenant.upsert({ where: { slug: 'strata' }, update: {}, create: { name: 'Strata Demo', slug: 'strata' } });
  await prisma.user.upsert({
    where: { email: 'demo@strata.io' }, update: {},
    create: { tenantId: tenant.id, email: 'demo@strata.io', name: 'Dana Chen', password: await bcrypt.hash('demo1234', 10), role: 'ADMIN' },
  });

  await prisma.company.deleteMany({ where: { tenantId: tenant.id } });
  const company = await prisma.company.create({ data: { tenantId: tenant.id, name: spine.company.name, slug: spine.company.slug } });
  const t = tenant.id;
  const c = company.id;

  // ── Value-stream domains ──
  await prisma.valueStreamDomain.createMany({ data: spine.domains.map((d) => ({ tenantId: t, companyId: c, name: d.name })) });
  const domainId = new Map((await prisma.valueStreamDomain.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((d) => [d.name, d.id] as const));

  // ── Divisions ──
  await prisma.division.createMany({
    data: spine.divisions.map((d) => ({ tenantId: t, companyId: c, code: d.code, name: d.name, sourceSheet: 'Org Chart View', sourceRow: d.sourceRow })),
  });
  const divisionId = new Map((await prisma.division.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((d) => [d.name, d.id] as const));

  // ── Departments ──
  await prisma.department.createMany({
    data: spine.departments.map((d) => ({ tenantId: t, companyId: c, divisionId: divisionId.get(d.divisionName)!, name: d.name, sourceSheet: 'Org Chart View', sourceRow: d.sourceRow })),
  });
  const departmentId = new Map((await prisma.department.findMany({ where: { companyId: c }, select: { id: true, name: true, divisionId: true } })).map((d) => [`${d.divisionId}␟${d.name}`, d.id] as const));

  // ── Roles (org roster + 84 extended roles; reporting links resolved after) ──
  await prisma.role.createMany({
    data: spine.roles.map((r) => {
      const divId = r.divisionName ? divisionId.get(r.divisionName) ?? null : null;
      const deptId = divId && r.departmentName ? departmentId.get(`${divId}␟${r.departmentName}`) ?? null : null;
      return {
        tenantId: t, companyId: c, divisionId: divId, departmentId: deptId, name: r.name, itemRole: r.itemRole, roleFamily: r.roleFamily,
        roleLevel: r.roleLevel, description: r.description, responsibilities: r.responsibilities, status: r.status,
        primaryDomain: r.primaryDomain, primaryValueStream: r.primaryValueStream, sourceSheet: r.sourceSheet, sourceRow: r.sourceRow,
      };
    }),
  });
  const roleId = new Map((await prisma.role.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((r) => [r.name, r.id] as const));

  // reporting hierarchy: set managerRoleId where resolvable (and not self)
  const mgrUpdates = spine.roles
    .filter((r) => r.managerRoleName && r.managerRoleName !== r.name && roleId.get(r.managerRoleName) && roleId.get(r.name))
    .map((r) => ({ id: roleId.get(r.name)!, managerRoleId: roleId.get(r.managerRoleName!)! }));
  await chunked(mgrUpdates, (batch) => Promise.all(batch.map((u) => prisma.role.update({ where: { id: u.id }, data: { managerRoleId: u.managerRoleId } }))), 50);

  // ── Categories ──
  await prisma.category.createMany({ data: spine.categories.map((name) => ({ tenantId: t, companyId: c, name })) });
  const categoryId = new Map((await prisma.category.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((x) => [x.name, x.id] as const));

  // ── Value streams (linked to domains) ──
  await prisma.valueStream.createMany({
    data: spine.valueStreams.map((v) => ({ tenantId: t, companyId: c, name: v.name, domain: v.domain, domainId: v.domain ? domainId.get(v.domain) ?? null : null, sourceSheet: 'Value Streams', sourceRow: v.sourceRow })),
  });
  const valueStreamId = new Map((await prisma.valueStream.findMany({ where: { companyId: c }, select: { id: true, name: true } })).map((v) => [v.name, v.id] as const));

  // ── Sub-value streams: L3 parents, then L4 ──
  const l3Seen = new Set<string>(); const l3Rows: any[] = [];
  for (const s of spine.subValueStreams) {
    const vsId = valueStreamId.get(s.valueStreamName); if (!vsId || !s.l3) continue;
    const key = `${vsId}␟${s.l3}`; if (l3Seen.has(key)) continue; l3Seen.add(key);
    l3Rows.push({ tenantId: t, valueStreamId: vsId, parentId: null, level: 3, name: s.l3, sourceSheet: 'Sub-Value Streams', sourceRow: s.sourceRow });
  }
  await prisma.subValueStream.createMany({ data: l3Rows });
  const l3Id = new Map((await prisma.subValueStream.findMany({ where: { level: 3, valueStream: { companyId: c } }, select: { id: true, valueStreamId: true, name: true } })).map((x) => [`${x.valueStreamId}␟${x.name}`, x.id] as const));
  const l4Seen = new Set<string>(); const l4Rows: any[] = [];
  for (const s of spine.subValueStreams) {
    const vsId = valueStreamId.get(s.valueStreamName); if (!vsId || !s.l4) continue;
    const parentId = s.l3 ? l3Id.get(`${vsId}␟${s.l3}`) ?? null : null;
    const key = `${vsId}␟${parentId}␟${s.l4}`; if (l4Seen.has(key)) continue; l4Seen.add(key);
    l4Rows.push({ tenantId: t, valueStreamId: vsId, parentId, level: 4, name: s.l4, inputs: s.inputs, outputs: s.outputs, upstream: s.upstream, downstream: s.downstream, notes: s.notes, sourceSheet: 'Sub-Value Streams', sourceRow: s.sourceRow });
  }
  await prisma.subValueStream.createMany({ data: l4Rows });

  // ── Real KPIs (243) with illustrative current readings ──
  await chunked(spine.metrics, (batch) => prisma.metric.createMany({
    data: batch.flatMap((m) => {
      const vsId = valueStreamId.get(m.valueStreamName); if (!vsId) return [];
      const r = metricReading({ name: m.name, target: m.target, notes: m.notes, category: m.category });
      return [{
        tenantId: t, companyId: c, valueStreamId: vsId, l3: m.l3, category: m.category, name: m.name, description: m.description,
        formula: m.formula, targetText: m.target, measurementLevel: m.measurementLevel, frequency: m.frequency, ownerRole: m.ownerRole,
        framework: m.framework, notes: m.notes, value: r.value, unit: r.unit, target: r.target, direction: r.direction, illustrative: true,
      }];
    }),
  }));

  // ── E2E process steps (256) ──
  await chunked(spine.processSteps, (batch) => prisma.processStep.createMany({
    data: batch.flatMap((s) => {
      const vsId = valueStreamId.get(s.valueStreamName); if (!vsId) return [];
      return [{ tenantId: t, valueStreamId: vsId, l3: s.l3, l4: s.l4, stepNumber: s.stepNumber, name: s.name, description: s.description, leads: s.leads, supporting: s.supporting, inputs: s.inputs, outputs: s.outputs, notes: s.notes, externalParticipants: s.externalParticipants }];
    }),
  }));

  // ── Inputs/Outputs inventory (835) ──
  await chunked(spine.ioItems, (batch) => prisma.ioItem.createMany({
    data: batch.flatMap((io) => {
      const vsId = valueStreamId.get(io.valueStreamName); if (!vsId) return [];
      return [{ tenantId: t, valueStreamId: vsId, l3: io.l3, l4: io.l4, type: io.type, name: io.name, keyRoles: io.keyRoles, dataElements: io.dataElements }];
    }),
  }));

  // ── Department standards index ──
  await prisma.standard.createMany({ data: spine.standards.map((s) => ({ tenantId: t, companyId: c, department: s.department, count: s.count, charterIncluded: s.charterIncluded, owner: s.owner, link: s.link })) });

  // ── Checklist items ──
  await chunked(spine.checklistItems, (batch) => prisma.checklistItem.createMany({
    data: batch.map((i) => ({ tenantId: t, roleId: roleId.get(i.roleName)!, categoryId: i.category ? categoryId.get(i.category) ?? null : null, text: i.text, crossRole: i.crossRole, sourceSheet: 'Items', sourceRow: i.sourceRow })),
  }));

  // ── Role tasks ──
  await chunked(spine.roleTasks, (batch) => prisma.roleTask.createMany({
    data: batch.map((rt) => ({ tenantId: t, roleId: roleId.get(rt.roleName)!, categoryId: rt.category ? categoryId.get(rt.category) ?? null : null, text: rt.text, sourceSheet: 'Aligned Role Tasks', sourceRow: rt.sourceRow })),
  }));

  // ── Role ↔ value-stream participation ──
  await chunked(spine.roleValueStreams, (batch) => prisma.roleValueStream.createMany({
    skipDuplicates: true,
    data: batch.map((l) => ({ tenantId: t, roleId: roleId.get(l.roleName)!, valueStreamId: valueStreamId.get(l.valueStreamName)!, subStream: l.subStream, participationType: l.participationType, inputs: l.inputs, outputs: l.outputs, upstream: l.upstream, downstream: l.downstream, notes: l.notes, sourceSheet: 'Value Streams', sourceRow: l.sourceRow })),
  }));

  // ── External interactions ──
  await prisma.externalInteraction.createMany({
    data: spine.externalInteractions.map((e) => ({ tenantId: t, companyId: c, partyType: e.partyType, externalRole: e.externalRole, internalRoleId: e.internalRoleName ? roleId.get(e.internalRoleName) ?? null : null, internalRoleOwner: e.internalRoleOwner, divisionFunction: e.divisionFunction, interactionType: e.interactionType, inputs: e.inputs, outputs: e.outputs, relatedValueStream: e.relatedValueStream, dependencyType: e.dependencyType, frequency: e.frequency, notes: e.notes, sourceSheet: 'External Interactions', sourceRow: e.sourceRow })),
  });

  console.log(`   spine: ${spine.domains.length} domains, ${spine.divisions.length} divisions, ${spine.roles.length} roles (${mgrUpdates.length} reporting links), ${spine.valueStreams.length} value streams, ${spine.metrics.length} KPIs, ${spine.processSteps.length} steps, ${spine.ioItems.length} I/O, ${spine.standards.length} standards`);

  // ── Illustrative systems + deep levels (people, initiatives, tasks, metrics, risks) ──
  await seedIllustrative(prisma, { tenantId: t, companyId: c, valueStreams: await prisma.valueStream.findMany({ where: { companyId: c }, select: { id: true, name: true } }) });
  await seedDeepLevels(prisma, { tenantId: t, companyId: c });

  console.log('✅ Seeded company:', company.name);
  console.log('   Login: demo@strata.io / demo1234');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
