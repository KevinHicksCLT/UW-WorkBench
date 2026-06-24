import type { PrismaClient } from '@prisma/client';
import { resolveSpineRefs, type SpineRefs } from './resolveSpineRefs.js';

// Demo data for the Initiative Tracker, ported in spirit from the Cascade seed
// and adapted to this company. Builds Program → Workstream → PortfolioInitiative
// with time-phased benefit/cost lines (monthly ACTUAL / TARGET / FORECAST),
// milestones, and RAID items. Initiatives are linked into the operating model by
// matching value-stream / division / role names that already exist for the
// company (best-effort; links are left null when nothing matches). Deterministic
// and idempotent: deletes the company's programs (cascades through children)
// before rebuilding. All figures are illustrative.

type BenefitDef = { name: string; category: string; monthly: number };
type CostDef = { name: string; category: string; monthly: number };
type MilestoneDef = { name: string; monthOffset: number; isGate?: boolean; done?: boolean; missed?: boolean };
type RaidDef = { type: 'RISK' | 'ASSUMPTION' | 'ISSUE' | 'DECISION'; title: string; probability?: number; impact?: number; mitigation?: string; status?: 'OPEN' | 'MITIGATED' | 'CLOSED' };
type InitDef = {
  name: string;
  description: string;
  stage: string;
  status: string;
  workflowAction?: string | null;
  startMonth: number; // months relative to today (negative = past)
  endMonth: number;
  valueStream?: string;
  division?: string;
  ownerRole?: string;
  sponsorRole?: string;
  benefits: BenefitDef[];
  costs: CostDef[];
  milestones: MilestoneDef[];
  raid: RaidDef[];
};
type WsDef = { name: string; description: string; status?: string; initiatives: InitDef[] };
type ProgramDef = { name: string; description: string; status: string; startMonth: number; endMonth: number; workstreams: WsDef[] };

const STAGE_TO_STATE: Record<string, string> = {
  IDEA: 'PLANNING', PLAN: 'PLANNING', EXECUTE: 'ACTIVE', REALIZE: 'ACTIVE', COMPLETE: 'DONE',
};

const PROGRAMS: ProgramDef[] = [
  {
    name: 'Digital Underwriting Transformation',
    description: 'Modernize the end-to-end underwriting value stream — submission intake, pricing, and policy issuance — onto a green-field platform.',
    status: 'ON_TRACK', startMonth: -8, endMonth: 16,
    workstreams: [
      {
        name: 'Submission & Intake', description: 'Straight-through submission capture and triage.',
        initiatives: [
          {
            name: 'Straight-Through Submission Intake', description: 'Replace manual ACORD intake with an API-first submission service and automated clearance.',
            stage: 'EXECUTE', status: 'ON_TRACK', startMonth: -6, endMonth: 8,
            valueStream: 'Underwriting', division: 'Underwriting', ownerRole: 'Underwriting', sponsorRole: 'Chief Underwriting',
            benefits: [
              { name: 'Underwriter time saved', category: 'Cost Savings', monthly: 42000 },
              { name: 'Faster quote conversion', category: 'Revenue Uplift', monthly: 28000 },
            ],
            costs: [
              { name: 'Platform build (squad)', category: 'CAPEX', monthly: 55000 },
              { name: 'Cloud + tooling', category: 'OPEX', monthly: 9000 },
            ],
            milestones: [
              { name: 'Discovery complete', monthOffset: -5, isGate: true, done: true },
              { name: 'Clearance MVP live', monthOffset: -1, done: true },
              { name: 'Broker portal pilot', monthOffset: 3, isGate: true },
              { name: 'Full rollout', monthOffset: 7 },
            ],
            raid: [
              { type: 'RISK', title: 'Broker channel API adoption slower than planned', probability: 3, impact: 4, mitigation: 'Phased onboarding with top-10 brokers first.' },
              { type: 'RISK', title: 'Broker portal security findings delay pilot', probability: 4, impact: 5, mitigation: 'Engage security architecture early; penetration test before the pilot gate.' },
              { type: 'RISK', title: 'Integration vendor attrition on the squad', probability: 2, impact: 5, mitigation: 'Cross-train internal engineers; keep integration runbooks current.' },
              { type: 'RISK', title: 'Clearance false positives frustrate brokers', probability: 3, impact: 2, mitigation: 'Tune match thresholds; manual review queue for borderline matches.' },
              { type: 'ISSUE', title: 'Legacy ACORD parser edge cases', probability: 4, impact: 3, status: 'MITIGATED' },
              { type: 'DECISION', title: 'Adopt canonical submission model', probability: 1, impact: 1, status: 'CLOSED' },
            ],
          },
        ],
      },
      {
        name: 'Pricing & Rating', description: 'Externalized rating rules and real-time pricing.',
        initiatives: [
          {
            name: 'Real-Time Rating Engine', description: 'Externalize rating logic into a decision service for sub-second quotes and faster rate changes.',
            stage: 'PLAN', status: 'AT_RISK', startMonth: -3, endMonth: 12,
            valueStream: 'Underwriting', division: 'Actuarial', ownerRole: 'Pricing Actuary', sponsorRole: 'Chief Underwriting',
            benefits: [
              { name: 'Reduced rate-change cycle time', category: 'Cost Avoidance', monthly: 31000 },
              { name: 'Win-rate uplift', category: 'Revenue Uplift', monthly: 36000 },
            ],
            costs: [
              { name: 'Rules engine licensing', category: 'Vendor', monthly: 12000 },
              { name: 'Actuarial + engineering', category: 'Resource', monthly: 48000 },
            ],
            milestones: [
              { name: 'Rules externalization design', monthOffset: -1, isGate: true, done: true },
              { name: 'Shadow-mode validation', monthOffset: 4, isGate: true },
              { name: 'Production cutover', monthOffset: 10 },
            ],
            raid: [
              { type: 'RISK', title: 'Actuarial sign-off on rule parity may slip', probability: 4, impact: 4, mitigation: 'Parallel-run shadow scoring for two quarters.' },
              { type: 'RISK', title: 'Rate-filing approvals lag in key states', probability: 3, impact: 5, mitigation: 'Stagger state rollout; file earliest in slow-approval states.' },
              { type: 'RISK', title: 'Quote latency under peak volume', probability: 3, impact: 3, mitigation: 'Load-test at 3× peak; cache common rating paths.' },
              { type: 'RISK', title: 'Legacy rater decommission slips, doubling run cost', probability: 5, impact: 2, mitigation: 'Tie decommission dates to cutover gates.' },
              { type: 'ASSUMPTION', title: 'State rate tables remain stable during migration', probability: 2, impact: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Claims Modernization',
    description: 'Faster, lower-leakage claims through automation and a unified claims data platform.',
    status: 'AT_RISK', startMonth: -5, endMonth: 18,
    workstreams: [
      {
        name: 'Intake & Triage', description: 'Automated FNOL capture and severity triage.',
        initiatives: [
          {
            name: 'Automated FNOL Triage', description: 'Auto-classify and route first notice of loss to reduce cycle time and improve assignment.',
            stage: 'EXECUTE', status: 'ON_TRACK', startMonth: -4, endMonth: 9,
            valueStream: 'Claims', division: 'Claims', ownerRole: 'Claims', sponsorRole: 'Chief Operating',
            benefits: [
              { name: 'Cycle-time reduction', category: 'Cost Savings', monthly: 38000 },
              { name: 'Leakage reduction', category: 'Cost Avoidance', monthly: 52000 },
            ],
            costs: [
              { name: 'ML model + integration', category: 'CAPEX', monthly: 40000 },
              { name: 'Run + monitoring', category: 'OPEX', monthly: 7000 },
            ],
            milestones: [
              { name: 'Triage model trained', monthOffset: -2, isGate: true, done: true },
              { name: 'Assisted-routing pilot', monthOffset: -1, missed: true },
              { name: 'Auto-routing GA', monthOffset: 7, isGate: true },
            ],
            raid: [
              { type: 'RISK', title: 'Model drift on rare loss types', probability: 3, impact: 4, mitigation: 'Quarterly retraining + human-in-the-loop fallback.' },
              { type: 'RISK', title: 'Adjusters override auto-routing recommendations', probability: 4, impact: 3, mitigation: 'Explainable routing reasons; pilot feedback loop into the model.' },
              { type: 'RISK', title: 'Catastrophe surge overwhelms triage queue', probability: 2, impact: 4, mitigation: 'CAT surge mode routes straight to senior adjusters.' },
              { type: 'RISK', title: 'PII exposure in claim narratives', probability: 2, impact: 2, mitigation: 'Mask PII before model inference.' },
              { type: 'ISSUE', title: 'FNOL data quality gaps from legacy intake', probability: 4, impact: 3 },
            ],
          },
        ],
      },
      {
        name: 'Claims Data Platform', description: 'Unified claims data foundation for analytics.',
        initiatives: [
          {
            name: 'Unified Claims Data Platform', description: 'Consolidate claims data into a governed lakehouse to power leakage and fraud analytics.',
            stage: 'IDEA', status: 'OFF_TRACK', startMonth: -1, endMonth: 14,
            valueStream: 'Claims', division: 'Data & AI', ownerRole: 'Data Engineer', sponsorRole: 'Chief Data',
            benefits: [
              { name: 'Analytics enablement', category: 'Revenue Uplift', monthly: 18000 },
              { name: 'Reporting effort saved', category: 'Cost Savings', monthly: 14000 },
            ],
            costs: [
              { name: 'Lakehouse + ingestion', category: 'CAPEX', monthly: 33000 },
              { name: 'Data platform run', category: 'OPEX', monthly: 11000 },
            ],
            milestones: [
              { name: 'Business case approval', monthOffset: 0, isGate: true, missed: true },
              { name: 'Source onboarding wave 1', monthOffset: 5 },
            ],
            raid: [
              { type: 'RISK', title: 'Funding contention with FNOL initiative', probability: 4, impact: 4, mitigation: 'Sequence behind FNOL; share platform squad.' },
              { type: 'RISK', title: 'Source-system owners not staffed for onboarding', probability: 5, impact: 4, mitigation: 'Secure named data stewards before wave 1 starts.' },
              { type: 'RISK', title: 'Cloud egress costs exceed estimates', probability: 2, impact: 3, mitigation: 'Egress monitoring plus tiered storage policy.' },
              { type: 'RISK', title: 'Fraud-analytics scope creep into the MVP', probability: 4, impact: 2, mitigation: 'Gate scope changes through business-case re-approval.' },
              { type: 'DECISION', title: 'Lakehouse vendor selection pending', probability: 1, impact: 1 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Data & AI Enablement',
    description: 'Foundational data governance and AI productivity tooling across the enterprise.',
    status: 'ON_TRACK', startMonth: -10, endMonth: 10,
    workstreams: [
      {
        name: 'AI Productivity', description: 'Roll out AI assistants to knowledge workers.',
        initiatives: [
          {
            name: 'Enterprise AI Assistant Rollout', description: 'Deploy governed AI assistants to underwriting, claims, and operations teams.',
            stage: 'REALIZE', status: 'ON_TRACK', startMonth: -9, endMonth: 4,
            valueStream: 'Underwriting', division: 'Technology', ownerRole: 'Product', sponsorRole: 'Chief Technology',
            benefits: [
              { name: 'Knowledge-worker productivity', category: 'Cost Savings', monthly: 61000 },
            ],
            costs: [
              { name: 'AI platform subscription', category: 'Vendor', monthly: 22000 },
              { name: 'Enablement & change mgmt', category: 'Resource', monthly: 9000 },
            ],
            milestones: [
              { name: 'Pilot cohort live', monthOffset: -7, isGate: true, done: true },
              { name: 'Department rollout', monthOffset: -2, done: true },
              { name: 'Value realization review', monthOffset: 3, isGate: true },
            ],
            raid: [
              { type: 'ASSUMPTION', title: 'Adoption sustains above 60% of licensed seats', probability: 2, impact: 3 },
              { type: 'RISK', title: 'Data governance gaps in assistant prompts', probability: 2, impact: 4, status: 'MITIGATED', mitigation: 'DLP + prompt logging review.' },
              { type: 'RISK', title: 'Shadow-IT AI tools bypass the governed assistant', probability: 3, impact: 3, mitigation: 'Block unsanctioned tools; fast-track feature requests.' },
              { type: 'RISK', title: 'Vendor pricing changes erode the business case', probability: 1, impact: 4, mitigation: 'Multi-year contract with price-protection clause.' },
              { type: 'RISK', title: 'Hallucinated answers reach regulated communications', probability: 2, impact: 4, mitigation: 'Human review required for external-facing outputs.' },
            ],
          },
        ],
      },
    ],
  },
];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }
function monthsBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfMonth(start);
  const last = startOfMonth(end);
  while (cur <= last) { out.push(cur); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
  return out;
}
// Deterministic 0..1 pseudo-noise from a string key.
function noise(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (Math.abs(h) % 1000) / 1000;
}

export async function seedPortfolio(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { tenantId, companyId } = ctx;
  const refs = ctx.refs ?? (await resolveSpineRefs(prisma, companyId));

  // Fresh rebuild — cascades through workstreams → initiatives → lines/values/milestones/raid.
  await prisma.program.deleteMany({ where: { companyId } });

  // Operating-model links now resolve to real erd_v5 FK ids via resolveSpineRefs:
  //   valueStreamNodeId → ProcessNode (L2), orgUnitId → OrgUnit (L2 division),
  //   ownerRoleId / sponsorRoleId / RaidItem.ownerRoleId → Role.
  const today = new Date();
  let programCount = 0, wsCount = 0, initCount = 0, lineCount = 0, valueCount = 0, msCount = 0, raidCount = 0, actCount = 0, resCount = 0;

  for (const pdef of PROGRAMS) {
    const program = await prisma.program.create({
      data: {
        tenantId, companyId, name: pdef.name, description: pdef.description, status: pdef.status,
        startDate: startOfMonth(addMonths(today, pdef.startMonth)),
        endDate: startOfMonth(addMonths(today, pdef.endMonth)),
      },
    });
    programCount++;

    for (const wdef of pdef.workstreams) {
      const ws = await prisma.workstream.create({
        data: { tenantId, companyId, programId: program.id, name: wdef.name, description: wdef.description, status: wdef.status ?? 'ON_TRACK' },
      });
      wsCount++;

      for (const idef of wdef.initiatives) {
        const startDate = startOfMonth(addMonths(today, idef.startMonth));
        const dueDate = startOfMonth(addMonths(today, idef.endMonth));
        const months = monthsBetween(startDate, dueDate);

        // Cumulative = ACTUAL (past) + FORECAST (future). Compute as we generate.
        let cumulativeBenefit = 0, cumulativeCost = 0;

        const ownerRoleId = refs.roleResolver(idef.ownerRole);
        const init = await prisma.portfolioInitiative.create({
          data: {
            tenantId, companyId, workstreamId: ws.id, name: idef.name, description: idef.description,
            stage: idef.stage, state: STAGE_TO_STATE[idef.stage] ?? 'PLANNING', status: idef.status,
            workflowAction: idef.workflowAction ?? null, startDate, dueDate,
            valueStreamNodeId: refs.nodeByName(idef.valueStream),
            orgUnitId: refs.orgUnitByName(idef.division),
            ownerRoleId,
            sponsorRoleId: refs.roleResolver(idef.sponsorRole),
          },
        });
        initCount++;

        // Benefit / cost lines + monthly ACTUAL / TARGET / FORECAST values.
        const buildLine = async (kind: 'BENEFIT' | 'COST', def: BenefitDef | CostDef) => {
          const line = kind === 'BENEFIT'
            ? await prisma.benefitLine.create({ data: { initiativeId: init.id, name: def.name, category: def.category, startDate, endDate: dueDate } })
            : await prisma.costLine.create({ data: { initiativeId: init.id, name: def.name, category: def.category, startDate, endDate: dueDate } });
          lineCount++;
          const fk = kind === 'BENEFIT' ? { benefitLineId: line.id } : { costLineId: line.id };
          const rows: any[] = [];
          for (const m of months) {
            const isPast = m <= startOfMonth(today);
            const factor = 0.82 + noise(`${line.id}:${m.toISOString()}`) * 0.3; // 0.82–1.12 vs target
            rows.push({ ...fk, dataset: 'TARGET', periodStart: m, amount: def.monthly });
            if (isPast) {
              const actual = Math.round(def.monthly * factor);
              rows.push({ ...fk, dataset: 'ACTUAL', periodStart: m, amount: actual });
              if (kind === 'BENEFIT') cumulativeBenefit += actual; else cumulativeCost += actual;
            } else {
              rows.push({ ...fk, dataset: 'FORECAST', periodStart: m, amount: def.monthly });
              if (kind === 'BENEFIT') cumulativeBenefit += def.monthly; else cumulativeCost += def.monthly;
            }
          }
          await prisma.metricValue.createMany({ data: rows });
          valueCount += rows.length;
        };
        for (const b of idef.benefits) await buildLine('BENEFIT', b);
        for (const c of idef.costs) await buildLine('COST', c);

        await prisma.portfolioInitiative.update({
          where: { id: init.id },
          data: { cumulativeBenefit, cumulativeCost, cumulativeNetBenefit: cumulativeBenefit - cumulativeCost },
        });

        // Milestones
        if (idef.milestones.length) {
          await prisma.milestone.createMany({
            data: idef.milestones.map((m) => ({
              initiativeId: init.id, name: m.name, dueDate: startOfMonth(addMonths(today, m.monthOffset)),
              isGate: m.isGate ?? false, status: m.done ? 'DONE' : m.missed ? 'MISSED' : 'PENDING',
              completedAt: m.done ? startOfMonth(addMonths(today, m.monthOffset)) : null,
            })),
          });
          msCount += idef.milestones.length;
        }

        // RAID
        if (idef.raid.length) {
          await prisma.raidItem.createMany({
            data: idef.raid.map((r) => {
              const probability = r.probability ?? 3;
              const impact = r.impact ?? 3;
              return {
                initiativeId: init.id, type: r.type, title: r.title, probability, impact,
                severity: probability * impact, mitigation: r.mitigation ?? null, status: r.status ?? 'OPEN',
                ownerRoleId, // the initiative owner owns its RAID items
              };
            }),
          });
          raidCount += idef.raid.length;
        }

        // Workplan activities (a small illustrative plan per initiative).
        await prisma.workplanActivity.createMany({
          data: [
            { initiativeId: init.id, name: 'Discovery & design', startDate, endDate: startOfMonth(addMonths(startDate, 2)), status: 'DONE', sortOrder: 0 },
            { initiativeId: init.id, name: 'Build & integrate', startDate: startOfMonth(addMonths(startDate, 2)), endDate: startOfMonth(addMonths(dueDate, -2)), status: 'IN_PROGRESS', sortOrder: 1 },
            { initiativeId: init.id, name: 'Rollout & realize', startDate: startOfMonth(addMonths(dueDate, -2)), endDate: dueDate, status: 'PLANNED', sortOrder: 2 },
          ],
        });
        actCount += 3;

        // Resource allocation — the owner role (when resolved) staffed on the initiative.
        if (ownerRoleId) {
          await prisma.initiativeResource.create({
            data: { initiativeId: init.id, roleId: ownerRoleId, name: idef.ownerRole ?? 'Initiative lead', allocationPct: 60, startDate, endDate: dueDate },
          });
          resCount++;
        }
      }
    }
  }

  // ── Strategic objectives + initiative links + risk-scoring bands (company-wide) ──
  const objectives = [
    { name: 'Reduce operating cost', description: 'Lower cost-to-serve across the operating model.', weight: 1.5 },
    { name: 'Accelerate growth', description: 'Grow premium and win-rate through faster, better service.', weight: 1.2 },
    { name: 'Strengthen resilience & compliance', description: 'Reduce risk, leakage, and regulatory exposure.', weight: 1.0 },
  ];
  const objIds: string[] = [];
  for (const o of objectives) {
    const row = await prisma.strategicObjective.create({ data: { tenantId, companyId, ...o } });
    objIds.push(row.id);
  }
  // Link every initiative to a deterministic objective with an illustrative impact.
  const allInits = await prisma.portfolioInitiative.findMany({ where: { companyId }, select: { id: true } });
  let objLinkCount = 0;
  for (let i = 0; i < allInits.length; i++) {
    await prisma.initiativeObjective.create({
      data: { initiativeId: allInits[i].id, objectiveId: objIds[i % objIds.length], impact: 3 + (i % 3) },
    });
    objLinkCount++;
  }

  const bands = [
    { label: 'Low', minScore: 1, maxScore: 6, color: '#16a34a', sortOrder: 0 },
    { label: 'Medium', minScore: 7, maxScore: 12, color: '#f59e0b', sortOrder: 1 },
    { label: 'High', minScore: 13, maxScore: 20, color: '#dc2626', sortOrder: 2 },
    { label: 'Critical', minScore: 21, maxScore: 25, color: '#7f1d1d', sortOrder: 3 },
  ];
  await prisma.riskScoringBand.createMany({ data: bands.map((b) => ({ tenantId, companyId, ...b })) });

  console.log(`   + ${programCount} programs, ${wsCount} workstreams, ${initCount} initiatives, ${lineCount} benefit/cost lines, ${valueCount} monthly values, ${msCount} milestones, ${raidCount} RAID items, ${actCount} activities, ${resCount} resources, ${objIds.length} objectives (${objLinkCount} links), ${bands.length} risk bands`);
}
