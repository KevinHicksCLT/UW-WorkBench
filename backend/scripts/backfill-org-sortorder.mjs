import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const L1_ORDER = { 'Core Business':0, 'Corporate Functions':1, 'Technology':2 };
const L2_FLOW = {
  'Core Business': ['Product & Delivery','Sales, Distribution & Marketing','Underwriting','Business Operations','Claims','Reinsurance','Actuarial','Call Center','Corporate Functions Operations'],
  'Corporate Functions': ['Finance & Investments','Risk, Compliance & Audit','Legal & Corporate Governance','Human Resources & Talent','Program Management Office','Executive Office'],
  'Technology': ['Technology & Engineering','Data & AI','Cybersecurity & IAM'],
};

const l1s = await p.orgUnit.findMany({ where:{ orgLevelType:{ levelNumber:1 } }, select:{ id:true, displayValue:true } });
let l1u=0, l2u=0, miss=[];
for (const l1 of l1s) {
  const so1 = L1_ORDER[l1.displayValue];
  if (so1 !== undefined) { await p.orgUnit.update({ where:{ id:l1.id }, data:{ sortOrder: so1 } }); l1u++; }
  const flow = L2_FLOW[l1.displayValue] ?? [];
  const l2 = await p.orgUnit.findMany({ where:{ parentId:l1.id }, select:{ id:true, displayValue:true } });
  for (const d of l2) {
    const idx = flow.indexOf(d.displayValue);
    if (idx === -1) { miss.push(`${l1.displayValue} > ${d.displayValue}`); continue; }
    await p.orgUnit.update({ where:{ id:d.id }, data:{ sortOrder: idx } });
    l2u++;
  }
}
console.log(`L1 updated=${l1u} L2 updated=${l2u} unmatched=${miss.length}`, miss);
await p.$disconnect();
