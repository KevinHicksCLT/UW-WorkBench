// P2 — seed the default NodeType taxonomy (operating-model rework).
// The taxonomy is DATA: labels/levels/branching live here, not in code. One shared
// tree: Enterprise → Segment → Division → { Department → Role | Value Stream →
// Sub-Process → Step → I/O }. external_party is a flat node set linked via NodeLink.
// Idempotent (upsert on tenantId+key). See docs/operating-model-architecture.md.
import { prisma } from '../src/db/prisma.js';

const TYPES = [
  { key: 'enterprise',     label: 'Enterprise',      plural: 'Enterprises',      level: 0, dimension: 'STRUCTURE', parentKeys: [] },
  { key: 'segment',        label: 'Segment',         plural: 'Segments',         level: 1, dimension: 'STRUCTURE', parentKeys: ['enterprise'] },
  { key: 'division',       label: 'Division',        plural: 'Divisions',        level: 2, dimension: 'STRUCTURE', parentKeys: ['segment'] },
  { key: 'department',     label: 'Department',      plural: 'Departments',      level: 3, dimension: 'STRUCTURE', parentKeys: ['division'] },
  { key: 'role',           label: 'Role',            plural: 'Roles',            level: 4, dimension: 'STRUCTURE', parentKeys: ['department', 'division'] },
  { key: 'value_stream',   label: 'Value Stream',    plural: 'Value Streams',    level: 3, dimension: 'STRUCTURE', parentKeys: ['division'] },
  { key: 'sub_process',    label: 'Sub-Process',     plural: 'Sub-Processes',    level: 4, dimension: 'STRUCTURE', parentKeys: ['value_stream'] },
  { key: 'step',           label: 'Process Step',    plural: 'Process Steps',    level: 5, dimension: 'STRUCTURE', parentKeys: ['sub_process'] },
  { key: 'io_item',        label: 'Input / Output',  plural: 'Inputs / Outputs', level: 6, dimension: 'STRUCTURE', parentKeys: ['step', 'sub_process', 'value_stream'] },
  { key: 'external_party', label: 'External Party',  plural: 'External Parties', level: 0, dimension: 'EXTERNAL',  parentKeys: [] },
];

async function main() {
  const tenants = await prisma.company.findMany({ select: { tenantId: true }, distinct: ['tenantId'] });
  for (const { tenantId } of tenants) {
    for (const [i, t] of TYPES.entries()) {
      await prisma.nodeType.upsert({
        where: { tenantId_key: { tenantId, key: t.key } },
        create: { tenantId, key: t.key, label: t.label, pluralLabel: t.plural, level: t.level, dimension: t.dimension, parentKeys: t.parentKeys, sortOrder: i },
        update: { label: t.label, pluralLabel: t.plural, level: t.level, dimension: t.dimension, parentKeys: t.parentKeys, sortOrder: i },
      });
    }
  }
  const rows = await prisma.nodeType.findMany({ orderBy: [{ tenantId: 'asc' }, { sortOrder: 'asc' }], select: { key: true, label: true, level: true, parentKeys: true } });
  console.log(`tenants: ${tenants.length} · NodeType rows: ${rows.length}`);
  for (const r of rows.slice(0, TYPES.length)) console.log(`  L${r.level} ${r.key} "${r.label}" parents=[${r.parentKeys.join(',')}]`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
