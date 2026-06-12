// Seeds TelemetrySignal 1:1 from the workbook reference catalog the
// /explorer/telemetry-catalog route used to hardcode (defect: rendered content
// not stored in the DB): backend/data/telemetry-catalog.json (kept on disk as
// the provenance artifact but no longer read at runtime) — system-of-record
// metrics, isLive = false.
// Idempotent: skips any company that already has TelemetrySignal rows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { prisma } from '../src/db/prisma.js';

type CatalogMetric = {
  name: string; origin: string | null; source: string | null; category: string | null;
  dataType: string | null; queryType: string | null; description: string | null;
};
const here = dirname(fileURLToPath(import.meta.url));
const CATALOG: CatalogMetric[] = JSON.parse(readFileSync(resolve(here, '../data/telemetry-catalog.json'), 'utf8'));

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true, tenantId: true } });
  for (const company of companies) {
    const existing = await prisma.telemetrySignal.count({ where: { companyId: company.id } });
    if (existing > 0) {
      console.log(`${company.name}: ${existing} TelemetrySignal rows already present — skipped`);
      continue;
    }
    let sort = 100;
    for (const m of CATALOG) {
      await prisma.telemetrySignal.create({
        data: {
          tenantId: company.tenantId, companyId: company.id,
          kind: 'system', name: m.name, description: m.description,
          source: m.source, category: m.category, unit: m.dataType, frequency: null, direction: 'up',
          origin: m.origin, queryType: m.queryType, isLive: false, sortOrder: sort++,
        },
      });
    }
    console.log(`${company.name}: seeded ${CATALOG.length} catalog TelemetrySignal rows`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
