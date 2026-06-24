import 'dotenv/config';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const j = JSON.parse(fs.readFileSync('data/seed/master_v5.json','utf8'));
const nodes = j.processNodes;

// Map code(=key) -> sortOrder from regenerated JSON
const want = new Map(nodes.map(n => [n.key, Math.round(n.sortOrder ?? 0)]));

// Pull current DB nodes (code + sortOrder) to compute a minimal diff
const db = await p.processNode.findMany({ select: { id:true, code:true, sortOrder:true } });
let updated=0, missing=0, unchanged=0;
const ops=[];
for (const row of db) {
  if (row.code == null || !want.has(row.code)) { missing++; continue; }
  const so = want.get(row.code);
  if (row.sortOrder === so) { unchanged++; continue; }
  ops.push(p.processNode.update({ where:{ id: row.id }, data:{ sortOrder: so } }));
  updated++;
}
// batch in chunks
for (let i=0;i<ops.length;i+=200){ await p.$transaction(ops.slice(i,i+200)); }
console.log(`DB nodes=${db.length} updated=${updated} unchanged=${unchanged} noMatchInJson=${missing}`);
await p.$disconnect();
