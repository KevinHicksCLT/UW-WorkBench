// audit-product-spine-gaps.ts — diagnostic: where does the Products board's
// drill-down run dry? Walks the product spine (L1 segment → L2 LOB → L3
// product → L4 version → L5 component) and reports, per level, nodes whose
// subtree carries no renderable data: versions without components, components
// without elements, versions without PolicyForm links, and Forms components
// vs the FormProductNode library.
//
// Run: npx tsx --env-file=.env scripts/audit-product-spine-gaps.ts
import { prisma } from '../src/db/prisma.js';

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('no company');

  const [levels, nodes, formLinks] = await Promise.all([
    prisma.productLevelType.findMany({
      where: { companyId: company.id },
      orderBy: { levelNumber: 'asc' },
      select: { id: true, levelNumber: true, displayValue: true },
    }),
    prisma.productNode.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        parentId: true,
        displayValue: true,
        productLevelTypeId: true,
        attributes: true,
      },
    }),
    prisma.formProductNode.findMany({
      where: { companyId: company.id },
      select: { productNodeId: true, role_: true },
    }),
  ]);

  const levelOf = new Map(levels.map((l) => [l.id, l.levelNumber]));
  const byParent = new Map<string | null, typeof nodes>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  const linksByNode = new Map<string, string[]>();
  for (const l of formLinks) {
    const list = linksByNode.get(l.productNodeId) ?? [];
    list.push(l.role_);
    linksByNode.set(l.productNodeId, list);
  }

  console.log(`company: ${company.name}`);
  console.log('levels:', levels.map((l) => `${l.levelNumber}=${l.displayValue}`).join(' · '));
  const countByLevel = new Map<number, number>();
  for (const n of nodes) {
    const ln = levelOf.get(n.productLevelTypeId) ?? -1;
    countByLevel.set(ln, (countByLevel.get(ln) ?? 0) + 1);
  }
  console.log(
    'node counts:',
    [...countByLevel.entries()]
      .sort()
      .map(([l, c]) => `L${l}:${c}`)
      .join(' '),
  );
  console.log(`formProductNode links: ${formLinks.length} on ${linksByNode.size} nodes`);

  const elCount = (attributes: unknown): number => {
    const a = attributes as { elements?: unknown } | null;
    return a && Array.isArray(a.elements) ? a.elements.length : 0;
  };

  let versionsTotal = 0;
  let versionsNoComponents = 0;
  let versionsNoForms = 0;
  const emptyComponents = new Map<string, number>(); // component name → empty count
  const componentTotals = new Map<string, number>();
  const versionGapSamples: string[] = [];
  const componentGapSamples: string[] = [];

  for (const seg of byParent.get(null) ?? []) {
    if (levelOf.get(seg.productLevelTypeId) !== 1) continue;
    for (const lob of byParent.get(seg.id) ?? []) {
      for (const prod of byParent.get(lob.id) ?? []) {
        for (const ver of byParent.get(prod.id) ?? []) {
          if (levelOf.get(ver.productLevelTypeId) !== 4) continue;
          versionsTotal += 1;
          const comps = byParent.get(ver.id) ?? [];
          const path = `${seg.displayValue} › ${lob.displayValue} › ${prod.displayValue} › ${ver.displayValue}`;
          if (comps.length === 0) {
            versionsNoComponents += 1;
            if (versionGapSamples.length < 25) versionGapSamples.push(`NO COMPONENTS: ${path}`);
          }
          if (!linksByNode.has(ver.id)) {
            versionsNoForms += 1;
            if (versionGapSamples.length < 25) versionGapSamples.push(`NO FORM LINKS: ${path}`);
          }
          for (const c of comps) {
            componentTotals.set(c.displayValue, (componentTotals.get(c.displayValue) ?? 0) + 1);
            const isForms = c.displayValue === 'Forms';
            const n = isForms ? (linksByNode.get(ver.id)?.length ?? 0) : elCount(c.attributes);
            if (n === 0) {
              emptyComponents.set(c.displayValue, (emptyComponents.get(c.displayValue) ?? 0) + 1);
              if (componentGapSamples.length < 40)
                componentGapSamples.push(`EMPTY ${c.displayValue}: ${path}`);
            }
          }
        }
      }
    }
  }

  console.log(`\nversions: ${versionsTotal}`);
  console.log(`  without any component children: ${versionsNoComponents}`);
  console.log(`  without any FormProductNode links: ${versionsNoForms}`);
  console.log('\ncomponents (empty/total):');
  for (const [name, total] of [...componentTotals.entries()].sort()) {
    const empty = emptyComponents.get(name) ?? 0;
    console.log(`  ${name}: ${empty}/${total} empty`);
  }
  if (versionGapSamples.length) {
    console.log('\nversion-level gaps (sample):');
    for (const s of versionGapSamples) console.log('  ' + s);
  }
  if (componentGapSamples.length) {
    console.log('\ncomponent-level gaps (sample):');
    for (const s of componentGapSamples) console.log('  ' + s);
  }

  // Orphan form links (linked to nodes that are not L4 versions)
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let linksNotOnL4 = 0;
  for (const id of linksByNode.keys()) {
    const n = nodeById.get(id);
    if (!n || levelOf.get(n.productLevelTypeId) !== 4) linksNotOnL4 += 1;
  }
  console.log(`\nform-link nodes that are NOT L4 versions: ${linksNotOnL4}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
