import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import {
  structureCounts, processSubtree, processSubtrees, ancestorNames, streamAncestry, rolesForNodes, appsForNodes,
} from '../lib/resolvers/index.js';

// erd_v5 explorer — the operating-model map + its drill sidebars, the value-stream
// list/tree/flow, telemetry catalog, AI-adoption heat map, the Organization table,
// and the (now-empty) Standards endpoints. Every structural read goes through the
// shared resolvers (ProcessNode/OrgUnit closures + FK junctions), never the dropped
// legacy spines, name-matching, or in-memory tree walks.
//
// Fixed level semantics (LOCKED): process L1 = domain/segment (3), L2 = value
// stream / "division" in the map (17), L3 = process area (135), L4 = sub-process
// (867), L5 = task / isTask (3811). Org L1 = segment, L2 = division (no Dept tier).

const router = Router();
router.use(requireAuth);

async function activeCompany(req: Request, select: { id?: true; name?: true } = { id: true, name: true }) {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  return prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select,
  });
}

// process-level-type id → levelNumber for a company (cheap, used by several routes).
async function processLevelMap(companyId: string) {
  const types = await prisma.processLevelType.findMany({ where: { companyId }, select: { id: true, levelNumber: true } });
  return { byId: new Map(types.map((t) => [t.id, t.levelNumber])), idOf: (n: number) => types.find((t) => t.levelNumber === n)?.id ?? null };
}

// ── overview (map bootstrap) ────────────────────────────────────────────────
// domains = process L1, divisions = process L2 (the map's L2 row). Per-bucket
// counts come from groupBy, not a whole-tree load.
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const { idOf } = await processLevelMap(company.id);
    const l1 = idOf(1); const l2 = idOf(2);

    const [domains, divisions, divRoleCounts] = await Promise.all([
      l1 ? prisma.processNode.findMany({ where: { companyId: company.id, processLevelTypeId: l1 }, orderBy: { sortOrder: 'asc' }, select: { id: true, displayValue: true } }) : Promise.resolve([]),
      l2 ? prisma.processNode.findMany({ where: { companyId: company.id, processLevelTypeId: l2 }, orderBy: { sortOrder: 'asc' }, select: { id: true, displayValue: true, parentId: true } }) : Promise.resolve([]),
      // role degree per L2 node (NodeRole) → the "roles" badge on each division.
      prisma.nodeRole.groupBy({ by: ['processNodeId'], where: { companyId: company.id }, _count: { _all: true } }),
    ]);
    const domainName = new Map(domains.map((d) => [d.id, d.displayValue]));
    const vsByDomain = new Map<string, number>();
    for (const d of divisions) { const p = d.parentId; if (p) vsByDomain.set(p, (vsByDomain.get(p) ?? 0) + 1); }
    const roleDeg = new Map(divRoleCounts.map((g) => [g.processNodeId, g._count._all]));

    res.json({
      company: { id: company.id, name: company.name },
      counts: { domains: domains.length, divisions: divisions.length, valueStreams: divisions.length },
      domains: domains.map((d) => ({ id: d.id, name: d.displayValue, valueStreams: vsByDomain.get(d.id) ?? 0 })),
      divisions: divisions.map((d) => ({ id: d.id, name: d.displayValue, higherCategory: d.parentId ? domainName.get(d.parentId) ?? null : null, higherCategoryId: d.parentId ?? null, roles: roleDeg.get(d.id) ?? 0 })),
    });
  } catch (e) { next(e); }
});

// Flat value-stream list (process L2) with the divisions / categories / roles that
// participate — used by the cross-cutting bottom rail of the column board.
router.get('/value-streams', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });
    const { idOf } = await processLevelMap(company.id);
    const l2 = idOf(2);
    const streams = l2 ? await prisma.processNode.findMany({
      where: { companyId: company.id, processLevelTypeId: l2 },
      orderBy: { displayValue: 'asc' },
      select: { id: true, displayValue: true, parentId: true, parent: { select: { displayValue: true } } },
    }) : [];

    // Roles participating in each stream's subtree, with their home division.
    // One batched closure read across all streams (not two queries per stream).
    const subtreeByStream = await processSubtrees(streams.map((s) => s.id));
    const allNodeIds = [...subtreeByStream.values()].flatMap((t) => t.nodes.map((n) => n.id));
    const roleEntries = await rolesForNodes(allNodeIds);
    // role → home division (orgUnit L2 displayValue) for the category grouping.
    const roleIds = [...new Set([...roleEntries.values()].flat().map((r) => r.id))];
    const roleHomes = roleIds.length ? await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, orgUnit: { select: { id: true, displayValue: true, parent: { select: { displayValue: true } } } } } }) : [];
    const homeByRole = new Map(roleHomes.map((r) => [r.id, r.orgUnit]));

    res.json({
      valueStreams: streams.map((s) => {
        const nodeIds = (subtreeByStream.get(s.id)?.nodes ?? []).map((n) => n.id);
        const roleSet = new Set<string>();
        const divIds = new Set<string>();
        const categories = new Set<string>();
        for (const nid of nodeIds) for (const r of roleEntries.get(nid) ?? []) {
          roleSet.add(r.id);
          const home = homeByRole.get(r.id);
          if (home) { divIds.add(home.id); if (home.parent?.displayValue) categories.add(home.parent.displayValue); }
        }
        return {
          id: s.id, name: s.displayValue, domain: s.parent?.displayValue ?? null, domainId: s.parentId,
          divisionIds: [...divIds], categories: [...categories], roleIds: [...roleSet],
        };
      }),
    });
  } catch (e) { next(e); }
});

// AI-adoption heat-map (Telemetry / Active AI). Value-stream ProcessNodes (L2)
// with NodeAiAdoption mapped to a 0-4 level per AI mode.
const AI_LEVEL_INDEX: Record<string, number> = { not_used: 0, pilot: 1, emerging: 2, scaling: 3, embedded: 4 };
router.get('/value-stream-adoption', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });
    const { idOf } = await processLevelMap(company.id);
    const l2 = idOf(2);
    const nodes = l2 ? await prisma.processNode.findMany({
      where: { companyId: company.id, processLevelTypeId: l2 },
      orderBy: { displayValue: 'asc' },
      select: { id: true, displayValue: true, parent: { select: { displayValue: true } }, aiAdoption: true },
    }) : [];
    const idx = (v: string | undefined) => AI_LEVEL_INDEX[v ?? 'not_used'] ?? 0;
    res.json({
      valueStreams: nodes.map((n) => ({
        id: n.id, name: n.displayValue, domain: n.parent?.displayValue ?? null,
        cells: [idx(n.aiAdoption?.aiAssist), idx(n.aiAdoption?.aiAugment), idx(n.aiAdoption?.aiWorkflow), idx(n.aiAdoption?.aiAutonomous)],
        useCases: n.aiAdoption?.useCases ?? null,
        stats: n.aiAdoption?.stats ?? null,
      })),
    });
  } catch (e) { next(e); }
});

// ── Telemetry catalog ────────────────────────────────────────────────────────
const TYPE_ORDER = ['User', 'Role', 'Division', 'System'] as const;
function metricType(kind: string): string {
  if (kind === 'system') return 'System';
  if (kind === 'workforce') return 'Role';
  return 'Role';
}
function canonicalSource(t: string): string {
  const low = t.toLowerCase();
  if (/viva/.test(low)) return 'Viva Insights';
  if (/teams/.test(low)) return 'Microsoft Teams';
  if (/microsoft 365|m365|office 365|outlook|sharepoint/.test(low)) return 'Microsoft 365';
  if (/github/.test(low)) return 'GitHub';
  if (/azure devops/.test(low)) return 'Azure DevOps';
  if (/cloudtrail|codebuild|cloudwatch|\baws\b/.test(low)) return 'AWS';
  if (/\bazure\b/.test(low)) return 'Azure';
  if (/jira/.test(low)) return 'Jira';
  if (/servicenow/.test(low)) return 'ServiceNow';
  if (/guidewire|claimcenter|policycenter/.test(low)) return 'Guidewire';
  if (/okta/.test(low)) return 'Okta';
  if (/splunk/.test(low)) return 'Splunk';
  return t.trim();
}
function normalizeSource(raw: string | null): string[] {
  if (!raw) return [];
  const parts = raw.split(/\s+\/\s+|\s*,\s*|\s+&\s+|\sand\s/).map((p) => p.trim()).filter(Boolean);
  return [...new Set(parts.map(canonicalSource))];
}

router.get('/telemetry-catalog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });

    const [metrics, signalRows] = await Promise.all([
      prisma.metric.findMany({
        where: { companyId: company.id },
        orderBy: [{ name: 'asc' }],
        select: {
          id: true, name: true, unit: true, kind: true, period: true,
          processNode: { select: { id: true, displayValue: true, parent: { select: { displayValue: true } } } },
          role: { select: { id: true, displayValue: true } },
        },
      }),
      prisma.telemetrySignal.findMany({ where: { companyId: company.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);

    type Signal = {
      id: string; kind: 'kpi' | 'system'; name: string; description: string | null;
      source: string | null; category: string | null; framework: string | null;
      frequency: string | null; unit: string | null; direction: string; target: string | null;
      levels: string[]; roleDrill: boolean;
      valueStreamName: string | null; domain: string | null; l3: string | null;
      ownerRole: string | null; ownerRoleId: string | null;
      provenance: string | null; calculation: string | null; unsourced: boolean;
    };

    // Operating-model metrics (kind = kpi | workforce | system); value-stream and
    // owner-role come straight off the FK.
    const kpis: Signal[] = metrics.map((m) => ({
      id: m.id, kind: m.kind === 'system' ? 'system' : 'kpi', name: m.name, description: null,
      source: null, category: null, framework: null, frequency: m.period ?? null,
      unit: m.unit, direction: 'up', target: null,
      levels: [], roleDrill: !!m.role,
      valueStreamName: m.processNode?.parent?.displayValue ?? m.processNode?.displayValue ?? null,
      domain: m.processNode?.parent?.displayValue ?? null, l3: null,
      ownerRole: m.role?.displayValue ?? null, ownerRoleId: m.role?.id ?? null,
      provenance: 'Workbook: metric catalog', calculation: null, unsourced: false,
    }));

    const catalog: Signal[] = signalRows
      .filter((s) => !s.isLive && s.name)
      .map((m, i) => ({
        id: `cat:${i}`, kind: 'system' as const, name: m.name, description: m.description,
        source: m.source, category: m.category, framework: null, frequency: m.frequency,
        unit: m.unit, direction: m.direction, target: null, levels: ['Individual', 'Role'], roleDrill: false,
        valueStreamName: null, domain: null, l3: null, ownerRole: null, ownerRoleId: null,
        provenance: m.origin ?? 'Workbook metric catalog', calculation: m.queryType,
        unsourced: !m.source && !m.origin,
      }));

    const signals = [...kpis, ...catalog].map((s) => ({
      ...s,
      type: metricType(s.kind),
      sourceTokens: normalizeSource(s.source),
    }));

    const uniqCI = (vals: (string | null)[]) => {
      const m = new Map<string, string>();
      for (const v of vals) if (v && !m.has(v.toLowerCase())) m.set(v.toLowerCase(), v);
      return [...m.values()].sort((a, b) => a.localeCompare(b));
    };
    res.json({
      signals,
      filters: {
        types: TYPE_ORDER.filter((t) => signals.some((s) => s.type === t)),
        sources: uniqCI(signals.flatMap((s) => s.sourceTokens)),
        categories: uniqCI(signals.map((s) => s.category)),
      },
    });
  } catch (e) { next(e); }
});

// Resolve the map drill-path for a value stream: its division (parent L2 →
// segment). erd_v5: a value stream is a process L2 node; the map focuses to its
// parent segment + the node itself.
router.get('/value-stream/:id/focus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vs = await prisma.processNode.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId }, processLevelType: { levelNumber: 2 } },
      select: { id: true, parentId: true, parent: { select: { displayValue: true } } },
    });
    if (!vs) return res.status(404).json({ error: 'No participating division' });
    res.json({ valueStreamId: vs.id, divisionId: vs.id, category: vs.parent?.displayValue ?? 'Core Business' });
  } catch (e) { next(e); }
});

// End-to-end process flow for a value stream (process L2). Its `valueStreams`
// are its L3 process areas; each L3's flow `steps` are its L4 sub-processes,
// whose `subSteps` are the L5 tasks. The whole subtree is one closure read.
router.get('/division/:id/flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const div = await prisma.processNode.findFirst({
      where: { id: req.params.id, company: { tenantId: req.tenantId }, processLevelType: { levelNumber: 2 } },
      select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
    });
    if (!div) return res.status(404).json({ error: 'Not found' });
    const higherCategory = div.parent?.displayValue ?? null;

    const { nodes } = await processSubtree(div.id, { excludeSelf: true, maxDepth: 3 });
    const byParent = new Map<string, typeof nodes>();
    for (const n of nodes) { const p = n.parentId ?? ''; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p)!.push(n); }
    const l3 = nodes.filter((n) => n.depth === 1); // process areas = the "valueStreams" row

    const wantVs = typeof req.query.vs === 'string' ? req.query.vs : undefined;
    const selectedVs = l3.find((s) => s.id === wantVs) ?? l3[0] ?? null;

    let selected: any = null;
    if (selectedVs) {
      const l4 = (byParent.get(selectedVs.id) ?? []).filter((n) => n.depth === 2);
      const steps = l4.map((s, i) => ({
        id: s.id, step: i + 1, name: s.displayValue,
        subSteps: (byParent.get(s.id) ?? []).filter((n) => n.depth === 3).map((x, k) => ({ id: x.id, name: x.displayValue, step: k + 1, l5: [] as { id: string; name: string; step: number }[] })),
        inputs: null, outputs: null, upstream: null, downstream: null,
        roles: [] as string[], categories: [] as string[], primaryCategory: higherCategory,
        crossDomain: false, unowned: false,
      }));
      selected = { id: selectedVs.id, name: selectedVs.displayValue, steps };
    }
    res.json({
      division: { id: div.id, name: div.displayValue, higherCategory },
      valueStreams: l3.map((s) => ({ id: s.id, name: s.displayValue, participationType: 'Lead' })),
      selectedId: selectedVs?.id ?? null,
      selected,
    });
  } catch (e) { next(e); }
});

// Fully-exploded tree for the List view: every division (L2) with its L3 → L4 →
// L5 hierarchy. One closure-driven read per division.
router.get('/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const { idOf } = await processLevelMap(company.id);
    const l2 = idOf(2);
    const divisions = l2 ? await prisma.processNode.findMany({
      where: { companyId: company.id, processLevelTypeId: l2 },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
    }) : [];

    // One batched closure read across all divisions (was two queries per division).
    const subtrees = await processSubtrees(divisions.map((d) => d.id), { excludeSelf: true });

    res.json({
      company: { id: company.id, name: company.name },
      divisions: divisions.map((d) => {
        const nodes = subtrees.get(d.id)?.nodes ?? [];
        const byParent = new Map<string, typeof nodes>();
        for (const n of nodes) { const p = n.parentId ?? ''; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p)!.push(n); }
        const l3 = nodes.filter((n) => n.depth === 1);
        return {
          id: d.id, name: d.displayValue, higherCategory: d.parent?.displayValue ?? null, roles: 0,
          valueStreams: l3.map((area) => ({
            id: area.id, name: area.displayValue,
            areas: (byParent.get(area.id) ?? []).filter((n) => n.depth === 2).map((l4, j) => ({
              id: l4.id, step: j + 1, name: l4.displayValue,
              subProcesses: (byParent.get(l4.id) ?? []).filter((n) => n.depth === 3).map((l5, k) => ({ id: l5.id, step: k + 1, name: l5.displayValue, steps: [] as { id: string; step: number; name: string }[] })),
            })),
          })),
        };
      }),
    });
  } catch (e) { next(e); }
});

// ── Testing templates ────────────────────────────────────────────────────────
// For a focused ProcessNode (any level), the testing-template rows whose task
// node is in this node's task subtree (isTask ids via the closure), UNION any
// rows tied to the node's deliverables (NodeDeliverable → deliverableId).
// Returned as flat key/value-friendly rows, ordered by the task's sortOrder.
// Parse a workbook "Testing Plan" cell into its two structured sections so the
// UI can render them as key/value pairs: a "Generic pattern" (numbered checklist)
// and "Specific tests" (each = a directive in a named system + its pass answer).
function numberedItems(block: string): string[] {
  const out: string[] = [];
  const re = /(\d+)\.\s*([\s\S]*?)(?=\s*\d+\.\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const t = m[2].replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}
function parseTestingPlan(text: string | null): {
  genericPattern: string[];
  specificTests: { system: string | null; directive: string; pass: string | null }[];
} {
  if (!text) return { genericPattern: [], specificTests: [] };
  const norm = text.replace(/\r/g, '');
  const gi = norm.search(/generic pattern\s*:/i);
  const si = norm.search(/specific tests\s*:/i);
  let genericBlock = '', specificBlock = '';
  if (si >= 0) { genericBlock = gi >= 0 ? norm.slice(gi, si) : ''; specificBlock = norm.slice(si); }
  else { genericBlock = gi >= 0 ? norm.slice(gi) : norm; }
  const genericPattern = numberedItems(genericBlock);
  const specificTests = numberedItems(specificBlock).map((s) => {
    let system: string | null = null, directive = s, pass: string | null = null;
    const pIdx = s.search(/pass\s*=/i);
    if (pIdx >= 0) { directive = s.slice(0, pIdx).trim().replace(/[.;:\s]+$/, ''); pass = s.slice(pIdx).trim(); }
    const vm = directive.match(/^in\s+(.+?),\s*verify\s*:?\s*(.+)$/i);
    if (vm) { system = vm[1].trim(); directive = vm[2].trim(); }
    return { system, directive, pass };
  });
  return { genericPattern, specificTests };
}

router.get('/testing-templates/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });

    const node = await prisma.processNode.findFirst({
      where: { id: req.params.nodeId, companyId: company.id },
      select: { id: true, displayValue: true },
    });
    if (!node) return res.status(404).json({ error: 'Not found' });

    // Task subtree (isTask L5 ids) + their sortOrder for ordering.
    const { nodes } = await processSubtree(node.id);
    const taskNodes = nodes.filter((n) => n.isTask);
    const taskIds = taskNodes.map((n) => n.id);
    const sortOf = new Map(taskNodes.map((n) => [n.id, n.sortOrder]));

    // Deliverables linked anywhere in this node's subtree.
    const delivLinks = await prisma.nodeDeliverable.findMany({
      where: { processNodeId: { in: nodes.map((n) => n.id) } },
      select: { deliverableId: true },
    });
    const deliverableIds = [...new Set(delivLinks.map((d) => d.deliverableId))];

    // Rows tied EITHER by task node OR by a subtree deliverable.
    const or: any[] = [];
    if (taskIds.length) or.push({ taskNodeId: { in: taskIds } });
    if (deliverableIds.length) or.push({ deliverableId: { in: deliverableIds } });
    const CAP = 500;
    const rows = or.length
      ? await prisma.testingTemplate.findMany({
          where: { OR: or },
          select: {
            id: true, system: true, location: true, checkType: true, expected: true, taskNodeId: true,
            deliverable: { select: { title: true } },
            taskNode: { select: { displayValue: true } },
          },
        })
      : [];

    const templates = rows
      .map((r) => ({
        id: r.id,
        deliverable: r.deliverable?.title ?? null,
        task: r.taskNode?.displayValue ?? null,
        system: r.system ?? null,
        location: r.location ?? null,
        checkType: r.checkType ?? null,
        expected: r.expected ?? null,
        parsed: parseTestingPlan(r.expected ?? null),
        _order: r.taskNodeId ? (sortOf.get(r.taskNodeId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a._order - b._order || (a.deliverable ?? '').localeCompare(b.deliverable ?? ''));

    res.json({
      node: { id: node.id, name: node.displayValue },
      total: templates.length,
      templates: templates.slice(0, CAP).map(({ _order, ...t }) => t),
    });
  } catch (e) { next(e); }
});

// ── Step-lens dashboards (map drill sidebar: /explorer/roles/:level/:id) ─────
type Fmt = 'money' | 'years' | 'number';
type MetricItem = { label: string; value: number; hint?: string; sub?: string; format?: Fmt; illustrative?: boolean; drill?: { level: string; id: string }; href?: string; children?: MetricItem[]; tag?: string };
type MetricSection = { title: string; kind: 'bar' | 'list' | 'kpi' | 'tree'; items: MetricItem[]; illustrative?: boolean; hidden?: boolean; expanded?: boolean; emptyText?: string };
type Dashboard = { level: string; title: string; subtitle?: string; tiles: { label: string; value: number; hint?: string; format?: Fmt; illustrative?: boolean; drawer?: string }[]; sections: MetricSection[] };

const CORE_EMPTY = {
  deliverables: 'No deliverables recorded at this level.',
  roles: 'No roles resolved for this slice of work.',
  tasks: 'No role tasks recorded for the involved roles.',
  checklist: 'No checklist items recorded for the involved roles.',
};

// Consolidated who/what/how for a set of ProcessNodes (the focused slice of a
// value stream). Roles (NodeRole), their checklist items (NodeChecklist), the
// deliverables produced (NodeDeliverable), and the applications used
// (NodeAppUsage) — all FK-junction reads, no name matching.
type Lens = {
  rolesTree: MetricItem[];
  deliverables: MetricItem[];
  deliverableChain: MetricItem[];
  tasks: MetricItem[];
  checklist: MetricItem[];
  applications: MetricItem[];
  roleCount: number; unresolvedRoles: string[];
};

async function stepLens(nodeIds: string[]): Promise<Lens> {
  if (!nodeIds.length) {
    return { rolesTree: [], deliverables: [], deliverableChain: [], tasks: [], checklist: [], applications: [], roleCount: 0, unresolvedRoles: [] };
  }
  const [roleEntries, appEntries, delivLinks, checkLinks] = await Promise.all([
    rolesForNodes(nodeIds),
    appsForNodes(nodeIds),
    prisma.nodeDeliverable.findMany({ where: { processNodeId: { in: nodeIds } }, select: { deliverable: { select: { id: true, title: true } } } }),
    prisma.nodeChecklist.findMany({ where: { processNodeId: { in: nodeIds } }, select: { processNodeId: true, checklistItem: { select: { id: true, text: true, role: { select: { id: true, displayValue: true } }, checklist: { select: { name: true } } } } } }),
  ]);

  // Roles (Owner = Lead, Participant = Support), deduped, leads first.
  const roleMap = new Map<string, { id: string; name: string; part: 'Lead' | 'Support' }>();
  for (const entries of roleEntries.values()) for (const e of entries) {
    const part = e.role_ === 'Owner' ? 'Lead' : 'Support';
    const cur = roleMap.get(e.id);
    if (!cur || (part === 'Lead' && cur.part !== 'Lead')) roleMap.set(e.id, { id: e.id, name: e.name, part });
  }
  const roles = [...roleMap.values()].sort((a, b) => (a.part === b.part ? a.name.localeCompare(b.name) : a.part === 'Lead' ? -1 : 1));
  const rolesTree: MetricItem[] = roles.map((r) => ({ label: r.name, value: 0, hint: r.part, drill: { level: 'role', id: r.id }, tag: 'role' }));

  // Applications, primary "performed" first.
  const appMap = new Map<string, { name: string; types: Set<string> }>();
  for (const list of appEntries.values()) for (const a of list) {
    let e = appMap.get(a.id);
    if (!e) { e = { name: a.name, types: new Set() }; appMap.set(a.id, e); }
    e.types.add(a.usageType);
  }
  const applications: MetricItem[] = [...appMap.entries()]
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([appId, a]) => ({ label: a.name, value: 0, hint: [...a.types].join(' · '), href: `/applications?focus=${appId}`, tag: 'app' }));

  // Deliverables (one per L4 sub-process; dedupe by deliverable id so two distinct
  // L4s that happen to share a sub-process name stay separate).
  const delivById = new Map<string, string>(); // id → title
  for (const d of delivLinks) if (!delivById.has(d.deliverable.id)) delivById.set(d.deliverable.id, d.deliverable.title);
  const deliverables: MetricItem[] = [...delivById.values()].map((title) => ({ label: title, value: 0, tag: 'deliverable', children: [] as MetricItem[] }));

  // Checklist items grouped by role. ChecklistItem.roleId is unset in this dataset
  // (the workbook codifies checklist steps against the PROCESS NODE, not a role),
  // so we attribute each item to the role(s) that work its node: the node's Owner
  // role(s) via NodeRole, falling back to any role on the node, then to the item's
  // own roleId, then to an unattributed bucket. This is what makes checklist items
  // reliably surface under the roles in the deliverable chain.
  const ownerByNode = new Map<string, string[]>(); // nodeId → owner role ids (else any role ids)
  for (const [nid, entries] of roleEntries) {
    const owners = entries.filter((e) => e.role_ === 'Owner').map((e) => e.id);
    ownerByNode.set(nid, owners.length ? owners : entries.map((e) => e.id));
  }
  const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
  const checkByRole = new Map<string, { role: string; items: { text: string; cat: string | null }[] }>();
  const pushItem = (rid: string, roleName: string, text: string, cat: string | null) => {
    let e = checkByRole.get(rid);
    if (!e) { e = { role: roleName, items: [] }; checkByRole.set(rid, e); }
    e.items.push({ text, cat });
  };
  for (const c of checkLinks) {
    const ci = c.checklistItem;
    const cat = ci.checklist?.name ?? null;
    const nodeRoleIds = ownerByNode.get(c.processNodeId) ?? [];
    if (nodeRoleIds.length) {
      // attribute to the node's role(s) — dedupe so the same step isn't double-counted per role.
      for (const rid of nodeRoleIds) pushItem(rid, roleNameById.get(rid) ?? '—', ci.text, cat);
    } else if (ci.role?.id) {
      pushItem(ci.role.id, ci.role.displayValue, ci.text, cat);
    } else {
      pushItem('_', '—', ci.text, cat);
    }
  }
  // Flat checklist section: dedupe identical (role,text) pairs the node-fan-out can create.
  const seenCheck = new Set<string>();
  const checklist: MetricItem[] = [...checkByRole.values()].flatMap((e) =>
    e.items.filter((it) => { const k = `${e.role}␟${it.text}`; if (seenCheck.has(k)) return false; seenCheck.add(k); return true; })
      .map((it) => ({ label: it.text, value: 0, sub: it.cat ?? undefined, hint: e.role, tag: 'checklist' })));

  // Connected chain: deliverable → the roles working these nodes → CHECKLIST
  // items (the codified steps the role reviews) → a couple of supporting apps.
  // Checklist items MUST appear for any role that has them — they are the point
  // of the chain (legend: DELIVERABLE → ROLE → CHECKLIST → APPLICATION). Apps are
  // a tail, and the apps-only shape is only used when a role genuinely has none.
  const CHAIN_ROLES = 3, CHAIN_CHECKS = 12, CHAIN_APPS = 2;
  // Surface roles that actually carry checklist items in this scope FIRST (Lead
  // ahead of Support on a tie), so the chain reliably shows checklist work rather
  // than landing on three roles that happen to have none. Roles without checklist
  // items fill any remaining slots and fall back to an apps-only tail.
  const chainRoles = [...roles].sort((a, b) => {
    const ha = (checkByRole.get(a.id)?.items.length ?? 0) > 0 ? 0 : 1;
    const hb = (checkByRole.get(b.id)?.items.length ?? 0) > 0 ? 0 : 1;
    return ha - hb; // stable sort keeps the original Lead-first/name order within each bucket
  }).slice(0, CHAIN_ROLES);
  const roleNodes: MetricItem[] = chainRoles.map((r) => {
    const seen = new Set<string>();
    const checks = (checkByRole.get(r.id)?.items ?? [])
      .filter((c) => { if (seen.has(c.text)) return false; seen.add(c.text); return true; })
      .slice(0, CHAIN_CHECKS)
      .map((c) => ({ label: c.text, value: 0, sub: c.cat ?? undefined, tag: 'checklist' as const }));
    const appNodes = applications.slice(0, CHAIN_APPS).map((a) => ({ ...a }));
    // checklist first (always, when the role has any), then a small app tail.
    return { label: r.name, value: 0, hint: r.part, drill: { level: 'role', id: r.id }, tag: 'role', children: [...checks, ...appNodes] };
  });
  const deliverableChain: MetricItem[] = deliverables.map((d) => ({ ...d, children: roleNodes }));

  // Flat tasks roll-up: each task node's display name with its owner role nested.
  const tasks: MetricItem[] = []; // tasks are L5 nodes themselves; the lens scope already is task-level

  return {
    rolesTree, deliverables, deliverableChain, tasks, checklist, applications,
    roleCount: roles.length, unresolvedRoles: [],
  };
}

function coreSections(lens: Lens, opts: { deliverables: MetricItem[]; expanded?: boolean; rolesFallback?: MetricItem[]; tasksChecklist?: boolean }): MetricSection[] {
  const out: MetricSection[] = [
    { title: 'Roles', kind: 'tree', items: lens.rolesTree.length ? lens.rolesTree : (opts.rolesFallback ?? []), emptyText: CORE_EMPTY.roles },
    { title: 'Applications & systems', kind: 'list', items: lens.applications },
    { title: 'Deliverables', kind: 'tree', expanded: opts.expanded, items: opts.deliverables, emptyText: CORE_EMPTY.deliverables },
  ];
  if (opts.tasksChecklist) {
    // Checklist items replace the old task list in the sidebar (the task scope is
    // the lens itself; what the user reviews here are the codified checklist steps).
    out.push(
      { title: 'Checklist', kind: 'tree', items: lens.checklist, emptyText: CORE_EMPTY.checklist },
    );
  }
  return out;
}

// task-node ids for a given subtree root, bounded to L5 (isTask).
async function taskNodeIds(rootId: string): Promise<string[]> {
  const { nodes } = await processSubtree(rootId);
  return nodes.filter((n) => n.isTask).map((n) => n.id);
}

// Level dashboards keyed by the focused ProcessNode's level.
async function processNodeDashboard(node: { id: string; displayValue: string; level: number }): Promise<Dashboard> {
  if (node.level === 2) {
    // Value stream: the lens over its whole task subtree + L3 process-area list.
    const { nodes } = await processSubtree(node.id, { excludeSelf: true });
    const l3 = nodes.filter((n) => n.depth === 1);
    const taskIds = nodes.filter((n) => n.isTask).map((n) => n.id);
    const taskCountByL3 = new Map<string, number>();
    // count tasks under each L3 via their closure root.
    await Promise.all(l3.map(async (a) => { taskCountByL3.set(a.id, (await taskNodeIds(a.id)).length); }));
    const lens = await stepLens(taskIds);
    return {
      level: 'valueStream', title: node.displayValue, subtitle: 'Who does the work, on what',
      tiles: [
        { label: 'Supporting roles', value: lens.roleCount, drawer: 'Roles' },
        { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
        { label: 'Deliverables', value: lens.deliverables.length, drawer: 'Deliverables' },
      ],
      sections: [
        ...coreSections(lens, { deliverables: lens.deliverableChain, tasksChecklist: true }),
        { title: 'Process Level 4', kind: 'list', items: l3.map((s) => ({ label: s.displayValue, value: 0, hint: taskCountByL3.get(s.id) ? `${taskCountByL3.get(s.id)} steps` : 'no flow', drill: { level: 'step', id: s.id } })) },
      ],
    };
  }
  // L3 / L4 / L5: lens scoped to that node's task subtree.
  const taskIds = await taskNodeIds(node.id);
  const lens = await stepLens(taskIds);
  const subtitle = node.level === 3 ? 'Process area (L3)' : node.level === 4 ? 'Sub-process (L4)' : 'Task (L5)';
  const expanded = node.level >= 4;
  return {
    level: node.level === 5 ? 'leafStep' : 'step', title: node.displayValue, subtitle,
    tiles: [
      { label: 'Supporting roles', value: lens.roleCount, drawer: 'Roles' },
      { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
      { label: 'Deliverables', value: lens.deliverables.length, drawer: 'Deliverables' },
    ],
    sections: [...coreSections(lens, { deliverables: lens.deliverableChain, expanded })],
  };
}

// Role dashboard: the role's deliverables, value-stream participation, and
// checklist responsibilities.
async function roleDashboard(roleId: string): Promise<Dashboard | null> {
  const role = await prisma.role.findFirst({ where: { id: roleId }, select: { id: true, displayValue: true, orgUnit: { select: { displayValue: true } } } });
  if (!role) return null;
  const [nodeRoles, roleDelivs, checks] = await Promise.all([
    prisma.nodeRole.findMany({ where: { roleId }, select: { processNode: { select: { id: true } } } }),
    prisma.roleDeliverable.findMany({ where: { roleId }, select: { deliverable: { select: { title: true } } } }),
    prisma.checklistItem.findMany({ where: { roleId }, select: { text: true, checklist: { select: { name: true } } } }),
  ]);
  const loc = await ancestorNames(nodeRoles.map((n) => n.processNode.id));
  const streams = new Map<string, string>();
  for (const a of loc.values()) if (a.valueStreamId) streams.set(a.valueStreamId, a.valueStreamName ?? '—');
  const deliverables = [...new Set(roleDelivs.map((d) => d.deliverable.title))];
  return {
    level: 'role', title: role.displayValue, subtitle: role.orgUnit?.displayValue ?? 'Role',
    tiles: [
      { label: 'Value streams', value: streams.size },
      { label: 'Deliverables', value: deliverables.length },
      { label: 'Responsibilities', value: checks.length, hint: 'checklist items' },
      { label: 'Tasks', value: nodeRoles.length, hint: 'process steps' },
    ],
    sections: [
      { title: 'Deliverables', kind: 'list', items: deliverables.map((d) => ({ label: d, value: 0 })), emptyText: CORE_EMPTY.deliverables },
      { title: 'Value-stream participation', kind: 'list', items: [...streams.values()].sort().map((s) => ({ label: s, value: 0 })) },
      { title: 'Responsibilities', kind: 'tree', items: checks.slice(0, 50).map((c) => ({ label: c.text, value: 0, sub: c.checklist?.name ?? undefined, tag: 'checklist' })), emptyText: CORE_EMPTY.checklist },
    ],
  };
}

// Department dashboard (org L3): the roles homed under this department + their
// value-stream participation. Mirrors roleDashboard's altitude but for a team.
async function departmentDashboard(orgUnitId: string, label: string): Promise<Dashboard | null> {
  const roles = await prisma.role.findMany({
    where: { orgUnitId },
    orderBy: { displayValue: 'asc' },
    select: { id: true, displayValue: true },
  });
  // value-stream participation for the team's roles (NodeRole → closure).
  const roleIds = roles.map((r) => r.id);
  const nodeRoles = roleIds.length
    ? await prisma.nodeRole.findMany({ where: { roleId: { in: roleIds } }, select: { processNodeId: true } })
    : [];
  const loc = await ancestorNames(nodeRoles.map((n) => n.processNodeId));
  const streams = new Map<string, string>();
  for (const a of loc.values()) if (a.valueStreamId) streams.set(a.valueStreamId, a.valueStreamName ?? '—');
  return {
    level: 'department', title: label, subtitle: 'Team · roles & value-stream reach',
    tiles: [
      { label: 'Roles', value: roles.length },
      { label: 'Value streams', value: streams.size },
    ],
    sections: [
      { title: 'Roles', kind: 'tree', items: roles.map((r) => ({ label: r.displayValue, value: 0, drill: { level: 'role', id: r.id }, tag: 'role' })), emptyText: 'No roles homed to this team.' },
      { title: 'Value-stream participation', kind: 'list', items: [...streams.values()].sort().map((s) => ({ label: s, value: 0 })) },
    ],
  };
}

// Org dashboard (company / domain / division): roles roll-up.
async function orgDashboard(companyId: string, level: string, id: string | undefined, label: string): Promise<Dashboard | null> {
  if (level === 'company') {
    const { idOf } = await processLevelMap(companyId);
    const l2 = idOf(2);
    const [roleCount, divisions] = await Promise.all([
      prisma.role.count({ where: { companyId } }),
      l2 ? prisma.processNode.findMany({ where: { companyId, processLevelTypeId: l2 }, orderBy: { displayValue: 'asc' }, select: { id: true, displayValue: true } }) : Promise.resolve([]),
    ]);
    return {
      level: 'company', title: label, subtitle: 'Roles · top-down ownership',
      tiles: [{ label: 'Roles', value: roleCount }, { label: 'Value streams', value: divisions.length }],
      sections: [{ title: 'Value streams', kind: 'list', items: divisions.map((d) => ({ label: d.displayValue, value: 0, drill: { level: 'valueStream', id: d.id } })) }],
    };
  }
  return null;
}

// /explorer/roles/:level/:id — the map's right-hand drill sidebar.
router.get('/roles/:level/:id?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const id = req.params.id ? decodeURIComponent(req.params.id) : undefined;

    let out: Dashboard | null = null;
    // A node id (process or org) drives the dashboard by its level; otherwise the
    // bare level (company/domain/division) gives the org roll-up.
    if (id) {
      const pn = await prisma.processNode.findFirst({
        where: { id, companyId: company.id },
        select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } } },
      });
      if (pn) {
        if (req.params.level === 'role') out = await roleDashboard(id); // (defensive — role ids aren't process nodes)
        else out = await processNodeDashboard({ id: pn.id, displayValue: pn.displayValue, level: pn.processLevelType.levelNumber });
      } else if (req.params.level === 'role') {
        out = await roleDashboard(id);
      } else {
        // The id is an OrgUnit (segment/division), not a ProcessNode. A division
        // (org L2) shares its dbValue with the same-named value stream (process L2);
        // map across and render that value stream's subtree-scoped dashboard so the
        // sidebar shows real division numbers instead of a company-wide roll-up.
        const ou = await prisma.orgUnit.findFirst({
          where: { id, companyId: company.id },
          select: { dbValue: true, displayValue: true, orgLevelType: { select: { levelNumber: true } } },
        });
        // Department (org L3) → team dashboard (roles homed under it + their reach).
        if (ou && ou.orgLevelType.levelNumber === 3) {
          out = await departmentDashboard(id, ou.displayValue);
        } else if (ou && ou.orgLevelType.levelNumber === 2) {
          const { idOf } = await processLevelMap(company.id);
          const l2 = idOf(2);
          const vs = l2
            ? await prisma.processNode.findFirst({
                where: { companyId: company.id, processLevelTypeId: l2, dbValue: ou.dbValue },
                select: { id: true, displayValue: true },
              })
            : null;
          if (vs) out = await processNodeDashboard({ id: vs.id, displayValue: vs.displayValue, level: 2 });
        }
        // Segment (org L1) or an unmatched division → safe company-wide roll-up.
        if (!out) out = await orgDashboard(company.id, 'company', id, company.name);
      }
    } else {
      out = await orgDashboard(company.id, req.params.level, undefined, company.name);
    }
    if (!out) return res.status(404).json({ error: 'Not found' });
    res.json(out);
  } catch (e) { next(e); }
});

// ── Org table (Organization tab): segment (org L1) → division (org L2) → roles ─
router.get('/org-table', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const c = company.id;

    const [orgTypes, units, roles, counts, allNodeRoles, valueStreams] = await Promise.all([
      prisma.orgLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } }),
      prisma.orgUnit.findMany({ where: { companyId: c }, orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }], select: { id: true, displayValue: true, parentId: true, orgLevelTypeId: true } }),
      prisma.role.findMany({ where: { companyId: c }, orderBy: { displayValue: 'asc' }, select: { id: true, displayValue: true, orgUnitId: true } }),
      structureCounts(c),
      prisma.nodeRole.findMany({ where: { companyId: c }, select: { roleId: true, role_: true, processNodeId: true } }),
      (async () => {
        const types = await prisma.processLevelType.findMany({ where: { companyId: c }, select: { id: true, levelNumber: true } });
        const l2 = types.find((t) => t.levelNumber === 2)?.id;
        return l2 ? prisma.processNode.findMany({ where: { companyId: c, processLevelTypeId: l2 }, orderBy: { displayValue: 'asc' }, select: { id: true, displayValue: true, parent: { select: { displayValue: true } } } }) : [];
      })(),
    ]);
    const levelOf = new Map(orgTypes.map((t) => [t.id, t.levelNumber]));
    const segNodes = units.filter((u) => levelOf.get(u.orgLevelTypeId) === 1);
    const divNodes = units.filter((u) => levelOf.get(u.orgLevelTypeId) === 2);
    const deptNodes = units.filter((u) => levelOf.get(u.orgLevelTypeId) === 3); // Department tier (L3)
    const byId = new Map(units.map((u) => [u.id, u]));
    // departments grouped under their division (parentId = the L2 division).
    const deptsByDivision = new Map<string, typeof deptNodes>();
    for (const dp of deptNodes) {
      if (!dp.parentId) continue;
      if (!deptsByDivision.has(dp.parentId)) deptsByDivision.set(dp.parentId, []);
      deptsByDivision.get(dp.parentId)!.push(dp);
    }

    // roles' value-stream participation, resolved via NodeRole + closure. The org
    // table only needs each node's value stream + domain, so use the lean ancestry
    // resolver (skips l3/l4 + the org-derived division/department join).
    const partNodeIds = [...new Set(allNodeRoles.map((n) => n.processNodeId))];
    const loc = await streamAncestry(partNodeIds);
    const partByRole = new Map<string, Map<string, { valueStreamId: string; valueStreamName: string; domain: string | null; participationType: string }>>();
    for (const nr of allNodeRoles) {
      const a = loc.get(nr.processNodeId);
      if (!a?.valueStreamId) continue;
      let m = partByRole.get(nr.roleId);
      if (!m) { m = new Map(); partByRole.set(nr.roleId, m); }
      const part = nr.role_ === 'Owner' ? 'Lead' : 'Support';
      const cur = m.get(a.valueStreamId);
      if (!cur || (part === 'Lead' && cur.participationType !== 'Lead')) {
        m.set(a.valueStreamId, { valueStreamId: a.valueStreamId, valueStreamName: a.valueStreamName ?? '—', domain: a.domain, participationType: part });
      }
    }

    // roles homed under each division org unit.
    const rolesByUnit = new Map<string, any[]>();
    const unassigned: any[] = [];
    for (const r of roles) {
      const part = [...(partByRole.get(r.id)?.values() ?? [])];
      const entry = { id: r.id, name: r.displayValue, roleLevel: null, roleFamily: null, valueStreamCount: part.length, participations: part };
      if (!r.orgUnitId) { unassigned.push(entry); continue; }
      if (!rolesByUnit.has(r.orgUnitId)) rolesByUnit.set(r.orgUnitId, []);
      rolesByUnit.get(r.orgUnitId)!.push(entry);
    }

    const divisionRows = divNodes.map((dv) => {
      // roles homed directly to the L2 division → looseRoles ("Direct to division").
      const looseRoles = rolesByUnit.get(dv.id) ?? [];
      // roles homed to an L3 department under this division → that department.
      const departments = (deptsByDivision.get(dv.id) ?? [])
        .map((dp) => {
          const roles = rolesByUnit.get(dp.id) ?? [];
          return { id: dp.id, name: dp.displayValue, roles, roleCount: roles.length };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      const deptRoleCount = departments.reduce((a, d) => a + d.roleCount, 0);
      const segment = dv.parentId ? byId.get(dv.parentId)?.displayValue ?? 'Core Business' : 'Core Business';
      return { id: dv.id, name: dv.displayValue, segment, departments, looseRoles, roleCount: looseRoles.length + deptRoleCount, _segId: dv.parentId };
    });

    const segments: any[] = segNodes
      .map((s) => {
        const divs = divisionRows.filter((d) => d._segId === s.id).map(({ _segId, ...d }) => d);
        return { name: s.displayValue, divisions: divs, divisionCount: divs.length, roleCount: divs.reduce((a, x) => a + x.roleCount, 0) };
      })
      .filter((s) => s.divisions.length > 0);
    if (unassigned.length) {
      segments.push({
        name: 'Unassigned',
        divisions: [{ id: '__unassigned', name: 'Unassigned roles', segment: 'Unassigned', departments: [], looseRoles: unassigned, roleCount: unassigned.length }],
        divisionCount: 0, roleCount: unassigned.length,
      });
    }

    res.json({
      company,
      totals: {
        segments: counts.segments, divisions: counts.divisions, departments: counts.departments,
        roles: counts.roles, valueStreams: counts.valueStreams,
      },
      valueStreams: valueStreams.map((v) => ({ id: v.id, name: v.displayValue, domain: v.parent?.displayValue ?? null })),
      segments,
    });
  } catch (e) { next(e); }
});

// ── Standards (department standards: area → group → leaf, on the Standard tree) ─
// areas = isArea Standards; groups = their direct children; leaves = the groups'
// children. The owner role (ownerRoleId) and the value streams (via NodeStandard)
// resolve to real ids for the front-end's role/VS links.

// Shared shaping of a leaf/group Standard row into the front-end Item contract.
type StdRow = {
  id: string; category: string | null; name: string; description: string | null;
  buildRun: string | null; ownerLabel: string | null; relatedRole: string | null;
  relatedCategory: string | null; link: string | null; agentSkill: string | null;
  sdlcGates: string | null; regCitation: string | null;
  ownerRole: { id: string; displayValue: string } | null;
  nodeStandards: { processNode: { id: string; displayValue: string; parent: { displayValue: string } | null } | null }[];
};
function shapeItem(r: StdRow) {
  const valueStreams = r.nodeStandards
    .map((ns) => ns.processNode)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.displayValue, domain: p.parent?.displayValue ?? null }));
  return {
    id: r.id,
    category: r.category ?? '—',
    name: r.name,
    description: r.description ?? '',
    buildRun: r.buildRun,
    ownerRole: r.ownerLabel,
    relatedRole: r.relatedRole,
    relatedCategory: r.relatedCategory,
    itemsLink: r.link,
    agentSkill: r.agentSkill,
    sdlcGates: r.sdlcGates,
    regCitation: r.regCitation,
    responsible: r.ownerRole ? { roleId: r.ownerRole.id, roleName: r.ownerRole.displayValue, roleLevel: null as string | null } : null,
    valueStreams,
  };
}

const STD_ITEM_SELECT = {
  id: true, category: true, name: true, description: true, buildRun: true, ownerLabel: true,
  relatedRole: true, relatedCategory: true, link: true, agentSkill: true, sdlcGates: true, regCitation: true,
  ownerRole: { select: { id: true, displayValue: true } },
  nodeStandards: { select: { processNode: { select: { id: true, displayValue: true, parent: { select: { displayValue: true } } } } } },
} as const;

router.get('/standards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req);
    if (!company) return res.status(404).json({ error: 'No company' });
    const areas = await prisma.standard.findMany({
      where: { companyId: company.id, isArea: true },
      orderBy: { department: 'asc' },
      select: {
        id: true, department: true, name: true, charterIncluded: true, ownerLabel: true, link: true,
        _count: { select: { children: true } },
      },
    });
    // Leaf count per area = all non-area descendants (groups + their leaves). The
    // displayed "standards" count is the number of individual (leaf-or-childless)
    // standards; cheaper to count all descendants via a single groupBy on parent
    // chain is overkill — count descendants by walking parentId twice (2 levels).
    const groupCounts = await prisma.standard.groupBy({
      by: ['parentId'], where: { companyId: company.id, isArea: false }, _count: { _all: true },
    });
    const childCount = new Map<string, number>();
    for (const g of groupCounts) if (g.parentId) childCount.set(g.parentId, g._count._all);
    // group ids per area (to roll their children into the area total).
    const groups = await prisma.standard.findMany({
      where: { companyId: company.id, isArea: false, parent: { isArea: true } },
      select: { id: true, parentId: true },
    });
    const leafByArea = new Map<string, number>();
    for (const g of groups) {
      if (!g.parentId) continue;
      // count this group's own leaf children; a childless group is itself 1 standard.
      const kids = childCount.get(g.id) ?? 0;
      leafByArea.set(g.parentId, (leafByArea.get(g.parentId) ?? 0) + (kids || 1));
    }
    res.json({
      company: { id: company.id, name: company.name },
      totals: {
        areas: areas.length,
        standards: [...leafByArea.values()].reduce((a, b) => a + b, 0),
        withCharter: areas.filter((a) => a.charterIncluded).length,
      },
      standards: areas.map((a) => ({
        id: a.id,
        department: a.department ?? a.name,
        count: leafByArea.get(a.id) ?? a._count.children,
        charterIncluded: !!a.charterIncluded,
        owner: a.ownerLabel,
        link: a.link,
        responsible: a.ownerLabel ? [{ label: a.ownerLabel, roleId: null, roleName: a.ownerLabel }] : [],
      })),
    });
  } catch (e) { next(e); }
});

router.get('/standards-flat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });
    // Flat leaf list = every individual standard. A "leaf" is a non-area Standard
    // with no children (a childless group is itself a leaf); a group WITH children
    // is a container whose children are the leaves. Each leaf carries its AREA id
    // (the area is the leaf's parent if the parent is an area, else the parent
    // group's parent) plus its group name.
    const nonAreas = await prisma.standard.findMany({
      where: { companyId: company.id, isArea: false },
      orderBy: [{ department: 'asc' }, { category: 'asc' }, { name: 'asc' }],
      select: {
        id: true, parentId: true, department: true, category: true, name: true, description: true,
        ownerRole: { select: { id: true, displayValue: true } },
        parent: { select: { id: true, isArea: true, name: true, parentId: true } },
      },
    });
    const hasChildren = new Set(nonAreas.map((n) => n.parentId).filter((p): p is string => !!p));
    const items = nonAreas
      .filter((n) => !hasChildren.has(n.id)) // drop container groups; keep leaves + childless groups
      .map((n) => {
        const parentIsArea = n.parent?.isArea ?? false;
        const areaId = parentIsArea ? n.parent!.id : (n.parent?.parentId ?? n.parentId ?? n.id);
        const group = parentIsArea ? null : (n.parent?.name ?? null);
        return {
          id: n.id, areaId, department: n.department ?? '—', category: n.category ?? '—', group,
          name: n.name, description: n.description,
          roleId: n.ownerRole?.id ?? null, roleName: n.ownerRole?.displayValue ?? null,
        };
      });
    res.json({ items });
  } catch (e) { next(e); }
});

router.get('/standards/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });
    const area = await prisma.standard.findFirst({
      where: { id: req.params.id, companyId: company.id, isArea: true },
      select: { id: true, department: true, name: true, charterIncluded: true, ownerLabel: true, link: true, mission: true, scope: true },
    });
    if (!area) return res.status(404).json({ error: 'Not found' });

    // Top-level rows = the area's direct children (groups). Each group carries its
    // own children as `subs`. A childless group is a standalone leaf standard.
    const groups = await prisma.standard.findMany({
      where: { companyId: company.id, parentId: area.id, isArea: false },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { ...STD_ITEM_SELECT, children: { orderBy: { name: 'asc' }, select: STD_ITEM_SELECT } },
    });

    let leafTotal = 0;
    const categories = new Set<string>();
    let withOwnerRole = 0;
    const items = groups.map((g) => {
      const shaped = shapeItem(g as StdRow);
      const subs = g.children.map((c) => shapeItem(c as StdRow));
      categories.add(shaped.category);
      leafTotal += subs.length || 1;
      if (g.ownerRole) withOwnerRole++;
      for (const c of g.children) if (c.ownerRole) withOwnerRole++;
      return { ...shaped, subs };
    });

    res.json({
      area: {
        id: area.id, department: area.department ?? area.name, count: leafTotal,
        charterIncluded: !!area.charterIncluded, owner: area.ownerLabel,
        link: area.link, mission: area.mission, scope: area.scope,
      },
      totals: { items: leafTotal, groups: groups.length, categories: categories.size, withOwnerRole },
      items,
    });
  } catch (e) { next(e); }
});

export default router;
