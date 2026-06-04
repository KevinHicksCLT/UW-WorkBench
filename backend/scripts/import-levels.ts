// import-levels.ts — populate the configurable Level tree from the org spine +
// the E2E Process Flows catalog (ZZ_ARCHIVE_E2E Process Flows sheet).
//
//   L0 Company  ── from the Company record            (connection outside workbook)
//   L1 Domain   ── distinct Division.higherCategory   (connection outside workbook)
//   L2 Division ── each Division, under its domain     (connection outside workbook)
//   L3 Value Stream  ── catalog col B   (imported un-parented; connect to a Division
//                                        in the Data Admin "Levels" editor)
//   L4 Sub-Process   ── catalog col D, under its value stream   (within workbook)
//   L5 Process Step  ── catalog col F, under its sub-process     (within workbook)
//                       + detail: G desc, H+I roles, J inputs, K outputs, M external, L notes
//
// Idempotent: clears the company's Level rows first. Run (cwd = backend):
//   npm run import:levels -w cascade-backend
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { prisma } from '../src/db/prisma.js';

const WORKBOOK = resolve(dirname(fileURLToPath(import.meta.url)), '../../IT_Roles_Analytics_v16.xlsx');
const SHEET = 'ZZ_ARCHIVE_E2E Process Flows';
const HEADER_ROW = 3; // data starts at row 4 (0-indexed)

const str = (v: unknown): string => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));
const orNull = (v: unknown): string | null => str(v) || null;
const intOr0 = (v: unknown): number => { const n = parseInt(str(v), 10); return Number.isFinite(n) ? n : 0; };

async function main() {
  const wb = XLSX.read(readFileSync(WORKBOOK), { cellDates: true });
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Missing sheet: ${SHEET}`);
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });

  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company found');
  const { id: companyId, tenantId } = company;

  // Clean slate for this company's levels (idempotent re-run).
  await prisma.level.deleteMany({ where: { companyId } });

  const mk = (data: {
    levelNumber: number; name: string; parentId: string | null; sortOrder?: number;
    sourceType: string; sourceRefId?: string | null;
    description?: string | null; leads?: string | null; supporting?: string | null;
    inputs?: string | null; outputs?: string | null; externalParticipants?: string | null; notes?: string | null;
  }) => prisma.level.create({
    data: { tenantId, companyId, sortOrder: 0, ...data },
    select: { id: true },
  });

  // L0 Company
  const l0 = await mk({ levelNumber: 0, name: company.name, parentId: null, sourceType: 'company', sourceRefId: companyId });

  // L1 Domains — distinct Division.higherCategory
  const divisions = await prisma.division.findMany({ where: { companyId }, select: { id: true, name: true, higherCategory: true } });
  const domainNames = [...new Set(divisions.map((d) => d.higherCategory).filter((x): x is string => !!x))].sort();
  const domainLevelId = new Map<string, string>();
  let di = 0;
  for (const name of domainNames) {
    const r = await mk({ levelNumber: 1, name, parentId: l0.id, sortOrder: di++, sourceType: 'domain' });
    domainLevelId.set(name, r.id);
  }

  // L2 Divisions — each under its domain (or the company if uncategorized)
  let vi = 0;
  for (const d of divisions.sort((a, b) => a.name.localeCompare(b.name))) {
    const parentId = (d.higherCategory && domainLevelId.get(d.higherCategory)) || l0.id;
    await mk({ levelNumber: 2, name: d.name, parentId, sortOrder: vi++, sourceType: 'division', sourceRefId: d.id });
  }

  // L3 Value Streams (col B) — imported un-parented (connect to a Division in Admin)
  const vsLevelId = new Map<string, string>();
  // L4 Sub-Processes keyed by `${vs}␟${sub}`
  const subLevelId = new Map<string, string>();
  let l3n = 0, l4n = 0, l5n = 0;

  for (let i = HEADER_ROW + 1; i < grid.length; i++) {
    const row = grid[i];
    const vs = str(row[1]);   // B  L2 Value Stream  → Level 3
    const sub = str(row[3]);  // D  L4 Sub-Process   → Level 4
    const step = str(row[5]); // F  L5 Process Step  → Level 5
    if (!vs) continue;

    // L3
    if (!vsLevelId.has(vs)) {
      const r = await mk({ levelNumber: 3, name: vs, parentId: null, sortOrder: l3n, sourceType: 'catalog' });
      vsLevelId.set(vs, r.id);
      l3n++;
    }
    if (!sub) continue;

    // L4
    const subKey = `${vs}␟${sub}`;
    if (!subLevelId.has(subKey)) {
      const r = await mk({ levelNumber: 4, name: sub, parentId: vsLevelId.get(vs)!, sortOrder: l4n, sourceType: 'catalog' });
      subLevelId.set(subKey, r.id);
      l4n++;
    }
    if (!step) continue;

    // L5 — one node per row, with the step detail for the metrics sidebar
    await mk({
      levelNumber: 5, name: step, parentId: subLevelId.get(subKey)!, sortOrder: intOr0(row[4]), sourceType: 'catalog',
      description: orNull(row[6]),          // G Step Description
      leads: orNull(row[7]),                // H Step Lead(s)
      supporting: orNull(row[8]),           // I Supporting Participants
      inputs: orNull(row[9]),               // J Key Inputs
      outputs: orNull(row[10]),             // K Key Outputs
      externalParticipants: orNull(row[12]),// M External Participants
      notes: orNull(row[11]),               // L Notes
    });
    l5n++;
  }

  const counts = await prisma.level.groupBy({ by: ['levelNumber'], where: { companyId }, _count: true });
  console.log('Imported levels into company', company.name);
  console.table(counts.map((c) => ({ level: c.levelNumber, count: c._count })));
  console.log(`L3 value streams: ${l3n}, L4 sub-processes: ${l4n}, L5 steps: ${l5n}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
