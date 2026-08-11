// Impact walker for Deliverable subjects (Change Impact v2, Workstream B) — the
// documents call this potentially the most valuable assessment. A deliverable
// is the atomic artifact a process produces; changing it (eliminate, merge,
// convert to structured data / knowledge object, AI-generate, …) ripples to the
// tasks that produce it, the roles that own/contribute it, the systems that
// perform those tasks, the controls that govern it, and the tests that verify
// it. The walk batch-reads every junction the deliverable set touches — no
// per-row fan-out — and also emits the deliverable-specific staged artifacts
// (Producers, Consumers, Information components, Knowledge extraction,
// Governance) the panel renders.
import { prisma } from '../../db/prisma.js';
import { appsForNodes, streamAncestry } from '../../lib/resolvers/index.js';
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
  type ImpactSectionRow,
} from './types.js';

const ITEM_CAP = 10;

export async function assessDeliverable(
  companyId: string,
  deliverableIds: string[],
  changeType: ChangeType,
  label?: string,
): Promise<ImpactReport | null> {
  const cls = classOf(changeType);
  const delivs = await prisma.deliverable.findMany({
    where: { id: { in: deliverableIds }, companyId },
    select: { id: true, title: true, description: true, automatability: true },
  });
  if (!delivs.length) return null;
  const ids = delivs.map((d) => d.id);

  // Producers/consumers: role links (Owner = producer, Contributor = consumer)
  // and the process nodes that produce the deliverable via NodeDeliverable.
  const [roleLinks, nodeLinks, stdLinks, regLinks, testingCount] = await Promise.all([
    prisma.roleDeliverable.findMany({
      where: { deliverableId: { in: ids } },
      select: { role_: true, roleId: true, role: { select: { displayValue: true } } },
    }),
    prisma.nodeDeliverable.findMany({
      where: { deliverableId: { in: ids } },
      select: { processNodeId: true, processNode: { select: { displayValue: true } } },
    }),
    prisma.standardDeliverable.findMany({
      where: { deliverableId: { in: ids } },
      select: { standardId: true, standard: { select: { name: true } } },
    }),
    prisma.regulationDeliverable.findMany({
      where: { deliverableId: { in: ids } },
      select: { regId: true, regulation: { select: { title: true } } },
    }),
    prisma.testingTemplate.count({ where: { deliverableId: { in: ids } } }),
  ]);

  const producerNodeIds = [...new Set(nodeLinks.map((l) => l.processNodeId))];
  const owners = new Map<string, string>();
  const contributors = new Map<string, string>();
  for (const l of roleLinks) {
    (l.role_ === 'Owner' ? owners : contributors).set(l.roleId, l.role.displayValue);
  }

  // From the producing tasks: the systems that perform them (technology), and
  // the governance inherited from their L2/L3 ancestors (compliance). Nothing
  // attaches directly to a task — standards/regs are inherited up the spine.
  const [appMap, ancestryMap, inheritedStd, inheritedReg] = await Promise.all([
    producerNodeIds.length ? appsForNodes(producerNodeIds) : Promise.resolve(new Map()),
    producerNodeIds.length ? streamAncestry(producerNodeIds) : Promise.resolve(new Map()),
    inheritedControls(companyId, producerNodeIds, 'standard'),
    inheritedControls(companyId, producerNodeIds, 'regulation'),
  ]);

  const impacts: Impact[] = [];

  // Producing tasks lose the thing they produce.
  pushCapped(
    impacts,
    nodeLinks,
    ITEM_CAP,
    (l) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: l.processNodeId,
      entityName: l.processNode.displayValue,
      description: 'Produces this deliverable — the task changes with the artifact it emits.',
    }),
    (rest) => ({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'tasks',
      entityType: 'ProcessNode',
      entityId: null,
      entityName: `${rest.length} more producing tasks`,
      description: 'Also produce this deliverable.',
      count: rest.length,
    }),
  );

  // Owner roles are on the hook for the artifact; contributors feed it.
  if (owners.size) {
    impacts.push({
      severity: grade('HIGH', cls),
      domain: 'operational',
      category: 'roles',
      entityType: 'Role',
      entityId: owners.size === 1 ? [...owners.keys()][0] : null,
      entityName:
        owners.size === 1
          ? [...owners.values()][0]
          : `${owners.size} owning role${owners.size === 1 ? '' : 's'}`,
      description: 'Owns this deliverable — accountable for the changed artifact and its sign-off.',
      count: owners.size,
    });
  }
  if (contributors.size) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'operational',
      category: 'roles',
      entityType: 'Role',
      entityId: null,
      entityName: `${contributors.size} contributing role${contributors.size === 1 ? '' : 's'}`,
      description: 'Feed this deliverable — their inputs and hand-offs shift with the change.',
      count: contributors.size,
    });
  }

  // Systems performing the producing tasks — a technology impact.
  const appIds = new Set<string>();
  const appNames = new Map<string, string>();
  for (const entries of appMap.values())
    for (const a of entries) {
      appIds.add(a.id);
      appNames.set(a.id, a.name);
    }
  if (appIds.size) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'technology',
      category: 'applications',
      entityType: 'Application',
      entityId: appIds.size === 1 ? [...appIds][0] : null,
      entityName:
        appIds.size === 1
          ? [...appNames.values()][0]
          : `${appIds.size} application${appIds.size === 1 ? '' : 's'}`,
      description:
        'Perform or memorialize the tasks that produce this deliverable — templates and outputs need repointing.',
      count: appIds.size,
    });
  }

  // Governance: controls tied directly to the deliverable PLUS controls
  // inherited over its producing tasks. Folds into the Compliance domain.
  const stdIds = new Set([...stdLinks.map((s) => s.standardId), ...inheritedStd.ids]);
  const regEntries = new Map<string, string>([
    ...regLinks.map((r) => [r.regId, r.regulation.title] as const),
    ...inheritedReg.named,
  ]);
  pushCapped(
    impacts,
    [...regEntries.entries()],
    ITEM_CAP,
    ([id, title]) => ({
      severity: grade('BREAKING', cls),
      domain: 'compliance',
      category: 'compliance',
      entityType: 'Regulation',
      entityId: id,
      entityName: title,
      description:
        'Governs this deliverable (directly or through its producing tasks) — the obligation, retention and audit trail must survive the change.',
    }),
    (rest) => ({
      severity: grade('BREAKING', cls),
      domain: 'compliance',
      category: 'compliance',
      entityType: 'Regulation',
      entityId: null,
      entityName: `${rest.length} more governing regulations`,
      description: 'Also apply to this deliverable.',
      count: rest.length,
    }),
  );
  if (stdIds.size) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'compliance',
      category: 'standards',
      entityType: 'Standard',
      entityId: null,
      entityName: `${stdIds.size} applicable standard${stdIds.size === 1 ? '' : 's'}`,
      description: 'Set the format, content and control expectations this deliverable must meet.',
      count: stdIds.size,
    });
  }

  // Verification assets tied to the deliverable.
  if (testingCount) {
    impacts.push({
      severity: grade('MEDIUM', cls),
      domain: 'testing',
      category: 'testing',
      entityType: 'TestingTemplate',
      entityId: null,
      entityName: `${testingCount} testing template${testingCount === 1 ? '' : 's'}`,
      description:
        'Verify this deliverable — scripts, UAT and regression packs must be rewritten to the new artifact.',
      count: testingCount,
    });
  }

  // Data impact — a deliverable's content is a data surface; converting or
  // system-generating it re-models what downstream analytics read.
  impacts.push({
    severity: grade('MEDIUM', cls),
    domain: 'data',
    category: 'deliverables',
    entityType: 'Deliverable',
    entityId: ids.length === 1 ? ids[0] : null,
    entityName: `${delivs.length} deliverable${delivs.length === 1 ? '' : 's'} in scope`,
    description:
      'The information this deliverable carries — its sections, fields and evidence — is a data surface that downstream reporting depends on.',
    count: delivs.length,
  });

  // Scope line — always present.
  const streams = [
    ...new Set([...ancestryMap.values()].map((a) => a.valueStreamName).filter(Boolean)),
  ];
  impacts.push({
    severity: 'LOW',
    domain: 'operational',
    category: 'scope',
    entityType: 'Deliverable',
    entityId: ids[0],
    entityName: label ?? delivs.map((d) => d.title).join(' · '),
    description: `${nodeLinks.length} producing task link${nodeLinks.length === 1 ? '' : 's'}, ${roleLinks.length} role link${roleLinks.length === 1 ? '' : 's'}${streams.length ? `, across ${streams.length} value stream${streams.length === 1 ? '' : 's'}` : ''}.`,
    count: delivs.length,
  });

  // Deliverable-specific staged artifacts.
  const sections = buildSections({
    owners: [...owners.values()],
    contributors: [...contributors.values()],
    producerNodes: nodeLinks.map((l) => l.processNode.displayValue),
    systems: [...appNames.values()],
    standards: stdLinks.map((s) => s.standard.name),
    regulations: [...regEntries.values()],
    automatability: delivs[0]?.automatability ?? null,
  });

  const stakeholders = deriveStakeholders(impacts, {
    changeType,
    lens: 'deliverable',
    ownerRoles: [...owners.entries()].map(([id, name]) => ({ id, name })),
  });

  return buildReport(
    {
      kind: 'deliverable',
      id: ids[0],
      name: label ?? delivs.map((d) => d.title).join(', '),
      context:
        delivs.length === 1
          ? (delivs[0].description?.slice(0, 140) ?? null)
          : `${delivs.length} deliverables`,
    },
    changeType,
    impacts,
    { stakeholders, sections },
  );
}

/** Standards/regs inherited over a set of tasks — walk each task to its
 *  ancestors via the closure, then read the non-excluded control junctions on
 *  the ancestor set. Returns ids (+ named for regulations). */
async function inheritedControls(
  companyId: string,
  taskIds: string[],
  kind: 'standard' | 'regulation',
): Promise<{ ids: Set<string>; named: [string, string][] }> {
  if (!taskIds.length) return { ids: new Set(), named: [] };
  const up = await prisma.processNodeClosure.findMany({
    where: { descendantId: { in: taskIds } },
    select: { ancestorId: true },
  });
  const govIds = [...new Set([...taskIds, ...up.map((u) => u.ancestorId)])];
  if (kind === 'standard') {
    const links = await prisma.nodeStandard.findMany({
      where: { processNodeId: { in: govIds }, excluded: false, standard: { companyId } },
      select: { standardId: true },
    });
    return { ids: new Set(links.map((l) => l.standardId)), named: [] };
  }
  const links = await prisma.nodeRegulation.findMany({
    where: { processNodeId: { in: govIds }, excluded: false, regulation: { companyId } },
    select: { regId: true, regulation: { select: { title: true } } },
  });
  const named = [...new Map(links.map((l) => [l.regId, l.regulation.title] as const)).entries()];
  return { ids: new Set(links.map((l) => l.regId)), named };
}

/** The Deliverable lens's staged artifacts (Purpose → Producers → Consumers →
 *  Information components → Knowledge extraction → Governance). The
 *  deterministic walk fills Producers/Consumers/Governance; Information
 *  components and Knowledge extraction are AI-derived (via /impact/analyze) and
 *  editable on the client, so they ship as prompts, not empty. */
function buildSections(d: {
  owners: string[];
  contributors: string[];
  producerNodes: string[];
  systems: string[];
  standards: string[];
  regulations: string[];
  automatability: string | null;
}): ImpactSection[] {
  const rows = (labels: string[], detail: string): ImpactSectionRow[] =>
    labels.slice(0, 12).map((label) => ({ label, detail }));

  const producers: ImpactSectionRow[] = [
    ...rows(d.owners, 'Owner role'),
    ...rows(d.contributors, 'Contributor role'),
    ...rows(d.producerNodes, 'Producing task'),
    ...rows(d.systems, 'Producing / memorializing system'),
  ];
  const governance: ImpactSectionRow[] = [
    ...rows(d.standards, 'Standard'),
    ...rows(d.regulations, 'Regulation'),
  ];

  return [
    {
      key: 'producers',
      title: 'Producers',
      blurb: 'Owner/contributor roles, producing tasks and the systems that generate it.',
      rows: producers.length ? producers : [{ label: 'No producers linked in the graph yet' }],
    },
    {
      key: 'consumers',
      title: 'Consumers',
      blurb: 'Roles and downstream nodes that depend on this deliverable and its approval chain.',
      rows: d.contributors.length
        ? rows(d.contributors, 'Consuming / contributing role')
        : [{ label: 'Consumers derived on analysis', detail: 'Run the AI deep-dive to enumerate' }],
    },
    {
      key: 'information-components',
      title: 'Information components',
      blurb:
        'Decomposition into sections / fields / data elements / evidence / rules / decisions — AI-derived and editable.',
      rows: [
        {
          label: 'Run the AI deep-dive to decompose this deliverable',
          detail: 'Sections, fields, data elements, evidence, rules and decisions',
        },
      ],
    },
    {
      key: 'knowledge-extraction',
      title: 'Knowledge extraction',
      blurb:
        'Can it become structured data or a knowledge object with citations and lineage preserved?',
      rows: [
        {
          label:
            d.automatability === 'automated'
              ? 'Already automatable — strong candidate for a knowledge object'
              : 'Assess conversion to structured data / knowledge object',
          detail: governance.length
            ? 'Preserve citations to the governing standards/regulations and its lineage'
            : 'Preserve source lineage on conversion',
        },
      ],
    },
    {
      key: 'governance',
      title: 'Governance',
      blurb: 'Approval chain, retention, compliance and audit — folds into the Compliance domain.',
      rows: governance.length
        ? governance
        : [
            {
              label: 'No controls linked',
              detail: 'No standards or regulations govern this today',
            },
          ],
    },
  ];
}
