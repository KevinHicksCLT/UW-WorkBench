// P4 — backfill NodeLink edges (operating-model rework). Turns the legacy junctions
// and the FREE-TEXT role references into real node↔node edges. Resolves names → node
// ids; every unmatched reference is LOGGED, never guessed. Idempotent: wipes+rebuilds
// this company's NodeLinks + external_party nodes. Run AFTER backfill-nodes.ts.
// See docs/operating-model-architecture.md.
import { prisma } from '../src/db/prisma.js';
import { canonicalVs } from './vs-mapping.js';

// Split a free-text role field into candidate role names.
function parseRoles(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(/[;,/\n]|·| and /i).map((x) => x.trim()).filter((x) => x.length > 1);
}

async function main() {
  for (const company of await prisma.company.findMany({ select: { id: true, name: true } })) {
    const companyId = company.id;
    const nodes = await prisma.node.findMany({ where: { companyId }, select: { id: true, typeKey: true, name: true, code: true, attributes: true } });
    const roleNodes = nodes.filter((n) => n.typeKey === 'role');
    const vsNodes = nodes.filter((n) => n.typeKey === 'value_stream');
    const stepNodes = nodes.filter((n) => n.typeKey === 'step');
    const ioNodes = nodes.filter((n) => n.typeKey === 'io_item');

    const roleByLegacyId = new Map(roleNodes.filter((n) => n.code).map((n) => [n.code!, n.id]));
    const roleByName = new Map<string, string>();
    for (const r of roleNodes) if (!roleByName.has(r.name)) roleByName.set(r.name, r.id);
    const vsByName = new Map(vsNodes.map((n) => [n.name, n.id]));

    // Rebuild: drop this company's links + the external_party nodes (created here).
    await prisma.nodeLink.deleteMany({ where: { companyId } });
    await prisma.node.deleteMany({ where: { companyId, typeKey: 'external_party' } });

    const links: { fromId: string; toId: string; relationType: string; attributes?: any }[] = [];
    const log = { rvs: 0, rvsUnmatched: 0, leadsSup: 0, leadsSupUnmatched: 0, keyRoles: 0, keyRolesUnmatched: 0, mgr: 0, ext: 0 };

    // (a) RoleValueStream → PARTICIPATES_IN  (legacy VS id → name → canonical VS node)
    const vsLegacy = await prisma.valueStream.findMany({ where: { companyId }, select: { id: true, name: true } });
    const vsLegacyName = new Map(vsLegacy.map((v) => [v.id, v.name]));
    for (const r of await prisma.roleValueStream.findMany({ where: { valueStream: { companyId } }, select: { roleId: true, valueStreamId: true, participationType: true } })) {
      const from = roleByLegacyId.get(r.roleId);
      const to = vsByName.get(canonicalVs(vsLegacyName.get(r.valueStreamId) ?? ''));
      if (from && to) { links.push({ fromId: from, toId: to, relationType: 'PARTICIPATES_IN', attributes: { participationType: r.participationType } }); log.rvs++; }
      else log.rvsUnmatched++;
    }

    // (b) step leads/supporting (free-text) → LEADS / SUPPORTS
    for (const s of stepNodes) {
      const a = (s.attributes as any) ?? {};
      for (const [field, rel] of [['leads', 'LEADS'], ['supporting', 'SUPPORTS']] as const) {
        for (const rn of parseRoles(a[field])) {
          const from = roleByName.get(rn);
          if (from) { links.push({ fromId: from, toId: s.id, relationType: rel }); log.leadsSup++; }
          else log.leadsSupUnmatched++;
        }
      }
    }

    // (c) io_item keyRoles (free-text) → OWNS
    for (const io of ioNodes) {
      for (const rn of parseRoles(((io.attributes as any) ?? {}).keyRoles)) {
        const from = roleByName.get(rn);
        if (from) { links.push({ fromId: from, toId: io.id, relationType: 'OWNS' }); log.keyRoles++; }
        else log.keyRolesUnmatched++;
      }
    }

    // (d) Role.managerRoleId → REPORTS_TO
    for (const r of await prisma.role.findMany({ where: { companyId, managerRoleId: { not: null } }, select: { id: true, managerRoleId: true } })) {
      const from = roleByLegacyId.get(r.id);
      const to = r.managerRoleId ? roleByLegacyId.get(r.managerRoleId) : undefined;
      if (from && to) { links.push({ fromId: from, toId: to, relationType: 'REPORTS_TO' }); log.mgr++; }
    }

    // (e) external parties + INTERACTS_WITH
    const extByName = new Map<string, string>();
    for (const e of await prisma.externalInteraction.findMany({ where: { companyId }, select: { externalRole: true, partyType: true, internalRoleId: true, interactionType: true, inputs: true, outputs: true, frequency: true } })) {
      if (!e.externalRole) continue;
      let extId = extByName.get(e.externalRole);
      if (!extId) {
        const n = await prisma.node.create({ data: { companyId, typeKey: 'external_party', name: e.externalRole, provenance: 'illustrative', attributes: { partyType: e.partyType } } });
        extId = n.id; extByName.set(e.externalRole, extId);
      }
      const from = e.internalRoleId ? roleByLegacyId.get(e.internalRoleId) : undefined;
      if (from) { links.push({ fromId: from, toId: extId, relationType: 'INTERACTS_WITH', attributes: { interactionType: e.interactionType, inputs: e.inputs, outputs: e.outputs, frequency: e.frequency } }); log.ext++; }
    }

    // de-dupe + insert
    const seen = new Set<string>();
    const unique = links.filter((l) => { const k = `${l.fromId}|${l.toId}|${l.relationType}`; if (seen.has(k)) return false; seen.add(k); return true; });
    await prisma.nodeLink.createMany({ data: unique.map((l) => ({ companyId, fromId: l.fromId, toId: l.toId, relationType: l.relationType, attributes: l.attributes ?? undefined })), skipDuplicates: true });

    const byType = await prisma.nodeLink.groupBy({ by: ['relationType'], where: { companyId }, _count: { _all: true } });
    console.log(`\n=== ${company.name} ===`);
    console.log(`  external_party nodes: ${extByName.size}`);
    for (const t of byType.sort((x, y) => y._count._all - x._count._all)) console.log(`  ${t.relationType.padEnd(15)} ${t._count._all}`);
    console.log(`  resolved: RVS ${log.rvs} · leads/sup ${log.leadsSup} · keyRoles ${log.keyRoles} · reports-to ${log.mgr} · external ${log.ext}`);
    console.log(`  unmatched (logged, not guessed): RVS ${log.rvsUnmatched} · leads/sup ${log.leadsSupUnmatched} · keyRoles ${log.keyRolesUnmatched}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
