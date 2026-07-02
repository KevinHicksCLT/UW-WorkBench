// Standards seeder — loads the department-standards taxonomy extracted from the
// `develop` Neon branch (backend/data/seed/standards-federal-from-develop.json,
// produced by the one-off pull in Task B) into the erd_v5 `Standard` model as a
// 3-level tree:
//
//   area  (isArea=true)            — the department charter (mission/scope/owner)
//     └ group (parentId=area)      — a higher-level standard within a category
//         └ leaf  (parentId=group) — an individual standard ("sub")
//
// Areas without a sub for a given top-level item still render: a source group with
// no children is a self-contained leaf standard (the frontend shows it directly).
//
// Owner roles are resolved via resolveSpineRefs.roleResolver (ownerRole text →
// Role.id); misses are counted + logged, not denormalized. Each item's
// appliesToValueStreams text is materialized as NodeStandard links to the matching
// value-stream ProcessNode(s) (deduped, fuzzy via refs.nodeByName).
//
// Idempotent: wipes the company's Standard rows (FK-cascades children +
// NodeStandard/RoleStandard) and rebuilds. Runnable standalone or from the seed.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { resolveSpineRefs, type SpineRefs } from './resolveSpineRefs.js';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/seed/standards-federal-from-develop.json');

type Area = { department: string; count: number; charterIncluded: boolean; owner: string | null; link: string | null; mission: string | null; scope: string | null };
type Item = {
  department: string; category: string; name: string; description: string | null;
  buildRun: string | null; ownerRole: string | null; relatedRole: string | null;
  relatedCategory: string | null; itemsLink: string | null; agentSkill: string | null;
  sdlcGates: string | null; regCitation: string | null; appliesToValueStreams: string | null;
  parentKey: string | null;
};

const groupKey = (i: { department: string; category: string; name: string }) => `${i.department}␟${i.category}␟${i.name}`;

// VS-reference cells are free text, sometimes a delimited list. Split on the
// common separators and resolve each fragment independently.
function splitVsRefs(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(/[;,/|]| and | & |\n/).map((s) => s.trim()).filter((s) => s.length > 2);
}

export async function seedStandards(
  prisma: PrismaClient,
  ids: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { companyId } = ids;
  const refs = ids.refs ?? (await resolveSpineRefs(prisma, companyId));
  const data = JSON.parse(readFileSync(DATA, 'utf8')) as { areas: Area[]; items: Item[] };

  // Wipe — cascades through the self-relation (children) + NodeStandard/RoleStandard.
  await prisma.standard.deleteMany({ where: { companyId } });

  // 1. Areas (department charters).
  const areaIdByDept = new Map<string, string>();
  for (const a of data.areas) {
    const row = await prisma.standard.create({
      data: {
        companyId, name: a.department, isArea: true, department: a.department,
        ownerLabel: a.owner, link: a.link, mission: a.mission, scope: a.scope,
        charterIncluded: a.charterIncluded,
      },
      select: { id: true },
    });
    areaIdByDept.set(a.department, row.id);
  }

  // 2. Groups (top-level items, parentKey === null) → child of the area.
  const groups = data.items.filter((i) => !i.parentKey);
  const leaves = data.items.filter((i) => i.parentKey);

  let nGroup = 0, nLeaf = 0, nVsLink = 0, ownerHits = 0;
  const groupIdByKey = new Map<string, string>();

  const buildData = (i: Item, parentId: string) => ({
    companyId, name: i.name, isArea: false, parentId,
    department: i.department, category: i.category, description: i.description,
    buildRun: i.buildRun, ownerLabel: i.ownerRole, relatedRole: i.relatedRole,
    relatedCategory: i.relatedCategory, link: i.itemsLink, agentSkill: i.agentSkill,
    sdlcGates: i.sdlcGates, regCitation: i.regCitation,
    appliesToValueStreams: i.appliesToValueStreams,
    ownerRoleId: (() => { const id = refs.roleResolver(i.ownerRole); if (id) { ownerHits++; } return id; })(),
  });

  // VS-link materialization for one Standard row.
  const linkVs = async (standardId: string, i: Item) => {
    const seen = new Set<string>();
    for (const ref of splitVsRefs(i.appliesToValueStreams)) {
      const nodeId = refs.nodeByName(ref);
      if (!nodeId || seen.has(nodeId)) continue;
      seen.add(nodeId);
      await prisma.nodeStandard.create({ data: { companyId, processNodeId: nodeId, standardId } }).catch(() => {});
      nVsLink++;
    }
  };

  for (const g of groups) {
    const areaId = areaIdByDept.get(g.department);
    if (!areaId) continue; // unknown department — skip (shouldn't happen; 13 areas cover all)
    const row = await prisma.standard.create({ data: buildData(g, areaId), select: { id: true } });
    groupIdByKey.set(groupKey(g), row.id);
    nGroup++;
    await linkVs(row.id, g);
  }

  for (const l of leaves) {
    const parentId = l.parentKey ? groupIdByKey.get(l.parentKey) : undefined;
    if (!parentId) continue; // orphan leaf — parent group missing (verified 0 at extract time)
    const row = await prisma.standard.create({ data: buildData(l, parentId), select: { id: true } });
    nLeaf++;
    await linkVs(row.id, l);
  }

  console.log(`Standards: ${data.areas.length} areas, ${nGroup} groups, ${nLeaf} leaves (${nGroup + nLeaf} items), ${nVsLink} VS links, ${ownerHits} owner-role matches`);
  return { areas: data.areas.length, groups: nGroup, leaves: nLeaf, vsLinks: nVsLink };
}

// Standalone entry point.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
    if (!company) throw new Error('No company found — run the main seed first.');
    console.log(`Seeding standards for ${company.name}…`);
    await seedStandards(prisma, { tenantId: company.tenantId, companyId: company.id });
  } finally {
    await prisma.$disconnect();
  }
}
