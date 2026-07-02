// apply-reg-decisions.ts — write the subagent-produced atomic-regulation decisions
// back to the DB, mirroring enrich-regulations.ts's write logic exactly (only the
// AI call is replaced by reading decisions-chunk-*.json).
//
// Per source requirement:
//   • 1 atom  → update the source row in place + wire links
//   • >1 atom → create ACTIVE children (sourceNote=derivedFrom:<id>), wire each,
//               mark the source SUPERSEDED + supersededById=firstChild
// Links: RoleRegulation (Owner/Contributor) + NodeRegulation (GOVERNS). Owner never
// also a contributor. Idempotent: skips a source that already has role links.
//
// Run (cwd = backend):
//   npx tsx scripts/apply-reg-decisions.ts --dir <dir> --dry-run
//   npx tsx scripts/apply-reg-decisions.ts --dir <dir>
import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = '') => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DIR = opt('dir'); if (!DIR) throw new Error('provide --dir <dir>');
const DRY = flag('dry-run');

type Atom = { title: string; description: string; category: string; obligationType: string; frequency: string | null; regime: string | null; ownerRef: number; contributorRefs: number[]; nodeRefs: number[] };
type Decision = { sourceId: string; atoms: Atom[] };

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  const cid = company!.id;

  const roles: { id: string; displayValue: string }[] = JSON.parse(readFileSync(join(DIR, 'roles.json'), 'utf8'));
  const nodes: { id: string; label: string }[] = JSON.parse(readFileSync(join(DIR, 'nodes.json'), 'utf8'));
  const sourcesFull: any[] = JSON.parse(readFileSync(join(DIR, 'sources-full.json'), 'utf8'));
  const srcById = new Map(sourcesFull.map((s) => [s.id, s]));
  const roleAt = (ref: number) => roles[ref - 1]?.id ?? null;
  const nodeAt = (ref: number) => nodes[ref - 1]?.id ?? null;

  // Load all decision files
  const files = readdirSync(DIR).filter((f) => /^decisions-chunk-\d+\.json$/.test(f)).sort();
  const decisions: Decision[] = [];
  for (const f of files) decisions.push(...JSON.parse(readFileSync(join(DIR, f), 'utf8')));
  console.log(`company: ${company!.name}  decision files: ${files.length}  decisions: ${decisions.length}  ${DRY ? '[DRY RUN]' : ''}`);

  // Pre-flight: every decision must map to a known unprocessed source; report coverage.
  const decIds = new Set(decisions.map((d) => d.sourceId));
  const missingSource = [...decIds].filter((id) => !srcById.has(id));
  const uncovered = sourcesFull.filter((s) => !decIds.has(s.id)).map((s) => s.id);
  if (missingSource.length) console.warn(`WARN ${missingSource.length} decision sourceIds not in export (skipped): ${missingSource.slice(0, 5).join(', ')}`);
  if (uncovered.length) console.warn(`WARN ${uncovered.length} exported sources have NO decision: ${uncovered.slice(0, 5).join(', ')}`);

  const unresolvedRole = new Set<number>(), unresolvedNode = new Set<number>();
  let inPlace = 0, split = 0, atomsCreated = 0, roleLinks = 0, nodeLinks = 0, skipped = 0, badCat = 0;
  const CATS = new Set(['PRODUCT_FILING','LICENSING','PREMIUM_TAX','SURPLUS_LINES','WORKERS_COMP_REPORTING','AUTO_VERIFICATION','APCD_REPORTING','FINANCIAL_REPORTING','MARKET_CONDUCT','DATA_CALL','CYBERSECURITY','DATA_PRIVACY','OTHER']);

  const resolveLinks = (a: Atom) => {
    const ownerId = roleAt(a.ownerRef); if (!ownerId) unresolvedRole.add(a.ownerRef);
    const contribs = (a.contributorRefs ?? []).map((r) => { const id = roleAt(r); if (!id) unresolvedRole.add(r); return id; }).filter((x): x is string => !!x);
    const nodeIds = [...new Set((a.nodeRefs ?? []).map((n) => { const id = nodeAt(n); if (!id) unresolvedNode.add(n); return id; }).filter((x): x is string => !!x))];
    const contribIds = [...new Set(contribs)].filter((id) => id !== ownerId);
    return { ownerId, contribIds, nodeIds };
  };

  for (const d of decisions) {
    const src = srcById.get(d.sourceId);
    if (!src) continue;
    const atoms = (d.atoms ?? []).filter((a) => a.title && a.description);
    if (!atoms.length) { console.warn(`  no atoms for ${src.title}`); continue; }
    for (const a of atoms) if (!CATS.has(a.category)) { badCat++; a.category = 'OTHER'; }

    if (DRY) {
      atoms.forEach(resolveLinks);
      if (atoms.length === 1) inPlace++; else { split++; atomsCreated += atoms.length; }
      continue;
    }

    // Idempotency: if this source already has role links, assume applied — skip.
    const existing = await prisma.roleRegulation.count({ where: { regId: src.id } });
    if (existing > 0) { skipped++; continue; }

    const wire = async (tx: any, regId: string, a: Atom) => {
      const { ownerId, contribIds, nodeIds } = resolveLinks(a);
      if (ownerId) { await tx.roleRegulation.upsert({ where: { roleId_regId_role_: { roleId: ownerId, regId, role_: 'Owner' } }, create: { companyId: cid, roleId: ownerId, regId, role_: 'Owner' }, update: {} }); roleLinks++; }
      for (const rid of contribIds) { await tx.roleRegulation.upsert({ where: { roleId_regId_role_: { roleId: rid, regId, role_: 'Contributor' } }, create: { companyId: cid, roleId: rid, regId, role_: 'Contributor' }, update: {} }); roleLinks++; }
      for (const nid of nodeIds) { await tx.nodeRegulation.upsert({ where: { processNodeId_regId: { processNodeId: nid, regId } }, create: { companyId: cid, processNodeId: nid, regId, relationship: 'GOVERNS' }, update: {} }); nodeLinks++; }
    };

    await prisma.$transaction(async (tx) => {
      if (atoms.length === 1) {
        const a = atoms[0];
        await tx.regulatoryRequirement.update({ where: { id: src.id }, data: { title: a.title, requirement: a.description, category: a.category, obligationType: a.obligationType, frequency: a.frequency ?? null, regime: a.regime ?? null } });
        await wire(tx, src.id, a);
        inPlace++;
      } else {
        let firstChildId: string | null = null;
        for (const a of atoms) {
          const child = await tx.regulatoryRequirement.create({
            data: {
              tenantId: src.tenantId, companyId: cid, jurisdictionId: src.jurisdictionId,
              category: a.category, title: a.title, requirement: a.description,
              lineOfBusiness: src.lineOfBusiness, citation: src.citation, citationUrl: src.citationUrl,
              obligationType: a.obligationType, frequency: a.frequency ?? null,
              status: 'ACTIVE', regime: a.regime ?? null, agentSkill: src.agentSkill, confidence: src.confidence,
              sourceNote: `derivedFrom:${src.id}`,
            },
          });
          if (!firstChildId) firstChildId = child.id;
          await wire(tx, child.id, a);
          atomsCreated++;
        }
        await tx.regulatoryRequirement.update({ where: { id: src.id }, data: { status: 'SUPERSEDED', supersededById: firstChildId } });
        split++;
      }
    });
  }

  console.log(`\n${DRY ? '[DRY] would ' : ''}DONE: ${inPlace} kept-atomic · ${split} split into ${atomsCreated} children · ${roleLinks} role links · ${nodeLinks} VS links · ${skipped} skipped(already) · ${badCat} category→OTHER`);
  if (unresolvedRole.size) console.log(`unresolved roleRefs (${unresolvedRole.size}): ${[...unresolvedRole].slice(0, 40).join(', ')}`);
  if (unresolvedNode.size) console.log(`unresolved nodeRefs (${unresolvedNode.size}): ${[...unresolvedNode].slice(0, 40).join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
