// audit-bridge-input.ts — cross-reference "AI Transformation Bridge Input.xlsx"
// (via the regenerated data/seed/spine.json) against the live database.
//
// Read-only: writes nothing to the DB. Emits docs/bridge-input-audit.md with a
// PASS/FAIL section per sheet↔table pair plus row-level missing/extra/changed
// detail (capped). Run AFTER transform-workbook.ts has been pointed at the new
// workbook so spine.json reflects it. Run (cwd = backend):
//   npx tsx scripts/audit-bridge-input.ts "../AI Transformation Bridge Input.xlsx"
import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { prisma } from '../src/db/prisma.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPINE = resolve(HERE, '../data/seed/spine.json');
const WORKBOOK = process.argv[2] || resolve(HERE, '../../AI Transformation Bridge Input.xlsx');
const OUT = resolve(HERE, '../../docs/bridge-input-audit.md');
const CAP = 15; // max detail rows listed per finding

const spine = JSON.parse(readFileSync(SPINE, 'utf8'));
const wb = XLSX.read(readFileSync(WORKBOOK), { cellDates: true });
const grid = (name: string): unknown[][] => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
};
const str = (v: unknown): string => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));

type Finding = { section: string; ok: boolean; summary: string; detail: string[] };
const findings: Finding[] = [];
const report = (section: string, ok: boolean, summary: string, detail: string[] = []) =>
  findings.push({ section, ok, summary, detail: detail.slice(0, CAP).concat(detail.length > CAP ? [`… and ${detail.length - CAP} more`] : []) });

// Generic set diff on string keys.
const diff = (a: Iterable<string>, b: Iterable<string>) => {
  const sa = new Set(a), sb = new Set(b);
  return { missing: [...sa].filter((x) => !sb.has(x)), extra: [...sb].filter((x) => !sa.has(x)) };
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company in DB');
  const c = company.id;

  // ── 1. Value streams ──────────────────────────────────────────────────
  {
    const db = await prisma.valueStream.findMany({ where: { companyId: c }, select: { name: true, domain: true } });
    const d = diff(spine.valueStreams.map((v: any) => v.name), db.map((v) => v.name));
    const domMismatch = spine.valueStreams
      .filter((v: any) => db.find((x) => x.name === v.name) && db.find((x) => x.name === v.name)!.domain !== v.domain)
      .map((v: any) => `${v.name}: workbook="${v.domain}" db="${db.find((x) => x.name === v.name)!.domain}"`);
    report('Value streams', !d.missing.length && !d.extra.length && !domMismatch.length,
      `workbook ${spine.valueStreams.length} vs db ${db.length} — missing ${d.missing.length}, extra ${d.extra.length}, domain mismatches ${domMismatch.length}`,
      [...d.missing.map((x) => `MISSING in db: ${x}`), ...d.extra.map((x) => `EXTRA in db: ${x}`), ...domMismatch]);
  }

  // ── 2. Roles ──────────────────────────────────────────────────────────
  {
    const db = await prisma.role.findMany({ where: { companyId: c }, select: { name: true } });
    const d = diff(spine.roles.map((r: any) => r.name), db.map((r) => r.name));
    report('Roles', !d.missing.length && !d.extra.length,
      `workbook ${spine.roles.length} vs db ${db.length} — missing ${d.missing.length}, extra ${d.extra.length}`,
      [...d.missing.map((x) => `MISSING in db: ${x}`), ...d.extra.map((x) => `EXTRA in db: ${x}`)]);
  }

  // ── 3. Role ↔ value-stream participation ─────────────────────────────
  {
    const db = await prisma.roleValueStream.findMany({
      where: { valueStream: { companyId: c } },
      select: { participationType: true, subStream: true, role: { select: { name: true } }, valueStream: { select: { name: true } } },
    });
    const key = (r: string, v: string, s: string | null, p: string) => `${r} ⇄ ${v} [${s ?? '-'}] (${p})`;
    const d = diff(
      spine.roleValueStreams.map((x: any) => key(x.roleName, x.valueStreamName, x.subStream, x.participationType)),
      db.map((x) => key(x.role.name, x.valueStream.name, x.subStream, x.participationType)),
    );
    report('Role participation (RoleValueStream)', !d.missing.length && !d.extra.length,
      `workbook ${spine.roleValueStreams.length} vs db ${db.length} — missing ${d.missing.length}, extra ${d.extra.length}`,
      [...d.missing.map((x) => `MISSING in db: ${x}`), ...d.extra.map((x) => `EXTRA in db: ${x}`)]);
  }

  // ── 4. L4 sub-processes (SubValueStream levels 3+4) ──────────────────
  {
    const db = await prisma.subValueStream.findMany({
      where: { valueStream: { companyId: c } },
      select: { level: true, name: true, valueStream: { select: { name: true } }, parent: { select: { name: true } } },
    });
    const dbL4 = db.filter((x) => x.level === 4).map((x) => `${x.valueStream.name} › ${x.parent?.name ?? '-'} › ${x.name}`);
    const wbL4 = spine.subValueStreams.map((s: any) => `${s.valueStreamName} › ${s.l3 ?? '-'} › ${s.l4}`);
    const d4 = diff(wbL4, dbL4);
    const dbL3 = db.filter((x) => x.level === 3).map((x) => `${x.valueStream.name} › ${x.name}`);
    const wbL3 = [...new Set<string>(spine.subValueStreams.filter((s: any) => s.l3).map((s: any) => `${s.valueStreamName} › ${s.l3}`))];
    const d3 = diff(wbL3, dbL3);
    report('L4 Process Master (SubValueStream)', !d4.missing.length && !d4.extra.length && !d3.missing.length && !d3.extra.length,
      `L4: workbook ${wbL4.length} vs db ${dbL4.length} (missing ${d4.missing.length}, extra ${d4.extra.length}); L3: workbook ${wbL3.length} vs db ${dbL3.length} (missing ${d3.missing.length}, extra ${d3.extra.length})`,
      [...d4.missing.map((x) => `L4 MISSING in db: ${x}`), ...d4.extra.map((x) => `L4 EXTRA in db: ${x}`),
       ...d3.missing.map((x) => `L3 MISSING in db: ${x}`), ...d3.extra.map((x) => `L3 EXTRA in db: ${x}`)]);
  }

  // ── 5. L5 process steps (ProcessStep) — keys + field content ─────────
  {
    const db = await prisma.processStep.findMany({
      where: { valueStream: { companyId: c } },
      select: { l3: true, l4: true, stepNumber: true, name: true, description: true, leads: true, supporting: true, inputs: true, outputs: true, externalParticipants: true, valueStream: { select: { name: true } } },
    });
    const key = (vs: string, l4: string | null, n: number, name: string) => `${vs} › ${l4 ?? '-'} › #${n} ${name}`;
    const wbMap = new Map<string, any>(spine.processSteps.map((s: any) => [key(s.valueStreamName, s.l4, s.stepNumber, s.name), s]));
    const dbMap = new Map<string, any>(db.map((s) => [key(s.valueStream.name, s.l4, s.stepNumber, s.name), s]));
    const d = diff(wbMap.keys(), dbMap.keys());
    const changed: string[] = [];
    for (const [k, w] of wbMap) {
      const x = dbMap.get(k); if (!x) continue;
      const fields: [string, any, any][] = [['leads', w.leads, x.leads], ['supporting', w.supporting, x.supporting], ['inputs', w.inputs, x.inputs], ['outputs', w.outputs, x.outputs], ['description', w.description, x.description], ['externalParticipants', w.externalParticipants, x.externalParticipants]];
      const diffs = fields.filter(([, a, b]) => str(a) !== str(b)).map(([f]) => f);
      if (diffs.length) changed.push(`${k} → ${diffs.join(', ')}`);
    }
    report('L5 Process Steps (ProcessStep)', !d.missing.length && !d.extra.length && !changed.length,
      `workbook ${wbMap.size} vs db ${dbMap.size} — missing ${d.missing.length}, extra ${d.extra.length}, field-changed ${changed.length}`,
      [...d.missing.map((x) => `MISSING in db: ${x}`), ...d.extra.map((x) => `EXTRA in db: ${x}`), ...changed.map((x) => `CHANGED: ${x}`)]);
  }

  // ── 6. Inputs & outputs (IoItem) ──────────────────────────────────────
  {
    const db = await prisma.ioItem.findMany({
      where: { valueStream: { companyId: c } },
      select: { l3: true, l4: true, type: true, name: true, keyRoles: true, dataElements: true, valueStream: { select: { name: true } } },
    });
    const key = (vs: string, l4: string | null, t: string, name: string) => `${vs} › ${l4 ?? '-'} › [${t}] ${name}`;
    // Both sides can hold duplicate keys (same item name twice in a stream) — compare as multisets.
    const count = (keys: string[]) => { const m = new Map<string, number>(); for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1); return m; };
    const wbm = count(spine.ioItems.map((s: any) => key(s.valueStreamName, s.l4, s.type, s.name)));
    const dbm = count(db.map((s) => key(s.valueStream.name, s.l4, s.type, s.name)));
    const missing: string[] = [], extra: string[] = [];
    for (const [k, n] of wbm) { const m = dbm.get(k) ?? 0; if (m < n) missing.push(`${k}${n > 1 ? ` ×${n - m}` : ''}`); }
    for (const [k, n] of dbm) { const m = wbm.get(k) ?? 0; if (m < n) extra.push(`${k}${n > 1 ? ` ×${n - m}` : ''}`); }
    report('Inputs & Outputs Inventory (IoItem)', !missing.length && !extra.length,
      `workbook ${spine.ioItems.length} vs db ${db.length} — missing ${missing.length}, extra ${extra.length}`,
      [...missing.map((x) => `MISSING in db: ${x}`), ...extra.map((x) => `EXTRA in db: ${x}`)]);
  }

  // ── 7. Metrics ────────────────────────────────────────────────────────
  {
    const db = await prisma.metric.findMany({ where: { companyId: c }, select: { name: true, valueStream: { select: { name: true } } } });
    const d = diff(
      spine.metrics.map((m: any) => `${m.valueStreamName} › ${m.name}`),
      db.map((m) => `${m.valueStream?.name ?? '-'} › ${m.name}`),
    );
    report('Value Stream Metrics (Metric)', !d.missing.length && !d.extra.length,
      `workbook ${spine.metrics.length} vs db ${db.length} — missing ${d.missing.length}, extra ${d.extra.length}`,
      [...d.missing.map((x) => `MISSING in db: ${x}`), ...d.extra.map((x) => `EXTRA in db: ${x}`)]);
  }

  // ── 8/9. Checklist items + role tasks (per-role counts) ──────────────
  for (const [section, wbRows, table] of [
    ['Items (ChecklistItem)', spine.checklistItems, 'checklistItem'],
    ['Aligned Role Tasks (RoleTask)', spine.roleTasks, 'roleTask'],
  ] as const) {
    const db: { name: string; n: bigint }[] = await prisma.$queryRawUnsafe(
      `SELECT r.name, COUNT(*)::int AS n FROM public."${table === 'checklistItem' ? 'ChecklistItem' : 'RoleTask'}" t JOIN public."Role" r ON r.id = t."roleId" GROUP BY r.name`,
    );
    const wbCount = new Map<string, number>();
    for (const r of wbRows as any[]) wbCount.set(r.roleName, (wbCount.get(r.roleName) ?? 0) + 1);
    const detail: string[] = [];
    for (const [role, n] of wbCount) { const m = Number(db.find((x) => x.name === role)?.n ?? 0); if (m !== n) detail.push(`${role}: workbook ${n} vs db ${m}`); }
    for (const x of db) if (!wbCount.has(x.name)) detail.push(`${x.name}: workbook 0 vs db ${x.n}`);
    const wbTotal = (wbRows as any[]).length, dbTotal = db.reduce((a, x) => a + Number(x.n), 0);
    report(section, wbTotal === dbTotal && !detail.length, `workbook ${wbTotal} vs db ${dbTotal} — roles off: ${detail.length}`, detail);
  }

  // ── 10. Level tree (drives Home + Value Streams tab counts) ──────────
  {
    const lv = await prisma.level.groupBy({ by: ['levelNumber'], where: { companyId: c }, _count: true });
    const n = (k: number) => lv.find((x) => x.levelNumber === k)?._count ?? 0;
    const wbStreams = spine.valueStreams.length, wbL4 = spine.subValueStreams.length, wbL5 = spine.l5Steps.length;
    const ok = n(3) === wbStreams && n(4) === wbL4 && n(5) === wbL5;
    report('Level tree (L3/L4/L5)', ok,
      `db L3=${n(3)} L4=${n(4)} L5=${n(5)} vs workbook streams=${wbStreams} L4=${wbL4} L5=${wbL5}`,
      ok ? [] : ['Level tree is built from the ARCHIVED v16 E2E sheet (import-levels.ts) — needs rebuild from L4 Process Master + L5 Process Steps.']);
  }

  // ── 11. Cap – Application Catalog ─────────────────────────────────────
  {
    const g = grid('Cap – Application Catalog'); // header row 2 (grid), data 3+
    const apps: { code: string; name: string; sor: boolean }[] = [];
    for (let i = 0; i < g.length; i++) {
      const code = str(g[i][0]);
      if (!/^APP-\d+$/.test(code)) continue;
      apps.push({ code, name: str(g[i][1]), sor: /yes/i.test(str(g[i][5])) });
    }
    const db = await prisma.application.findMany({ where: { companyId: c }, select: { name: true } });
    const d = diff(apps.map((a) => a.name), db.map((a) => a.name));
    report('Cap – Application Catalog (Application)', !d.missing.length,
      `workbook ${apps.length} vs db ${db.length} — missing ${d.missing.length}, db-only ${d.extra.length} (db-only rows are pre-existing illustrative apps; kept)`,
      [...d.missing.map((x) => `MISSING in db: ${x}`), ...d.extra.map((x) => `db-only: ${x}`)]);
  }

  // ── 12. Cap – People (roles covered, capacity fields) ─────────────────
  {
    const g = grid('Cap – People');
    const capRoles = new Map<string, number>();
    for (let i = 0; i < g.length; i++) {
      if (!/^P-\d+$/.test(str(g[i][0]))) continue;
      const role = str(g[i][2]);
      if (role) capRoles.set(role, (capRoles.get(role) ?? 0) + 1);
    }
    const dbRoles = await prisma.role.findMany({ where: { companyId: c }, select: { name: true, assignments: { select: { personId: true } } } });
    const byName = new Map(dbRoles.map((r) => [r.name, r] as const));
    const noRole: string[] = [], noPerson: string[] = [];
    for (const role of capRoles.keys()) {
      const r = byName.get(role);
      if (!r) { noRole.push(role); continue; }
      if (!r.assignments.length) noPerson.push(role);
    }
    report('Cap – People (role coverage)', !noRole.length && !noPerson.length,
      `cap rows ${[...capRoles.values()].reduce((a, b) => a + b, 0)} across ${capRoles.size} roles — unknown roles ${noRole.length}, roles with no assigned person ${noPerson.length}`,
      [...noRole.map((x) => `Cap role not in db: ${x}`), ...noPerson.map((x) => `No person assigned: ${x}`)]);
  }

  // ── 13. Cap bridge sheets vs step-lens tables ─────────────────────────
  {
    const usage = grid('Cap – App Usage by Step').filter((r) => /^U-\d+$/.test(str(r[0]))).length;
    const deliv = grid('Cap – Deliverables & Approvals').filter((r) => /^D-\d+$/.test(str(r[0]))).length;
    const tables: { table_name: string }[] = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('StepAppUsage','StepDeliverable')`);
    const have = new Set(tables.map((t) => t.table_name));
    let usageDb = -1, delivDb = -1;
    if (have.has('StepAppUsage')) usageDb = Number((await prisma.$queryRawUnsafe<{ n: number }[]>('SELECT COUNT(*)::int n FROM public."StepAppUsage"'))[0].n);
    if (have.has('StepDeliverable')) delivDb = Number((await prisma.$queryRawUnsafe<{ n: number }[]>('SELECT COUNT(*)::int n FROM public."StepDeliverable"'))[0].n);
    const ok = have.size === 2 && usageDb >= usage && delivDb >= deliv;
    report('Cap – App Usage / Deliverables bridges', ok,
      `workbook real rows: usage ${usage}, deliverables ${deliv}; db: ${have.has('StepAppUsage') ? `StepAppUsage ${usageDb}` : 'StepAppUsage table MISSING'}, ${have.has('StepDeliverable') ? `StepDeliverable ${delivDb}` : 'StepDeliverable table MISSING'}`,
      ok ? [] : ['Step-lens tables/import pending (plan phases 2–3).']);
  }

  // ── Write report ──────────────────────────────────────────────────────
  const failed = findings.filter((f) => !f.ok);
  const lines: string[] = [
    '# Bridge Input ↔ Database Audit',
    '',
    `Workbook: \`${WORKBOOK.split(/[\\/]/).pop()}\` · Spine: \`backend/data/seed/spine.json\` · Generated: ${new Date().toISOString().slice(0, 16)}Z`,
    `Company: ${company.name} · Result: **${failed.length ? `${failed.length}/${findings.length} sections FAIL` : `all ${findings.length} sections PASS`}**`,
    '',
    '| # | Section | Status | Summary |',
    '|---|---------|--------|---------|',
    ...findings.map((f, i) => `| ${i + 1} | ${f.section} | ${f.ok ? '✅ PASS' : '❌ FAIL'} | ${f.summary} |`),
    '',
  ];
  for (const f of findings.filter((x) => x.detail.length)) {
    lines.push(`## ${f.section} — ${f.ok ? 'PASS' : 'FAIL'}`, '', f.summary, '', ...f.detail.map((d) => `- ${d}`), '');
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join('\n'));
  console.log(`Audit written to ${OUT}`);
  console.table(findings.map((f) => ({ section: f.section, status: f.ok ? 'PASS' : 'FAIL', summary: f.summary.slice(0, 80) })));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
