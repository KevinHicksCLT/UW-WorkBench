import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

// Work Library plan read-model for surfacing (Inspector tabs, work chain).
// Derives each task's checklist/testing rows from its assigned WorkTemplates
// (grayed generic keys minus suppressed ones, plus item-specific custom steps)
// and its answers; a row is "defined" when it has a value (text or entity FK).
// Tied standards/regulations are the task's OWN NodeStandard/NodeRegulation
// rows (tasks = single source of truth; higher levels roll up via govRollup).

// generic — true = the row is a generic template key (pattern-owned text shared
// by every plan using it); false = an item-specific step (custom answer or
// standard/regulation evidence row). Surfaces label the two groups distinctly.
export type PlanRow = { key: string; value: string | null; defined: boolean; generic: boolean };
export type TiedPlanItem = {
  id: string;
  name: string;
  source: string | null;
  direct: boolean;
  checklist: PlanRow[];
  testing: PlanRow[];
};
export type TaskPlan = {
  checklist: PlanRow[];
  testing: PlanRow[];
  standards: TiedPlanItem[];
  regulations: TiedPlanItem[];
  defined: number;
  total: number;
};

const valueInclude = {
  application: { select: { name: true } },
  role: { select: { displayValue: true } },
  deliverable: { select: { title: true } },
} as const;

function resolvedValue(
  a:
    | {
        value: string | null;
        application: { name: string } | null;
        role: { displayValue: string } | null;
        deliverable: { title: string } | null;
      }
    | null
    | undefined,
): string | null {
  if (!a) return null;
  return a.application?.name ?? a.role?.displayValue ?? a.deliverable?.title ?? a.value ?? null;
}

// Aggregate plan completeness for a whole subtree in ONE SQL round trip —
// containers (VS / L2 / L3) show a defined/total meter without loading every
// task's full plan. Mirrors taskPlans() row semantics: generic keys of
// assigned templates minus suppressed, plus custom steps, plus tied
// standard/reg evidence steps; "defined" = text value or entity FK present.
export type SubtreePlanRollup = {
  tasksWithPlan: number;
  defined: number;
  total: number;
  checklistKeys: number;
  testingKeys: number;
};

export async function subtreePlanRollup(rootId: string): Promise<SubtreePlanRollup> {
  const defined = Prisma.sql`(a.value IS NOT NULL OR a."applicationId" IS NOT NULL OR a."roleId" IS NOT NULL OR a."deliverableId" IS NOT NULL)`;
  const evDefined = Prisma.sql`(e.value IS NOT NULL OR e."applicationId" IS NOT NULL OR e."roleId" IS NOT NULL OR e."deliverableId" IS NOT NULL)`;
  const rows = await prisma.$queryRaw<Record<string, number>[]>(Prisma.sql`
    SELECT
      (SELECT count(DISTINCT nwt."processNodeId")::int FROM public."NodeWorkTemplate" nwt
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = nwt."processNodeId" AND c."ancestorId" = ${rootId}) AS tasks_with_plan,
      (SELECT count(*)::int FROM public."NodeWorkTemplate" nwt
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = nwt."processNodeId" AND c."ancestorId" = ${rootId}
        JOIN public."WorkTemplateKey" k ON k."templateId" = nwt."templateId"
        JOIN public."WorkTemplate" t ON t.id = nwt."templateId" AND t.kind = 'CHECKLIST') AS generic_ck,
      (SELECT count(*)::int FROM public."NodeWorkTemplate" nwt
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = nwt."processNodeId" AND c."ancestorId" = ${rootId}
        JOIN public."WorkTemplateKey" k ON k."templateId" = nwt."templateId"
        JOIN public."WorkTemplate" t ON t.id = nwt."templateId" AND t.kind = 'TEST') AS generic_ts,
      (SELECT count(*)::int FROM public."NodeTemplateAnswer" a
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = a."processNodeId" AND c."ancestorId" = ${rootId}
        JOIN public."WorkTemplateKey" k ON k.id = a."templateKeyId"
        JOIN public."WorkTemplate" t ON t.id = k."templateId"
        JOIN public."NodeWorkTemplate" nwt ON nwt."processNodeId" = a."processNodeId" AND nwt."templateId" = k."templateId"
        WHERE a.suppressed AND t.kind = 'CHECKLIST') AS suppressed_ck,
      (SELECT count(*)::int FROM public."NodeTemplateAnswer" a
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = a."processNodeId" AND c."ancestorId" = ${rootId}
        JOIN public."WorkTemplateKey" k ON k.id = a."templateKeyId"
        JOIN public."WorkTemplate" t ON t.id = k."templateId"
        JOIN public."NodeWorkTemplate" nwt ON nwt."processNodeId" = a."processNodeId" AND nwt."templateId" = k."templateId"
        WHERE a.suppressed AND t.kind = 'TEST') AS suppressed_ts,
      (SELECT count(*)::int FROM public."NodeTemplateAnswer" a
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = a."processNodeId" AND c."ancestorId" = ${rootId}
        WHERE a."templateKeyId" IS NULL AND (a.kind IS DISTINCT FROM 'TEST')) AS custom_ck,
      (SELECT count(*)::int FROM public."NodeTemplateAnswer" a
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = a."processNodeId" AND c."ancestorId" = ${rootId}
        WHERE a."templateKeyId" IS NULL AND a.kind = 'TEST') AS custom_ts,
      (SELECT count(*)::int FROM public."NodeTemplateAnswer" a
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = a."processNodeId" AND c."ancestorId" = ${rootId}
        LEFT JOIN public."WorkTemplateKey" k ON k.id = a."templateKeyId"
        LEFT JOIN public."NodeWorkTemplate" nwt ON nwt."processNodeId" = a."processNodeId" AND nwt."templateId" = k."templateId"
        WHERE NOT a.suppressed AND (a."templateKeyId" IS NULL OR nwt.id IS NOT NULL) AND ${defined}) AS defined_answers,
      (SELECT count(*)::int FROM public."NodeStandardEvidence" e
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = e."processNodeId" AND c."ancestorId" = ${rootId}) AS sev_total,
      (SELECT count(*)::int FROM public."NodeStandardEvidence" e
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = e."processNodeId" AND c."ancestorId" = ${rootId}
        WHERE ${evDefined}) AS sev_def,
      (SELECT count(*)::int FROM public."NodeRegulationEvidence" e
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = e."processNodeId" AND c."ancestorId" = ${rootId}) AS rev_total,
      (SELECT count(*)::int FROM public."NodeRegulationEvidence" e
        JOIN public."ProcessNodeClosure" c ON c."descendantId" = e."processNodeId" AND c."ancestorId" = ${rootId}
        WHERE ${evDefined}) AS rev_def`);
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  const checklistKeys = n('generic_ck') - n('suppressed_ck') + n('custom_ck');
  const testingKeys = n('generic_ts') - n('suppressed_ts') + n('custom_ts');
  return {
    tasksWithPlan: n('tasks_with_plan'),
    defined: n('defined_answers') + n('sev_def') + n('rev_def'),
    total: checklistKeys + testingKeys + n('sev_total') + n('rev_total'),
    checklistKeys,
    testingKeys,
  };
}

export async function taskPlans(
  nodeIds: string[],
  opts: { includeTied?: boolean } = {},
): Promise<Map<string, TaskPlan>> {
  const plans = new Map<string, TaskPlan>();
  if (!nodeIds.length) return plans;

  const [links, answers] = await Promise.all([
    prisma.nodeWorkTemplate.findMany({
      where: { processNodeId: { in: nodeIds } },
      select: {
        processNodeId: true,
        template: {
          select: {
            id: true,
            kind: true,
            sortOrder: true,
            keys: { orderBy: { sortOrder: 'asc' }, select: { id: true, key: true } },
          },
        },
      },
    }),
    prisma.nodeTemplateAnswer.findMany({
      where: { processNodeId: { in: nodeIds } },
      orderBy: { sortOrder: 'asc' },
      include: valueInclude,
    }),
  ]);

  const linksByNode = new Map<string, typeof links>();
  for (const l of links) {
    (
      linksByNode.get(l.processNodeId) ?? linksByNode.set(l.processNodeId, []).get(l.processNodeId)!
    ).push(l);
  }
  const answersByNode = new Map<string, typeof answers>();
  for (const a of answers) {
    (
      answersByNode.get(a.processNodeId) ??
      answersByNode.set(a.processNodeId, []).get(a.processNodeId)!
    ).push(a);
  }

  // Tied standards/regs (derived from closure ancestors) + their evidence steps.
  let stdByNode = new Map<string, TiedPlanItem[]>();
  let regByNode = new Map<string, TiedPlanItem[]>();
  if (opts.includeTied) {
    // Task-grain single source of truth: a task's standards/regs are its OWN
    // NodeStandard/NodeRegulation rows (no upward inheritance — higher levels
    // roll up FROM tasks via lib/govRollup.ts).
    const [nodeStandards, nodeRegs, stdEvidence, regEvidence] = await Promise.all([
      prisma.nodeStandard.findMany({
        where: { processNodeId: { in: nodeIds }, excluded: false },
        select: {
          processNodeId: true,
          standard: { select: { id: true, name: true, department: true } },
        },
      }),
      prisma.nodeRegulation.findMany({
        where: { processNodeId: { in: nodeIds }, excluded: false },
        select: {
          processNodeId: true,
          regulation: { select: { id: true, title: true, regime: true } },
        },
      }),
      prisma.nodeStandardEvidence.findMany({
        where: { processNodeId: { in: nodeIds } },
        orderBy: { sortOrder: 'asc' },
        include: valueInclude,
      }),
      prisma.nodeRegulationEvidence.findMany({
        where: { processNodeId: { in: nodeIds } },
        orderBy: { sortOrder: 'asc' },
        include: valueInclude,
      }),
    ]);
    const evRow = (e: (typeof stdEvidence)[number] | (typeof regEvidence)[number]): PlanRow => {
      const value = resolvedValue(e);
      return { key: e.step, value, defined: !!value, generic: false };
    };
    stdByNode = new Map(nodeIds.map((id) => [id, []]));
    for (const l of nodeStandards) {
      const s = l.standard;
      stdByNode.get(l.processNodeId)?.push({
        id: s.id,
        name: s.name,
        source: s.department,
        direct: true,
        checklist: stdEvidence
          .filter(
            (e) =>
              e.processNodeId === l.processNodeId &&
              e.standardId === s.id &&
              e.kind === 'CHECKLIST',
          )
          .map(evRow),
        testing: stdEvidence
          .filter(
            (e) =>
              e.processNodeId === l.processNodeId && e.standardId === s.id && e.kind === 'TEST',
          )
          .map(evRow),
      });
    }
    regByNode = new Map(nodeIds.map((id) => [id, []]));
    for (const l of nodeRegs) {
      const r = l.regulation;
      regByNode.get(l.processNodeId)?.push({
        id: r.id,
        name: r.title,
        source: r.regime,
        direct: true,
        checklist: regEvidence
          .filter(
            (e) =>
              e.processNodeId === l.processNodeId && e.regId === r.id && e.kind === 'CHECKLIST',
          )
          .map(evRow),
        testing: regEvidence
          .filter(
            (e) => e.processNodeId === l.processNodeId && e.regId === r.id && e.kind === 'TEST',
          )
          .map(evRow),
      });
    }
    for (const list of stdByNode.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    for (const list of regByNode.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  }

  for (const nodeId of nodeIds) {
    const nodeLinks = (linksByNode.get(nodeId) ?? []).sort(
      (a, b) => a.template.sortOrder - b.template.sortOrder,
    );
    const nodeAnswers = answersByNode.get(nodeId) ?? [];
    const byKeyId = new Map(
      nodeAnswers.filter((a) => a.templateKeyId).map((a) => [a.templateKeyId as string, a]),
    );

    const rowsFor = (kind: 'CHECKLIST' | 'TEST'): PlanRow[] => {
      const rows: PlanRow[] = [];
      for (const l of nodeLinks) {
        if (l.template.kind !== kind) continue;
        for (const k of l.template.keys) {
          const answer = byKeyId.get(k.id);
          if (answer?.suppressed) continue;
          const value = resolvedValue(answer);
          rows.push({ key: k.key, value, defined: !!value, generic: true });
        }
      }
      for (const a of nodeAnswers) {
        if (a.templateKeyId || !a.customKey) continue;
        const isTest = a.kind === 'TEST';
        if ((kind === 'TEST') !== isTest) continue;
        const value = resolvedValue(a);
        rows.push({ key: a.customKey, value, defined: !!value, generic: false });
      }
      return rows;
    };

    const checklist = rowsFor('CHECKLIST');
    const testing = rowsFor('TEST');
    const standards = stdByNode.get(nodeId) ?? [];
    const regulations = regByNode.get(nodeId) ?? [];
    const tiedRows = [...standards, ...regulations].flatMap((t) => [...t.checklist, ...t.testing]);
    const all = [...checklist, ...testing, ...tiedRows];
    plans.set(nodeId, {
      checklist,
      testing,
      standards,
      regulations,
      defined: all.filter((r) => r.defined).length,
      total: all.length,
    });
  }
  return plans;
}
