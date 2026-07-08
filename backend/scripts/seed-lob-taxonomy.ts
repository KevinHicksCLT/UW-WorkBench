// seed-lob-taxonomy.ts — seed the LineOfBusiness reference table from the
// user-provided NAIC annual-statement + Solvency II line list (lob-taxonomy.json).
// Deduped to one row per distinct label; `segments` records every market grouping
// (PERSONAL/COMMERCIAL/FEDERAL/INTERNATIONAL) the label appeared under. Idempotent.
//
// Run (cwd = backend): npx tsx --env-file=.env scripts/seed-lob-taxonomy.ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';

const here = dirname(fileURLToPath(import.meta.url));

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

async function main() {
  const tax = JSON.parse(readFileSync(join(here, 'lob-taxonomy.json'), 'utf-8')) as {
    segmentsByList: Record<string, string[]>;
  };
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('no company');
  const { id: companyId, tenantId } = company;

  // Dedup by label → collect segments + preserve first-seen order for sortOrder.
  const byLabel = new Map<string, { label: string; segments: Set<string>; order: number }>();
  let order = 0;
  for (const [segment, labels] of Object.entries(tax.segmentsByList)) {
    for (const label of labels) {
      const key = label.trim();
      if (!byLabel.has(key)) byLabel.set(key, { label: key, segments: new Set(), order: order++ });
      byLabel.get(key)!.segments.add(segment);
    }
  }

  let created = 0;
  let updated = 0;
  for (const { label, segments, order: sortOrder } of byLabel.values()) {
    const code = slug(label);
    const segArr = [...segments];
    const existing = await prisma.lineOfBusiness.findUnique({
      where: { companyId_code: { companyId, code } },
      select: { id: true },
    });
    if (existing) {
      await prisma.lineOfBusiness.update({
        where: { id: existing.id },
        data: { label, segments: segArr, sortOrder },
      });
      updated++;
    } else {
      await prisma.lineOfBusiness.create({
        data: { tenantId, companyId, code, label, segments: segArr, sortOrder },
      });
      created++;
    }
  }

  console.log(
    `LineOfBusiness taxonomy: +${created} created, ${updated} updated (${byLabel.size} distinct labels)`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
