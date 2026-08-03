// Impact walker for process-spine subjects (the Value-streams lens rows, and
// any decision anchored on ProcessNode ids). Expands the subject nodes through
// the closure, then batch-reads every junction the scope touches — roles,
// applications, deliverables, checklists, inherited governance, initiatives —
// and grades each by the change class. No per-row fan-out.
import { prisma } from '../../db/prisma.js';
import { appsForNodes, rolesForNodes, streamAncestry } from '../../lib/resolvers/index.js';
import {
  buildReport,
  classOf,
  grade,
  pushCapped,
  type ChangeType,
  type Impact,
  type ImpactReport,
} from './types.js';

/** Past this many scope nodes the sole-producer refinement is skipped (the
 *  NOT-IN probe would be heavier than the value of the distinction). */
const SOLE_CHECK_CAP = 4000;
const ITEM_CAP = 10;

export async function assessProcessNodes(
  companyId: string,
  nodeIds: string[],
  changeType: ChangeType,
  label?: string,
): Promise<ImpactReport | null> {
  const cls = classOf(changeType);
  const roots = await prisma.processNode.findMany({
    where: { id: { in: nodeIds }, companyId },
    select: { id: true, displayValue: true, isTask: true },
  });
  if (!roots.length) return null;
  const rootIds = roots.map((r) => r.id);

  // Scope = the subject nodes plus everything beneath them; governance is
  // inherited from ancestors, so those are read separately.
  const [down, up] = await Promise.all([
    prisma.processNodeClosure.findMany({
      where: { ancestorId: { in: rootIds } },
      select: { descendantId: true },
    }),
    prisma.processNodeClosure.findMany({
      where: { descendantId: { in: rootIds } },
      select: { ancestorId: true },
    }),
  ]);
  const scopeIds = [...new Set(down.map((c) => c.descendantId))];
  const govIds = [...new Set([...scopeIds, ...up.map((u) => u.ancestorId)])];

  const [
    taskCount,
    roleMap,
    appMap,
    delivLinks,
    checklistCount,
    stdLinks,
    regLinks,
    initLinks,
    extCount,
    ancestry,
    testingTemplateCount,
    testPlanCount,
  ] = await Promise.all([
    prisma.processNode.count({ where: { id: { in: scopeIds }, isTask: true } }),
    rolesForNodes(scopeIds),
    appsForNodes(scopeIds),
    prisma.nodeDeliverable.findMany({
      where: { processNodeId: { in: scopeIds } },
      select: { deliverableId: true, deliverable: { select: { title: true } } },
    }),
    prisma.nodeChecklist.count({ where: { processNodeId: { in: scopeIds } } }),
    prisma.nodeStandard.findMany({
      where: { processNodeId: { in: govIds }, excluded: false },
      select: { standardId: true, standard: { select: { name: true } } },
    }),
    prisma.nodeRegulation.findMany({
      where: { processNodeId: { in: govIds }, excluded: false },
      select: { regId: true, regulation: { select: { title: true } } },
    }),
    prisma.nodeInitiative.findMany({
      where: { processNodeId: { in: scopeIds } },
      select: { initiativeId: true, initiative: { select: { name: true } } },
    }),
    prisma.externalInteraction.count({ where: { processNodeId: { in: scopeIds } } }),
    streamAncestry(rootIds),
    prisma.testingTemplate.count({ where: { taskNodeId: { in: scopeIds } } }),
    prisma.nodeWorkTemplate.count({
      where: { processNodeId: { in: scopeIds }, template: { kind: 'TEST' } },
    }),
  ]);

  const impacts: Impact[] = [];

  // Deliverables — a deliverable produced ONLY inside the scope has no other
  // producer left after a destructive change.
  const delivTitles = new Map(delivLinks.map((l) => [l.deliverableId, l.deliverable.title]));
  const delivIds = [...delivTitles.keys()];
  let soleDeliv: string[] = [];
  if (delivIds.length && scopeIds.length <= SOLE_CHECK_CAP) {
    const outside = await prisma.nodeDeliverable.groupBy({
      by: ['deliverableId'],
      where: { deliverableId: { in: delivIds }, processNodeId: { notIn: scopeIds } },
    });
    const alsoOutside = new Set(outside.map((o) => o.deliverableId));
    soleDeliv = delivIds.filter((d) => !alsoOutside.has(d));
  }
  pushCapped(
    impacts,
    soleDeliv,
    ITEM_CAP,
    (id) => ({
      severity: grade('BREAKING', cls),
      domain: 'operational',
      category: 'deliverables',
      entityType: 'Deliverable',
      entityId: id,
      entityName: delivTitles.get(id) ?? 'Deliverable',
      description: 'Produced only by tasks in this scope — no other process produces it.',
    }),
    (rest) => ({
      severity: grade('BREAKING', cls),
      domain: 'operational',
      category: 'deliverables',
      entityType: 'Deliverable',
      entityId: null,
      entityName: `${rest.length} more sole-producer deliverables`,
      description: 'Also produced only inside this scope.',
      count: rest.length,
    }),
  );
  const coDeliv = delivIds.filter((d) => !soleDeliv.includes(d));
  if (coDeliv.length) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'deliverables',
      entityType: 'Deliverable',
      entityId: null,
      entityName: `${coDeliv.length} deliverable${coDeliv.length === 1 ? '' : 's'}`,
      description: 'Linked to this scope but also produced elsewhere.',
      count: coDeliv.length,
    });
  }

  // Regulations / standards — inherited governance over the scope's tasks.
  const regTitles = new Map(regLinks.map((l) => [l.regId, l.regulation.title]));
  pushCapped(
    impacts,
    [...regTitles.entries()],
    ITEM_CAP,
    ([id, title]) => ({
      severity: grade('BREAKING', cls),
      domain: 'compliance',
      category: 'compliance',
      entityType: 'Regulation',
      entityId: id,
      entityName: title,
      description: 'Governs this scope — the obligation remains and must be satisfied elsewhere.',
    }),
    (rest) => ({
      severity: grade('BREAKING', cls),
      domain: 'compliance',
      category: 'compliance',
      entityType: 'Regulation',
      entityId: null,
      entityName: `${rest.length} more governing regulations`,
      description: 'Also apply to this scope.',
      count: rest.length,
    }),
  );
  const stdCount = new Set(stdLinks.map((l) => l.standardId)).size;
  if (stdCount) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'compliance',
      category: 'standards',
      entityType: 'Standard',
      entityId: null,
      entityName: `${stdCount} applicable standard${stdCount === 1 ? '' : 's'}`,
      description: 'Apply to tasks in this scope through the process hierarchy.',
      count: stdCount,
    });
  }

  // Roles — aggregate owner/participant footprint per role across the scope.
  const byRole = new Map<string, { name: string; owner: number; participant: number }>();
  for (const entries of roleMap.values()) {
    for (const e of entries) {
      const cur = byRole.get(e.id) ?? { name: e.name, owner: 0, participant: 0 };
      if (e.role_ === 'Owner') cur.owner += 1;
      else cur.participant += 1;
      byRole.set(e.id, cur);
    }
  }
  const owners = [...byRole.entries()]
    .filter(([, v]) => v.owner > 0)
    .sort((a, b) => b[1].owner - a[1].owner);
  pushCapped(
    impacts,
    owners,
    ITEM_CAP,
    ([id, v]) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'roles',
      entityType: 'Role',
      entityId: id,
      entityName: v.name,
      description: `Owns ${v.owner} task${v.owner === 1 ? '' : 's'} in this scope — ownership must be re-planned.`,
      count: v.owner,
    }),
    (rest) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'roles',
      entityType: 'Role',
      entityId: null,
      entityName: `${rest.length} more owning roles`,
      description: 'Also own tasks in this scope.',
      count: rest.length,
    }),
  );
  const participants = [...byRole.values()].filter((v) => v.owner === 0 && v.participant > 0);
  if (participants.length) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'roles',
      entityType: 'Role',
      entityId: null,
      entityName: `${participants.length} participating role${participants.length === 1 ? '' : 's'}`,
      description: 'Work in this scope as participants — their day-to-day changes.',
      count: participants.length,
    });
  }

  // Applications — systems performing or memorializing work in the scope.
  const byApp = new Map<string, { name: string; performed: number; memorialized: number }>();
  for (const entries of appMap.values()) {
    for (const a of entries) {
      const cur = byApp.get(a.id) ?? { name: a.name, performed: 0, memorialized: 0 };
      if (a.usageType === 'performed') cur.performed += 1;
      else cur.memorialized += 1;
      byApp.set(a.id, cur);
    }
  }
  const performing = [...byApp.entries()]
    .filter(([, v]) => v.performed > 0)
    .sort((a, b) => b[1].performed - a[1].performed);
  pushCapped(
    impacts,
    performing,
    ITEM_CAP,
    ([id, v]) => ({
      severity: grade('HIGH', cls),
      domain: 'technology',
      category: 'applications',
      entityType: 'Application',
      entityId: id,
      entityName: v.name,
      description: `Performs ${v.performed} task${v.performed === 1 ? '' : 's'} in this scope — integrations and licences are affected.`,
      count: v.performed,
    }),
    (rest) => ({
      severity: grade('HIGH', cls),
      domain: 'technology',
      category: 'applications',
      entityType: 'Application',
      entityId: null,
      entityName: `${rest.length} more performing applications`,
      description: 'Also perform tasks in this scope.',
      count: rest.length,
    }),
  );
  // Systems of record memorializing the scope's outputs are a DATA impact —
  // their data model, warehouse feeds, and reporting change with the work.
  const memorializing = [...byApp.values()].filter((v) => v.performed === 0 && v.memorialized > 0);
  if (memorializing.length) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'data',
      category: 'applications',
      entityType: 'Application',
      entityId: null,
      entityName: `${memorializing.length} system${memorializing.length === 1 ? '' : 's'} of record`,
      description:
        'Memorialize outputs of this scope — records, warehouse feeds and downstream analytics change.',
      count: memorializing.length,
    });
  }

  // Testing assets attached to the scope's tasks — verification templates and
  // test-pattern work plans that must be rewritten or retired with the work.
  if (testingTemplateCount + testPlanCount > 0) {
    const parts = [
      testingTemplateCount
        ? `${testingTemplateCount} testing template${testingTemplateCount === 1 ? '' : 's'}`
        : null,
      testPlanCount ? `${testPlanCount} test plan${testPlanCount === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'testing',
      category: 'testing',
      entityType: 'TestingTemplate',
      entityId: null,
      entityName: parts.join(' · '),
      description:
        'Attached to tasks in this scope — test scripts, UAT and regression packs need updating.',
      count: testingTemplateCount + testPlanCount,
    });
  }

  // Initiatives / checklists / external interactions.
  const inits = [...new Map(initLinks.map((l) => [l.initiativeId, l.initiative.name])).entries()];
  pushCapped(
    impacts,
    inits,
    ITEM_CAP,
    ([id, name]) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'Initiative',
      entityId: id,
      entityName: name,
      description: 'Depends on process nodes in this scope.',
    }),
    (rest) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'initiatives',
      entityType: 'Initiative',
      entityId: null,
      entityName: `${rest.length} more initiatives`,
      description: 'Also depend on this scope.',
      count: rest.length,
    }),
  );
  if (checklistCount) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'checklists',
      entityType: 'ChecklistItem',
      entityId: null,
      entityName: `${checklistCount} checklist item${checklistCount === 1 ? '' : 's'}`,
      description: 'Attached to tasks in this scope.',
      count: checklistCount,
    });
  }
  if (extCount) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'external',
      entityType: 'ExternalInteraction',
      entityId: null,
      entityName: `${extCount} external hand-off${extCount === 1 ? '' : 's'}`,
      description: 'Third parties interact with this scope (hand-offs, approvals, data).',
      count: extCount,
    });
  }

  // Scope line — always present so the report states what was walked.
  impacts.push({
    severity: 'LOW',
    domain: 'operational',
    category: 'scope',
    entityType: 'ProcessNode',
    entityId: rootIds[0],
    entityName: label ?? roots.map((r) => r.displayValue).join(' · '),
    description: `${scopeIds.length} process node${scopeIds.length === 1 ? '' : 's'} in scope, ${taskCount} of them tasks.`,
    count: scopeIds.length,
  });

  const streams = [
    ...new Set([...ancestry.values()].map((a) => a.valueStreamName).filter(Boolean)),
  ];
  return buildReport(
    {
      kind: 'process-nodes',
      id: rootIds[0],
      name: label ?? roots.map((r) => r.displayValue).join(' · '),
      context: streams.length
        ? `Value stream${streams.length === 1 ? '' : 's'}: ${streams.join(', ')}`
        : null,
    },
    changeType,
    impacts,
  );
}
