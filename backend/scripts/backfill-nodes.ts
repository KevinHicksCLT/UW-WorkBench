// P3 — backfill the unified Node tree from legacy tables (operating-model rework).
// DATA-TRUE: 1:1, original legacy id kept as Node.code, names verbatim, provenance
// carried. Idempotent: wipes+rebuilds the company's Nodes (Node is a derived table).
// This pass does the ORG branch: Enterprise → Segment → Division → Department → Role.
// The WORK branch (value_stream → sub_process → step → io_item) is added next.
// See docs/operating-model-architecture.md.
import { prisma } from '../src/db/prisma.js';

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
    for (const [i, d] of divisions.entries()) {
      const parentId = d.higherCategory ? segByName.get(d.higherCategory) ?? enterprise.id : enterprise.id;
      const n = await prisma.node.create({ data: { companyId, typeKey: 'division', name: d.name, code: d.id, parentId, provenance: 'real', sortOrder: i } });
      divByLegacyId.set(d.id, n.id);
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

    // ── reconcile ──
    const counts = await prisma.node.groupBy({ by: ['typeKey'], where: { companyId }, _count: { _all: true } });
    const got = Object.fromEntries(counts.map((c) => [c.typeKey, c._count._all]));
    const expect = { enterprise: 1, segment: segments.length, division: divisions.length, department: departments.length, role: roles.length };
    console.log(`\n=== ${company.name} (${companyId}) ===`);
    for (const [k, v] of Object.entries(expect)) {
      const g = got[k] ?? 0;
      console.log(`  ${k.padEnd(11)} expect ${String(v).padStart(4)}  got ${String(g).padStart(4)}  ${g === v ? 'OK' : 'MISMATCH'}`);
    }
    if (orphanRoles.length) console.log(`  ⚠ ${orphanRoles.length} roles with no department/division parent (logged): ${orphanRoles.slice(0, 8).join(', ')}${orphanRoles.length > 8 ? '…' : ''}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
