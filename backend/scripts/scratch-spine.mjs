import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const levels = await p.productLevelType.findMany({ orderBy: { levelNumber: 'asc' } });
console.log('LEVELS:', levels.map(l => `${l.levelNumber}=${l.displayValue}`).join(' | '));
for (const l of levels) {
  const c = await p.productNode.count({ where: { productLevelTypeId: l.id } });
  console.log(`L${l.levelNumber} ${l.displayValue}: ${c} nodes`);
}
// L2 LOBs
const l2 = await p.productNode.findMany({ where: { productLevelType: { levelNumber: 2 } }, select: { id: true, displayValue: true, parent: { select: { displayValue: true } } }, orderBy: { sortOrder: 'asc' } });
console.log('\nL2 LOBs:', l2.map(n => `${n.displayValue} (seg: ${n.parent?.displayValue})`).join('; '));
// pick one LOB, show L3 products + L4 versions + L5 components sample
const lob = l2.find(n => /home|homeowner|auto/i.test(n.displayValue)) ?? l2[0];
console.log('\nSAMPLE LOB:', lob.displayValue);
const l3 = await p.productNode.findMany({ where: { parentId: lob.id }, select: { id: true, displayValue: true }, orderBy: { sortOrder: 'asc' } });
for (const prod of l3) {
  const l4 = await p.productNode.findMany({ where: { parentId: prod.id }, select: { id: true, displayValue: true, status: true, attributes: true }, orderBy: { sortOrder: 'asc' } });
  console.log(`\n  L3 ${prod.displayValue}: versions = ${l4.map(v => `${v.displayValue} [${v.status}]`).join('; ')}`);
  for (const v of l4.slice(0, 2)) {
    const l5 = await p.productNode.findMany({ where: { parentId: v.id }, select: { displayValue: true, description: true, attributes: true }, orderBy: { sortOrder: 'asc' } });
    console.log(`    L4 ${v.displayValue} components (${l5.length}): ${l5.map(c => c.displayValue).join(' | ')}`);
    if (l5[0]) console.log('      sample attrs:', JSON.stringify(l5[0].attributes)?.slice(0, 300), '| desc:', l5[0].description?.slice(0, 120));
  }
}
await p.$disconnect();
