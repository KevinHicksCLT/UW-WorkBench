// apply-ai-scores.ts — apply the AI-native 1-5 re-score to ProcessNode.automatability
// and sync NodeAiAdoption to match. 1→autonomous,2→workflow,3→augmented,4→assist,5→manual.
// NodeAiAdoption (per L5): which AI modes are viable given the task's tier —
//   assist viable if score<=4, augment <=3, workflow <=2, autonomous ==1.
// Run (cwd=backend): npx tsx scripts/apply-ai-scores.ts
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/db/prisma.js';

const D = 'C:/Users/xando/AppData/Local/Temp/claude/C--Users-xando-Code-transform-platform/af846a15-b100-4a71-bef2-36c56f98f942/scratchpad/score2';
const TOKEN: Record<number, string> = { 1: 'autonomous', 2: 'workflow', 3: 'augmented', 4: 'assist', 5: 'manual' };
const chunk = <T>(a: T[], n = 1000) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function main() {
  const co = await prisma.company.findFirst({ select: { id: true } }); if (!co) throw new Error('no company');
  const c = co.id;
  const plt = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
  const L5 = plt.find((x) => x.levelNumber === 5)!.id;

  // ground-truth ids
  const batchIds = new Set<string>();
  for (const f of fs.readdirSync(D).filter((x) => /^batch_\d+\.json$/.test(x)))
    for (const r of JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'))) batchIds.add(r.id);
  // scores
  const score = new Map<string, number>();
  for (const f of fs.readdirSync(D).filter((x) => /^scores_\d+\.json$/.test(x))) {
    let txt = fs.readFileSync(path.join(D, f), 'utf8').trim().replace(/^```(json)?/, '').replace(/```$/, '').trim();
    let o: Record<string, any>; try { o = JSON.parse(txt); } catch { console.log('parse fail', f); continue; }
    for (const [id, v] of Object.entries(o)) { const n = Math.round(Number(v)); if (n >= 1 && n <= 5) score.set(id, n); }
  }
  console.log('batch ids', batchIds.size, '| scored', score.size);

  // apply automatability by token
  const byTok: Record<string, string[]> = { autonomous: [], workflow: [], augmented: [], assist: [], manual: [] };
  for (const [id, n] of score) if (batchIds.has(id)) byTok[TOKEN[n]].push(id);
  for (const t of Object.keys(byTok)) for (const b of chunk(byTok[t])) await prisma.processNode.updateMany({ where: { id: { in: b } }, data: { automatability: t } });

  // straggler fill by L4-modal numeric
  const nodes = await prisma.processNode.findMany({ where: { companyId: c }, select: { id: true, parentId: true, processLevelTypeId: true, automatability: true } });
  const l5 = nodes.filter((n) => n.processLevelTypeId === L5);
  const TOKNUM: Record<string, number> = { autonomous: 1, workflow: 2, augmented: 3, assist: 4, manual: 5 };
  const l4mode = new Map<string, Record<number, number>>();
  for (const n of l5) { if (!n.automatability) continue; const m = l4mode.get(n.parentId!) ?? {}; const k = TOKNUM[n.automatability]; m[k] = (m[k] || 0) + 1; l4mode.set(n.parentId!, m); }
  const modeNum = (l4: string) => { const m = l4mode.get(l4); if (!m) return 3; return Number(Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]); };
  const fill: Record<string, string[]> = { autonomous: [], workflow: [], augmented: [], assist: [], manual: [] };
  for (const n of l5) if (!n.automatability) fill[TOKEN[modeNum(n.parentId!)]].push(n.id);
  for (const t of Object.keys(fill)) if (fill[t].length) for (const b of chunk(fill[t])) await prisma.processNode.updateMany({ where: { id: { in: b } }, data: { automatability: t } });

  // ── sync NodeAiAdoption ──────────────────────────────────────────────────────
  const fresh = await prisma.processNode.findMany({ where: { companyId: c, processLevelTypeId: L5 }, select: { id: true, automatability: true } });
  const ids = fresh.map((n) => n.id);
  // wipe + rebuild adoption for these nodes
  for (const b of chunk(ids)) await prisma.nodeAiAdoption.deleteMany({ where: { processNodeId: { in: b } } });
  const lvl = (on: boolean, mature: boolean) => (on ? (mature ? 'embedded' : 'scaling') : 'not_used');
  const rows = fresh.map((n) => {
    const s = TOKNUM[n.automatability ?? 'augmented'] ?? 3;
    return {
      id: randomUUID(), processNodeId: n.id,
      aiAssist: lvl(s <= 4, true),       // lower-autonomy AI: embedded where viable
      aiAugment: lvl(s <= 3, true),
      aiWorkflow: lvl(s <= 2, false),    // higher-autonomy: scaling (emerging)
      aiAutonomous: lvl(s === 1, false),
    };
  });
  for (const b of chunk(rows)) await prisma.nodeAiAdoption.createMany({ data: b, skipDuplicates: true });

  // report
  const g = await prisma.processNode.groupBy({ by: ['automatability'], where: { companyId: c, processLevelTypeId: L5 }, _count: true });
  const dist = Object.fromEntries(g.map((x) => [x.automatability, x._count]));
  const auto = (dist['autonomous'] ?? 0) + (dist['workflow'] ?? 0);
  console.log('automatability:', dist);
  console.log(`automatable (score<=2): ${auto} / ${fresh.length} = ${Math.round(100 * auto / fresh.length)}%`);
  const adopt = await prisma.nodeAiAdoption.count({ where: { processNode: { companyId: c, processLevelTypeId: L5 } } });
  console.log('NodeAiAdoption rows:', adopt, '| null automatability:', fresh.filter((n) => !n.automatability).length);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
