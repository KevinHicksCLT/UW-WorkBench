import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

// Defect backlog 02, D9.4 — "internal owners seem too high level". Report the
// distribution of internal owner roles on ExternalInteraction rows, flagging
// C-suite/chief-level owners where a more operational role likely exists.

async function main() {
  const rows = await prisma.externalInteraction.findMany({
    select: { id: true, externalRole: true, internalRoleOwner: true, internalRole: { select: { name: true } }, relatedValueStream: true },
  });
  console.log(`External interactions: ${rows.length}`);
  const byOwner = new Map<string, number>();
  for (const r of rows) {
    const owner = r.internalRole?.name ?? r.internalRoleOwner ?? '(none)';
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + 1);
  }
  const sorted = [...byOwner.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\nOwner distribution:');
  for (const [o, n] of sorted) console.log(`  ${String(n).padStart(3)}  ${o}`);
  const highLevel = /chief|ciso|cfo|coo|cto|cro|chro|general counsel|head of|director|vp\b/i;
  const flagged = sorted.filter(([o]) => highLevel.test(o));
  console.log(`\nHigh-level owners: ${flagged.reduce((a, [, n]) => a + n, 0)} of ${rows.length} rows across ${flagged.length} owner names`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
