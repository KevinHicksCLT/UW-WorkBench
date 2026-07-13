/**
 * Backfills citationUrl for RegulatoryRequirement rows missing it (859 rows,
 * all STATE_INSURANCE_REGULATOR or INTERNATIONAL) by matching against
 * documents/Regulation-Source-Audit.xlsx. Match: same jurisdiction name +
 * citation-text containment (either direction, normalized). Falls back to the
 * jurisdiction's own regulatorWebsite (always present) so every requirement
 * ends up with a real, working source link — never leaving a defect row.
 *
 * Run: npx tsx --env-file=.env scripts/backfill-regulation-sources.ts
 */
import XLSX from 'xlsx';
import { prisma } from '../src/db/prisma.js';

const WORKBOOK = new URL(
  '../../documents/Regulation-Source-Audit.xlsx',
  import.meta.url,
).pathname.replace(/^\/([A-Za-z]:)/, '$1');

type SourceRow = {
  jurisdiction: string;
  citation: string;
  source: string;
  link: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function loadSources(): SourceRow[] {
  const wb = XLSX.readFile(WORKBOOK);
  const out: SourceRow[] = [];
  for (const tier of ['International', 'Federal', 'State']) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[tier], {
      defval: '',
    });
    for (const r of rows) {
      const citation = (r['Citation'] || '').trim();
      const link = (r['Jump-To Link'] || '').trim();
      if (!citation || !link) continue;
      out.push({
        jurisdiction: (r['Jurisdiction'] || '').trim(),
        citation,
        source: (r['Source'] || '').trim(),
        link,
      });
    }
  }
  return out;
}

async function main() {
  const sources = loadSources();
  const byJurisdiction = new Map<string, SourceRow[]>();
  for (const s of sources) {
    const key = norm(s.jurisdiction);
    if (!byJurisdiction.has(key)) byJurisdiction.set(key, []);
    byJurisdiction.get(key)!.push(s);
  }

  const missing = await prisma.regulatoryRequirement.findMany({
    where: { citationUrl: null },
    select: {
      id: true,
      citation: true,
      sourceNote: true,
      jurisdiction: { select: { name: true, regulatorWebsite: true } },
    },
  });

  let matched = 0;
  let fallback = 0;
  for (const row of missing) {
    const candidates = byJurisdiction.get(norm(row.jurisdiction.name)) ?? [];
    const citNorm = norm(row.citation ?? '');
    const hit = citNorm
      ? candidates.find(
          (c) => citNorm.includes(norm(c.citation)) || norm(c.citation).includes(citNorm),
        )
      : undefined;

    if (hit) {
      matched++;
      await prisma.regulatoryRequirement.update({
        where: { id: row.id },
        data: {
          citationUrl: hit.link,
          sourceNote: row.sourceNote ?? hit.source,
        },
      });
    } else {
      fallback++;
      await prisma.regulatoryRequirement.update({
        where: { id: row.id },
        data: {
          citationUrl: row.jurisdiction.regulatorWebsite ?? undefined,
          sourceNote: row.sourceNote ?? 'Regulator homepage — specific citation link unavailable',
        },
      });
    }
  }
  console.log(
    `Backfilled ${missing.length} rows: ${matched} matched to audit source, ${fallback} fell back to regulator homepage.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
