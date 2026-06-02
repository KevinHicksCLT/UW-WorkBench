// One-off: load Scenario Inputs (change initiatives) into the existing company
// without a full reseed. Safe to re-run (replaces existing scenarios).
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SPINE = resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed/spine.json');

async function main() {
  const spine = JSON.parse(readFileSync(SPINE, 'utf8'));
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company found — run the full seed first.');
  await prisma.scenario.deleteMany({ where: { companyId: company.id } });
  await prisma.scenario.createMany({
    data: spine.scenarios.map((s: any) => ({
      tenantId: company.tenantId, companyId: company.id, name: s.name, changeType: s.changeType,
      impactScope: s.impactScope, divisionName: s.divisionName, valueStreamName: s.valueStreamName,
      application: s.application, roleImpact: s.roleImpact, oneTimeCost: s.oneTimeCost,
      annualBenefit: s.annualBenefit, annualAddedCost: s.annualAddedCost, annualNetImpact: s.annualNetImpact,
      confidence: s.confidence, sourceSheet: 'Scenario Inputs', sourceRow: s.sourceRow,
    })),
  });
  const n = await prisma.scenario.count({ where: { companyId: company.id } });
  console.log(`Loaded ${n} scenarios into "${company.name}".`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
