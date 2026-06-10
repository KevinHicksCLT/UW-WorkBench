// Per-mode adoption statistics for the Active AI drill-in (defect: the stream
// drill-down's "roles using %" / "efficiency gain" were code-derived). Adds
// NodeAiAdoption.stats (JSON: { <mode>: { rolesUsingPct, efficiencyGainPct } })
// and seeds it from the formerly hardcoded derivations so the displayed numbers
// carry over 1:1 — from here on they're data, edited in Data Admin → Telemetry →
// AI adoption. Additive raw SQL (DB has drift; prisma db push forbidden). Idempotent.
import { prisma } from '../src/db/prisma.js';

const MODE_KEYS = ['assistant', 'augmented', 'workflow', 'agent'] as const;
const LEVELS = ['not_used', 'pilot', 'emerging', 'scaling', 'embedded'];

// The retired frontend derivations, ported verbatim so seeded numbers match
// what the page used to show.
const SHARE = [0, 0.12, 0.35, 0.6, 0.85];
const EFF_BASE = [0, 9, 14, 21, 29];
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function rolesUsingPct(level: number, roleCount: number): number {
  if (level <= 0 || roleCount <= 0) return 0;
  const count = Math.min(roleCount, Math.max(1, Math.round(roleCount * SHARE[level])));
  return Math.round((100 * count) / roleCount);
}
function efficiencyGainPct(streamName: string, modeKey: string, level: number): number {
  if (level <= 0) return 0;
  return EFF_BASE[level] + (hash(streamName + ':' + modeKey) % 6);
}

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "NodeAiAdoption" ADD COLUMN IF NOT EXISTS stats jsonb`);

  const rows = await prisma.nodeAiAdoption.findMany({
    include: { node: { select: { id: true, name: true, code: true, companyId: true } } },
  });
  let seeded = 0, kept = 0;
  for (const r of rows) {
    if (r.stats != null) { kept++; continue; }
    // Participating-role count = the stream's RoleValueStream links (what the
    // drill-in counts against).
    const roleCount = r.node.code
      ? (await prisma.roleValueStream.groupBy({ by: ['roleId'], where: { valueStreamId: r.node.code } })).length
      : 0;
    const levels = [r.aiAssist, r.aiAugment, r.aiWorkflow, r.aiAutonomous].map((v) => Math.max(0, LEVELS.indexOf(v)));
    const stats = Object.fromEntries(MODE_KEYS.map((k, i) => [k, {
      rolesUsingPct: rolesUsingPct(levels[i], roleCount),
      efficiencyGainPct: efficiencyGainPct(r.node.name, k, levels[i]),
    }]));
    await prisma.nodeAiAdoption.update({ where: { id: r.id }, data: { stats } });
    seeded++;
  }
  console.log(`adoption stats: seeded ${seeded}, kept existing ${kept}, total ${rows.length}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
