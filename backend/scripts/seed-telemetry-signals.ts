// Seeds TelemetrySignal 1:1 from the two sources the /explorer/telemetry-catalog
// route used to hardcode (defect: rendered content not stored in the DB):
//   1. The 9 live workforce signals (previously the WORKFORCE_SIGNALS constant in
//      routes/explorer.ts) — per-person readings exist in PersonSignal/PersonMetric;
//      `queryType` records which store ('signal' | 'metric'), isLive = true.
//   2. The 154-row workbook reference catalog (backend/data/telemetry-catalog.json,
//      kept on disk as the provenance artifact but no longer read at runtime) —
//      kind classified the same way the route did (Viva/M365 → workforce, the rest
//      → system), isLive = false.
// Idempotent: skips any company that already has TelemetrySignal rows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const LIVE_SIGNALS = [
  { name: 'Time online', store: 'signal', source: 'Viva Insights', category: 'Collaboration', unit: 'hrs/day', frequency: 'Daily', direction: 'up', description: 'Active digital working time per day.' },
  { name: 'Focus hours', store: 'signal', source: 'Viva Insights', category: 'Wellbeing', unit: 'hrs/wk', frequency: 'Weekly', direction: 'up', description: 'Uninterrupted time available for deep, focused work.' },
  { name: 'Meetings', store: 'signal', source: 'Viva Insights', category: 'Collaboration', unit: 'hrs/wk', frequency: 'Weekly', direction: 'down', description: 'Time spent in meetings per week.' },
  { name: 'Team messages', store: 'signal', source: 'Microsoft Teams', category: 'Collaboration', unit: 'msgs/wk', frequency: 'Weekly', direction: 'up', description: 'Chat messages sent per week.' },
  { name: 'GitHub activity', store: 'signal', source: 'GitHub', category: 'Engineering', unit: 'commits/mo', frequency: 'Monthly', direction: 'up', description: 'Code commits per month.' },
  { name: 'Throughput', store: 'metric', source: 'Delivery analytics', category: 'Delivery', unit: '/mo', frequency: 'Monthly', direction: 'up', description: 'Work items completed per month.' },
  { name: 'Quality', store: 'metric', source: 'Delivery analytics', category: 'Quality', unit: '%', frequency: 'Monthly', direction: 'up', description: 'Share of output meeting the quality bar.' },
  { name: 'Utilization', store: 'metric', source: 'Delivery analytics', category: 'Operational', unit: '%', frequency: 'Monthly', direction: 'up', description: 'Share of capacity actively utilized.' },
  { name: 'Cycle time', store: 'metric', source: 'Delivery analytics', category: 'Delivery', unit: 'days', frequency: 'Monthly', direction: 'down', description: 'Elapsed time from work started to done.' },
];

type CatalogMetric = {
  name: string; origin: string | null; source: string | null; category: string | null;
  dataType: string | null; queryType: string | null; description: string | null;
};
const here = dirname(fileURLToPath(import.meta.url));
const CATALOG: CatalogMetric[] = JSON.parse(readFileSync(resolve(here, '../data/telemetry-catalog.json'), 'utf8'));

// Same classification the route applied at read time: Viva/M365 collaboration
// telemetry → workforce; everything else is a system-of-record metric.
const isViva = (source: string | null) => /viva|microsoft|teams|m365|outlook|sharepoint|office 365/i.test(source ?? '');

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true, tenantId: true } });
  for (const company of companies) {
    const existing = await prisma.telemetrySignal.count({ where: { companyId: company.id } });
    if (existing > 0) {
      console.log(`${company.name}: ${existing} TelemetrySignal rows already present — skipped`);
      continue;
    }
    let sort = 0;
    for (const s of LIVE_SIGNALS) {
      await prisma.telemetrySignal.create({
        data: {
          tenantId: company.tenantId, companyId: company.id,
          kind: 'workforce', name: s.name, description: s.description, source: s.source,
          category: s.category, unit: s.unit, frequency: s.frequency, direction: s.direction,
          origin: null, queryType: s.store, isLive: true, sortOrder: sort++,
        },
      });
    }
    // Catalog rows start at 100 so live signals always sort first.
    sort = 100;
    for (const m of CATALOG) {
      await prisma.telemetrySignal.create({
        data: {
          tenantId: company.tenantId, companyId: company.id,
          kind: isViva(m.source) ? 'workforce' : 'system', name: m.name, description: m.description,
          source: m.source, category: m.category, unit: m.dataType, frequency: null, direction: 'up',
          origin: m.origin, queryType: m.queryType, isLive: false, sortOrder: sort++,
        },
      });
    }
    console.log(`${company.name}: seeded ${LIVE_SIGNALS.length} live + ${CATALOG.length} catalog = ${LIVE_SIGNALS.length + CATALOG.length} TelemetrySignal rows`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
