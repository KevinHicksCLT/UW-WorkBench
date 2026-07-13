/**
 * Seed the product spine (ProductLevelType + ProductNode + ProductNodeClosure)
 * from the per-segment content files in scripts/data/product-spine/*.json
 * (schema: scripts/data/product-spine/SCHEMA.md).
 *
 * Hierarchy: L1 Segment > L2 LOB / Product Family > L3 Product >
 *            L4 Version / Jurisdiction > L5 Model Component. Component `items`
 *            (the real coverages / factors / rules / forms of that product
 *            version, each with what it is + the system it lives in) land in
 *            ProductNode.attributes.elements. Level names are per-company
 *            editable via ProductLevelType.displayValue.
 *
 * Idempotent: wipes the company's existing product spine and recreates it,
 * then rebuilds the closure. Run from backend/:
 *   npx tsx --env-file=.env scripts/seed-product-spine.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from '../src/db/prisma.js';
import { productClosure } from '../src/lib/closure.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data', 'product-spine');
// Seed order = segment sort order on the tab.
const SEGMENT_FILES = [
  'personal-lines.json',
  'smb.json',
  'commercial.json',
  'multinational.json',
  'specialty.json',
  'lloyds.json',
];

const LEVELS = [
  { levelNumber: 1, displayValue: 'Segment' },
  { levelNumber: 2, displayValue: 'LOB / Product Family' },
  { levelNumber: 3, displayValue: 'Product' },
  { levelNumber: 4, displayValue: 'Version / Jurisdiction' },
  { levelNumber: 5, displayValue: 'Model Component' },
];

const COMPONENTS = [
  'Product Taxonomy',
  'Coverages',
  'Terms',
  'Rating',
  'Pricing',
  'Underwriting Rules',
  'Forms',
  'Filings',
  'Lifecycle Behavior',
];

const OWNER: Record<string, string> = {
  'Product Taxonomy': 'Product operations',
  Coverages: 'Product operations',
  Terms: 'Product operations',
  Rating: 'Actuarial + IT',
  Pricing: 'Actuarial',
  'Underwriting Rules': 'Underwriting',
  Forms: 'Compliance / forms team',
  Filings: 'Compliance',
  'Lifecycle Behavior': 'IT / policy operations',
};

interface ItemJson {
  name: string;
  description: string;
  livesIn: string;
  format?: string;
}
interface ComponentJson {
  name: string;
  owner?: string;
  expression?: string;
  items: ItemJson[];
}
interface VersionJson {
  version: string;
  jurisdiction: string;
  effective: string;
  status: string;
  components: ComponentJson[];
}
interface ProductJson {
  name: string;
  lob: string;
  runsIn: string;
  description?: string;
  versions: VersionJson[];
}
interface SegmentFile {
  segment: {
    name: string;
    canonicalName: string;
    systems: string;
    legacyVariants: number;
    operatingPattern: string;
    distribution: string;
    placement: string;
    reinsurance: string;
    regulatory: string;
    behavior: Record<string, string>;
    patterns: { name: string; components: string[] }[];
  };
  lobs: { name: string; appliesTo: string; componentsExtended: string }[];
  products: ProductJson[];
}

/** Classify a source-location string into a display format bucket. */
function fmtOf(s: string): string {
  const l = s.toLowerCase();
  if (/cobol|vsam|cics|batch|copybook|mainframe/.test(l)) return 'Mainframe / COBOL';
  if (/\.xls|excel|spreadsheet|workbook|matrix|grid|bordereau/.test(l)) return 'Excel';
  if (/\.docx|word|memo|wording|manuscript/.test(l)) return 'Word';
  if (/pdf/.test(l)) return 'PDF';
  if (
    /duck creek|rules engine|pas c|pas a|pas b|binder admin|globalnet|rating engine|workbench|scan feed|db2/.test(
      l,
    )
  )
    return 'System config';
  if (/serff|portal|cdr|crystal|atlas|bureau|xchanging|oir|tdi|doi/.test(l))
    return 'Regulator system';
  if (/slip|lma|mrc|binder|sharepoint|library|clause/.test(l)) return 'Market doc / library';
  if (/sme|manual|undocumented|judgment|negotiation|email/.test(l)) return 'Manual / SME';
  if (/powerpoint/.test(l)) return 'PowerPoint';
  return 'Document';
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function loadSegments(): SegmentFile[] {
  return SEGMENT_FILES.map((f) => {
    const raw = readFileSync(join(DATA_DIR, f), 'utf8');
    const parsed = JSON.parse(raw) as SegmentFile;
    // Validate: every version carries exactly the 9 canonical components.
    for (const p of parsed.products) {
      for (const v of p.versions) {
        const names = v.components.map((c) => c.name);
        const missing = COMPONENTS.filter((c) => !names.includes(c));
        const extra = names.filter((c) => !COMPONENTS.includes(c));
        if (missing.length || extra.length) {
          throw new Error(
            `${f}: ${p.name} ${v.version} components mismatch (missing: ${missing.join(', ') || '—'}; extra: ${extra.join(', ') || '—'})`,
          );
        }
        for (const c of v.components) {
          for (const it of c.items) {
            if (!it.name || !it.description || !it.livesIn) {
              throw new Error(
                `${f}: ${p.name} ${v.version} ${c.name}: item missing name/description/livesIn`,
              );
            }
          }
        }
      }
    }
    return parsed;
  });
}

async function main() {
  const segments = loadSegments();

  const company =
    (await prisma.company.findFirst({ where: { slug: 'abc-insurance' } })) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } }));
  if (!company) throw new Error('No company row found — seed the base data first.');
  const companyId = company.id;

  const del = await prisma.productNode.deleteMany({ where: { companyId } });
  await prisma.productLevelType.deleteMany({ where: { companyId } });
  console.log(`Company ${company.slug}: wiped ${del.count} existing product nodes.`);

  const levelIds = new Map<number, string>();
  for (const l of LEVELS) {
    const row = await prisma.productLevelType.create({
      data: {
        companyId,
        levelNumber: l.levelNumber,
        dbValue: `L${l.levelNumber}`,
        displayValue: l.displayValue,
      },
    });
    levelIds.set(l.levelNumber, row.id);
  }

  let nodes = 0;
  const node = async (data: {
    level: number;
    parentId: string | null;
    dbValue: string;
    displayValue: string;
    description?: string;
    status?: string;
    sortOrder: number;
    attributes?: object;
  }) => {
    const row = await prisma.productNode.create({
      data: {
        companyId,
        productLevelTypeId: levelIds.get(data.level)!,
        parentId: data.parentId,
        dbValue: data.dbValue,
        displayValue: data.displayValue,
        description: data.description ?? null,
        status: data.status ?? null,
        sortOrder: data.sortOrder,
        attributes: data.attributes ?? undefined,
      },
    });
    nodes++;
    return row.id;
  };

  for (const [si, file] of segments.entries()) {
    const seg = file.segment;
    const segId = await node({
      level: 1,
      parentId: null,
      dbValue: slug(seg.name),
      displayValue: seg.name,
      sortOrder: si,
      description: seg.operatingPattern,
      attributes: {
        canonicalName: seg.canonicalName,
        systems: seg.systems,
        legacyVariants: seg.legacyVariants,
        distribution: seg.distribution,
        placement: seg.placement,
        reinsurance: seg.reinsurance,
        regulatory: seg.regulatory,
        patterns: seg.patterns,
      },
    });

    const lobIds = new Map<string, string>();
    for (const [i, fam] of file.lobs.entries()) {
      const lobId = await node({
        level: 2,
        parentId: segId,
        dbValue: `${slug(seg.name)}-${slug(fam.name)}`,
        displayValue: fam.name,
        sortOrder: i,
        description: fam.appliesTo,
        attributes: { componentsExtended: fam.componentsExtended },
      });
      lobIds.set(fam.name, lobId);
    }

    for (const [pi, prod] of file.products.entries()) {
      const lobId = lobIds.get(prod.lob);
      if (!lobId) throw new Error(`LOB family "${prod.lob}" not defined for segment "${seg.name}"`);
      const prodId = await node({
        level: 3,
        parentId: lobId,
        dbValue: `${slug(seg.name)}-${slug(prod.name)}`,
        displayValue: prod.name,
        sortOrder: pi,
        description: prod.description,
        attributes: { runsIn: prod.runsIn },
      });

      for (const [vi, v] of prod.versions.entries()) {
        const verId = await node({
          level: 4,
          parentId: prodId,
          dbValue: `${slug(seg.name)}-${slug(prod.name)}-${slug(v.version)}-${slug(v.jurisdiction)}`,
          displayValue: `${v.version} — ${v.jurisdiction}`,
          sortOrder: vi,
          status: v.status,
          attributes: { version: v.version, jurisdiction: v.jurisdiction, effective: v.effective },
        });

        // Keep canonical component order regardless of JSON order.
        const byName = new Map(v.components.map((c) => [c.name, c]));
        for (const [ci, compName] of COMPONENTS.entries()) {
          const comp = byName.get(compName)!;
          const elements = comp.items.map((it) => ({
            element: it.name,
            description: it.description,
            livesIn: it.livesIn,
            format: it.format ?? fmtOf(it.livesIn),
          }));
          await node({
            level: 5,
            parentId: verId,
            dbValue: `${slug(seg.name)}-${slug(prod.name)}-${slug(v.version)}-${slug(v.jurisdiction)}-${slug(compName)}`,
            displayValue: compName,
            sortOrder: ci,
            description: comp.expression ?? seg.behavior[compName],
            attributes: {
              owner: comp.owner ?? OWNER[compName],
              currentExpression: comp.expression ?? seg.behavior[compName],
              formats: [...new Set(elements.map((e) => e.format))],
              elements,
            },
          });
        }
      }
    }
  }

  const closureRows = await productClosure.rebuildClosure({ companyId });
  console.log(
    `Seeded ${nodes} product nodes, ${LEVELS.length} level types, ${closureRows} closure rows.`,
  );

  const counts = await prisma.productNode.groupBy({
    by: ['productLevelTypeId'],
    _count: true,
    where: { companyId },
  });
  for (const [num, id] of levelIds) {
    const c = counts.find((x) => x.productLevelTypeId === id)?._count ?? 0;
    console.log(`  L${num}: ${c}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
