// sync-bridge-input.ts — apply the Bridge Input workbook deltas found by
// audit-bridge-input.ts to the live DB, ADDITIVELY (no company wipe — the
// seed's company.deleteMany would cascade away people/portfolio/regulations).
//
// What it does (idempotent):
//   1. Inserts missing ValueStreamDomain / ValueStream / Role / RoleValueStream
//      rows from data/seed/spine.json (the 7 Life/Disability/Retirement streams,
//      their 12 roles and 12 participation links).
//   2. Deletes ChecklistItem rows for roles the workbook no longer gives items
//      (the removed "Claims Analyst" item) — logged before deletion.
//   3. Rebuilds Level L3/L4/L5 from the spine (the old tree came from the
//      ARCHIVED v16 E2E sheet: 21/43/256 with v13-era stream names). L0–L2 are
//      kept. L3 streams are parented to the owning L2 division derived from
//      role participation (Lead > Core > other). Workbook codes (CI-01-01,
//      CI-01-01-S03) land in Level.sourceRefId.
//
// Afterwards re-run: seed-ai-adoption.ts (LevelAiAdoption was cascade-cleared
// for L3–L5) and backfill-nodes.ts + backfill-node-links.ts (Node is derived).
// Run (cwd = backend): npx tsx scripts/sync-bridge-input.ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const SPINE = resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed/spine.json');
const spine = JSON.parse(readFileSync(SPINE, 'utf8'));

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company');
  const c = company.id, t = company.tenantId;

  // ── 1a. Domains ────────────────────────────────────────────────────────
  const dbDomains = await prisma.valueStreamDomain.findMany({ where: { companyId: c }, select: { id: true, name: true } });
  const domainId = new Map(dbDomains.map((d) => [d.name, d.id] as const));
  for (const d of spine.domains) {
    if (domainId.has(d.name)) continue;
    const r = await prisma.valueStreamDomain.create({ data: { tenantId: t, companyId: c, name: d.name }, select: { id: true } });
    domainId.set(d.name, r.id);
    console.log('+ ValueStreamDomain:', d.name);
  }

  // ── 1b. Value streams ──────────────────────────────────────────────────
  const dbVs = await prisma.valueStream.findMany({ where: { companyId: c }, select: { id: true, name: true } });
  const vsId = new Map(dbVs.map((v) => [v.name, v.id] as const));
  for (const v of spine.valueStreams) {
    if (vsId.has(v.name)) continue;
    const r = await prisma.valueStream.create({
      data: { tenantId: t, companyId: c, name: v.name, domain: v.domain, domainId: v.domain ? domainId.get(v.domain) ?? null : null, sourceSheet: 'Value Streams', sourceRow: v.sourceRow },
      select: { id: true },
    });
    vsId.set(v.name, r.id);
    console.log('+ ValueStream:', v.name);
  }

  // ── 1c. Roles ──────────────────────────────────────────────────────────
  const dbRoles = await prisma.role.findMany({ where: { companyId: c }, select: { id: true, name: true } });
  const roleId = new Map(dbRoles.map((r) => [r.name, r.id] as const));
  const divisions = await prisma.division.findMany({ where: { companyId: c }, select: { id: true, name: true } });
  const divId = new Map(divisions.map((d) => [d.name, d.id] as const));
  const depts = await prisma.department.findMany({ where: { companyId: c }, select: { id: true, name: true, division: { select: { name: true } } } });
  const deptId = new Map(depts.map((d) => [`${d.division.name}␟${d.name}`, d.id] as const));
  for (const r of spine.roles) {
    if (roleId.has(r.name)) continue;
    const created = await prisma.role.create({
      data: {
        tenantId: t, companyId: c, name: r.name, itemRole: r.itemRole, roleFamily: r.roleFamily,
        roleLevel: r.roleLevel, description: r.description, responsibilities: r.responsibilities,
        divisionId: r.divisionName ? divId.get(r.divisionName) ?? null : null,
        departmentId: r.divisionName && r.departmentName ? deptId.get(`${r.divisionName}␟${r.departmentName}`) ?? null : null,
        sourceSheet: r.sourceSheet, sourceRow: r.sourceRow,
      },
      select: { id: true },
    });
    roleId.set(r.name, created.id);
    console.log('+ Role:', r.name);
  }

  // ── 1d. Role ↔ value-stream links ─────────────────────────────────────
  const dbRvs = await prisma.roleValueStream.findMany({
    where: { valueStream: { companyId: c } },
    select: { subStream: true, participationType: true, role: { select: { name: true } }, valueStream: { select: { name: true } } },
  });
  const rvsKey = (r: string, v: string, s: string | null, p: string) => `${r}␟${v}␟${s ?? ''}␟${p}`;
  const haveRvs = new Set(dbRvs.map((x) => rvsKey(x.role.name, x.valueStream.name, x.subStream, x.participationType)));
  let rvsAdded = 0;
  for (const x of spine.roleValueStreams) {
    if (haveRvs.has(rvsKey(x.roleName, x.valueStreamName, x.subStream, x.participationType))) continue;
    const rid = roleId.get(x.roleName), vid = vsId.get(x.valueStreamName);
    if (!rid || !vid) { console.warn('! RVS skipped (unresolved):', x.roleName, '⇄', x.valueStreamName); continue; }
    await prisma.roleValueStream.create({
      data: {
        tenantId: t, roleId: rid, valueStreamId: vid, subStream: x.subStream, participationType: x.participationType,
        inputs: x.inputs, outputs: x.outputs, upstream: x.upstream, downstream: x.downstream,
        notes: x.notes, sourceSheet: 'Value Streams', sourceRow: x.sourceRow,
      },
    });
    rvsAdded++;
    console.log('+ RoleValueStream:', x.roleName, '⇄', x.valueStreamName);
  }

  // ── 2. Checklist items the workbook removed ───────────────────────────
  const wbItemRoles = new Map<string, number>();
  for (const r of spine.checklistItems) wbItemRoles.set(r.roleName, (wbItemRoles.get(r.roleName) ?? 0) + 1);
  const dbItemRoles: { id: string; name: string; n: number }[] = await prisma.$queryRawUnsafe(
    'SELECT r.id, r.name, COUNT(*)::int AS n FROM public."ChecklistItem" i JOIN public."Role" r ON r.id = i."roleId" GROUP BY r.id, r.name');
  for (const row of dbItemRoles) {
    if (wbItemRoles.has(row.name)) continue; // role still has items; content drift is out of scope here
    const items = await prisma.checklistItem.findMany({ where: { roleId: row.id }, select: { id: true, text: true } });
    for (const it of items) console.log(`- ChecklistItem (workbook removed, role ${row.name}): "${it.text.slice(0, 80)}"`);
    await prisma.checklistItem.deleteMany({ where: { roleId: row.id } });
  }

  // ── 3. Level tree rebuild (L3–L5 only) ────────────────────────────────
  // Owning division per stream: strongest role participation (Lead 3 / Core 2 /
  // other 1) over the stream's role links, by each role's division.
  const roleDiv = new Map((await prisma.role.findMany({ where: { companyId: c }, select: { name: true, division: { select: { name: true } } } }))
    .map((r) => [r.name, r.division?.name ?? null] as const));
  const W: Record<string, number> = { Lead: 3, Core: 2 };
  const ownerOf = new Map<string, string>();
  {
    const score = new Map<string, Map<string, number>>();
    for (const x of spine.roleValueStreams) {
      const div = roleDiv.get(x.roleName); if (!div) continue;
      const m = score.get(x.valueStreamName) ?? new Map<string, number>();
      m.set(div, (m.get(div) ?? 0) + (W[x.participationType] ?? 1));
      score.set(x.valueStreamName, m);
    }
    for (const [vs, m] of score) ownerOf.set(vs, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }

  const before = await prisma.level.groupBy({ by: ['levelNumber'], where: { companyId: c }, _count: true });
  console.log('Level counts before:', before.map((x) => `L${x.levelNumber}=${x._count}`).join(' '));
  await prisma.level.deleteMany({ where: { companyId: c, levelNumber: { in: [3, 4, 5] } } });

  const l2 = await prisma.level.findMany({ where: { companyId: c, levelNumber: 2 }, select: { id: true, name: true } });
  const l2Id = new Map(l2.map((d) => [d.name, d.id] as const));

  const mk = (data: any) => prisma.level.create({ data: { tenantId: t, companyId: c, sortOrder: 0, ...data }, select: { id: true } });
  const l3Id = new Map<string, string>();
  let i3 = 0;
  for (const v of spine.valueStreams) {
    const owner = ownerOf.get(v.name);
    const r = await mk({ levelNumber: 3, name: v.name, parentId: (owner && l2Id.get(owner)) ?? null, sortOrder: i3++, sourceType: 'catalog' });
    l3Id.set(v.name, r.id);
  }
  const l4Id = new Map<string, string>(); // keyed by L4 name (globally unique in the master)
  let i4 = 0;
  for (const s of spine.subValueStreams) {
    const parentId = l3Id.get(s.valueStreamName);
    if (!parentId) { console.warn('! L4 skipped (no stream):', s.l4); continue; }
    const r = await mk({
      levelNumber: 4, name: s.l4, parentId, sortOrder: i4++, sourceType: 'catalog', sourceRefId: s.processId ?? null,
      description: s.l3 ? `Process area: ${s.l3}` : null,
      inputs: s.inputs, outputs: s.outputs, externalParticipants: s.externalParticipants, notes: s.notes,
    });
    l4Id.set(s.l4, r.id);
  }
  let n5 = 0;
  for (const s of spine.l5Steps) {
    const parentId = l4Id.get(s.l4Name);
    if (!parentId) { console.warn('! L5 skipped (no L4):', s.name); continue; }
    const ps = spine.processSteps.find((p: any) => p.code === s.code);
    await mk({
      levelNumber: 5, name: s.name, parentId, sortOrder: s.stepNumber, sourceType: 'catalog', sourceRefId: s.code ?? null,
      description: s.description, leads: ps?.leads ?? null, supporting: ps?.supporting ?? null,
      inputs: ps?.inputs ?? null, outputs: ps?.outputs ?? null, externalParticipants: ps?.externalParticipants ?? null, notes: ps?.notes ?? null,
    });
    n5++;
  }

  const after = await prisma.level.groupBy({ by: ['levelNumber'], where: { companyId: c }, _count: true });
  console.log('Level counts after:', after.sort((a, b) => a.levelNumber - b.levelNumber).map((x) => `L${x.levelNumber}=${x._count}`).join(' '));
  console.log(`Done: +${rvsAdded} role links, L5 created ${n5}. Now re-run seed-ai-adoption.ts and backfill-nodes.ts + backfill-node-links.ts.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
