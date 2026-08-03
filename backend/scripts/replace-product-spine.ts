/**
 * replace-product-spine.ts — replace the ABC Insurance product spine with the
 * document-normalized v2 portfolio.
 *
 * The product data previously seeded into the spine was illustrative; the
 * portfolio in scripts/data/abc-portfolio-v2.json is normalized from the real
 * collected sources (Composite_Normalized_Insurance_Product_Model.xlsx — 257
 * carrier products across AIG / Chubb / Farmers / Liberty Mutual / Munich Re —
 * plus the 9 filed homeowners policy forms and a 51-jurisdiction regulatory
 * reference). The review workbook for this dataset is
 * documents/product-model-workspace/ABC_Insurance_Product_Portfolio_REVIEW.xlsx.
 *
 * Shape loaded (mirrors the ProductLevelType axis):
 *   L1 Segment (7) → L2 LOB (56) → L3 Product (77) → L4 Version (381)
 *   → L5 Model Component (1,301; attributes.elements[] carry the atoms).
 * A product's countrywide L4 version carries all nine model components with
 * the full element set; a state-form L4 version (a state whose regulation
 * forces its own policy form) carries only the components that deviate there
 * (Forms + Filings) with state-specific elements, so grid deltas land exactly
 * where the state forces a difference.
 *
 * Destructive and idempotent: deletes every ProductNode for the company
 * (closure rows cascade) plus stale ProductNormalizationDecision rows, then
 * reloads and rebuilds the closure. Re-running converges to the same state.
 *
 * Run from backend/:  npx tsx --env-file=.env scripts/replace-product-spine.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

interface JsonElement {
  element: string;
  format: string;
  livesIn: string;
  description: string;
}
interface JsonComponent {
  name: string;
  description: string;
  attributes: {
    owner: string;
    formats: string[];
    currentExpression: string;
    elements: JsonElement[];
  };
}
interface JsonVersion {
  name: string;
  status: string;
  description: string;
  attributes: Record<string, unknown>;
  components: JsonComponent[];
}
interface JsonProduct {
  name: string;
  code: string;
  description: string;
  attributes: Record<string, unknown>;
  versions: JsonVersion[];
}
interface JsonLob {
  name: string;
  description: string;
  attributes: Record<string, unknown>;
  products: JsonProduct[];
}
interface JsonSegment {
  name: string;
  description: string;
  attributes: Record<string, unknown>;
  lobs: JsonLob[];
}
interface Payload {
  meta: Record<string, string>;
  levels: { levelNumber: number; dbValue: string; displayValue: string }[];
  segments: JsonSegment[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data', 'abc-portfolio-v2.json');

/** Deterministic node id — stable across re-runs so links stay diffable. */
function nodeId(path: string): string {
  return 'pv2_' + createHash('sha1').update(path).digest('hex').slice(0, 20);
}

async function main(): Promise<void> {
  const payload = JSON.parse(readFileSync(DATA, 'utf8')) as Payload;

  const company = await prisma.company.findFirst({ where: { name: 'ABC Insurance' } });
  if (!company) throw new Error('Company "ABC Insurance" not found');
  const companyId = company.id;

  // Level types: update display names in place, create any that are missing.
  const levelIds = new Map<number, string>();
  for (const lvl of payload.levels) {
    const row = await prisma.productLevelType.upsert({
      where: { companyId_levelNumber: { companyId, levelNumber: lvl.levelNumber } },
      update: { dbValue: lvl.dbValue, displayValue: lvl.displayValue },
      create: { companyId, ...lvl },
    });
    levelIds.set(lvl.levelNumber, row.id);
  }

  type Row = {
    id: string;
    companyId: string;
    productLevelTypeId: string;
    parentId: string | null;
    dbValue: string;
    displayValue: string;
    description: string | null;
    status: string | null;
    sortOrder: number;
    code: string | null;
    attributes: object;
  };
  const rows: Row[] = [];
  const closure: { ancestorId: string; descendantId: string; depth: number }[] = [];

  function push(
    level: number,
    path: string,
    ancestors: string[],
    node: {
      name: string;
      description?: string;
      status?: string;
      code?: string;
      attributes: Record<string, unknown>;
    },
    sortOrder: number,
  ): string {
    const id = nodeId(path);
    rows.push({
      id,
      companyId,
      productLevelTypeId: levelIds.get(level)!,
      parentId: ancestors.length ? ancestors[ancestors.length - 1] : null,
      dbValue: node.name,
      displayValue: node.name,
      description: node.description ?? null,
      status: node.status ?? null,
      sortOrder,
      code: node.code ?? null,
      attributes: node.attributes as object,
    });
    closure.push({ ancestorId: id, descendantId: id, depth: 0 });
    ancestors.forEach((anc, i) => {
      closure.push({ ancestorId: anc, descendantId: id, depth: ancestors.length - i });
    });
    return id;
  }

  let si = 0;
  for (const seg of payload.segments) {
    const segId = push(1, `seg:${seg.name}`, [], seg, si++);
    let li = 0;
    for (const lob of seg.lobs) {
      const lobId = push(2, `lob:${seg.name}/${lob.name}`, [segId], lob, li++);
      let pi = 0;
      for (const prod of lob.products) {
        const prodId = push(3, `prod:${prod.code}`, [segId, lobId], prod, pi++);
        let vi = 0;
        for (const ver of prod.versions) {
          const verId = push(4, `ver:${prod.code}/${ver.name}`, [segId, lobId, prodId], ver, vi++);
          let ci = 0;
          for (const comp of ver.components) {
            push(
              5,
              `comp:${prod.code}/${ver.name}/${comp.name}`,
              [segId, lobId, prodId, verId],
              comp,
              ci++,
            );
          }
        }
      }
    }
  }

  console.log(
    `loading ${rows.length} nodes / ${closure.length} closure rows into company ${companyId}`,
  );

  await prisma.$transaction(
    async (tx) => {
      const decisions = await tx.productNormalizationDecision.deleteMany({ where: { companyId } });
      // Single statement, so the self-referential parent FK validates at
      // statement end — parents and children can go together.
      const deleted = await tx.productNode.deleteMany({ where: { companyId } });
      console.log(
        `deleted ${deleted.count} old nodes, ${decisions.count} stale normalization decisions`,
      );
      // createMany skips relation checks per-row batching; insert parents
      // before children (rows[] is already in ancestor-first order).
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await tx.productNode.createMany({ data: rows.slice(i, i + CHUNK) });
      }
      for (let i = 0; i < closure.length; i += 2000) {
        await tx.productNodeClosure.createMany({ data: closure.slice(i, i + 2000) });
      }
    },
    { timeout: 300_000 },
  );

  // Verify: counts per level + closure integrity.
  for (const [lvl, id] of levelIds) {
    const n = await prisma.productNode.count({ where: { productLevelTypeId: id } });
    console.log(`  L${lvl}: ${n}`);
  }
  const closureCount = await prisma.productNodeClosure.count();
  console.log(`  closure rows: ${closureCount}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
