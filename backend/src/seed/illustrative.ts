import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSpineRefs, type SpineRefs } from './resolveSpineRefs.js';

// erd_v5 illustrative peripherals — re-pointed onto the master spine by FK.
//
//   seedRealApplications  — enrich master Applications with a 6-bucket TCO
//                           breakdown where names match (else upsert the 6 real
//                           apps). No ApplicationValueStream (dropped) — VS reach
//                           is via NodeAppUsage / orgUnitId.
//   metricReading         — KPI-target → numeric reading helper (unchanged).
//   seedDeepLevels        — illustrative Initiative + NodeInitiative; value-stream
//                           KPI Metric rows (processNodeId); NodeAiAdoption per VS
//                           node; AnalysisStatus coverage rows. The old standalone
//                           Risk model is GONE → illustrative risk lives in
//                           portfolio RaidItem now, so it is omitted here.
//   seedExternalParties   — ExternalParty + ExternalInteraction from spine.json.

const SPINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/seed/spine.json');
const ADOPTION = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/ai-adoption-usecases.json');

// Deterministic pseudo-values, so re-seeds are stable.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// Turn a KPI definition (real target text) into a numeric target + unit +
// direction + an illustrative current actual near the target.
export function metricReading(def: { name: string; target: string | null; notes: string | null; category: string | null }) {
  const t = (def.target ?? '').trim();
  const lower = `${def.target ?? ''} ${def.notes ?? ''} ${def.name}`.toLowerCase();
  const unit = /%|percent/.test(t) ? '%' : /day/.test(t) ? 'days' : /hour|hr/.test(t) ? 'hrs' : /\$|usd/.test(t) ? '$' : /month|\/mo/.test(t) ? '/mo' : /ratio|x\b/.test(t) ? 'x' : 'score';
  const nums = (t.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  let target: number | null = nums.length ? (nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0]) : (/zero|0 /.test(lower) ? 0 : null);
  const down = /lower is better|<|reduce|days|cycle|time|cost|dso|backlog|defect|leakage|loss|turnover|breach|incident|outage|complaint|aging/.test(lower) && !/>|higher is better/.test(lower);
  const direction = down ? 'down' : 'up';
  const h = hash(`${def.name}:${def.target}`);
  const jitter = ((h % 1000) / 1000 - 0.45) * 0.35;
  let value: number;
  if (target != null) {
    value = target === 0 ? Math.round((h % 5)) : Math.round(target * (1 + jitter) * 10) / 10;
  } else {
    value = Math.round((40 + (h % 60)) * 10) / 10;
    target = Math.round((value / (1 + jitter)) * 10) / 10;
  }
  if (unit === '%') value = Math.max(0, Math.min(100, value));
  return { value, unit, target, direction };
}

// ─── Real Application TCO records (6 apps, full 6-bucket breakdown) ─────────
// Enriches a same-named master Application in place where possible, else creates
// a standalone illustrative=false app. orgUnit set from primaryDivisionName.

type TcoApp = {
  name: string;
  ownershipModel: string;
  primaryDivisionName: string;
  licenseCost: number; laborCost: number; vendorServicesCost: number;
  infraCost: number; depreciationCost: number; overheadCost: number; totalTco: number;
  kind: string; criticality: string;
};

const REAL_APPS: TcoApp[] = [
  { name: 'Claims Management Platform', ownershipModel: 'Hybrid', primaryDivisionName: 'Claims', licenseCost: 210000, laborCost: 340000, vendorServicesCost: 180000, infraCost: 145000, depreciationCost: 60000, overheadCost: 50000, totalTco: 985000, kind: 'SystemOfRecord', criticality: 'High' },
  { name: 'Policy Administration Platform', ownershipModel: 'In-house', primaryDivisionName: 'Business Operations', licenseCost: 0, laborCost: 620000, vendorServicesCost: 280000, infraCost: 215000, depreciationCost: 80000, overheadCost: 50000, totalTco: 1245000, kind: 'SystemOfRecord', criticality: 'High' },
  { name: 'Finance ERP', ownershipModel: 'Hybrid', primaryDivisionName: 'Finance & Investments', licenseCost: 320000, laborCost: 280000, vendorServicesCost: 160000, infraCost: 130000, depreciationCost: 45000, overheadCost: 50000, totalTco: 985000, kind: 'SystemOfRecord', criticality: 'High' },
  { name: 'IAM Platform', ownershipModel: 'SaaS', primaryDivisionName: 'Cybersecurity & IAM', licenseCost: 480000, laborCost: 80000, vendorServicesCost: 60000, infraCost: 45000, depreciationCost: 20000, overheadCost: 20000, totalTco: 705000, kind: 'Service', criticality: 'High' },
  { name: 'Data Analytics Platform', ownershipModel: 'Hybrid', primaryDivisionName: 'Data & AI', licenseCost: 290000, laborCost: 220000, vendorServicesCost: 130000, infraCost: 105000, depreciationCost: 40000, overheadCost: 30000, totalTco: 815000, kind: 'Service', criticality: 'High' },
  { name: 'Broker / Distribution Portal', ownershipModel: 'SaaS', primaryDivisionName: 'Sales, Distribution & Marketing', licenseCost: 360000, laborCost: 80000, vendorServicesCost: 60000, infraCost: 50000, depreciationCost: 25000, overheadCost: 25000, totalTco: 600000, kind: 'Tool', criticality: 'Medium' },
];

export async function seedRealApplications(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { companyId } = ctx;
  const refs = ctx.refs ?? (await resolveSpineRefs(prisma, companyId));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const existing = await prisma.application.findMany({ where: { companyId }, select: { id: true, name: true } });
  const byNorm = new Map(existing.map((a) => [norm(a.name), a.id] as const));

  let enriched = 0, created = 0;
  for (const a of REAL_APPS) {
    const orgUnitId = refs.orgUnitByName(a.primaryDivisionName);
    const tco = {
      illustrative: false, ownershipModel: a.ownershipModel, orgUnitId,
      licenseCost: a.licenseCost, laborCost: a.laborCost, vendorServicesCost: a.vendorServicesCost,
      infraCost: a.infraCost, depreciationCost: a.depreciationCost, overheadCost: a.overheadCost,
      totalTco: a.totalTco, kind: a.kind, criticality: a.criticality,
    };
    const hit = byNorm.get(norm(a.name));
    if (hit) {
      await prisma.application.update({ where: { id: hit }, data: tco });
      enriched++;
    } else {
      await prisma.application.create({ data: { companyId, name: a.name, ...tco } });
      created++;
    }
  }
  console.log(`   + real TCO applications: enriched ${enriched}, created ${created}`);
}

// ─── Deep levels: illustrative initiatives, KPI metrics, AI-adoption, analysis ──

const INITIATIVES = [
  { code: 'CLM-TX', name: 'Claims Transformation', stage: 'Build', vs: 'Claims' },
  { code: 'UW-MOD', name: 'Underwriting Modernization', stage: 'Pilot', vs: 'Underwriting' },
  { code: 'BILL-1', name: 'Billing Consolidation', stage: 'Rollout', vs: 'Business Operations' },
  { code: 'DATA-PLT', name: 'Data & AI Platform Build-out', stage: 'Build', vs: 'Data & AI' },
  { code: 'CYBER', name: 'Cyber Resilience Program', stage: 'Build', vs: 'Cybersecurity & IAM' },
  { code: 'DIST-SS', name: 'Distribution Self-Service', stage: 'Discovery', vs: 'Sales, Distribution & Marketing' },
];

const ADOPTION_LEVELS = ['not_used', 'pilot', 'emerging', 'scaling', 'embedded'];
type UseCase = { title: string; persona: string; detail: string };
type ModeProfile = { level: number; useCases: UseCase[] };
type StreamProfile = { assistant: ModeProfile; augmented: ModeProfile; workflow: ModeProfile; agent: ModeProfile };

function addDays(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

export async function seedDeepLevels(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { companyId } = ctx;
  const refs = ctx.refs ?? (await resolveSpineRefs(prisma, companyId));

  // ── Illustrative initiatives + value-stream links (Initiative + NodeInitiative) ──
  await prisma.initiative.deleteMany({ where: { companyId } });
  let initN = 0, nodeInitN = 0;
  for (const ini of INITIATIVES) {
    const vsNodeId = refs.nodeByName(ini.vs);
    const init = await prisma.initiative.create({ data: { companyId, name: ini.name, state: ini.stage } });
    initN++;
    if (vsNodeId) {
      await prisma.nodeInitiative.create({ data: { companyId, processNodeId: vsNodeId, initiativeId: init.id } });
      nodeInitN++;
    }
  }

  // ── Value-stream KPI Metrics (processNodeId, kind=kpi) from the spine KPIs ──
  await prisma.metric.deleteMany({ where: { companyId, kind: 'kpi' } });
  const spine = JSON.parse(readFileSync(SPINE, 'utf8')) as {
    metrics: { valueStreamName: string; name: string; target: string | null; notes: string | null; category: string | null; frequency: string | null }[];
  };
  const metricRows: { companyId: string; processNodeId: string; name: string; value: number; unit: string; period: string | null; kind: string }[] = [];
  for (const m of spine.metrics) {
    const nodeId = refs.nodeByName(m.valueStreamName);
    if (!nodeId) continue;
    const r = metricReading({ name: m.name, target: m.target, notes: m.notes, category: m.category });
    metricRows.push({ companyId, processNodeId: nodeId, name: m.name, value: r.value, unit: r.unit, period: m.frequency, kind: 'kpi' });
  }
  for (let i = 0; i < metricRows.length; i += 1000) {
    await prisma.metric.createMany({ data: metricRows.slice(i, i + 1000) });
  }

  // ── NodeAiAdoption per value-stream node (levels + use cases) ──
  const profiles: Record<string, StreamProfile> = JSON.parse(readFileSync(ADOPTION, 'utf8'));
  const vsNodes = await prisma.processNode.findMany({
    where: { companyId, processLevelType: { levelNumber: { in: [2, 3] } } },
    select: { id: true, dbValue: true, aiAdoption: { select: { id: true } } },
  });
  // Resolve each authored profile name → a VS node id (alias/fuzzy). One node
  // wins per profile; first writer keeps the node (skip if already adopted).
  const claimed = new Set<string>();
  let adoptN = 0;
  for (const [name, p] of Object.entries(profiles)) {
    const nodeId = refs.nodeIdQuiet(name);
    if (!nodeId || claimed.has(nodeId)) continue;
    claimed.add(nodeId);
    const node = vsNodes.find((n) => n.id === nodeId);
    if (!node || node.aiAdoption) continue;
    await prisma.nodeAiAdoption.create({
      data: {
        processNodeId: nodeId,
        aiAssist: ADOPTION_LEVELS[p.assistant?.level ?? 0],
        aiAugment: ADOPTION_LEVELS[p.augmented?.level ?? 0],
        aiWorkflow: ADOPTION_LEVELS[p.workflow?.level ?? 0],
        aiAutonomous: ADOPTION_LEVELS[p.agent?.level ?? 0],
        useCases: { assistant: p.assistant?.useCases ?? [], augmented: p.augmented?.useCases ?? [], workflow: p.workflow?.useCases ?? [], agent: p.agent?.useCases ?? [] },
      },
    });
    adoptN++;
  }

  // ── AnalysisStatus coverage rows over VS nodes, divisions, roles ──
  await prisma.analysisStatus.deleteMany({ where: { companyId } });
  const [l2nodes, divisions, roles] = await Promise.all([
    prisma.processNode.findMany({ where: { companyId, processLevelType: { levelNumber: 2 } }, select: { id: true, dbValue: true } }),
    prisma.orgUnit.findMany({ where: { companyId, orgLevelType: { levelNumber: 2 } }, select: { id: true, dbValue: true } }),
    prisma.role.findMany({ where: { companyId }, select: { id: true, dbValue: true } }),
  ]);
  const today = new Date();
  const subjects: { subjectType: string; id: string; name: string }[] = [
    ...l2nodes.map((n) => ({ subjectType: 'valueStream', id: n.id, name: n.dbValue })),
    ...divisions.map((d) => ({ subjectType: 'division', id: d.id, name: d.dbValue })),
    ...roles.map((r) => ({ subjectType: 'role', id: r.id, name: r.dbValue })),
  ];
  const analysisRows = subjects.map((s) => {
    const h = hash(`${s.subjectType}:${s.name}`);
    const bucket = h % 100;
    if (bucket < 60) {
      const completed = addDays(today, -(7 + (h % 90)));
      return { tenantId: ctx.tenantId, companyId, subjectType: s.subjectType, subjectId: s.id, status: 'Complete', plannedDate: addDays(completed, (h >> 3) % 10), completedDate: completed };
    }
    if (bucket < 80) {
      const planned = (h >> 2) % 9 === 0 ? addDays(today, -(3 + (h % 10))) : addDays(today, 5 + (h % 40));
      return { tenantId: ctx.tenantId, companyId, subjectType: s.subjectType, subjectId: s.id, status: 'In Progress', plannedDate: planned, completedDate: null };
    }
    return { tenantId: ctx.tenantId, companyId, subjectType: s.subjectType, subjectId: s.id, status: 'Not Started', plannedDate: addDays(today, 30 + (h % 120)), completedDate: null };
  });
  for (let i = 0; i < analysisRows.length; i += 500) {
    await prisma.analysisStatus.createMany({ data: analysisRows.slice(i, i + 500), skipDuplicates: true });
  }

  console.log(`   + ${initN} initiatives (${nodeInitN} VS links), ${metricRows.length} KPI metrics, ${adoptN} AI-adoption profiles, ${analysisRows.length} analysis-coverage rows`);
}

// ─── External parties & interactions (Third-Parties tab) ────────────────────
// From spine.json externalInteractions[]: distinct ExternalParty (by externalRole)
// + an ExternalInteraction per row (internalRole→roleId, relatedValueStream→VS node).

const PARTY_TYPE_MAP: Record<string, string> = {
  Customer: 'Insured', 'Distribution Partner': 'Broker', Broker: 'Broker', Agent: 'Agent',
  Regulator: 'Regulator', Vendor: 'Vendor', Reinsurer: 'Vendor', 'Service Provider': 'Vendor',
  Partner: 'Vendor', 'System Integrator': 'SystemIntegrator',
};

export async function seedExternalParties(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { companyId } = ctx;
  const refs = ctx.refs ?? (await resolveSpineRefs(prisma, companyId));
  await prisma.externalParty.deleteMany({ where: { companyId } });

  const spine = JSON.parse(readFileSync(SPINE, 'utf8')) as {
    externalInteractions: {
      partyType: string; externalRole: string; internalRoleName: string | null; internalRoleOwner: string | null;
      interactionType: string | null; relatedValueStream: string | null;
    }[];
  };

  const partyIdByName = new Map<string, string>();
  let partyN = 0, interN = 0;
  for (const e of spine.externalInteractions) {
    const partyName = e.externalRole || e.partyType;
    let partyId = partyIdByName.get(partyName);
    if (!partyId) {
      const party = await prisma.externalParty.create({
        data: { companyId, name: partyName, partyType: PARTY_TYPE_MAP[e.partyType] ?? 'Vendor' },
      });
      partyId = party.id;
      partyIdByName.set(partyName, partyId);
      partyN++;
    }
    // first related value stream (cell can be "A; B; C")
    const firstVs = (e.relatedValueStream ?? '').split(/[;,]/)[0]?.trim() || null;
    await prisma.externalInteraction.create({
      data: {
        externalPartyId: partyId,
        roleId: refs.roleResolver(e.internalRoleName) ?? refs.roleResolver(e.internalRoleOwner),
        processNodeId: refs.nodeByName(firstVs),
        nature: (e.interactionType ?? 'handoff').slice(0, 80),
      },
    });
    interN++;
  }
  console.log(`   + ${partyN} external parties, ${interN} external interactions`);
}
