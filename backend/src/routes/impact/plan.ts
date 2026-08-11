// Impact walker for Enterprise Plan subjects (Change Impact v2, Workstream B) —
// the executive layer over the SPM domain. A plan change ("move Claims
// Modernization from Q2 to Q4", defund, cancel, merge…) has an impact surface
// the other four lenses don't: milestone slips, benefit deferral, funding
// variance, and knock-ons onto the operating model the initiatives touch.
//
// Subject is a Program, a Workstream, or a single PortfolioInitiative; the walk
// resolves the affected initiative set, then batch-reads milestones, funding
// (Cost/Benefit lines + MetricValue), benefits/metrics, RAID, and the linked
// value-stream / role / deliverable footprint — no per-row fan-out.
import { prisma } from '../../db/prisma.js';
import { streamAncestry } from '../../lib/resolvers/index.js';
import { deriveStakeholders } from './stakeholders.js';
import {
  buildReport,
  classOf,
  grade,
  pushCapped,
  type ChangeType,
  type Impact,
  type ImpactReport,
  type ImpactSection,
} from './types.js';

const ITEM_CAP = 10;

export interface PlanSubject {
  programId?: string;
  workstreamId?: string;
  initiativeId?: string;
}

const money = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${Math.round(n)}`;

export async function assessPlan(
  companyId: string,
  subject: PlanSubject,
  changeType: ChangeType,
  label?: string,
): Promise<ImpactReport | null> {
  const cls = classOf(changeType);

  // Resolve the affected initiative set + a name for the plan being changed.
  const where = subject.initiativeId
    ? { id: subject.initiativeId, companyId }
    : subject.workstreamId
      ? { workstreamId: subject.workstreamId, companyId }
      : subject.programId
        ? { workstream: { programId: subject.programId }, companyId }
        : null;
  if (!where) return null;

  const initiatives = await prisma.portfolioInitiative.findMany({
    where,
    select: {
      id: true,
      name: true,
      startDate: true,
      dueDate: true,
      status: true,
      stage: true,
      cumulativeBenefit: true,
      cumulativeCost: true,
      valueStreamNodeId: true,
      orgUnitId: true,
      ownerRoleId: true,
      ownerRole: { select: { id: true, displayValue: true } },
      orgUnit: { select: { id: true, displayValue: true } },
    },
  });
  if (!initiatives.length) return null;
  const initIds = initiatives.map((i) => i.id);

  // The plan's display name — program / workstream / the single initiative.
  let planName = label ?? initiatives.map((i) => i.name).join(', ');
  let planContext: string | null =
    `${initiatives.length} initiative${initiatives.length === 1 ? '' : 's'}`;
  if (subject.programId) {
    const prog = await prisma.program.findFirst({
      where: { id: subject.programId, companyId },
      select: { name: true },
    });
    if (prog) planName = label ?? prog.name;
    planContext = `Program · ${initiatives.length} initiative${initiatives.length === 1 ? '' : 's'}`;
  } else if (subject.workstreamId) {
    const ws = await prisma.workstream.findFirst({
      where: { id: subject.workstreamId, companyId },
      select: { name: true },
    });
    if (ws) planName = label ?? ws.name;
    planContext = `Workstream · ${initiatives.length} initiative${initiatives.length === 1 ? '' : 's'}`;
  }

  const [milestones, benefitLines, costLines, raid] = await Promise.all([
    prisma.milestone.findMany({
      where: { initiativeId: { in: initIds } },
      select: {
        id: true,
        name: true,
        dueDate: true,
        status: true,
        isGate: true,
        completedAt: true,
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.benefitLine.findMany({
      where: { initiativeId: { in: initIds } },
      select: { id: true },
    }),
    prisma.costLine.findMany({ where: { initiativeId: { in: initIds } }, select: { id: true } }),
    prisma.raidItem.groupBy({
      by: ['status'],
      where: { initiativeId: { in: initIds } },
      _count: true,
    }),
  ]);

  const [benefitSum, costSum] = await Promise.all([
    benefitLines.length
      ? prisma.metricValue.aggregate({
          where: { benefitLineId: { in: benefitLines.map((b) => b.id) }, dataset: 'TARGET' },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    costLines.length
      ? prisma.metricValue.aggregate({
          where: { costLineId: { in: costLines.map((c) => c.id) }, dataset: 'TARGET' },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);
  const plannedBenefit = benefitSum._sum.amount ?? 0;
  const plannedCost = costSum._sum.amount ?? 0;

  const impacts: Impact[] = [];

  // ── Milestone impact ────────────────────────────────────────────────────
  const now = new Date();
  const gates = milestones.filter((m) => m.isGate);
  const openGates = gates.filter((m) => m.status !== 'DONE');
  const missed = milestones.filter((m) => m.status === 'MISSED');
  const atRisk = milestones.filter(
    (m) => m.status === 'PENDING' && m.dueDate.getTime() < now.getTime() + 90 * 86_400_000,
  );
  pushCapped(
    impacts,
    openGates,
    ITEM_CAP,
    (m) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'Milestone',
      entityId: m.id,
      entityName: `${m.name} (gate)`,
      description: `Stage gate due ${m.dueDate.toISOString().slice(0, 10)} — a plan change slips this gate and everything sequenced behind it.`,
    }),
    (rest) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'Milestone',
      entityId: null,
      entityName: `${rest.length} more stage gates`,
      description: 'Also slip if the plan moves.',
      count: rest.length,
    }),
  );
  if (missed.length) {
    impacts.push({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'Milestone',
      entityId: null,
      entityName: `${missed.length} already-missed milestone${missed.length === 1 ? '' : 's'}`,
      description: 'Behind schedule before this change — the slip compounds an existing overrun.',
      count: missed.length,
    });
  }
  const otherAtRisk = atRisk.filter((m) => !m.isGate).length;
  if (otherAtRisk) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'Milestone',
      entityId: null,
      entityName: `${otherAtRisk} milestone${otherAtRisk === 1 ? '' : 's'} due within a quarter`,
      description: 'Near-term milestones a reschedule / pause pushes out.',
      count: otherAtRisk,
    });
  }

  // ── Funding & benefits impact ───────────────────────────────────────────
  if (plannedBenefit > 0) {
    impacts.push({
      severity: grade('HIGH', cls),
      domain: 'data',
      category: 'initiatives',
      entityType: 'BenefitLine',
      entityId: null,
      entityName: `${money(plannedBenefit)} targeted benefit`,
      description:
        'Rescheduling or pausing defers this benefit — value delayed quarter over quarter until the plan re-lands.',
      count: benefitLines.length,
    });
  }
  if (plannedCost > 0) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'CostLine',
      entityId: null,
      entityName: `${money(plannedCost)} planned spend`,
      description:
        'Funding variance — defunding releases it, accelerating pulls it forward, rescheduling re-phases the burn.',
      count: costLines.length,
    });
  }

  // ── Downstream operating-model impact ───────────────────────────────────
  const vsNodeIds = [
    ...new Set(initiatives.map((i) => i.valueStreamNodeId).filter(Boolean)),
  ] as string[];
  const ancestry = vsNodeIds.length ? await streamAncestry(vsNodeIds) : new Map();
  const streams = [
    ...new Set([...ancestry.values()].map((a) => a.valueStreamName).filter(Boolean)),
  ];
  if (vsNodeIds.length) {
    impacts.push({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: vsNodeIds[0],
      entityName: `${vsNodeIds.length} linked value-stream node${vsNodeIds.length === 1 ? '' : 's'}`,
      description: streams.length
        ? `The plan drives change in: ${streams.slice(0, 6).join(', ')}${streams.length > 6 ? '…' : ''}. Moving it moves the operating-model work with it.`
        : 'The plan drives operating-model change on these nodes — moving it moves that work.',
      count: vsNodeIds.length,
    });
  }

  // Owner roles & org units carrying the initiatives.
  const ownerRoles = new Map<string, string>();
  const orgUnits = new Map<string, string>();
  for (const i of initiatives) {
    if (i.ownerRole) ownerRoles.set(i.ownerRole.id, i.ownerRole.displayValue);
    if (i.orgUnit) orgUnits.set(i.orgUnit.id, i.orgUnit.displayValue);
  }
  if (ownerRoles.size) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'roles',
      entityType: 'Role',
      entityId: ownerRoles.size === 1 ? [...ownerRoles.keys()][0] : null,
      entityName:
        ownerRoles.size === 1
          ? [...ownerRoles.values()][0]
          : `${ownerRoles.size} initiative owner${ownerRoles.size === 1 ? '' : 's'}`,
      description: 'Own the affected initiatives — their delivery commitments move with the plan.',
      count: ownerRoles.size,
    });
  }

  // RAID — open risks/issues a plan change disturbs.
  const openRaid = raid
    .filter((r) => r.status === 'OPEN')
    .reduce((n, r) => n + (typeof r._count === 'number' ? r._count : 0), 0);
  if (openRaid) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'RaidItem',
      entityId: null,
      entityName: `${openRaid} open RAID item${openRaid === 1 ? '' : 's'}`,
      description: 'Open risks, issues and decisions a plan change re-opens or invalidates.',
      count: openRaid,
    });
  }

  // Compliance line — cancelling/defunding a mandated programme has a control
  // dimension (the emphasis on CANCEL grades this harder).
  impacts.push({
    severity: grade('LOW', cls),
    domain: 'compliance',
    category: 'compliance',
    entityType: 'PortfolioInitiative',
    entityId: null,
    entityName: 'Regulatory-commitment check',
    description:
      'Confirm none of the affected initiatives satisfy a regulatory commitment or filing deadline before moving them.',
  });

  // Scope line.
  impacts.push({
    severity: 'LOW',
    domain: 'operational',
    category: 'scope',
    entityType: 'PortfolioInitiative',
    entityId: initIds[0],
    entityName: planName,
    description: `${initiatives.length} initiative${initiatives.length === 1 ? '' : 's'}, ${milestones.length} milestone${milestones.length === 1 ? '' : 's'} (${gates.length} gate${gates.length === 1 ? '' : 's'}), ${money(plannedBenefit)} benefit / ${money(plannedCost)} cost planned.`,
    count: initiatives.length,
  });

  const sections: ImpactSection[] = [
    {
      key: 'milestone-impact',
      title: 'Milestone impact',
      blurb: 'Which milestones and stage gates slip if the plan moves.',
      rows: milestones.slice(0, 12).map((m) => ({
        label: m.name + (m.isGate ? ' (gate)' : ''),
        detail: `${m.status} · due ${m.dueDate.toISOString().slice(0, 10)}`,
        entityType: 'Milestone',
        entityId: m.id,
      })),
    },
    {
      key: 'downstream-impact',
      title: 'Downstream operating-model impact',
      blurb: 'Value streams, roles and deliverables the affected initiatives drive.',
      rows: [
        ...streams.slice(0, 8).map((s) => ({ label: s, detail: 'Linked value stream' })),
        ...[...ownerRoles.values()]
          .slice(0, 8)
          .map((r) => ({ label: r, detail: 'Initiative owner' })),
      ],
    },
    {
      key: 'funding-benefits',
      title: 'Funding & benefits impact',
      blurb: 'Planned spend, targeted benefit and the deferral a move creates.',
      rows: [
        { label: 'Targeted benefit', detail: money(plannedBenefit) },
        { label: 'Planned cost', detail: money(plannedCost) },
        { label: 'Net', detail: money(plannedBenefit - plannedCost) },
      ],
    },
  ];

  const stakeholders = deriveStakeholders(impacts, {
    changeType,
    lens: 'plan',
    ownerRoles: [...ownerRoles.entries()].map(([id, name]) => ({ id, name })),
    orgUnits: [...orgUnits.entries()].map(([id, name]) => ({ id, name })),
  });

  return buildReport(
    { kind: 'plan', id: initIds[0], name: planName, context: planContext },
    changeType,
    impacts,
    { stakeholders, sections },
  );
}
