// P3 — backfill the unified Node tree from legacy tables (operating-model rework).
// DATA-TRUE: 1:1, original legacy id kept as Node.code, names verbatim, provenance
// carried. Idempotent: wipes+rebuilds the company's Nodes (Node is a derived table).
// This pass does the ORG branch: Enterprise → Segment → Division → Department → Role.
// The WORK branch (value_stream → sub_process → step → io_item) is added next.
// See docs/operating-model-architecture.md.
import { prisma } from '../src/db/prisma.js';
import { canonicalVs, NEW_STREAMS } from './vs-mapping.js';

const prov = (illustrative: boolean | null | undefined) => (illustrative === false ? 'real' : 'illustrative');

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  for (const company of companies) {
    const companyId = company.id;

    // ── baseline (pre-backfill legacy counts) ──
    const [divisions, departments, roles] = await Promise.all([
      prisma.division.findMany({ where: { companyId }, select: { id: true, name: true, higherCategory: true } }),
      prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, divisionId: true } }),
      prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, divisionId: true, departmentId: true, roleLevel: true, status: true } }),
    ]);
    const segments = [...new Set(divisions.map((d) => d.higherCategory).filter((s): s is string => !!s))];

    // Rebuild this company's nodes from scratch (derived table).
    await prisma.node.deleteMany({ where: { companyId } });

    // L0 Enterprise root
    const enterprise = await prisma.node.create({ data: { companyId, typeKey: 'enterprise', name: company.name, provenance: 'real', sortOrder: 0 } });

    // L1 Segments (the ONE shared grouping) from distinct Division.higherCategory
    const segByName = new Map<string, string>();
    for (const [i, name] of segments.entries()) {
      const n = await prisma.node.create({ data: { companyId, typeKey: 'segment', name, parentId: enterprise.id, provenance: 'real', sortOrder: i } });
      segByName.set(name, n.id);
    }

    // L2 Divisions → parent = its segment node (by higherCategory)
    const divByLegacyId = new Map<string, string>();
    const divByName = new Map<string, string>();
    for (const [i, d] of divisions.entries()) {
      const parentId = d.higherCategory ? segByName.get(d.higherCategory) ?? enterprise.id : enterprise.id;
      const n = await prisma.node.create({ data: { companyId, typeKey: 'division', name: d.name, code: d.id, parentId, provenance: 'real', sortOrder: i } });
      divByLegacyId.set(d.id, n.id);
      divByName.set(d.name, n.id);
    }

    // L3 Departments → parent = its division node (Department.divisionId)
    const deptByLegacyId = new Map<string, string>();
    for (const [i, d] of departments.entries()) {
      const parentId = divByLegacyId.get(d.divisionId);
      const n = await prisma.node.create({ data: { companyId, typeKey: 'department', name: d.name, code: d.id, parentId: parentId ?? null, provenance: 'real', sortOrder: i } });
      deptByLegacyId.set(d.id, n.id);
    }

    // L4 Roles → parent = department node, else division node, else logged orphan
    const orphanRoles: string[] = [];
    for (const [i, r] of roles.entries()) {
      let parentId: string | null = null;
      if (r.departmentId) parentId = deptByLegacyId.get(r.departmentId) ?? null;
      if (!parentId && r.divisionId) parentId = divByLegacyId.get(r.divisionId) ?? null;
      if (!parentId) orphanRoles.push(r.name);
      await prisma.node.create({
        data: { companyId, typeKey: 'role', name: r.name, code: r.id, parentId, provenance: prov(undefined), sortOrder: i,
          attributes: { roleLevel: r.roleLevel ?? null, status: r.status ?? null } },
      });
    }

    // ── WORK branch: value_stream / sub_process / step from the canonical Level
    // tree (levelNumber 3/4/5); io_item from IoItem (legacy-VS name → VS node). ──
    const levels = await prisma.level.findMany({
      where: { companyId, levelNumber: { in: [2, 3, 4, 5] } },
      orderBy: [{ levelNumber: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, name: true, parentId: true, levelNumber: true, sortOrder: true, description: true, leads: true, supporting: true, inputs: true, outputs: true, notes: true },
    });
    const l2NameById = new Map(levels.filter((l) => l.levelNumber === 2).map((l) => [l.id, l.name]));
    const levelToNode = new Map<string, string>(); // Level.id → Node.id (L3/L4/L5)
    const unmatchedVs: string[] = [];

    const l3 = levels.filter((l) => l.levelNumber === 3);
    for (const [i, l] of l3.entries()) {
      const divName = l.parentId ? l2NameById.get(l.parentId) : null;
      const parentId = divName ? divByName.get(divName) ?? null : null;
      if (!parentId) unmatchedVs.push(l.name);
      const n = await prisma.node.create({ data: { companyId, typeKey: 'value_stream', name: l.name, code: l.id, parentId, description: l.description, provenance: 'illustrative', sortOrder: l.sortOrder || i } });
      levelToNode.set(l.id, n.id);
    }
    const l4 = levels.filter((l) => l.levelNumber === 4);
    for (const [i, l] of l4.entries()) {
      const parentId = l.parentId ? levelToNode.get(l.parentId) ?? null : null;
      const n = await prisma.node.create({ data: { companyId, typeKey: 'sub_process', name: l.name, code: l.id, parentId, description: l.description, provenance: 'illustrative', sortOrder: l.sortOrder || i } });
      levelToNode.set(l.id, n.id);
    }
    const l5 = levels.filter((l) => l.levelNumber === 5);
    for (const [i, l] of l5.entries()) {
      const parentId = l.parentId ? levelToNode.get(l.parentId) ?? null : null;
      const n = await prisma.node.create({
        data: { companyId, typeKey: 'step', name: l.name, code: l.id, parentId, description: l.description, provenance: 'illustrative', sortOrder: l.sortOrder || i,
          attributes: { leads: l.leads, supporting: l.supporting, inputs: l.inputs, outputs: l.outputs, notes: l.notes } },
      });
      levelToNode.set(l.id, n.id);
    }

    // NEW canonical value streams promoted from the legacy set (vs-mapping.ts)
    const vsNodeByName = new Map(l3.map((l) => [l.name, levelToNode.get(l.id)!]));
    for (const ns of NEW_STREAMS) {
      if (vsNodeByName.has(ns.name)) continue;
      const n = await prisma.node.create({ data: { companyId, typeKey: 'value_stream', name: ns.name, parentId: divByName.get(ns.division) ?? null, provenance: 'illustrative', sortOrder: 99 } });
      vsNodeByName.set(ns.name, n.id);
    }

    // io_item ← IoItem (preserve ALL; legacy-VS NAME → canonical VS node via the
    // 29→21 mapping; log unmatched)
    const vsLegacy = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } });
    const vsLegacyName = new Map(vsLegacy.map((v) => [v.id, v.name]));
    const ioItems = await prisma.ioItem.findMany({ where: { valueStream: { companyId } }, select: { id: true, name: true, type: true, valueStreamId: true, keyRoles: true, dataElements: true, l3: true, l4: true } });
    const unmatchedIo: string[] = [];
    for (const io of ioItems) {
      const vsName = vsLegacyName.get(io.valueStreamId);
      const parentId = vsName ? vsNodeByName.get(canonicalVs(vsName)) ?? null : null;
      if (!parentId) unmatchedIo.push(io.name);
      await prisma.node.create({
        data: { companyId, typeKey: 'io_item', name: io.name, code: io.id, parentId, provenance: 'illustrative',
          attributes: { type: io.type, keyRoles: io.keyRoles, dataElements: io.dataElements, l3: io.l3, l4: io.l4, legacyValueStream: vsName ?? null } },
      });
    }

    // ── reconcile ──
    const counts = await prisma.node.groupBy({ by: ['typeKey'], where: { companyId }, _count: { _all: true } });
    const got = Object.fromEntries(counts.map((c) => [c.typeKey, c._count._all]));
    const expect = {
      enterprise: 1, segment: segments.length, division: divisions.length, department: departments.length, role: roles.length,
      value_stream: l3.length + NEW_STREAMS.filter((ns) => !l3.some((l) => l.name === ns.name)).length,
      sub_process: l4.length, step: l5.length, io_item: ioItems.length,
    };
    console.log(`\n=== ${company.name} (${companyId}) ===`);
    for (const [k, v] of Object.entries(expect)) {
      const g = got[k] ?? 0;
      console.log(`  ${k.padEnd(11)} expect ${String(v).padStart(4)}  got ${String(g).padStart(4)}  ${g === v ? 'OK' : 'MISMATCH'}`);
    }
    if (orphanRoles.length) console.log(`  ⚠ ${orphanRoles.length} roles with no department/division parent (logged): ${orphanRoles.slice(0, 8).join(', ')}${orphanRoles.length > 8 ? '…' : ''}`);
    if (unmatchedVs.length) console.log(`  ⚠ ${unmatchedVs.length} value streams with no division parent (logged): ${unmatchedVs.slice(0, 8).join(', ')}${unmatchedVs.length > 8 ? '…' : ''}`);
    console.log(`  io_item: ${ioItems.length - unmatchedIo.length}/${ioItems.length} attached to a canonical value stream (${unmatchedIo.length} logged — deferred 29→21 reconciliation)`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
