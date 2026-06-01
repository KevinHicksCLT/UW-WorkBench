import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const CONTROL_CATEGORIES = ['Governance/Compliance', 'Security', 'Reviews/Audits', 'Approvals/Sign-offs', 'Risk & Compliance', 'Runbooks'];
const PART_ORDER: Record<string, number> = { Lead: 0, Core: 1, Control: 2, Oversight: 3, Support: 4 };
const LATEST_PERIOD = '2026-05';
const PAGE = 60;

// ── shared lens/insight helpers ────────────────────────────────────────

// Gap 1 — cross-division capability overlap.
// Key: Role.roleFamily (the capability type). Roles with null roleFamily are
// individual-contributor roles that aren't tagged to a family; they're excluded
// because their names are unique per company and can't be compared across divisions.
// Returns families that appear under 2+ divisions, sorted by division count desc.
async function capabilityOverlapsFor(companyId: string) {
  const roles = await prisma.role.findMany({
    where: { companyId, roleFamily: { not: null }, divisionId: { not: null } },
    select: { roleFamily: true, divisionId: true, division: { select: { id: true, name: true } } },
  });
  const famMap = new Map<string, Map<string, string>>(); // family -> divisionId -> divisionName
  for (const r of roles) {
    const fam = r.roleFamily!;
    if (!famMap.has(fam)) famMap.set(fam, new Map());
    famMap.get(fam)!.set(r.divisionId!, r.division!.name);
  }
  return [...famMap.entries()]
    .filter(([, divs]) => divs.size > 1)
    .map(([capability, divs]) => ({ capability, count: divs.size, divisions: [...divs.entries()].map(([id, name]) => ({ id, name })) }))
    .sort((a, b) => b.count - a.count);
}

// Gap 2 — sub-value-stream ownership gaps.
// RoleValueStream.subStream stores compound strings: "L3Name — L4Name".
// For a L3 node, roleLinkCount = # of RVS rows whose subStream starts with "L3Name — ".
// For a L4 node, roleLinkCount = # of RVS rows whose subStream === "L3Name — L4Name".
// Returns a Map<subValueStreamId, roleLinkCount> for all L3s of a given value stream.
async function l3RoleLinkCounts(valueStreamId: string, l3s: { id: string; name: string }[]) {
  if (!l3s.length) return new Map<string, number>();
  const rvs = await prisma.roleValueStream.findMany({
    where: { valueStreamId, subStream: { not: null } },
    select: { subStream: true },
  });
  const counts = new Map<string, number>(l3s.map((s) => [s.id, 0]));
  for (const r of rvs) {
    const sub = r.subStream!;
    for (const l3 of l3s) {
      if (sub.startsWith(l3.name + ' — ')) {
        counts.set(l3.id, (counts.get(l3.id) ?? 0) + 1);
        break; // each RVS row matches at most one L3
      }
    }
  }
  return counts;
}

async function headcount(personWhere: any) {
  const [emp, reg] = await Promise.all([
    prisma.person.groupBy({ by: ['employmentType'], where: personWhere, _count: { _all: true } }),
    prisma.person.groupBy({ by: ['region'], where: personWhere, _count: { _all: true } }),
  ]);
  const out: any = { badged: 0, contractor: 0, si_partner: 0, total: 0, Onshore: 0, Nearshore: 0, Offshore: 0 };
  for (const r of emp) { out[r.employmentType] = r._count._all; out.total += r._count._all; }
  for (const r of reg) if (r.region) out[r.region] = (out[r.region] ?? 0) + r._count._all;
  return out;
}
async function avgPersonMetrics(personWhere: any) {
  const rows = await prisma.personMetric.groupBy({ by: ['name', 'unit', 'direction'], where: { person: personWhere, period: LATEST_PERIOD }, _avg: { value: true } });
  return rows.map((r) => ({ name: r.name, unit: r.unit, direction: r.direction, value: Math.round((r._avg.value ?? 0) * 10) / 10 }));
}
async function controlsFor(roleIds: string[]) {
  if (!roleIds.length) return { count: 0, byCategory: [] as any[] };
  const items = await prisma.checklistItem.findMany({ where: { roleId: { in: roleIds }, category: { name: { in: CONTROL_CATEGORIES } } }, select: { text: true, category: { select: { name: true } } } });
  const m = new Map<string, { count: number; samples: string[] }>();
  for (const it of items) { const cat = it.category?.name ?? 'Other'; if (!m.has(cat)) m.set(cat, { count: 0, samples: [] }); const e = m.get(cat)!; e.count++; if (e.samples.length < 3) e.samples.push(it.text); }
  return { count: items.length, byCategory: [...m.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.count - a.count) };
}
async function categoryCounts(roleIds: string[]) {
  if (!roleIds.length) return [] as { category: string; count: number }[];
  const items = await prisma.checklistItem.findMany({ where: { roleId: { in: roleIds } }, select: { category: { select: { name: true } } } });
  const m = new Map<string, number>();
  for (const it of items) { const cat = it.category?.name ?? 'Other'; m.set(cat, (m.get(cat) ?? 0) + 1); }
  return [...m.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}
async function streamsForRoles(roleWhere: any) {
  const links = await prisma.roleValueStream.findMany({ where: { role: roleWhere }, select: { valueStreamId: true, participationType: true, valueStream: { select: { id: true, name: true, domain: true } } } });
  const m = new Map<string, any>();
  for (const l of links) { const cur = m.get(l.valueStreamId); if (!cur || (PART_ORDER[l.participationType] ?? 9) < (PART_ORDER[cur.participationType] ?? 9)) m.set(l.valueStreamId, { id: l.valueStreamId, name: l.valueStream.name, domain: l.valueStream.domain, participationType: l.participationType }); }
  return [...m.values()].sort((a, b) => (PART_ORDER[a.participationType] ?? 9) - (PART_ORDER[b.participationType] ?? 9));
}
async function appsForStreams(streamIds: string[]) {
  if (!streamIds.length) return [] as any[];
  const links = await prisma.applicationValueStream.findMany({ where: { valueStreamId: { in: streamIds } }, include: { application: { select: { id: true, name: true, kind: true, vendor: true, criticality: true, illustrative: true } } } });
  const m = new Map<string, any>();
  for (const l of links) if (!m.has(l.applicationId)) m.set(l.applicationId, { ...l.application, systemRole: l.systemRole });
  return [...m.values()];
}
// Real KPI rows for a set of value streams + attainment rollup (the data behind
// the "how well" charts; the reading is illustrative, the definition real).
async function kpisFor(streamIds: string[], take = 400) {
  if (!streamIds.length) return { metrics: [] as any[], attainment: emptyAttainment() };
  const rows = await prisma.metric.findMany({ where: { valueStreamId: { in: streamIds } }, take, select: { name: true, value: true, unit: true, target: true, targetText: true, direction: true, category: true, l3: true, ownerRole: true, framework: true } });
  return { metrics: rows, attainment: attainmentOf(rows) };
}
function emptyAttainment() { return { onTarget: 0, offTarget: 0, measured: 0, total: 0, byCategory: [] as any[] }; }
function attainmentOf(metrics: any[]) {
  let on = 0, off = 0; const cat = new Map<string, { on: number; total: number }>();
  for (const m of metrics) {
    const good = m.target == null ? null : m.direction === 'down' ? m.value <= m.target : m.value >= m.target;
    if (good === true) on++; else if (good === false) off++;
    const k = m.category || 'Other'; const e = cat.get(k) ?? { on: 0, total: 0 };
    if (good != null) { e.total++; if (good) e.on++; } cat.set(k, e);
  }
  return { onTarget: on, offTarget: off, measured: on + off, total: metrics.length, byCategory: [...cat.entries()].map(([category, v]) => ({ category, onTarget: v.on, total: v.total, pct: v.total ? Math.round((v.on / v.total) * 100) : 0 })).sort((a, b) => b.total - a.total) };
}
async function ioCounts(streamIds: string[], l4?: string) {
  if (!streamIds.length) return { Input: 0, Output: 0, Deliverable: 0, total: 0 };
  const rows = await prisma.ioItem.groupBy({ by: ['type'], where: { valueStreamId: { in: streamIds }, ...(l4 ? { l4 } : {}) }, _count: { _all: true } });
  const out: any = { Input: 0, Output: 0, Deliverable: 0, total: 0 };
  for (const r of rows) { out[r.type] = r._count._all; out.total += r._count._all; }
  return out;
}
async function risksBySeverity(where: any) {
  const rows = await prisma.risk.groupBy({ by: ['severity'], where, _count: { _all: true } });
  const order = ['Critical', 'High', 'Medium', 'Low'];
  const total = rows.reduce((a, r) => a + r._count._all, 0);
  return { total, bySeverity: order.map((severity) => ({ severity, count: rows.find((r) => r.severity === severity)?._count._all ?? 0 })) };
}

// ── overview (company bootstrap) ────────────────────────────────────────
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    // The sidebar index: both ways into the model (operating-model domains +
    // the org's divisions), so the canvas can be operating-model-led while the
    // org stays one click away.
    const [domains, divisions, valueStreams] = await Promise.all([
      prisma.valueStreamDomain.findMany({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { valueStreams: true } } } }),
      prisma.division.findMany({ where: { companyId: company.id }, orderBy: { name: 'asc' }, include: { _count: { select: { roles: true } } } }),
      prisma.valueStream.count({ where: { companyId: company.id } }),
    ]);
    res.json({
      company,
      counts: { domains: domains.length, divisions: divisions.length, valueStreams },
      domains: domains.map((d) => ({ id: d.id, name: d.name, valueStreams: d._count.valueStreams })),
      // higherCategory groups divisions into the three CEO-facing top-level buckets:
      // "Core Business" | "IT" | "Corporate Function" (from Org Chart View 2).
      divisions: divisions.map((d) => ({ id: d.id, name: d.name, higherCategory: d.higherCategory, roles: d._count.roles })),
    });
  } catch (e) { next(e); }
});

// ── unified drill node endpoint ─────────────────────────────────────────
router.get('/node/:type/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await buildNode(req.tenantId, req.params.type, req.params.id, typeof req.query.cursor === 'string' ? req.query.cursor : undefined);
    if (!out) return res.status(404).json({ error: 'Not found' });
    res.json(out);
  } catch (e) { next(e); }
});
router.get('/node/:type/:id/children', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await buildNode(req.tenantId, req.params.type, req.params.id, typeof req.query.cursor === 'string' ? req.query.cursor : undefined);
    if (!out) return res.status(404).json({ error: 'Not found' });
    res.json(out.children);
  } catch (e) { next(e); }
});

async function buildNode(tenantId: string, type: string, id: string, cursor?: string) {
  switch (type) {
    case 'company': return nodeCompany(tenantId, id);
    case 'domain': return nodeDomain(tenantId, id);
    case 'division': return nodeDivision(tenantId, id);
    case 'department': return nodeDepartment(tenantId, id);
    case 'valueStream': return nodeValueStream(tenantId, id);
    case 'subValueStream': return nodeSubValueStream(tenantId, id);
    case 'processStep': return nodeProcessStep(tenantId, id);
    case 'role': return nodeRole(tenantId, id, cursor);
    case 'person': return nodePerson(tenantId, id);
    case 'initiative': return nodeInitiative(tenantId, id, cursor);
    case 'application': return nodeApplication(tenantId, id);
    case 'task': return nodeTask(tenantId, id);
    default: return null;
  }
}

const child = (id: string, type: string, name: string, extra: any = {}) => ({ id, type, name, ...extra });

async function nodeCompany(tenantId: string, id: string) {
  const company = await prisma.company.findFirst({ where: { id, tenantId } });
  if (!company) return null;
  const c = company.id;
  const [domains, divisions, roleCount, ppl, allVs, apps, risk, inits, kpi, capabilityOverlaps] = await Promise.all([
    prisma.valueStreamDomain.findMany({ where: { companyId: c }, orderBy: { name: 'asc' }, include: { _count: { select: { valueStreams: true } } } }),
    prisma.division.findMany({ where: { companyId: c }, orderBy: { name: 'asc' }, include: { _count: { select: { departments: true, roles: true } } } }),
    prisma.role.count({ where: { companyId: c } }),
    headcount({ companyId: c }),
    prisma.valueStream.findMany({ where: { companyId: c }, select: { id: true } }),
    prisma.application.groupBy({ by: ['kind'], where: { companyId: c }, _count: { _all: true } }),
    risksBySeverity({ companyId: c }),
    prisma.initiative.groupBy({ by: ['health'], where: { companyId: c }, _count: { _all: true } }),
    prisma.metric.count({ where: { companyId: c } }),
    capabilityOverlapsFor(c),
  ]);
  const kpiRoll = await kpisFor(allVs.map((v) => v.id));
  const stepCount = await prisma.processStep.count({ where: { valueStream: { companyId: c } } });
  // Operating-model-led: the company drills into its value-stream domains. The
  // organization (divisions → people) nests underneath value streams and is also
  // a click away in the sidebar.
  const items = domains.map((d) => child(d.id, 'domain', d.name, { subtitle: `${d._count.valueStreams} value streams`, badges: { valueStreams: d._count.valueStreams } }));
  // CEO-facing org: divisions grouped by the three top-level buckets.
  const divsByGroup: Record<string, { id: string; name: string; roles: number }[]> = { 'Core Business': [], 'IT': [], 'Corporate Function': [] };
  for (const d of divisions) { const g = d.higherCategory ?? 'Core Business'; (divsByGroup[g] ??= []).push({ id: d.id, name: d.name, roles: d._count.roles }); }
  return {
    type: 'company', id: c, name: company.name, subtitle: `${domains.length} domains · ${allVs.length} value streams · ${divisions.length} divisions · ${ppl.total} people`, illustrative: false,
    lenses: {
      who: { headcount: ppl },
      what: { domains: domains.length, divisions: divisions.length, valueStreams: allVs.length, kpis: kpi },
      how: { processSteps: stepCount, valueStreams: allVs.length },
      where: { systems: apps.reduce((a, x) => a + x._count._all, 0), byKind: apps.map((x) => ({ kind: x.kind, count: x._count._all })) },
      why: { risks: risk.total, bySeverity: risk.bySeverity },
      howWell: { attainment: kpiRoll.attainment, initiatives: inits.map((x) => ({ health: x.health, count: x._count._all })) },
    },
    // divsByGroup: the CEO's three top-level org buckets (Core Business / IT / Corporate Function).
    divsByGroup,
    // capabilityOverlaps: role families (capability types) that appear in 2+ divisions.
    // CEO overlap signal: same capability duplicated across organizational boundaries.
    // Derived from Role.roleFamily; excludes the 157 roles with null roleFamily.
    capabilityOverlaps,
    children: { childType: 'domain', total: items.length, nextCursor: null, items },
  };
}

async function nodeDomain(tenantId: string, id: string) {
  const dom = await prisma.valueStreamDomain.findFirst({ where: { id, tenantId }, include: { valueStreams: { orderBy: { name: 'asc' }, include: { _count: { select: { subStreams: true, processSteps: true, roleLinks: true } } } } } });
  if (!dom) return null;
  const streamIds = dom.valueStreams.map((v) => v.id);
  const [ppl, kpi, apps, risk, io, steps] = await Promise.all([
    headcount({ assignments: { some: { role: { valueStreamLinks: { some: { valueStreamId: { in: streamIds.length ? streamIds : ['_'] } } } } } } }),
    kpisFor(streamIds),
    appsForStreams(streamIds),
    risksBySeverity({ valueStreamId: { in: streamIds.length ? streamIds : ['_'] } }),
    ioCounts(streamIds),
    prisma.processStep.count({ where: { valueStreamId: { in: streamIds.length ? streamIds : ['_'] } } }),
  ]);
  return {
    type: 'domain', id: dom.id, name: dom.name, subtitle: `${dom.valueStreams.length} value streams · ${kpi.metrics.length} KPIs`, illustrative: false,
    lenses: {
      who: { headcount: ppl },
      what: { valueStreams: dom.valueStreams.length, kpis: kpi.metrics.length, io },
      how: { processSteps: steps, valueStreams: dom.valueStreams.map((v) => ({ id: v.id, name: v.name })) },
      where: { applications: apps.slice(0, 14) },
      why: { risks: risk.total, bySeverity: risk.bySeverity },
      howWell: { attainment: kpi.attainment, metrics: kpi.metrics.slice(0, 24) },
    },
    children: { childType: 'valueStream', total: dom.valueStreams.length, nextCursor: null, items: dom.valueStreams.map((v) => child(v.id, 'valueStream', v.name, { subtitle: `${v._count.subStreams} processes · ${v._count.processSteps} steps`, badges: { roles: v._count.roleLinks } })) },
  };
}

async function nodeDivision(tenantId: string, id: string) {
  const div = await prisma.division.findFirst({ where: { id, tenantId }, include: { departments: { orderBy: { name: 'asc' }, include: { _count: { select: { roles: true } } } } } });
  if (!div) return null;
  const roleWhere = { divisionId: div.id };
  const [roles, ppl, streams, controls, metrics, leaders, risk, cats, standards] = await Promise.all([
    prisma.role.findMany({ where: roleWhere, select: { id: true } }),
    headcount({ assignments: { some: { role: roleWhere } } }),
    streamsForRoles(roleWhere),
    prisma.role.findMany({ where: roleWhere, select: { id: true } }).then((r) => controlsFor(r.map((x) => x.id))),
    avgPersonMetrics({ assignments: { some: { role: roleWhere } } }),
    prisma.role.findMany({ where: { ...roleWhere, OR: [{ roleLevel: { contains: 'Executive', mode: 'insensitive' } }, { name: { contains: 'Chief', mode: 'insensitive' } }, { name: { contains: 'Head', mode: 'insensitive' } }] }, select: { id: true, name: true }, take: 6 }),
    risksBySeverity({ valueStream: { roleLinks: { some: { role: roleWhere } } } }),
    prisma.role.findMany({ where: roleWhere, select: { id: true } }).then((r) => categoryCounts(r.map((x) => x.id))),
    prisma.standard.findMany({ where: { companyId: div.companyId }, select: { department: true, count: true, charterIncluded: true, owner: true } }),
  ]);
  const apps = await appsForStreams(streams.map((s) => s.id));
  const kpi = await kpisFor(streams.map((s) => s.id));
  return {
    type: 'division', id: div.id, name: div.name, higherCategory: div.higherCategory, subtitle: `${div.departments.length} departments · ${roles.length} roles · ${ppl.total} people`, illustrative: false,
    lenses: {
      who: { headcount: ppl, leaders: leaders.map((l) => ({ id: l.id, name: l.name })) },
      what: { roles: roles.length, valueStreams: streams.length, categories: cats },
      how: { valueStreams: streams.slice(0, 14) },
      where: { applications: apps.slice(0, 14) },
      why: { controls: controls.count, byCategory: controls.byCategory, risks: risk.total, bySeverity: risk.bySeverity, standards: standards.slice(0, 6) },
      howWell: { metrics, attainment: kpi.attainment },
    },
    children: { childType: 'department', total: div.departments.length, nextCursor: null, items: div.departments.map((d) => child(d.id, 'department', d.name, { subtitle: `${d._count.roles} roles`, badges: { roles: d._count.roles } })) },
  };
}

async function nodeDepartment(tenantId: string, id: string) {
  const dept = await prisma.department.findFirst({ where: { id, tenantId }, include: { division: { select: { id: true, name: true } }, roles: { orderBy: { name: 'asc' }, select: { id: true, name: true, roleFamily: true, roleLevel: true, _count: { select: { reports: true } } } } } });
  if (!dept) return null;
  const roleWhere = { departmentId: dept.id };
  const roleIds = dept.roles.map((r) => r.id);
  const [ppl, streams, controls, metrics, cats] = await Promise.all([
    headcount({ assignments: { some: { role: roleWhere } } }),
    streamsForRoles(roleWhere),
    controlsFor(roleIds),
    avgPersonMetrics({ assignments: { some: { role: roleWhere } } }),
    categoryCounts(roleIds),
  ]);
  const apps = await appsForStreams(streams.map((s) => s.id));
  return {
    type: 'department', id: dept.id, name: dept.name, subtitle: `${dept.division.name} · ${dept.roles.length} roles · ${ppl.total} people`, illustrative: false,
    lenses: {
      who: { headcount: ppl, division: dept.division },
      what: { roles: dept.roles.length, valueStreams: streams.length, categories: cats },
      how: { valueStreams: streams.slice(0, 14) },
      where: { applications: apps.slice(0, 14) },
      why: { controls: controls.count, byCategory: controls.byCategory },
      howWell: { metrics },
    },
    children: { childType: 'role', total: dept.roles.length, nextCursor: null, items: dept.roles.map((r) => child(r.id, 'role', r.name, { subtitle: [r.roleLevel, r.roleFamily].filter(Boolean).join(' · ') || undefined, badges: r._count.reports ? { reports: r._count.reports } : undefined })) },
  };
}

async function nodeValueStream(tenantId: string, id: string) {
  const vs = await prisma.valueStream.findFirst({ where: { id, tenantId }, include: { domainRef: { select: { id: true, name: true } } } });
  if (!vs) return null;
  const [links, subStreams, apps, metrics, inits, risk, steps, io] = await Promise.all([
    prisma.roleValueStream.findMany({ where: { valueStreamId: vs.id }, include: { role: { select: { id: true, name: true } } } }),
    prisma.subValueStream.findMany({ where: { valueStreamId: vs.id }, orderBy: [{ level: 'asc' }, { sourceRow: 'asc' }], select: { id: true, parentId: true, level: true, name: true, inputs: true, outputs: true, sourceRow: true } }),
    prisma.applicationValueStream.findMany({ where: { valueStreamId: vs.id }, include: { application: { select: { id: true, name: true, kind: true, vendor: true, criticality: true, illustrative: true } } } }),
    prisma.metric.findMany({ where: { valueStreamId: vs.id }, select: { name: true, value: true, unit: true, target: true, targetText: true, direction: true, category: true, l3: true, ownerRole: true, framework: true } }),
    prisma.initiativeValueStream.findMany({ where: { valueStreamId: vs.id }, include: { initiative: { select: { id: true, name: true, health: true, stage: true } } } }),
    risksBySeverity({ valueStreamId: vs.id }),
    prisma.processStep.findMany({ where: { valueStreamId: vs.id }, orderBy: { stepNumber: 'asc' }, select: { id: true, stepNumber: true, name: true, l3: true, leads: true } }),
    ioCounts([vs.id]),
  ]);
  const roleIds = [...new Set(links.map((l) => l.roleId))];
  const controls = await controlsFor(roleIds);
  const whoMap = new Map<string, any>();
  for (const l of links) { const cur = whoMap.get(l.roleId); if (!cur || (PART_ORDER[l.participationType] ?? 9) < (PART_ORDER[cur.participationType] ?? 9)) whoMap.set(l.roleId, { id: l.roleId, name: l.role.name, participationType: l.participationType }); }
  const who = [...whoMap.values()].sort((a, b) => (PART_ORDER[a.participationType] ?? 9) - (PART_ORDER[b.participationType] ?? 9));
  const l3 = subStreams.filter((s) => s.level === 3).sort((a, b) => (a.sourceRow ?? 0) - (b.sourceRow ?? 0));
  // Gap 2: compute roleLinkCount per L3 process area (ownership gap signal).
  const l3LinkCounts = await l3RoleLinkCounts(vs.id, l3);
  const ownershipGaps = l3.filter((s) => (l3LinkCounts.get(s.id) ?? 0) === 0).length;
  const appItems = apps.map((a) => child(a.application.id, 'application', a.application.name, { group: a.application.kind === 'External' ? 'External applications' : 'Supporting applications', subtitle: `${a.application.kind}${a.application.vendor ? ' · ' + a.application.vendor : ''}`, badges: { kind: a.application.kind } }));
  return {
    type: 'valueStream', id: vs.id, name: vs.name, subtitle: vs.domain ?? undefined, illustrative: false,
    lenses: {
      who: { roles: who },
      what: { deliverables: subStreams.filter((s) => s.level === 4 && s.outputs).map((s) => ({ process: s.name, output: s.outputs })), io },
      // ownershipGaps: count of L3 process areas with no owning/contributing roles (accountability gap / loss signal).
      how: { processAreas: l3.length, subProcesses: subStreams.filter((s) => s.level === 4).length, ownershipGaps, steps, initiatives: inits.map((i) => ({ id: i.initiativeId, name: i.initiative.name, health: i.initiative.health })) },
      where: { applications: apps.map((a) => ({ ...a.application, systemRole: a.systemRole })) },
      why: { controls: controls.count, byCategory: controls.byCategory, risks: risk.total, bySeverity: risk.bySeverity },
      howWell: { metrics, attainment: attainmentOf(metrics) },
    },
    children: {
      childType: 'mixed', total: l3.length + appItems.length, nextCursor: null,
      items: [
        // roleLinkCount: # of role-participation records for this process area.
        // hasOwner: false means no roles are mapped here — an accountability gap.
        ...l3.map((s) => { const roleLinkCount = l3LinkCounts.get(s.id) ?? 0; return child(s.id, 'subValueStream', s.name, { group: 'Process flow', flow: true, roleLinkCount, hasOwner: roleLinkCount > 0 }); }),
        ...appItems,
      ],
    },
  };
}

// The roles involved in a process, nested under the flow (they drill → people).
// Prefer the roles named as a step's lead/supporting (process-specific); when a
// process has no mapped steps (most value streams), fall back to the value
// stream's participating roles so EVERY value stream always shows roles.
async function rolesInProcess(tenantId: string, valueStreamId: string, steps: { leads: string | null; supporting: string | null }[]) {
  const tokens = new Set<string>();
  for (const st of steps) for (const f of [st.leads, st.supporting]) if (f) for (const t of f.split(',')) { const v = t.trim(); if (v) tokens.add(v); }
  if (tokens.size) {
    const roles = await prisma.role.findMany({ where: { tenantId, name: { in: [...tokens] } }, select: { id: true, name: true, roleLevel: true, division: { select: { name: true } } } });
    if (roles.length) return roles.map((r) => ({ id: r.id, name: r.name, subtitle: r.division?.name ?? r.roleLevel ?? undefined }));
  }
  // fallback: roles that participate in the value stream (always populated)
  const links = await prisma.roleValueStream.findMany({ where: { valueStreamId }, select: { roleId: true, participationType: true, role: { select: { id: true, name: true, roleLevel: true, division: { select: { name: true } } } } } });
  const m = new Map<string, any>();
  for (const l of links) { const cur = m.get(l.roleId); if (!cur || (PART_ORDER[l.participationType] ?? 9) < (PART_ORDER[cur.p] ?? 9)) m.set(l.roleId, { ...l.role, p: l.participationType }); }
  return [...m.values()].sort((a, b) => (PART_ORDER[a.p] ?? 9) - (PART_ORDER[b.p] ?? 9)).map((r) => ({ id: r.id, name: r.name, subtitle: r.division?.name ?? r.roleLevel ?? undefined }));
}

async function nodeSubValueStream(tenantId: string, id: string) {
  const s = await prisma.subValueStream.findFirst({ where: { id, tenantId }, include: { children: { orderBy: { sourceRow: 'asc' }, select: { id: true, name: true } }, parent: { select: { name: true } } } });
  if (!s) return null;
  const isL3 = s.level === 3;
  const stepWhere = isL3 ? { valueStreamId: s.valueStreamId, l3: s.name } : { valueStreamId: s.valueStreamId, l4: s.name };
  const [steps, io] = await Promise.all([
    prisma.processStep.findMany({ where: stepWhere, orderBy: { stepNumber: 'asc' }, select: { id: true, stepNumber: true, name: true, leads: true, supporting: true } }),
    isL3 ? Promise.resolve({ Input: 0, Output: 0, Deliverable: 0, total: 0 }) : ioCounts([s.valueStreamId], s.name),
  ]);
  const roles = await rolesInProcess(tenantId, s.valueStreamId, steps);
  // Gap 2: compute roleLinkCount for this node.
  // L3: count RVS rows starting with "name — "; L4: count exact compound matches.
  const compoundKey = isL3 ? null : `${s.parent?.name} — ${s.name}`;
  const rvsRows = await prisma.roleValueStream.findMany({
    where: {
      valueStreamId: s.valueStreamId,
      subStream: isL3 ? { startsWith: s.name + ' — ' } : compoundKey!,
    },
    select: { roleId: true },
  });
  const roleLinkCount = rvsRows.length;
  // Children: the next flow level (sub-processes for L3, steps for L4) plus the
  // roles involved nested right under the flow.
  const flowItems = isL3
    ? s.children.map((c) => child(c.id, 'subValueStream', c.name, { group: 'Sub-processes', flow: true }))
    : steps.map((st) => child(st.id, 'processStep', `${st.stepNumber}. ${st.name}`, { group: 'Process steps', flow: true, subtitle: st.leads ?? undefined }));
  const roleItems = roles.map((r) => child(r.id, 'role', r.name, { group: 'Roles involved', subtitle: r.subtitle }));
  const items = [...flowItems, ...roleItems];
  return {
    type: 'subValueStream', id: s.id, name: s.name, subtitle: isL3 ? 'Process area' : 'Sub-process', illustrative: false,
    // roleLinkCount / hasOwner: Gap 2 ownership signal. hasOwner=false = accountability gap (loss signal).
    roleLinkCount, hasOwner: roleLinkCount > 0,
    lenses: {
      who: { rolesInvolved: roles },
      what: { output: s.outputs, io }, how: { inputs: s.inputs, outputs: s.outputs, upstream: s.upstream, downstream: s.downstream, steps }, where: {}, why: { notes: s.notes }, howWell: {},
    },
    children: { childType: 'mixed', total: items.length, nextCursor: null, items },
  };
}

async function nodeProcessStep(tenantId: string, id: string) {
  const st = await prisma.processStep.findFirst({ where: { id, tenantId } });
  if (!st) return null;
  return {
    type: 'processStep', id: st.id, name: `${st.stepNumber}. ${st.name}`, subtitle: st.l3 ?? undefined, illustrative: false,
    lenses: {
      who: { leads: st.leads, supporting: st.supporting }, what: { outputs: st.outputs }, how: { inputs: st.inputs, outputs: st.outputs, description: st.description, stepNumber: st.stepNumber }, where: { externalParticipants: st.externalParticipants }, why: { notes: st.notes }, howWell: {},
    },
    children: { childType: null, total: 0, nextCursor: null, items: [] as any[] },
  };
}

async function nodeRole(tenantId: string, id: string, cursor?: string) {
  const role = await prisma.role.findFirst({ where: { id, tenantId }, include: { division: { select: { id: true, name: true } }, department: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } } } });
  if (!role) return null;
  const [ppl, links, cats, roleTasks, ownedRisks, reports, peopleRows] = await Promise.all([
    headcount({ assignments: { some: { roleId: role.id } } }),
    prisma.roleValueStream.findMany({ where: { roleId: role.id }, include: { valueStream: { select: { id: true, name: true } } } }),
    categoryCounts([role.id]),
    prisma.roleTask.count({ where: { roleId: role.id } }),
    prisma.risk.count({ where: { ownerRoleId: role.id } }),
    prisma.role.findMany({ where: { managerRoleId: role.id }, orderBy: { name: 'asc' }, select: { id: true, name: true, roleLevel: true, _count: { select: { reports: true } } } }),
    prisma.person.findMany({ where: { assignments: { some: { roleId: role.id } } }, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: PAGE + 1, select: { id: true, name: true, employmentType: true, region: true } }),
  ]);
  const metrics = await avgPersonMetrics({ assignments: { some: { roleId: role.id } } });
  const streams = links.reduce<Map<string, any>>((m, l) => { if (!m.has(l.valueStreamId)) m.set(l.valueStreamId, { id: l.valueStreamId, name: l.valueStream.name, participationType: l.participationType }); return m; }, new Map());
  const apps = await appsForStreams([...streams.keys()]);
  const kpisOwned = await prisma.metric.count({ where: { ownerRole: role.name, companyId: role.companyId } });
  const more = peopleRows.length > PAGE; const ppls = more ? peopleRows.slice(0, PAGE) : peopleRows;
  const items = [
    ...reports.map((r) => child(r.id, 'role', r.name, { subtitle: r.roleLevel ?? undefined, group: 'Direct reports', badges: r._count.reports ? { reports: r._count.reports } : undefined })),
    ...ppls.map((p) => child(p.id, 'person', p.name, { subtitle: p.employmentType, group: 'People in role', badges: { employmentType: p.employmentType, region: p.region } })),
  ];
  return {
    type: 'role', id: role.id, name: role.name, subtitle: `${[role.roleLevel, role.department?.name, role.division?.name].filter(Boolean).join(' · ') || 'Role'} · ${ppl.total} people`, illustrative: false,
    lenses: {
      who: { headcount: ppl, division: role.division, department: role.department, manager: role.manager, directReports: reports.length },
      what: { categories: cats, roleTasks, responsibilities: role.responsibilities, description: role.description, kpisOwned },
      how: { valueStreams: [...streams.values()] },
      where: { applications: apps.slice(0, 12) },
      why: { controls: cats.filter((cc) => CONTROL_CATEGORIES.includes(cc.category)).reduce((a, cc) => a + cc.count, 0), ownedRisks },
      howWell: { metrics },
    },
    children: { childType: 'mixed', total: reports.length + ppl.total, nextCursor: more ? ppls[ppls.length - 1].id : null, items },
  };
}

async function nodePerson(tenantId: string, id: string) {
  const person = await prisma.person.findFirst({ where: { id, tenantId }, include: { assignments: { include: { role: { select: { id: true, name: true } }, initiative: { select: { id: true, name: true, health: true } } } } } });
  if (!person) return null;
  const roleIds = person.assignments.map((a) => a.roleId);
  const [tasks, metrics, ownedRisks] = await Promise.all([
    prisma.personTask.findMany({ where: { personId: person.id }, select: { id: true, title: true, status: true, priority: true } }),
    prisma.personMetric.findMany({ where: { personId: person.id }, orderBy: { period: 'asc' }, select: { period: true, name: true, value: true, unit: true, target: true, direction: true } }),
    prisma.risk.count({ where: { ownerRoleId: { in: roleIds.length ? roleIds : ['_none_'] } } }),
  ]);
  const streams = roleIds.length ? await streamsForRoles({ id: { in: roleIds } }) : [];
  const apps = await appsForStreams(streams.map((s) => s.id));
  const tasksByStatus = new Map<string, number>();
  for (const tk of tasks) tasksByStatus.set(tk.status, (tasksByStatus.get(tk.status) ?? 0) + 1);
  const series = new Map<string, any[]>();
  for (const m of metrics) { const a = series.get(m.name) ?? []; a.push({ period: m.period, value: m.value }); series.set(m.name, a); }
  const latest = metrics.filter((m) => m.period === LATEST_PERIOD).map((m) => ({ name: m.name, value: m.value, unit: m.unit, target: m.target, direction: m.direction }));
  return {
    type: 'person', id: person.id, name: person.name, subtitle: `${person.employmentType}${person.vendor ? ' · ' + person.vendor : ''}${person.title ? ' · ' + person.title : ''}`, illustrative: true,
    lenses: {
      who: { employmentType: person.employmentType, vendor: person.vendor, region: person.region, location: person.location, title: person.title, roles: person.assignments.map((a) => ({ id: a.role.id, name: a.role.name, allocationPct: a.allocationPct })), initiatives: person.assignments.filter((a) => a.initiative).map((a) => ({ id: a.initiative!.id, name: a.initiative!.name, health: a.initiative!.health })) },
      what: { tasksByStatus: [...tasksByStatus.entries()].map(([status, count]) => ({ status, count })), tasks: tasks.slice(0, 12) },
      how: { valueStreams: streams.slice(0, 8) },
      where: { applications: apps.slice(0, 8) },
      why: { blockedTasks: tasksByStatus.get('Blocked') ?? 0, ownedRisks },
      howWell: { latest, series: [...series.entries()].map(([name, points]) => ({ name, points })) },
    },
    children: { childType: 'task', total: tasks.length, nextCursor: null, items: tasks.slice(0, PAGE).map((tk) => child(tk.id, 'task', tk.title, { subtitle: tk.status, badges: { status: tk.status, priority: tk.priority } })) },
  };
}

async function nodeInitiative(tenantId: string, id: string, cursor?: string) {
  const ini = await prisma.initiative.findFirst({ where: { id, tenantId }, include: { sponsorRole: { select: { id: true, name: true } }, valueStreamLinks: { include: { valueStream: { select: { id: true, name: true } } } }, divisionLinks: { include: { division: { select: { id: true, name: true } } } } } });
  if (!ini) return null;
  const [hc, risk, peopleRows, metrics] = await Promise.all([
    headcount({ assignments: { some: { initiativeId: ini.id } } }),
    prisma.risk.findMany({ where: { initiativeId: ini.id }, select: { id: true, title: true, severity: true, status: true } }),
    prisma.person.findMany({ where: { assignments: { some: { initiativeId: ini.id } } }, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: PAGE + 1, select: { id: true, name: true, employmentType: true, region: true, vendor: true } }),
    avgPersonMetrics({ assignments: { some: { initiativeId: ini.id } } }),
  ]);
  const apps = await appsForStreams(ini.valueStreamLinks.map((l) => l.valueStreamId));
  const more = peopleRows.length > PAGE; const ppls = more ? peopleRows.slice(0, PAGE) : peopleRows;
  const sev = ['Critical', 'High', 'Medium', 'Low'];
  return {
    type: 'initiative', id: ini.id, name: ini.name, subtitle: `${ini.stage ?? ''}${ini.stage ? ' · ' : ''}${ini.health} · ${hc.total} people`, illustrative: true,
    lenses: {
      who: { headcount: hc, sponsor: ini.sponsorRole },
      what: { valueStreams: ini.valueStreamLinks.map((l) => ({ id: l.valueStreamId, name: l.valueStream.name })), stage: ini.stage, status: ini.status, budget: ini.budget },
      how: { divisions: ini.divisionLinks.map((l) => ({ id: l.divisionId, name: l.division.name })), valueStreams: ini.valueStreamLinks.map((l) => ({ id: l.valueStreamId, name: l.valueStream.name })) },
      where: { applications: apps.slice(0, 12) },
      why: { risks: risk, bySeverity: sev.map((severity) => ({ severity, count: risk.filter((r) => r.severity === severity).length })) },
      howWell: { health: ini.health, metrics },
    },
    children: { childType: 'person', total: hc.total, nextCursor: more ? ppls[ppls.length - 1].id : null, items: ppls.map((p) => child(p.id, 'person', p.name, { subtitle: `${p.employmentType}${p.vendor ? ' · ' + p.vendor : ''}`, badges: { employmentType: p.employmentType, region: p.region } })) },
  };
}

async function nodeApplication(tenantId: string, id: string) {
  const app = await prisma.application.findFirst({ where: { id, tenantId }, include: { valueStreamLinks: { include: { valueStream: { select: { id: true, name: true } } } } } });
  if (!app) return null;
  // Dependent applications "within the flow" = other systems that support the
  // same value streams, split internal vs external. (Illustrative app graph.)
  const streamIds = app.valueStreamLinks.map((l) => l.valueStreamId);
  const links = streamIds.length
    ? await prisma.applicationValueStream.findMany({ where: { valueStreamId: { in: streamIds }, applicationId: { not: app.id } }, include: { application: { select: { id: true, name: true, kind: true, vendor: true, criticality: true } } } })
    : [];
  const m = new Map<string, any>();
  for (const l of links) if (!m.has(l.applicationId)) m.set(l.applicationId, l.application);
  const connected = [...m.values()];
  const internal = connected.filter((a) => a.kind !== 'External');
  const external = connected.filter((a) => a.kind === 'External');
  const toItem = (a: any, group: string) => child(a.id, 'application', a.name, { group, subtitle: `${a.kind}${a.vendor ? ' · ' + a.vendor : ''}`, badges: { kind: a.kind } });

  // Roles that support this system = roles participating in the value streams it
  // serves, with the org (division) they sit under.
  const rvs = streamIds.length
    ? await prisma.roleValueStream.findMany({ where: { valueStreamId: { in: streamIds } }, select: { roleId: true, participationType: true, role: { select: { id: true, name: true, division: { select: { name: true } }, department: { select: { name: true } } } } } })
    : [];
  const rm = new Map<string, any>();
  for (const l of rvs) { const cur = rm.get(l.roleId); if (!cur || (PART_ORDER[l.participationType] ?? 9) < (PART_ORDER[cur.p] ?? 9)) rm.set(l.roleId, { id: l.role.id, name: l.role.name, org: l.role.division?.name ?? null, department: l.role.department?.name ?? null, p: l.participationType }); }
  const roles = [...rm.values()].sort((a, b) => (PART_ORDER[a.p] ?? 9) - (PART_ORDER[b.p] ?? 9));
  const roleItems = roles.slice(0, 30).map((r) => child(r.id, 'role', r.name, { group: 'Roles involved', subtitle: r.org ?? r.department ?? undefined }));

  const items = [...roleItems, ...internal.map((a) => toItem(a, 'Internal systems')), ...external.map((a) => toItem(a, 'External systems'))];
  return {
    type: 'application', id: app.id, name: app.name, subtitle: `${app.kind}${app.vendor ? ' · ' + app.vendor : ''} · ${app.criticality} criticality`, illustrative: app.illustrative,
    lenses: {
      who: { roles: roles.map((r) => ({ id: r.id, name: r.name, org: r.org, department: r.department, participationType: r.p })) },
      what: { category: app.category }, how: { systemRoles: app.valueStreamLinks.map((l) => ({ stream: l.valueStream.name, role: l.systemRole })) },
      where: { kind: app.kind, vendor: app.vendor, criticality: app.criticality, internal: internal.length, external: external.length, valueStreams: app.valueStreamLinks.map((l) => ({ id: l.valueStreamId, name: l.valueStream.name })) },
      why: { criticality: app.criticality }, howWell: {},
    },
    children: { childType: 'mixed', total: items.length, nextCursor: null, items },
  };
}

async function nodeTask(tenantId: string, id: string) {
  const tk = await prisma.personTask.findFirst({ where: { id, tenantId }, include: { person: { select: { id: true, name: true } } } });
  if (!tk) return null;
  return {
    type: 'task', id: tk.id, name: tk.title, subtitle: `${tk.status} · ${tk.priority}`, illustrative: true,
    lenses: { who: { assignee: tk.person }, what: { title: tk.title, status: tk.status }, how: {}, where: {}, why: { blocked: tk.status === 'Blocked' }, howWell: { status: tk.status } },
    children: { childType: null, total: 0, nextCursor: null, items: [] as any[] },
  };
}

// ── CEO use-case convenience: contractors on an initiative ──────────────
router.get('/initiatives/:id/contributors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ini = await prisma.initiative.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!ini) return res.status(404).json({ error: 'Not found' });
    const where: any = { initiativeId: ini.id };
    if (req.query.employmentType) where.employmentType = req.query.employmentType;
    const rows = await prisma.assignment.findMany({ where, include: { person: { select: { id: true, name: true, employmentType: true, region: true, vendor: true, location: true, title: true } } }, take: 100 });
    let people = rows.map((r) => ({ ...r.person, allocationPct: r.allocationPct }));
    if (req.query.region) people = people.filter((p) => p.region === req.query.region);
    res.json({ initiative: { id: ini.id, name: ini.name }, contributors: people });
  } catch (e) { next(e); }
});

export default router;
