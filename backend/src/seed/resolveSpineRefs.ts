// resolveSpineRefs — the single FK-resolution helper the re-pointed peripheral
// seeders share. Built once per seed run, it maps the free-text operating-model
// references the illustrative seed data carries (value-stream names, division
// names, role names) onto real erd_v5 spine ids:
//
//   • nodeByName(name)           — any ProcessNode by name (lowest level wins on
//                                  a name collision), with a fuzzy token-overlap
//                                  fallback + a curated alias map for the well
//                                  known VS labels the legacy data uses.
//   • nodeByNameLevel(name, lvl) — same, constrained to one level number.
//   • valueStreamNodes           — Map<name, id> of the L2 (value-stream/division)
//                                  ProcessNodes only.
//   • orgUnitByName(name)        — OrgUnit (L2 division) by name, fuzzy fallback.
//   • roleResolver(raw)          — normalize a role token (roleMatch.ts rules:
//                                  lowercase, abbreviation expand, paren-strip,
//                                  "A / B" → first segment) and look it up against
//                                  the company's Roles by dbValue. Miss → null.
//
// Every miss is COUNTED on `resolver.misses` and logged via reportMisses(); it is
// never silently denormalized (the whole point of the no-duplication rebuild).
import type { PrismaClient } from '@prisma/client';
import { buildRoleResolver } from '../lib/roleMatch.js';

const norm = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Curated aliases for the well-known value-stream / division labels the legacy
// illustrative seed data uses, mapped to the canonical v14 node name. Resolved
// before the fuzzy fallback so they land on the intended node, not a token-overlap
// near-miss (e.g. "Data, Analytics & AI Management" must hit "Data & AI", not a
// "Marketing Data Management" L4).
const NODE_ALIASES: Record<string, string> = {
  'data analytics ai management': 'Data & AI',
  'data analytics': 'Data & AI',
  'data analytics and ai management': 'Data & AI',
  'submission to bind underwriting': 'Underwriting',
  'submission to bind': 'Underwriting',
  'claims intake to settlement': 'Claims',
  'claims intake': 'Claims',
  'cybersecurity identity and resilience': 'Cybersecurity & IAM',
  'cybersecurity identity resilience': 'Cybersecurity & IAM',
  cybersecurity: 'Cybersecurity & IAM',
  'finance treasury capital management': 'Finance & Investments',
  'finance treasury and capital management': 'Finance & Investments',
  finance: 'Finance & Investments',
  investment: 'Finance & Investments',
  'investment asset management': 'Finance & Investments',
  'talent workforce management': 'Human Resources & Talent',
  talent: 'Human Resources & Talent',
  'enterprise strategy portfolio management': 'Program Management Office',
  'risk compliance regulatory management': 'Risk, Compliance & Audit',
  'audit assurance': 'Risk, Compliance & Audit',
  'technology delivery': 'Technology & Engineering',
  'technology delivery and change': 'Technology & Engineering',
  'technology strategy architecture and delivery': 'Technology & Engineering',
  'product and proposition management': 'Product & Delivery',
  'product proposition management': 'Product & Delivery',
  'customer service complaints and experience': 'Call Center',
  'customer service': 'Call Center',
  'marketing growth customer insights': 'Sales, Distribution & Marketing',
  marketing: 'Sales, Distribution & Marketing',
  distribution: 'Sales, Distribution & Marketing',
  'distribution channel management': 'Sales, Distribution & Marketing',
  sales: 'Sales, Distribution & Marketing',
  'policy administration servicing': 'Business Operations',
  'policy administration and servicing': 'Business Operations',
  'policy administration': 'Business Operations',
  billing: 'Business Operations',
  reinsurance: 'Reinsurance',
  'reinsurance retrocession management': 'Reinsurance',
  'legal governance and privacy management': 'Legal & Corporate Governance',
  legal: 'Legal & Corporate Governance',
  'service operations': 'Technology & Engineering',
};

export type SpineRefs = Awaited<ReturnType<typeof resolveSpineRefs>>;

export async function resolveSpineRefs(prisma: PrismaClient, companyId: string) {
  const [nodes, levelTypes, orgUnits, roles] = await Promise.all([
    prisma.processNode.findMany({
      where: { companyId },
      select: { id: true, dbValue: true, processLevelTypeId: true },
    }),
    prisma.processLevelType.findMany({
      where: { companyId },
      select: { id: true, levelNumber: true },
    }),
    prisma.orgUnit.findMany({ where: { companyId }, select: { id: true, dbValue: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true, dbValue: true } }),
  ]);

  const levelByType = new Map(levelTypes.map((t) => [t.id, t.levelNumber] as const));
  type N = { id: string; name: string; level: number };
  const allNodes: N[] = nodes.map((n) => ({
    id: n.id,
    name: n.dbValue,
    level: levelByType.get(n.processLevelTypeId) ?? 99,
  }));

  // name(normalized) → node, lowest level wins (L2 VS beats a same-named L5 task).
  const nodeByNorm = new Map<string, N>();
  for (const n of allNodes) {
    const k = norm(n.name);
    const prev = nodeByNorm.get(k);
    if (!prev || n.level < prev.level) nodeByNorm.set(k, n);
  }
  // per-level index for nodeByNameLevel
  const nodeByNormLevel = new Map<string, N>();
  for (const n of allNodes) nodeByNormLevel.set(`${n.level}␟${norm(n.name)}`, n);

  const fuzzy = (name: string): N | null => {
    const toks = new Set(norm(name).split(' ').filter((w) => w.length > 3));
    if (!toks.size) return null;
    let best: N | null = null;
    let bestScore = 0;
    for (const [nk, node] of nodeByNorm) {
      const nt = nk.split(' ');
      let hit = 0;
      for (const t of nt) if (toks.has(t)) hit++;
      // score favours overlap density AND a lower level on ties
      const score = hit / Math.max(1, nt.length) - node.level * 0.001;
      if (hit > 0 && score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return bestScore >= 0.5 ? best : null;
  };

  const misses: { kind: string; raw: string }[] = [];
  const seenMiss = new Set<string>();
  const recordMiss = (kind: string, raw: string) => {
    const k = `${kind}␟${raw}`;
    if (!seenMiss.has(k)) {
      seenMiss.add(k);
      misses.push({ kind, raw });
    }
  };

  const resolveNode = (name?: string | null): N | null => {
    if (!name) return null;
    const k = norm(name);
    const alias = NODE_ALIASES[k];
    if (alias) {
      const a = nodeByNorm.get(norm(alias));
      if (a) return a;
    }
    return nodeByNorm.get(k) ?? fuzzy(name);
  };

  const nodeByName = (name?: string | null): string | null => {
    if (!name) return null;
    const n = resolveNode(name);
    if (!n) recordMiss('node', name);
    return n?.id ?? null;
  };

  const nodeByNameLevel = (name: string | null | undefined, level: number): string | null => {
    if (!name) return null;
    const exact = nodeByNormLevel.get(`${level}␟${norm(name)}`);
    if (exact) return exact.id;
    // fall back to alias/fuzzy but only accept the hit if it is on the asked level
    const n = resolveNode(name);
    if (n && n.level === level) return n.id;
    recordMiss(`node@L${level}`, name);
    return null;
  };

  // Non-recording variant — resolve to a node id without counting a miss. Used
  // where the caller tries several levels and only one needs to hit (AI-adoption).
  const nodeIdQuiet = (name?: string | null): string | null => resolveNode(name)?.id ?? null;

  // value-stream nodes = L2 ProcessNodes (the "Division/Value Stream" level).
  const valueStreamNodes = new Map<string, string>();
  for (const n of allNodes) if (n.level === 2) valueStreamNodes.set(n.name, n.id);

  // org units (L2 divisions) — fuzzy + alias-aware too.
  const orgByNorm = new Map(orgUnits.map((o) => [norm(o.dbValue), o.id] as const));
  const orgUnitByName = (name?: string | null): string | null => {
    if (!name) return null;
    const k = norm(name);
    const alias = NODE_ALIASES[k];
    const hit =
      orgByNorm.get(k) ??
      (alias ? orgByNorm.get(norm(alias)) : undefined) ??
      // token-overlap fallback against org units
      (() => {
        const toks = new Set(k.split(' ').filter((w) => w.length > 3));
        let best: string | null = null;
        let bestScore = 0;
        for (const [ok, id] of orgByNorm) {
          const ot = ok.split(' ');
          let h = 0;
          for (const t of ot) if (toks.has(t)) h++;
          const score = h / Math.max(1, ot.length);
          if (h > 0 && score > bestScore) {
            bestScore = score;
            best = id;
          }
        }
        return bestScore >= 0.5 ? best : null;
      })();
    if (!hit) recordMiss('orgUnit', name);
    return hit ?? null;
  };

  // role resolver — reuse the seed-time roleMatch normalization against dbValue.
  const baseResolver = buildRoleResolver(roles.map((r) => ({ id: r.id, name: r.dbValue })));
  const roleResolver = (raw?: string | null): string | null => {
    if (!raw || !raw.trim()) return null;
    const m = baseResolver(raw);
    if (!m) recordMiss('role', raw);
    return m?.id ?? null;
  };

  const reportMisses = (label: string) => {
    if (!misses.length) {
      console.log(`   [resolveSpineRefs:${label}] 0 unresolved references`);
      return 0;
    }
    const byKind = new Map<string, number>();
    for (const m of misses) byKind.set(m.kind, (byKind.get(m.kind) ?? 0) + 1);
    const summary = [...byKind].map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`   [resolveSpineRefs:${label}] ${misses.length} unresolved (${summary}):`);
    for (const m of misses.slice(0, 30)) console.log(`     · ${m.kind}: "${m.raw}"`);
    if (misses.length > 30) console.log(`     … +${misses.length - 30} more`);
    return misses.length;
  };
  // resetMisses lets the orchestrator attribute misses per seeder.
  const resetMisses = () => {
    misses.length = 0;
    seenMiss.clear();
  };

  return {
    nodeByName,
    nodeByNameLevel,
    nodeIdQuiet,
    valueStreamNodes,
    orgUnitByName,
    roleResolver,
    get misses() {
      return misses;
    },
    reportMisses,
    resetMisses,
  };
}
