import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { buildRoleResolver, resolveRoleCell } from '../lib/roleMatch.js';
import { canonicalVs, legacyNamesFor } from '../lib/vsMapping.js';
import { structureCounts } from '../lib/orgCounts.js';

// A sidebar / drill :id may arrive as a unified-node id (the map's namespace
// since the rework) or a legacy table id (old links). Resolve the node when
// present; callers translate to the legacy id (node.code) or branch on the node.
type ResolvedNode = { id: string; typeKey: string; name: string; code: string | null; parentId: string | null; companyId: string };
async function resolveNode(id: string | undefined): Promise<ResolvedNode | null> {
  if (!id) return null;
  return prisma.node.findUnique({ where: { id }, select: { id: true, typeKey: true, name: true, code: true, parentId: true, companyId: true } });
}
// Legacy ValueStream ids whose data folds into one canonical stream name.
async function legacyVsIds(companyId: string, canonicalName: string): Promise<string[]> {
  const rows = await prisma.valueStream.findMany({ where: { companyId, name: { in: legacyNamesFor(canonicalName) } }, select: { id: true } });
  return rows.map((r) => r.id);
}

const router = Router();
router.use(requireAuth);

// Trackable signals live in the TelemetrySignal table (seeded 1:1 from the old
// hardcoded constants + backend/data/telemetry-catalog.json by
// scripts/seed-telemetry-signals.ts; editable in Data Admin → Telemetry).
// isLive=true rows are workforce signals with real per-person readings — their
// `queryType` holds which time-series table to drill ('signal' = PersonSignal,
// 'metric' = PersonMetric). isLive=false rows are the workbook reference catalog.
// Levels a workforce signal can be tracked / rolled up at (individual → org).
const WORKFORCE_LEVELS = ['Individual', 'Role', 'Team', 'Division', 'Company'];

// ── Trackable-metric filter taxonomy ─────────────────────────────────────────
// `type` = the grain a metric is tracked at, collapsed to four plain buckets.
const TYPE_ORDER = ['User', 'Role', 'Division', 'System'] as const;
function metricType(kind: string, levels: string[]): string {
  if (kind === 'system') return 'System';
  if (kind === 'workforce') return 'User'; // per-person Viva/M365 telemetry
  // KPIs: classify by their measurement level.
  const l = levels[0] ?? '';
  if (l === 'Individual') return 'User';
  if (['Division', 'Executive', 'Company', 'Product'].includes(l)) return 'Division';
  return 'Role'; // Team / Department / unspecified
}

// Split a raw (often compound) source string into clean, canonical system tokens
// so the Source filter reads "GitHub", "Viva Insights", "ServiceNow" — not
// "Jira / Rally / Pega / ServiceNow". Framework labels (DORA, NIST…) pass through.
function canonicalSource(t: string): string {
  const low = t.toLowerCase();
  if (/viva/.test(low)) return 'Viva Insights';
  if (/teams/.test(low)) return 'Microsoft Teams';
  if (/microsoft 365|m365|office 365|outlook|sharepoint/.test(low)) return 'Microsoft 365';
  if (/github/.test(low)) return 'GitHub';
  if (/azure devops/.test(low)) return 'Azure DevOps';
  if (/azure virtual desktop/.test(low)) return 'Azure Virtual Desktop';
  if (/cloudtrail|codebuild|cloudwatch|\baws\b/.test(low)) return 'AWS';
  if (/\bazure\b/.test(low)) return 'Azure';
  if (/jira/.test(low)) return 'Jira';
  if (/rally/.test(low)) return 'Rally';
  if (/servicenow/.test(low)) return 'ServiceNow';
  if (/pega/.test(low)) return 'Pega';
  if (/guidewire|claimcenter|policycenter/.test(low)) return 'Guidewire';
  if (/duck creek/.test(low)) return 'Duck Creek';
  if (/okta/.test(low)) return 'Okta';
  if (/splunk/.test(low)) return 'Splunk';
  if (/opentelemetry|otel/.test(low)) return 'OpenTelemetry';
  if (/in[\s‑-]house|rules engine|process mining|claim|policy system/.test(low)) return 'In-house apps';
  return t.trim();
}
function normalizeSource(raw: string | null): string[] {
  if (!raw) return [];
  // Split only on spaced separators ("A / B", "A, B", "A & B") so we don't break
  // tokens like "GDPR/Privacy" or "issue/PR support".
  const parts = raw.split(/\s+\/\s+|\s*,\s*|\s+&\s+|\sand\s/).map((p) => p.trim()).filter(Boolean);
  return [...new Set(parts.map(canonicalSource))];
}

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
    // The sidebar index: both ways into the model (segments + divisions), so the
    // canvas can be operating-model-led while the org stays one click away.
    // The map renders from the unified Node tree (operating-model rework):
    // enterprise = the ROOT label, segment = the grouping bucket, division,
    // value_stream. Editing any node in the builder therefore reflects here.
    const treeNodes = await prisma.node.findMany({
      where: { companyId: company.id, typeKey: { in: ['enterprise', 'segment', 'division', 'value_stream'] } },
      orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, typeKey: true, parentId: true },
    });
    const root = treeNodes.find((l) => l.typeKey === 'enterprise');
    const domains = treeNodes.filter((l) => l.typeKey === 'segment');
    const domainName = new Map(domains.map((d) => [d.id, d.name] as const));
    const divisions = treeNodes.filter((l) => l.typeKey === 'division');
    const vsCount = treeNodes.filter((l) => l.typeKey === 'value_stream').length;
    res.json({
      // Root label comes from the L0 tree node when present, else the company name.
      company: { id: company.id, name: root?.name ?? company.name },
      counts: { domains: domains.length, divisions: divisions.length, valueStreams: vsCount },
      domains: domains.map((d) => ({ id: d.id, name: d.name, valueStreams: 0 })),
      // higherCategory = the L1 domain bucket ("Core Business" | "IT" | "Corporate Function").
      divisions: divisions.map((d) => ({ id: d.id, name: d.name, higherCategory: d.parentId ? domainName.get(d.parentId) ?? null : null, roles: 0 })),
    });
  } catch (e) { next(e); }
});

// Flat value-stream list for the cross-cutting bottom rail of the column board.
// Each stream carries the divisions / higher-categories / roles that participate
// in it (via RoleValueStream → Role → Division.higherCategory), so selecting a
// stream can light up its participants across the three category columns.
router.get('/value-streams', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const [streams, links] = await Promise.all([
      prisma.valueStream.findMany({ where: { companyId: company.id }, orderBy: [{ domain: 'asc' }, { name: 'asc' }], select: { id: true, name: true, domain: true, domainRef: { select: { id: true, name: true } } } }),
      prisma.roleValueStream.findMany({ where: { valueStream: { companyId: company.id } }, select: { valueStreamId: true, roleId: true, role: { select: { division: { select: { id: true, name: true, higherCategory: true } } } } } }),
    ]);
    const agg = new Map<string, { divisionIds: Set<string>; categories: Set<string>; roleIds: Set<string> }>();
    for (const l of links) {
      let a = agg.get(l.valueStreamId);
      if (!a) { a = { divisionIds: new Set(), categories: new Set(), roleIds: new Set() }; agg.set(l.valueStreamId, a); }
      a.roleIds.add(l.roleId);
      if (l.role.division) { a.divisionIds.add(l.role.division.id); if (l.role.division.higherCategory) a.categories.add(l.role.division.higherCategory); }
    }
    res.json({
      valueStreams: streams.map((s) => {
        const a = agg.get(s.id);
        return {
          id: s.id, name: s.name, domain: s.domain ?? null, domainId: s.domainRef?.id ?? null,
          divisionIds: a ? [...a.divisionIds] : [], categories: a ? [...a.categories] : [], roleIds: a ? [...a.roleIds] : [],
        };
      }),
    });
  } catch (e) { next(e); }
});

// AI-adoption heat-map source for Telemetry. Canonical value streams (Level nodes,
// levelNumber = 3) with their LevelAiAdoption mapped to a 0-4 level per AI mode
// (not_used=0 … embedded=4) and the parent node as the domain. This is the same
// model Value Streams / Home render, so Telemetry now agrees with the rest of the
// app (audit D3/D7). Streams with no AI yet return all-zero (a real <100% ratio).
const AI_LEVEL_INDEX: Record<string, number> = { not_used: 0, pilot: 1, emerging: 2, scaling: 3, embedded: 4 };
router.get('/value-stream-adoption', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    // Canonical value_stream NODES (ids match the map focus + admin editor);
    // adoption reads the node-keyed NodeAiAdoption table.
    const nodes = await prisma.node.findMany({
      where: { companyId: company.id, typeKey: 'value_stream' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, parent: { select: { name: true } }, aiAdoption: true },
    });
    const idx = (v: string | undefined) => AI_LEVEL_INDEX[v ?? 'not_used'] ?? 0;
    res.json({
      valueStreams: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        domain: n.parent?.name ?? null,
        cells: [idx(n.aiAdoption?.aiAssist), idx(n.aiAdoption?.aiAugment), idx(n.aiAdoption?.aiWorkflow), idx(n.aiAdoption?.aiAutonomous)],
        // Per-mode use cases ({ assistant|augmented|workflow|agent: [{title, persona, detail}] }),
        // authored in Data Admin → Telemetry → AI adoption.
        useCases: n.aiAdoption?.useCases ?? null,
        // Per-mode adoption statistics ({ <mode>: { rolesUsingPct, efficiencyGainPct } }),
        // same admin surface.
        stats: n.aiAdoption?.stats ?? null,
      })),
    });
  } catch (e) { next(e); }
});

// Telemetry catalog — the full inventory of trackable signals/metrics defined for
// the company (the "what can we measure" reference, akin to a Viva Insights metric
// catalog). Read straight from the DB: the Metric table (workbook KPIs) plus the
// TelemetrySignal table (live workforce signals + the workbook reference catalog).
// Returns one flat row per metric plus the distinct values backing the filter
// dropdowns.
router.get('/telemetry-catalog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    const company = await prisma.company.findFirst({
      where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
      orderBy: { createdAt: 'asc' }, select: { id: true },
    });
    if (!company) return res.status(404).json({ error: 'No company' });

    const [metrics, roles, signalRows] = await Promise.all([
      prisma.metric.findMany({
        where: { companyId: company.id },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, description: true, category: true, framework: true,
          frequency: true, measurementLevel: true, ownerRole: true, targetText: true,
          unit: true, direction: true, l3: true, formula: true,
          valueStream: { select: { id: true, name: true, domain: true } },
        },
      }),
      prisma.role.findMany({ where: { companyId: company.id }, select: { id: true, name: true, itemRole: true } }),
      prisma.telemetrySignal.findMany({ where: { companyId: company.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);
    // Resolve each KPI's free-text owner role to a linkable operating-model Role so
    // the catalog can drill down to the role level.
    const resolve = buildRoleResolver(roles);

    type Signal = {
      id: string; kind: 'workforce' | 'kpi' | 'system'; name: string; description: string | null;
      source: string | null; category: string | null; framework: string | null;
      frequency: string | null; unit: string | null; direction: string; target: string | null;
      levels: string[]; store?: string; roleDrill: boolean;
      valueStreamName: string | null; domain: string | null; l3: string | null;
      ownerRole: string | null; ownerRoleId: string | null;
      provenance: string | null; calculation: string | null; unsourced: boolean;
    };

    // Live workforce/Viva signals first — tracked at the individual level, rolled
    // up to role (per-person readings exist, so they drill by role).
    const workforce: Signal[] = signalRows.filter((s) => s.isLive).map((s) => ({
      id: `wf:${s.name}`, kind: 'workforce', name: s.name, description: s.description,
      source: s.source, category: s.category, framework: null, frequency: s.frequency,
      unit: s.unit, direction: s.direction, target: null, levels: WORKFORCE_LEVELS, store: s.queryType ?? 'signal',
      roleDrill: true, valueStreamName: null, domain: null, l3: null, ownerRole: null, ownerRoleId: null,
      provenance: 'Live signal — seeded per-person readings', calculation: null, unsourced: false,
    }));

    // Operating-model KPIs from the workbook.
    const kpis: Signal[] = metrics.map((m) => {
      const owner = m.ownerRole ? resolve(m.ownerRole) : null;
      return {
        id: m.id, kind: 'kpi', name: m.name, description: m.description,
        source: m.framework, category: m.category, framework: m.framework, frequency: m.frequency,
        unit: m.unit, direction: m.direction, target: m.targetText,
        levels: m.measurementLevel ? [m.measurementLevel] : [], roleDrill: !!owner,
        valueStreamName: m.valueStream?.name ?? null, domain: m.valueStream?.domain ?? null, l3: m.l3,
        ownerRole: m.ownerRole, ownerRoleId: owner?.id ?? null,
        provenance: 'Workbook: Value Stream Metrics catalog', calculation: m.formula, unsourced: false,
      };
    });

    // Reference catalog rows (no per-person readings yet, so no role drill).
    // `kind` was classified at seed time: workforce = Viva Insights / M365
    // collaboration telemetry; everything else (Jira, ServiceNow, GitHub,
    // Guidewire, Okta, Splunk, AWS/Azure …) is a system-of-record metric.
    // Dedupe against the live workforce signals by name so a metric that gained
    // real readings isn't listed twice.
    const liveNames = new Set(workforce.map((s) => s.name.toLowerCase()));
    const catalog: Signal[] = signalRows
      .filter((s) => !s.isLive && s.name && !liveNames.has(s.name.toLowerCase()))
      .map((m, i) => ({
        id: `cat:${i}`, kind: m.kind === 'workforce' ? 'workforce' as const : 'system' as const, name: m.name, description: m.description,
        source: m.source, category: m.category, framework: null, frequency: m.frequency,
        unit: m.unit, direction: m.direction, target: null, levels: ['Individual', 'Role'], roleDrill: false,
        valueStreamName: null, domain: null, l3: null, ownerRole: null, ownerRoleId: null,
        // Provenance = the workbook sheet the row was extracted from (`origin`).
        provenance: m.origin ?? 'Workbook metric catalog', calculation: m.queryType,
        unsourced: !m.source && !m.origin,
      }));

    // Augment every signal with a simple grain `type` (User/Role/Division/System)
    // and a clean, split list of `sourceTokens` (GitHub, Viva Insights, ServiceNow…)
    // so the UI can offer four straightforward filters instead of seven.
    const signals = [...workforce, ...kpis, ...catalog].map((s) => ({
      ...s,
      type: metricType(s.kind, s.levels),
      sourceTokens: normalizeSource(s.source),
    }));

    // Case-insensitive unique + sort (collapses "Vendor/Third-party" casing dupes).
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

// Role-level drill for a single trackable signal — "go down to the role level".
// For a workforce signal, averages the per-person time-series (latest period)
// across the people assigned to each role. For a KPI, returns its owning role.
router.get('/telemetry-signal/by-role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    const company = await prisma.company.findFirst({
      where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
      orderBy: { createdAt: 'asc' }, select: { id: true },
    });
    if (!company) return res.status(404).json({ error: 'No company' });

    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const store = typeof req.query.store === 'string' ? req.query.store : '';
    if (!name) return res.status(400).json({ error: 'name required' });

    // Map each person to their primary role (the rollup path person → role).
    const assignments = await prisma.assignment.findMany({
      where: { person: { companyId: company.id }, isPrimary: true },
      select: { personId: true, role: { select: { id: true, name: true } } },
    });
    const roleOf = new Map<string, { id: string; name: string }>();
    for (const a of assignments) if (a.role) roleOf.set(a.personId, a.role);

    // Latest-period reading per person for this signal.
    const where = { name, period: LATEST_PERIOD, person: { companyId: company.id } };
    const readings = store === 'metric'
      ? await prisma.personMetric.findMany({ where, select: { personId: true, value: true, unit: true } })
      : await prisma.personSignal.findMany({ where, select: { personId: true, value: true, unit: true } });

    // Average per role.
    const agg = new Map<string, { roleId: string; roleName: string; sum: number; n: number }>();
    let unit = '';
    for (const r of readings) {
      unit = r.unit;
      const role = roleOf.get(r.personId);
      if (!role) continue;
      let a = agg.get(role.id);
      if (!a) { a = { roleId: role.id, roleName: role.name, sum: 0, n: 0 }; agg.set(role.id, a); }
      a.sum += r.value; a.n += 1;
    }
    const rows = [...agg.values()]
      .map((a) => ({ roleId: a.roleId, roleName: a.roleName, value: Math.round((a.sum / a.n) * 10) / 10, people: a.n, unit }))
      .sort((x, y) => y.people - x.people || y.value - x.value);

    res.json({ name, unit, period: LATEST_PERIOD, roles: rows });
  } catch (e) { next(e); }
});

// Resolve the map drill-path for a value stream: which CEO domain + division the
// map should focus to surface it. The map renders a division's LEAD value streams,
// but not every stream is led by a division — so we pick the division with the
// STRONGEST participation (Lead > Core > Control > Oversight > Support), breaking
// ties by the number of participating roles. Anything else in the app that links
// to a value stream uses this to drop the user onto the map at the right level.
router.get('/value-stream/:id/focus', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Value stream = a value_stream node; its division is its parent and the
    // category is that division's parent segment.
    const vs = await prisma.node.findFirst({ where: { id: req.params.id, company: { tenantId: req.tenantId }, typeKey: 'value_stream' }, select: { id: true, parentId: true } });
    if (!vs || !vs.parentId) return res.status(404).json({ error: 'No participating division' });
    const div = await prisma.node.findFirst({ where: { id: vs.parentId }, select: { id: true, parentId: true } });
    const category = div?.parentId ? (await prisma.node.findFirst({ where: { id: div.parentId }, select: { name: true } }))?.name ?? null : null;
    res.json({ valueStreamId: vs.id, divisionId: vs.parentId, category: category ?? 'Core Business' });
  } catch (e) { next(e); }
});

// End-to-end process flow for a division's value stream(s). Clicking a division
// in the column board reveals the L3 process flow (e.g. Claims: Claim Intake/FNOL →
// Coverage & Assignment → Investigation & Evaluation → Resolution & Recovery), each
// L3 stage carrying its L4 sub-processes. Every stage is tagged with the higher-
// categories of the roles that PERFORM it — so a Core-Business value stream that
// leans on IT or Corporate-Function steps shows that cross-domain dependency.
router.get('/division/:id/flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;
    // Division = a division node in the unified tree. Its category is its parent
    // segment's name.
    const div = await prisma.node.findFirst({ where: { id: req.params.id, company: { tenantId }, typeKey: 'division' }, select: { id: true, name: true, parentId: true } });
    if (!div) return res.status(404).json({ error: 'Not found' });
    const domain = div.parentId ? await prisma.node.findFirst({ where: { id: div.parentId }, select: { name: true } }) : null;
    const higherCategory = domain?.name ?? null;

    // Value streams = this division's value_stream children (it also parents
    // departments — filter by type).
    const streams = await prisma.node.findMany({ where: { parentId: div.id, typeKey: 'value_stream' }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
    const wantVs = typeof req.query.vs === 'string' ? req.query.vs : undefined;
    const selectedVs = streams.find((s) => s.id === wantVs) ?? streams[0] ?? null;

    let selected: any = null;
    if (selectedVs) {
      // Sub-processes (the flow row) and their process steps.
      const l4 = await prisma.node.findMany({ where: { parentId: selectedVs.id, typeKey: 'sub_process' }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, attributes: true } });
      const l5 = await prisma.node.findMany({ where: { typeKey: 'step', parentId: { in: l4.map((x) => x.id) } }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, parentId: true } });
      const l5ByParent = new Map<string, typeof l5>();
      for (const s of l5) { if (!s.parentId) continue; if (!l5ByParent.has(s.parentId)) l5ByParent.set(s.parentId, []); l5ByParent.get(s.parentId)!.push(s); }
      const steps = l4.map((s, i) => ({
        id: s.id, step: i + 1, name: s.name,
        subSteps: (l5ByParent.get(s.id) ?? []).map((x, k) => ({ id: x.id, name: x.name, step: k + 1, l5: [] as { id: string; name: string; step: number }[] })),
        inputs: ((s.attributes as any) ?? {}).inputs ?? null, outputs: ((s.attributes as any) ?? {}).outputs ?? null, upstream: null, downstream: null,
        roles: [] as string[], categories: [] as string[], primaryCategory: higherCategory,
        crossDomain: false, unowned: false,
      }));
      selected = { id: selectedVs.id, name: selectedVs.name, steps };
    }
    res.json({
      division: { id: div.id, name: div.name, higherCategory },
      valueStreams: streams.map((s) => ({ id: s.id, name: s.name, participationType: 'Lead' })),
      selectedId: selectedVs?.id ?? null,
      selected,
    });
  } catch (e) { next(e); }
});

// Fully-exploded operating-model tree for the List view. One response carries
// every division's LEAD value streams, each with its complete L3 process area →
// L4 sub-process → L5 process step hierarchy (workbook order), so the list can
// render the whole depth at once — no per-node lazy loading / loading rows.
router.get('/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    // List view renders from the SAME unified Node tree as the map:
    // enterprise = root label, segment → division → value_stream → sub_process →
    // step. Divisions also parent departments, so children are filtered by type.
    const treeNodes = await prisma.node.findMany({
      where: { companyId: company.id, typeKey: { in: ['enterprise', 'segment', 'division', 'value_stream', 'sub_process', 'step'] } },
      orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, typeKey: true, parentId: true },
    });
    const root = treeNodes.find((l) => l.typeKey === 'enterprise');
    const childrenOf = new Map<string, typeof treeNodes>();
    for (const l of treeNodes) { if (!l.parentId) continue; if (!childrenOf.has(l.parentId)) childrenOf.set(l.parentId, []); childrenOf.get(l.parentId)!.push(l); }
    const kids = (id: string, typeKey: string) => (childrenOf.get(id) ?? []).filter((c) => c.typeKey === typeKey);
    const domainName = new Map(treeNodes.filter((l) => l.typeKey === 'segment').map((d) => [d.id, d.name] as const));
    const divisions = treeNodes.filter((l) => l.typeKey === 'division');

    res.json({
      company: { id: company.id, name: root?.name ?? company.name },
      divisions: divisions.map((d) => ({
        id: d.id, name: d.name, higherCategory: d.parentId ? domainName.get(d.parentId) ?? null : null, roles: 0,
        // VS → sub_process as "areas" → step as "subProcesses" (leaf).
        valueStreams: kids(d.id, 'value_stream').map((vs) => ({
          id: vs.id, name: vs.name,
          areas: kids(vs.id, 'sub_process').map((l4, i) => ({
            id: l4.id, step: i + 1, name: l4.name,
            subProcesses: kids(l4.id, 'step').map((l5, j) => ({ id: l5.id, step: j + 1, name: l5.name, steps: [] as { id: string; step: number; name: string }[] })),
          })),
        })),
      })),
    });
  } catch (e) { next(e); }
});

// ── Per-level metric dashboards: PERFORMANCE & CHANGE IMPACT ─────────────
// Each level surfaces DISTINCT performance + change-impact metrics from the real
// workbook: KPI definitions w/ frameworks & targets ("Value Stream Metrics"),
// change-initiative economics ("Scenario Inputs": one-time cost, annual benefit,
// net impact, payback, confidence), and application run cost ("Application TCO").
// Bar/list items may carry a `drill` target that navigates to the next map level.
type Fmt = 'money' | 'years' | 'number';
// `tag` names what an item IS (deliverable | task | role | checklist | person |
// step | app) so the sidebar can color-code and iconize rows consistently.
type MetricItem = { label: string; value: number; hint?: string; sub?: string; format?: Fmt; illustrative?: boolean; drill?: { level: string; id: string }; href?: string; children?: MetricItem[]; tag?: string };
// kind 'tree' renders items with their nested children (collapsible); a hidden
// section is drawer-only — reached by clicking the tile that names it; an
// `expanded` tree opens every level on load (the L5 deliverable chain).
type MetricSection = { title: string; kind: 'bar' | 'list' | 'kpi' | 'tree'; items: MetricItem[]; illustrative?: boolean; hidden?: boolean; expanded?: boolean };
// Loaded annual resource cost by role level — ILLUSTRATIVE. The workbook has no
// compensation data; the "Financial Driver Map" only states the method
// (FTE × compensation band), so these bands are assumptions, not workbook values.
const COMP_BAND: Record<string, number> = { Executive: 450000, Leadership: 300000, Manager: 180000, 'Individual Contributor': 120000 };
const loadedCost = (roleLevel: string | null, allocationPct = 100) => Math.round(((COMP_BAND[roleLevel ?? ''] ?? 120000) * allocationPct) / 100);
// Build the KPI metric+target list: each item is one KPI (name + target benchmark
// + category/framework), so the actual metrics show alongside their targets.
function kpiList(kpis: { name: string; targetText: string | null; category: string | null; framework: string | null }[]): MetricItem[] {
  return kpis.map((k) => ({ label: k.name, value: 0, hint: k.targetText ?? '—', sub: [k.category, k.framework].filter(Boolean).join(' · ') || undefined }));
}
// tile.drawer names a section (possibly hidden) — clicking the tile opens that
// section's consolidated list in the drawer.
type Dashboard = { level: string; title: string; subtitle?: string; tiles: { label: string; value: number; hint?: string; format?: Fmt; illustrative?: boolean; drawer?: string }[]; sections: MetricSection[] };

type ScenarioRow = { name: string; changeType: string | null; divisionName: string | null; valueStreamName: string | null; confidence: string | null; oneTimeCost: number | null; annualBenefit: number | null; annualAddedCost: number | null; annualNetImpact: number | null };
function scenarioRoll(rows: ScenarioRow[]) {
  const sum = (f: (s: ScenarioRow) => number | null) => rows.reduce((a, s) => a + (f(s) ?? 0), 0);
  const oneTime = sum((s) => s.oneTimeCost), net = sum((s) => s.annualNetImpact);
  return { count: rows.length, benefit: sum((s) => s.annualBenefit), added: sum((s) => s.annualAddedCost), oneTime, net, payback: net > 0 ? Math.round((oneTime / net) * 10) / 10 : 0 };
}
const TCO_SELECT = { totalTco: true, licenseCost: true, laborCost: true, vendorServicesCost: true, infraCost: true, depreciationCost: true, overheadCost: true } as const;
type TcoApp = { totalTco: number | null; licenseCost: number | null; laborCost: number | null; vendorServicesCost: number | null; infraCost: number | null; depreciationCost: number | null; overheadCost: number | null };
const tcoTotal = (apps: TcoApp[]) => apps.reduce((a, x) => a + (x.totalTco ?? 0), 0);
function tcoBuckets(apps: TcoApp[]): MetricItem[] {
  const b: Record<string, number> = { License: 0, 'Internal labor': 0, 'Vendor services': 0, Infrastructure: 0, Depreciation: 0, Overhead: 0 };
  for (const a of apps) { b.License += a.licenseCost ?? 0; b['Internal labor'] += a.laborCost ?? 0; b['Vendor services'] += a.vendorServicesCost ?? 0; b.Infrastructure += a.infraCost ?? 0; b.Depreciation += a.depreciationCost ?? 0; b.Overhead += a.overheadCost ?? 0; }
  return Object.entries(b).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value, format: 'money' as const })).sort((a, c) => c.value - a.value);
}
function kpiBars(metrics: { framework: string | null }[]): MetricItem[] {
  const m = new Map<string, number>();
  for (const k of metrics) m.set(k.framework ?? 'Other', (m.get(k.framework ?? 'Other') ?? 0) + 1);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, c) => c.value - a.value);
}
// ── Step lens ────────────────────────────────────────────────────────────────
// Consolidated who/what/how for a set of process steps (the focused point in a
// value stream): the PEOPLE assigned to the roles named on the steps' own
// leads/supporting cells (deliberately NOT everyone tied to the stream), those
// roles' tasks and readiness-checklist items, the deliverables the steps
// produce (where memorialized, who approves, how), and the applications the
// work runs on. The same builder serves every drill depth — the caller passes
// a wider or narrower step set, so the sidebar refines as the user drills.
type LensStep = { id: string; name: string; stepNumber: number; code: string | null; parentProcessId: string | null; leads: string | null; supporting: string | null; inputs: string | null; outputs: string | null };
const LENS_STEP_SELECT = { id: true, name: true, stepNumber: true, code: true, parentProcessId: true, leads: true, supporting: true, inputs: true, outputs: true } as const;
type Lens = {
  people: MetricItem[];           // flat "Supporting employees" list (subset of the refined roles)
  rolesTree: MetricItem[];        // "Supporting roles" — each role with its people nested
  deliverables: MetricItem[];     // each with its producing L5 step nested (when known)
  deliverableChain: MetricItem[]; // deliverable → task → responsible role → checklist + people
  applications: MetricItem[];
  roleCount: number; unresolvedRoles: string[];
};

// Roles that hold a stream-level seat but don't do this work the majority of
// the time (CEO/CIO/Chief Product Officer…) are excluded from the lens — the
// sidebar shows the doing roles, ordered by how many of the scoped steps they
// actually appear on.
const isOutlierRole = (name: string, roleLevel: string | null) =>
  roleLevel === 'Executive' || /^chief\b|\bchief .{0,30}officer\b|^ceo\b|^cio\b|^cto\b|^cfo\b|^coo\b/i.test(name);

async function stepLens(companyId: string, steps: LensStep[]): Promise<Lens> {
  const stepIds = steps.map((s) => s.id);
  // Bridge rows attach by ProcessStep id (L5 codes) OR by the L4 activity code
  // alone (the real workbook rows are keyed CI-nn-nn with no step id).
  const activityCodes = [...new Set(steps.flatMap((s) => [s.code, s.parentProcessId]).filter((x): x is string => !!x))];
  const bridgeWhere = { companyId, OR: [{ processStepId: { in: stepIds } }, { activityCode: { in: activityCodes.length ? activityCodes : ['_'] } }] };
  const roles = await prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, itemRole: true, roleLevel: true } });
  const roleLevelOf = new Map(roles.map((r) => [r.id, r.roleLevel] as const));
  const resolve = buildRoleResolver(roles);

  // Roles doing the work, from the steps' own lead/support cells. Free-text
  // names that aren't in the role inventory (e.g. "Billing Coordinator") are
  // kept visible as unresolved rather than silently dropped.
  const lead = new Map<string, string>(), support = new Map<string, string>();
  const coverage = new Map<string, number>(); // roleId → # scoped steps it appears on
  const unresolved = new Set<string>();
  for (const s of steps) {
    const l = resolveRoleCell(s.leads, resolve), u = resolveRoleCell(s.supporting, resolve);
    for (const r of l.roles) { lead.set(r.id, r.name); support.delete(r.id); coverage.set(r.id, (coverage.get(r.id) ?? 0) + 1); }
    for (const r of u.roles) { if (!lead.has(r.id)) support.set(r.id, r.name); coverage.set(r.id, (coverage.get(r.id) ?? 0) + 1); }
    for (const raw of [...l.unresolved, ...u.unresolved]) unresolved.add(raw);
  }
  const partOf = (roleId: string) => (lead.has(roleId) ? 'Lead' : 'Support');
  const roleName = (roleId: string) => lead.get(roleId) ?? support.get(roleId) ?? '';
  const allRoleIds = [...lead.keys(), ...support.keys()];
  // Majority-of-time filter: drop executive outliers (unless they're all there
  // is), order the rest by step coverage so the main doers come first.
  let roleIds = allRoleIds.filter((id) => !isOutlierRole(roleName(id), roleLevelOf.get(id) ?? null));
  if (!roleIds.length) roleIds = allRoleIds;
  roleIds.sort((a, b) => (partOf(a) === partOf(b) ? (coverage.get(b) ?? 0) - (coverage.get(a) ?? 0) : partOf(a) === 'Lead' ? -1 : 1));

  const [assignments, tasks, checklist, usages, delivs] = await Promise.all([
    roleIds.length ? prisma.assignment.findMany({
      where: { roleId: { in: roleIds } },
      select: { roleId: true, person: { select: { id: true, name: true, employmentType: true } } },
    }) : [],
    roleIds.length ? prisma.roleTask.findMany({
      where: { roleId: { in: roleIds } }, orderBy: { id: 'asc' }, take: 150,
      select: { roleId: true, text: true, category: { select: { name: true } } },
    }) : [],
    roleIds.length ? prisma.checklistItem.findMany({
      where: { roleId: { in: roleIds } }, orderBy: { id: 'asc' }, take: 150,
      select: { roleId: true, text: true, category: { select: { name: true } } },
    }) : [],
    stepIds.length ? prisma.stepAppUsage.findMany({
      where: bridgeWhere,
      select: { usageType: true, isPrimary: true, illustrative: true, application: { select: { id: true, name: true, systemOfRecord: true } } },
    }) : [],
    stepIds.length ? prisma.stepDeliverable.findMany({
      where: bridgeWhere, orderBy: { activityCode: 'asc' },
      select: {
        name: true, approvalType: true, approverRoleRaw: true, illustrative: true,
        approverRole: { select: { name: true } },
        sorApplication: { select: { name: true } },
        approvalApplication: { select: { name: true } },
        processStep: { select: { name: true, stepNumber: true } },
      },
    }) : [],
  ]);

  // People per role (nested under "Supporting roles") + the flat employee list.
  const peopleByRole = new Map<string, MetricItem[]>();
  for (const a of assignments) {
    if (!peopleByRole.has(a.roleId)) peopleByRole.set(a.roleId, []);
    peopleByRole.get(a.roleId)!.push({ label: a.person.name, value: 0, hint: a.person.employmentType ?? undefined, illustrative: true, drill: { level: 'person', id: a.person.id }, tag: 'person' });
  }
  for (const list of peopleByRole.values()) list.sort((a, b) => a.label.localeCompare(b.label));

  // Role rows carry only the Lead/Support signal (rendered as a dot, not a tag
  // chip) — coverage stats stay out of the UI per review.
  const rolesTree: MetricItem[] = roleIds.map((id) => ({
    label: roleName(id), value: 0,
    hint: partOf(id),
    drill: { level: 'role', id },
    children: peopleByRole.get(id) ?? [],
    tag: 'role',
  }));

  const seenPerson = new Set<string>();
  const people: MetricItem[] = roleIds.flatMap((id) =>
    (peopleByRole.get(id) ?? []).filter((p) => {
      const pid = p.drill!.id;
      if (seenPerson.has(pid)) return false;
      seenPerson.add(pid);
      return true;
    }).map((p) => ({ ...p, hint: `${roleName(id)} · ${partOf(id)}` })));

  // Applications — one row per app; real rows beat illustrative, primary beats
  // not. Items link through to the Applications tab.
  const appMap = new Map<string, { name: string; types: Set<string>; primary: boolean; sor: boolean | null; illustrative: boolean }>();
  for (const u of usages) {
    let a = appMap.get(u.application.id);
    if (!a) { a = { name: u.application.name, types: new Set(), primary: false, sor: u.application.systemOfRecord, illustrative: true }; appMap.set(u.application.id, a); }
    a.types.add(u.usageType);
    a.primary ||= u.isPrimary;
    a.illustrative &&= u.illustrative;
  }
  const applications: MetricItem[] = [...appMap.entries()]
    .sort(([, a], [, b]) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name))
    .map(([appId, a]) => ({ label: a.name, value: 0, hint: [...a.types].join(' · '), sub: a.sor ? 'System of record' : undefined, illustrative: a.illustrative, href: `/applications?focus=${appId}`, tag: 'app' }));

  // Deliverables — the producing L5 step nests inside each deliverable.
  const deliverables: MetricItem[] = delivs.map((d) => ({
    label: d.name, value: 0,
    hint: d.sorApplication ? `in ${d.sorApplication.name}` : undefined,
    sub: [
      d.approverRole?.name ?? d.approverRoleRaw ? `Approver: ${d.approverRole?.name ?? d.approverRoleRaw}` : null,
      d.approvalType ? `${d.approvalType}${d.approvalApplication && d.approvalApplication.name !== d.sorApplication?.name ? ` via ${d.approvalApplication.name}` : ''}` : null,
    ].filter(Boolean).join(' · ') || undefined,
    illustrative: d.illustrative,
    tag: 'deliverable',
    children: d.processStep ? [{ label: d.processStep.name, value: 0, hint: `L5 step ${d.processStep.stepNumber}`, tag: 'step' }] : [],
  }));

  // Connected chain (L5 leaf): deliverable → the tasks that must be met → the
  // role responsible for each task → that role's checklist for doing it right
  // (same category as the task when available). People stay OUT of the chain —
  // they appear only as a subset of roles (Supporting roles → role → people).
  type ItemRow = { roleId: string; text: string; category: { name: string } | null };
  const tasksByRole = new Map<string, ItemRow[]>();
  for (const t of tasks as ItemRow[]) { if (!tasksByRole.has(t.roleId)) tasksByRole.set(t.roleId, []); tasksByRole.get(t.roleId)!.push(t); }
  const checksByRole = new Map<string, ItemRow[]>();
  for (const c of checklist as ItemRow[]) { if (!checksByRole.has(c.roleId)) checksByRole.set(c.roleId, []); checksByRole.get(c.roleId)!.push(c); }
  const CHAIN_TASKS = 5, CHAIN_CHECKS = 5;
  const deliverableChain: MetricItem[] = deliverables.map((d, di) => {
    const taskNodes: MetricItem[] = roleIds.filter((id) => lead.has(id)).flatMap((rid) =>
      (tasksByRole.get(rid) ?? []).slice(0, CHAIN_TASKS).map((t) => {
        const checks = (checksByRole.get(rid) ?? []);
        const matched = checks.filter((c) => c.category?.name && c.category.name === t.category?.name);
        const checkNodes = (matched.length ? matched : checks).slice(0, CHAIN_CHECKS)
          .map((c) => ({ label: c.text, value: 0, sub: c.category?.name ?? undefined, tag: 'checklist' }));
        return {
          label: t.text, value: 0, sub: t.category?.name ?? undefined, tag: 'task',
          children: [{
            label: roleName(rid), value: 0, hint: partOf(rid), drill: { level: 'role', id: rid }, tag: 'role',
            children: checkNodes,
          }],
        };
      }));
    return { ...deliverables[di], children: taskNodes.length ? taskNodes : deliverables[di].children };
  });

  return { people, rolesTree, deliverables, deliverableChain, applications, roleCount: roleIds.length, unresolvedRoles: [...unresolved] };
}

async function participatedVsIds(divIds: string[]): Promise<string[]> {
  if (!divIds.length) return [];
  const links = await prisma.roleValueStream.findMany({ where: { role: { divisionId: { in: divIds } } }, select: { valueStreamId: true } });
  return [...new Set(links.map((l) => l.valueStreamId))];
}

async function metricsCompany(c: string, name: string): Promise<Dashboard> {
  const [scenarios, metrics, apps, divisions] = await Promise.all([
    prisma.scenario.findMany({ where: { companyId: c } }),
    prisma.metric.findMany({ where: { companyId: c }, select: { framework: true } }),
    prisma.application.findMany({ where: { companyId: c, illustrative: false, totalTco: { not: null } }, select: TCO_SELECT }),
    prisma.division.findMany({ where: { companyId: c }, select: { name: true, higherCategory: true } }),
  ]);
  const roll = scenarioRoll(scenarios);
  const catOf = new Map(divisions.map((d) => [d.name, d.higherCategory ?? 'Core Business']));
  const byCat = new Map<string, number>();
  for (const s of scenarios) { const k = s.divisionName ? catOf.get(s.divisionName) ?? 'Core Business' : 'Enterprise'; byCat.set(k, (byCat.get(k) ?? 0) + (s.annualNetImpact ?? 0)); }
  return {
    level: 'company', title: name, subtitle: 'Performance & change impact',
    tiles: [
      { label: 'Change initiatives', value: roll.count },
      { label: 'Annual net impact', value: roll.net, format: 'money' },
      { label: 'Annual benefit', value: roll.benefit, format: 'money' },
      { label: 'One-time cost', value: roll.oneTime, format: 'money' },
      { label: 'Payback', value: roll.payback, format: 'years' },
      { label: 'App run cost', value: tcoTotal(apps), format: 'money', hint: 'annual TCO' },
      { label: 'KPIs defined', value: metrics.length },
      { label: 'Frameworks', value: new Set(metrics.map((m) => m.framework).filter(Boolean)).size },
    ],
    sections: [
      { title: 'Net impact by domain', kind: 'bar', items: [...byCat.entries()].map(([label, value]) => ({ label, value, format: 'money' as const, drill: label !== 'Enterprise' ? { level: 'domain', id: label } : undefined })).sort((a, b) => b.value - a.value) },
      { title: 'App run cost by bucket', kind: 'bar', items: tcoBuckets(apps) },
      { title: 'KPIs by framework', kind: 'bar', items: kpiBars(metrics) },
      { title: 'Change initiatives', kind: 'list', items: scenarios.map((s) => ({ label: s.name, value: s.annualNetImpact ?? 0, format: 'money' as const, hint: s.confidence ?? undefined, drill: s.divisionName && catOf.get(s.divisionName) ? { level: 'domain', id: catOf.get(s.divisionName)! } : undefined })).sort((a, b) => b.value - a.value) },
    ],
  };
}

async function metricsDomain(c: string, category: string): Promise<Dashboard | null> {
  const divisions = await prisma.division.findMany({ where: { companyId: c, higherCategory: category }, select: { id: true, name: true } });
  if (!divisions.length) return null;
  const divIds = divisions.map((d) => d.id);
  const divIdByName = new Map(divisions.map((d) => [d.name, d.id]));
  const names = divisions.map((d) => d.name);
  const vsIds = await participatedVsIds(divIds);
  const [scenarios, metrics, apps] = await Promise.all([
    prisma.scenario.findMany({ where: { companyId: c, divisionName: { in: names } } }),
    prisma.metric.findMany({ where: { valueStreamId: { in: vsIds.length ? vsIds : ['_'] } }, select: { framework: true } }),
    prisma.application.findMany({ where: { companyId: c, illustrative: false, totalTco: { not: null }, primaryDivisionName: { in: names } }, select: TCO_SELECT }),
  ]);
  const roll = scenarioRoll(scenarios);
  const byDiv = new Map<string, number>();
  for (const s of scenarios) { if (!s.divisionName) continue; byDiv.set(s.divisionName, (byDiv.get(s.divisionName) ?? 0) + (s.annualNetImpact ?? 0)); }
  return {
    level: 'domain', title: category, subtitle: 'Performance & change impact',
    tiles: [
      { label: 'Change initiatives', value: roll.count },
      { label: 'Annual net impact', value: roll.net, format: 'money' },
      { label: 'Annual benefit', value: roll.benefit, format: 'money' },
      { label: 'App run cost', value: tcoTotal(apps), format: 'money', hint: 'annual TCO' },
      { label: 'KPIs defined', value: metrics.length },
      { label: 'Divisions', value: divisions.length },
    ],
    sections: [
      { title: 'Net impact by division', kind: 'bar', items: [...byDiv.entries()].map(([label, value]) => ({ label, value, format: 'money' as const, drill: divIdByName.get(label) ? { level: 'division', id: divIdByName.get(label)! } : undefined })).sort((a, b) => b.value - a.value) },
      { title: 'KPIs by framework', kind: 'bar', items: kpiBars(metrics) },
      { title: 'Change initiatives', kind: 'list', items: scenarios.map((s) => ({ label: s.name, value: s.annualNetImpact ?? 0, format: 'money' as const, hint: s.confidence ?? undefined, drill: s.divisionName && divIdByName.get(s.divisionName) ? { level: 'division', id: divIdByName.get(s.divisionName)! } : undefined })).sort((a, b) => b.value - a.value) },
    ],
  };
}

async function metricsDivision(tenantId: string, c: string, id: string): Promise<Dashboard | null> {
  const div = await prisma.division.findFirst({ where: { id, tenantId, companyId: c }, select: { id: true, name: true, higherCategory: true } });
  if (!div) return null;
  const vsIds = await participatedVsIds([id]);
  const [scenarios, metrics, apps, vsLinks] = await Promise.all([
    prisma.scenario.findMany({ where: { companyId: c, divisionName: div.name } }),
    prisma.metric.findMany({ where: { valueStreamId: { in: vsIds.length ? vsIds : ['_'] } }, select: { framework: true } }),
    prisma.application.findMany({ where: { companyId: c, illustrative: false, totalTco: { not: null }, primaryDivisionName: div.name }, select: TCO_SELECT }),
    prisma.roleValueStream.findMany({ where: { role: { divisionId: id } }, select: { valueStreamId: true, participationType: true, valueStream: { select: { name: true } } } }),
  ]);
  const roll = scenarioRoll(scenarios);
  const vsMap = new Map<string, { id: string; name: string; part: string }>();
  for (const l of vsLinks) { const cur = vsMap.get(l.valueStreamId); if (!cur || (PART_ORDER[l.participationType] ?? 9) < (PART_ORDER[cur.part] ?? 9)) vsMap.set(l.valueStreamId, { id: l.valueStreamId, name: l.valueStream.name, part: l.participationType }); }
  return {
    level: 'division', title: div.name, subtitle: 'Performance & change impact',
    tiles: [
      { label: 'Change initiatives', value: roll.count },
      { label: 'Annual net impact', value: roll.net, format: 'money' },
      { label: 'Annual benefit', value: roll.benefit, format: 'money' },
      { label: 'One-time cost', value: roll.oneTime, format: 'money' },
      { label: 'App run cost', value: tcoTotal(apps), format: 'money', hint: 'annual TCO' },
      { label: 'KPIs defined', value: metrics.length },
    ],
    sections: [
      { title: 'Change initiatives', kind: 'list', items: scenarios.map((s) => ({ label: s.name, value: s.annualNetImpact ?? 0, format: 'money' as const, hint: s.confidence ?? undefined, drill: s.valueStreamName && vsMap.size && [...vsMap.values()].find((v) => v.name === s.valueStreamName) ? { level: 'valueStream', id: [...vsMap.values()].find((v) => v.name === s.valueStreamName)!.id } : undefined })).sort((a, b) => b.value - a.value) },
      { title: 'App run cost by bucket', kind: 'bar', items: tcoBuckets(apps) },
      { title: 'KPIs by framework', kind: 'bar', items: kpiBars(metrics) },
      { title: 'Value streams', kind: 'list', items: [...vsMap.values()].sort((a, b) => (PART_ORDER[a.part] ?? 9) - (PART_ORDER[b.part] ?? 9)).map((v) => ({ label: v.name, value: 0, hint: v.part, drill: { level: 'valueStream', id: v.id } })) },
    ],
  };
}

async function metricsValueStream(tenantId: string, c: string, id: string, node?: ResolvedNode | null): Promise<Dashboard | null> {
  // Unified value_stream node (preferred): aggregate all legacy streams that fold
  // into it (vs-mapping) and drill into its sub_process child nodes.
  if (node && node.typeKey === 'value_stream') {
    const ids = await legacyVsIds(c, node.name);
    const vsFilter = { in: ids.length ? ids : ['_'] };
    const [kpis, areas, ps, lensSteps, rvsLinks] = await Promise.all([
      prisma.metric.findMany({ where: { valueStreamId: vsFilter }, orderBy: [{ l3: 'asc' }, { category: 'asc' }], select: { name: true, targetText: true, category: true, framework: true } }),
      prisma.node.findMany({ where: { parentId: node.id, typeKey: 'sub_process' }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
      prisma.processStep.findMany({ where: { valueStreamId: vsFilter }, select: { l4: true } }),
      prisma.processStep.findMany({ where: { valueStreamId: vsFilter }, select: LENS_STEP_SELECT }),
      prisma.roleValueStream.findMany({ where: { valueStreamId: vsFilter }, select: { participationType: true, role: { select: { id: true, name: true, roleLevel: true } } } }),
    ]);
    const stepByL4 = new Map<string, number>();
    for (const p of ps) { if (!p.l4) continue; stepByL4.set(p.l4, (stepByL4.get(p.l4) ?? 0) + 1); }
    // Stream level shows the coarse lens: the supporting roles (with their
    // people nested), the systems, and deliverable counts — the connected
    // per-step detail appears as you drill.
    const lens = await stepLens(c, lensSteps);
    void kpis; void rvsLinks; // KPI + roster sections removed from the sidebar by design
    return {
      level: 'valueStream', title: node.name, subtitle: 'Who does the work, on what',
      tiles: [
        { label: 'Supporting employees', value: lens.people.length, illustrative: true, drawer: 'Supporting employees' },
        { label: 'Supporting roles', value: lens.roleCount, drawer: 'Supporting roles' },
        { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
        { label: 'Deliverables', value: lens.deliverables.length, drawer: 'Deliverables' },
      ],
      sections: [
        { title: 'Process Level 4', kind: 'list', items: areas.map((s) => ({ label: s.name, value: stepByL4.get(s.name) ?? 0, hint: stepByL4.get(s.name) ? `${stepByL4.get(s.name)} steps` : 'no flow', drill: { level: 'step', id: s.id } })) },
        { title: 'Supporting roles', kind: 'tree', items: lens.rolesTree },
        { title: 'Applications & systems', kind: 'list', items: lens.applications },
        { title: 'Supporting employees', kind: 'list', illustrative: true, hidden: true, items: lens.people },
        { title: 'Deliverables', kind: 'tree', hidden: true, items: lens.deliverables },
      ],
    };
  }
  const vs = await prisma.valueStream.findFirst({ where: { id, tenantId, companyId: c }, select: { id: true, name: true, domain: true } });
  if (!vs) return null;
  const [kpis, l3rows, ps, lensSteps, rvsLinks] = await Promise.all([
    prisma.metric.findMany({ where: { valueStreamId: id }, orderBy: [{ l3: 'asc' }, { category: 'asc' }], select: { name: true, targetText: true, category: true, framework: true } }),
    prisma.subValueStream.findMany({ where: { valueStreamId: id, level: 3 }, orderBy: { sourceRow: 'asc' }, select: { id: true, name: true } }),
    prisma.processStep.findMany({ where: { valueStreamId: id }, select: { l3: true } }),
    prisma.processStep.findMany({ where: { valueStreamId: id }, select: LENS_STEP_SELECT }),
    prisma.roleValueStream.findMany({ where: { valueStreamId: id }, select: { participationType: true, role: { select: { id: true, name: true, roleLevel: true } } } }),
  ]);
  const stepByL3 = new Map<string, number>();
  for (const p of ps) { if (!p.l3) continue; stepByL3.set(p.l3, (stepByL3.get(p.l3) ?? 0) + 1); }
  const lens = await stepLens(c, lensSteps);
  void kpis; void rvsLinks; // KPI + roster sections removed from the sidebar by design
  return {
    level: 'valueStream', title: vs.name, subtitle: 'Who does the work, on what',
    tiles: [
      { label: 'Supporting employees', value: lens.people.length, illustrative: true, drawer: 'Supporting employees' },
      { label: 'Supporting roles', value: lens.roleCount, drawer: 'Supporting roles' },
      { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
      { label: 'Deliverables', value: lens.deliverables.length, drawer: 'Deliverables' },
    ],
    sections: [
      { title: 'Process Level 4', kind: 'list', items: l3rows.map((s) => ({ label: s.name, value: stepByL3.get(s.name) ?? 0, hint: stepByL3.get(s.name) ? `${stepByL3.get(s.name)} steps` : 'no flow', drill: { level: 'step', id: s.id } })) },
      { title: 'Supporting roles', kind: 'tree', items: lens.rolesTree },
      { title: 'Applications & systems', kind: 'list', items: lens.applications },
      { title: 'Supporting employees', kind: 'list', illustrative: true, hidden: true, items: lens.people },
      { title: 'Deliverables', kind: 'tree', hidden: true, items: lens.deliverables },
    ],
  };
}

async function metricsStep(tenantId: string, id: string, node?: ResolvedNode | null): Promise<Dashboard | null> {
  // ── L5 leaf: a single process step (unified `step` node; code = ProcessStep.id).
  // The most refined view — this step's own people, I/O, deliverable + approval
  // chain, and the application(s) the step runs on.
  if (node && node.typeKey === 'step') {
    const step = await prisma.processStep.findFirst({
      where: { id: node.code ?? '_', tenantId },
      select: { ...LENS_STEP_SELECT, l4: true, description: true, externalParticipants: true },
    });
    if (!step) return null;
    let lens = await stepLens(node.companyId, [step]);
    // Step leads are often named-only roles ("Billing Coordinator") with no
    // workbook task/checklist items — when the chain comes back without tasks,
    // rebuild it from the parent sub-process's working roles so the connected
    // view never goes dark at the deepest level.
    const chainHasTasks = lens.deliverableChain.some((d) => d.children?.some((c) => c.hint === 'task'));
    if (!chainHasTasks && step.l4) {
      const sibs = await prisma.processStep.findMany({ where: { tenantId, l4: step.l4 }, select: LENS_STEP_SELECT });
      const wider = await stepLens(node.companyId, sibs);
      // Keep this step's own deliverable/apps/people; borrow only the chain.
      const own = new Set(lens.deliverables.map((d) => d.label));
      const borrowed = wider.deliverableChain.filter((d) => own.has(d.label));
      if (borrowed.length) lens = { ...lens, deliverableChain: borrowed };
    }
    return {
      level: 'leafStep', title: step.name, subtitle: `Process step ${step.stepNumber}${step.l4 ? ` · ${step.l4}` : ''} (L5)`,
      tiles: [
        { label: 'Supporting employees', value: lens.people.length, illustrative: true, drawer: 'Supporting employees' },
        { label: 'Supporting roles', value: lens.roleCount, hint: lens.unresolvedRoles.length ? `+${lens.unresolvedRoles.length} named only` : undefined, drawer: 'Supporting roles' },
        { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
        { label: 'Deliverables', value: lens.deliverableChain.length, drawer: 'Deliverables' },
      ],
      sections: [
        // The connected view: deliverable → tasks to meet it → responsible role
        // → the checklist that proves each task was done right + the people in
        // that role who carry it out. Fully expanded on load.
        { title: 'Deliverables', kind: 'tree', expanded: true, items: lens.deliverableChain },
        { title: 'Supporting roles', kind: 'tree', items: lens.rolesTree.length ? lens.rolesTree : lens.unresolvedRoles.map((r) => ({ label: r, value: 0, hint: 'named role — not in role inventory' })) },
        { title: 'Applications & systems', kind: 'list', items: lens.applications },
        { title: 'Supporting employees', kind: 'list', illustrative: true, hidden: true, items: lens.people },
      ],
    };
  }

  // ── L4 sub-process (unified node; code = SubValueStream.id) or legacy L3
  // process area — the lens scoped to that slice of the stream's steps.
  let s: { name: string; subtitle: string } | null = null;
  let stepWhere: any = null;
  let kpiWhere: any = null;
  if (node && node.typeKey === 'sub_process') {
    const svs = await prisma.subValueStream.findFirst({ where: { id: node.code ?? '_' }, select: { name: true, valueStreamId: true, parent: { select: { name: true } } } });
    const parent = node.parentId ? await resolveNode(node.parentId) : null;
    const vsIds = parent ? await legacyVsIds(node.companyId, parent.name) : (svs ? [svs.valueStreamId] : []);
    const vsFilter = { in: vsIds.length ? vsIds : ['_'] };
    s = { name: node.name, subtitle: `Sub-process${svs?.parent?.name ? ` · ${svs.parent.name}` : ''} (L4)` };
    stepWhere = { valueStreamId: vsFilter, l4: node.name };
    kpiWhere = svs?.parent?.name ? { valueStreamId: vsFilter, l3: svs.parent.name } : { valueStreamId: vsFilter, l3: node.name };
  } else {
    const row = await prisma.subValueStream.findFirst({ where: { id, tenantId, level: { in: [3, 4] } }, select: { name: true, level: true, valueStreamId: true } });
    if (row) {
      s = { name: row.name, subtitle: row.level === 4 ? 'Sub-process (L4)' : 'Process area (L3)' };
      stepWhere = { valueStreamId: row.valueStreamId, [row.level === 4 ? 'l4' : 'l3']: row.name };
      kpiWhere = { valueStreamId: row.valueStreamId, l3: row.name };
    }
  }
  if (!s) return null;
  const companyId = node?.companyId ?? (await prisma.company.findFirst({ where: { tenantId }, select: { id: true } }))!.id;
  const [kpis, steps, io] = await Promise.all([
    prisma.metric.findMany({ where: kpiWhere, orderBy: { category: 'asc' }, select: { name: true, targetText: true, category: true, framework: true } }),
    prisma.processStep.findMany({ where: stepWhere, orderBy: { stepNumber: 'asc' }, select: LENS_STEP_SELECT }),
    prisma.ioItem.groupBy({ by: ['type'], where: stepWhere, _count: { _all: true } }),
  ]);
  const lens = await stepLens(companyId, steps);
  void kpis; void io; // KPI + I/O sections removed from the sidebar by design
  return {
    level: 'step', title: s.name, subtitle: s.subtitle,
    tiles: [
      { label: 'Process steps', value: steps.length },
      { label: 'Supporting employees', value: lens.people.length, illustrative: true, drawer: 'Supporting employees' },
      { label: 'Supporting roles', value: lens.roleCount, hint: lens.unresolvedRoles.length ? `+${lens.unresolvedRoles.length} named only` : undefined, drawer: 'Supporting roles' },
      { label: 'Applications', value: lens.applications.length, drawer: 'Applications & systems' },
      { label: 'Deliverables', value: lens.deliverables.length, drawer: 'Deliverables' },
    ],
    sections: [
      // A refined Process Level 3 plus deliverables: each deliverable carries
      // the L5 step that produces it nested inside, expanded on load.
      { title: 'Deliverables', kind: 'tree', expanded: true, items: lens.deliverables },
      { title: 'Supporting roles', kind: 'tree', items: lens.rolesTree },
      { title: 'Applications & systems', kind: 'list', items: lens.applications },
      { title: 'Supporting employees', kind: 'list', illustrative: true, hidden: true, items: lens.people },
    ],
  };
}

// Role: real profile + deliverables + tasks (workbook) PLUS illustrative people,
// resource cost, and aggregate performance (tagged illustrative). Drills → person.
async function metricsRole(tenantId: string, id: string): Promise<Dashboard | null> {
  const role = await prisma.role.findFirst({ where: { id, tenantId }, select: { id: true, name: true, roleLevel: true, roleFamily: true, division: { select: { name: true } }, department: { select: { name: true } } } });
  if (!role) return null;
  const [rvs, tasks, assignments, perf] = await Promise.all([
    prisma.roleValueStream.findMany({ where: { roleId: id }, select: { participationType: true, outputs: true, valueStream: { select: { name: true } } } }),
    prisma.roleTask.findMany({ where: { roleId: id }, select: { text: true } }),
    prisma.assignment.findMany({ where: { roleId: id }, select: { allocationPct: true, person: { select: { id: true, name: true, employmentType: true, region: true } } } }),
    prisma.personMetric.groupBy({ by: ['name', 'unit'], where: { period: LATEST_PERIOD, person: { assignments: { some: { roleId: id } } } }, _avg: { value: true } }),
  ]);
  const fte = assignments.length;
  const cost = assignments.reduce((a, x) => a + loadedCost(role.roleLevel, x.allocationPct), 0);
  const deliverables = rvs.filter((r) => r.outputs).map((r) => ({ label: r.outputs!, value: 0, sub: r.valueStream.name }));
  return {
    level: 'role', title: role.name, subtitle: [role.roleLevel, role.department?.name ?? role.division?.name].filter(Boolean).join(' · ') || 'Role',
    tiles: [
      { label: 'People (FTE)', value: fte, illustrative: true },
      { label: 'Resource cost', value: cost, format: 'money', hint: 'loaded, annual', illustrative: true },
      { label: 'Value streams', value: new Set(rvs.map((r) => r.valueStream.name)).size },
      { label: 'Deliverables', value: deliverables.length },
      { label: 'Responsibilities', value: tasks.length, hint: 'role tasks' },
      { label: 'Participations', value: rvs.length, hint: 'process mappings' },
    ],
    sections: [
      { title: 'People in role', kind: 'list', illustrative: true, items: assignments.map((a) => ({ label: a.person.name, value: loadedCost(role.roleLevel, a.allocationPct), format: 'money' as const, hint: a.person.employmentType, illustrative: true, drill: { level: 'person', id: a.person.id } })) },
      { title: 'Deliverables', kind: 'list', items: deliverables },
      { title: 'Value-stream participation', kind: 'list', items: rvs.map((r) => ({ label: r.valueStream.name, value: 0, hint: r.participationType })) },
      { title: 'Performance (avg, latest month)', kind: 'list', illustrative: true, items: perf.map((p) => ({ label: p.name, value: 0, hint: `${Math.round((p._avg.value ?? 0) * 10) / 10} ${p.unit}`, illustrative: true })) },
      { title: 'Responsibilities (role tasks)', kind: 'list', items: tasks.slice(0, 25).map((t) => ({ label: t.text, value: 0 })) },
    ],
  };
}

// Person: ILLUSTRATIVE individual. Identity, resource cost, performance, and tasks
// are synthesized; only the role link and its deliverables trace to the workbook.
async function metricsPerson(tenantId: string, id: string): Promise<Dashboard | null> {
  const person = await prisma.person.findFirst({ where: { id, tenantId }, select: { id: true, name: true, title: true, region: true, employmentType: true, vendor: true } });
  if (!person) return null;
  const [assignments, perf, tasks] = await Promise.all([
    prisma.assignment.findMany({ where: { personId: id }, select: { allocationPct: true, role: { select: { id: true, name: true, roleLevel: true } } } }),
    prisma.personMetric.findMany({ where: { personId: id, period: LATEST_PERIOD }, select: { name: true, value: true, unit: true, target: true, direction: true } }),
    prisma.personTask.groupBy({ by: ['status'], where: { personId: id }, _count: { _all: true } }),
  ]);
  const cost = assignments.reduce((a, x) => a + loadedCost(x.role.roleLevel, x.allocationPct), 0);
  const roleIds = assignments.map((a) => a.role.id);
  const rvs = roleIds.length ? await prisma.roleValueStream.findMany({ where: { roleId: { in: roleIds }, outputs: { not: null } }, select: { outputs: true, valueStream: { select: { name: true } } } }) : [];
  return {
    level: 'person', title: person.name, subtitle: [person.title, person.region].filter(Boolean).join(' · ') || 'Individual contributor',
    tiles: [
      { label: 'Resource cost', value: cost, format: 'money', hint: 'loaded, annual', illustrative: true },
      { label: 'Allocation', value: assignments.reduce((a, x) => a + x.allocationPct, 0), hint: '% across roles', illustrative: true },
      { label: 'Roles', value: assignments.length },
      { label: 'Tasks', value: tasks.reduce((a, x) => a + x._count._all, 0), illustrative: true },
      { label: 'Metrics', value: perf.length, hint: 'tracked', illustrative: true },
      { label: 'Deliverables', value: rvs.length },
    ],
    sections: [
      { title: 'Performance (latest month)', kind: 'list', illustrative: true, items: perf.map((p) => ({ label: p.name, value: 0, hint: `${p.value}${p.unit}${p.target != null ? ` / target ${p.target}${p.unit}` : ''}`, illustrative: true })) },
      { title: 'Deliverables', kind: 'list', items: rvs.map((r) => ({ label: r.outputs!, value: 0, sub: r.valueStream.name })) },
      { title: 'Roles', kind: 'list', items: assignments.map((a) => ({ label: a.role.name, value: 0, hint: a.role.roleLevel ?? undefined, drill: { level: 'role', id: a.role.id } })) },
      { title: 'Tasks by status', kind: 'bar', illustrative: true, items: tasks.map((t) => ({ label: t.status, value: t._count._all })).sort((a, b) => b.value - a.value) },
    ],
  };
}

router.get('/metrics/:level/:id?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const id = req.params.id ? decodeURIComponent(req.params.id) : undefined;
    const node = await resolveNode(id);
    const lid = node?.code ?? id; // legacy id when a unified-node id was passed
    let out: Dashboard | null = null;
    switch (req.params.level) {
      case 'company':     out = await metricsCompany(company.id, company.name); break;
      case 'domain':      out = id ? await metricsDomain(company.id, node?.name ?? id) : null; break;
      case 'division':    out = lid ? await metricsDivision(req.tenantId, company.id, lid) : null; break;
      case 'valueStream': out = id ? await metricsValueStream(req.tenantId, company.id, id, node) : null; break;
      case 'step':        out = id ? await metricsStep(req.tenantId, id, node) : null; break;
      case 'role':        out = lid ? await metricsRole(req.tenantId, lid) : null; break;
      case 'person':      out = id ? await metricsPerson(req.tenantId, id) : null; break;
    }
    if (!out) return res.status(404).json({ error: 'Not found' });
    res.json(out);
  } catch (e) { next(e); }
});

// ── Roles summary (right-hand sidebar) ──────────────────────────────────
// Replaces the metrics dashboard. For each focused level: WHO OWNS IT (the
// senior-most / Lead role) + a SUMMARIZED role accumulation (counts, not full
// lists), each row drillable deeper in the same sidebar.
type RoleLite = { id: string; name: string; roleLevel: string | null };
// This DB has no usable roleLevel (every role is null or 'Individual Contributor')
// and the C-suite is not wired into the reporting tree, so seniority/ownership is
// derived from the role TITLE. Lower rank = more senior.
const TIER_LABEL = ['Executive', 'Director / Head', 'Manager / Lead', 'Individual contributor'];
function nameRank(name: string): number {
  const n = name.toLowerCase();
  if (/\bchief\b|\bceo\b|^president\b/.test(n)) return 0;                                  // C-suite
  if (/\bhead\b|\bofficer\b|general counsel|\bcontroller\b|\bdirector\b/.test(n)) return 1; // function heads / directors
  if (/\bmanager\b|\blead\b|\bprincipal\b/.test(n)) return 2;                               // managers / leads
  return 3;                                                                                  // individual contributors
}
const bySeniority = (a: RoleLite, b: RoleLite) => nameRank(a.name) - nameRank(b.name) || a.name.localeCompare(b.name);

async function rolesCompany(c: string, name: string): Promise<Dashboard> {
  const [roles, divisions] = await Promise.all([
    prisma.role.findMany({ where: { companyId: c }, select: { id: true, name: true, roleLevel: true } }),
    prisma.division.findMany({ where: { companyId: c }, orderBy: { name: 'asc' }, include: { _count: { select: { roles: true } } } }),
  ]);
  return {
    level: 'company', title: name, subtitle: 'Roles · top-down ownership',
    tiles: [{ label: 'Roles', value: roles.length }, { label: 'Divisions', value: divisions.length }],
    sections: [
      { title: 'Roles by division', kind: 'list', items: divisions.map((d) => ({ label: d.name, value: d._count.roles, drill: { level: 'division', id: d.id } })) },
    ],
  };
}
async function rolesDomain(c: string, category: string): Promise<Dashboard | null> {
  const divisions = await prisma.division.findMany({ where: { companyId: c, higherCategory: category }, orderBy: { name: 'asc' }, include: { _count: { select: { roles: true } } } });
  if (!divisions.length) return null;
  const roles = await prisma.role.findMany({ where: { divisionId: { in: divisions.map((d) => d.id) } }, select: { id: true, name: true, roleLevel: true } });
  return {
    level: 'domain', title: category, subtitle: 'Roles · top-down ownership',
    tiles: [{ label: 'Roles', value: roles.length }, { label: 'Divisions', value: divisions.length }],
    sections: [
      { title: 'Roles by division', kind: 'list', items: divisions.map((d) => ({ label: d.name, value: d._count.roles, drill: { level: 'division', id: d.id } })) },
    ],
  };
}
async function rolesDivision(tenantId: string, c: string, id: string): Promise<Dashboard | null> {
  const div = await prisma.division.findFirst({ where: { id, tenantId, companyId: c }, select: { id: true, name: true } });
  if (!div) return null;
  const [roles, departments] = await Promise.all([
    prisma.role.findMany({ where: { divisionId: id }, orderBy: { name: 'asc' }, select: { id: true, name: true, roleLevel: true } }),
    prisma.department.findMany({ where: { divisionId: id }, orderBy: { name: 'asc' }, include: { _count: { select: { roles: true } } } }),
  ]);
  const breakdown: MetricSection = departments.length
    ? { title: 'Roles by department', kind: 'list', items: departments.map((d) => ({ label: d.name, value: d._count.roles, drill: { level: 'department', id: d.id } })) }
    : { title: 'Roles', kind: 'list', items: [...roles].sort(bySeniority).map((r) => ({ label: r.name, value: 0, hint: TIER_LABEL[nameRank(r.name)], drill: { level: 'role', id: r.id } })) };
  return {
    level: 'division', title: div.name, subtitle: 'Roles · top-down ownership',
    tiles: [{ label: 'Roles', value: roles.length }, { label: 'Departments', value: departments.length }],
    sections: [breakdown],
  };
}
async function rolesDepartment(tenantId: string, id: string): Promise<Dashboard | null> {
  const dept = await prisma.department.findFirst({ where: { id, tenantId }, select: { id: true, name: true } });
  if (!dept) return null;
  const roles = await prisma.role.findMany({ where: { departmentId: id }, orderBy: { name: 'asc' }, select: { id: true, name: true, roleLevel: true } });
  return {
    level: 'department', title: dept.name, subtitle: 'Roles · top-down ownership',
    tiles: [{ label: 'Roles', value: roles.length }],
    sections: [
      { title: 'Roles', kind: 'list', items: [...roles].sort(bySeniority).map((r) => ({ label: r.name, value: 0, hint: TIER_LABEL[nameRank(r.name)], drill: { level: 'role', id: r.id } })) },
    ],
  };
}
function dedupeByStrongestPart(links: { participationType: string; role: RoleLite }[]) {
  const m = new Map<string, RoleLite & { part: string }>();
  for (const l of links) { const cur = m.get(l.role.id); if (!cur || (PART_ORDER[l.participationType] ?? 9) < (PART_ORDER[cur.part] ?? 9)) m.set(l.role.id, { ...l.role, part: l.participationType }); }
  return [...m.values()].sort((a, b) => (PART_ORDER[a.part] ?? 9) - (PART_ORDER[b.part] ?? 9));
}
async function rolesValueStream(tenantId: string, c: string, id: string, node?: ResolvedNode | null): Promise<Dashboard | null> {
  // Unified value_stream node (preferred): aggregate the folded legacy streams.
  let name: string | null = null;
  let vsIds: string[] | null = null;
  if (node && node.typeKey === 'value_stream') {
    name = node.name;
    vsIds = await legacyVsIds(c, node.name);
  } else {
    const vs = await prisma.valueStream.findFirst({ where: { id, tenantId, companyId: c }, select: { id: true, name: true } });
    if (vs) { name = vs.name; vsIds = [vs.id]; }
  }
  if (!name || !vsIds) return null;
  const links = await prisma.roleValueStream.findMany({ where: { valueStreamId: { in: vsIds.length ? vsIds : ['_'] } }, select: { participationType: true, role: { select: { id: true, name: true, roleLevel: true } } } });
  const roles = dedupeByStrongestPart(links);
  return {
    level: 'valueStream', title: name, subtitle: 'Roles · who owns what',
    tiles: [{ label: 'Roles', value: roles.length }],
    sections: [
      { title: 'Participating Roles', kind: 'list', items: roles.map((r) => ({ label: r.name, value: 0, hint: r.part, drill: { level: 'role', id: r.id } })) },
    ],
  };
}
async function rolesStep(tenantId: string, id: string, node?: ResolvedNode | null): Promise<Dashboard | null> {
  let s: { id: string; name: string; valueStreamId: string } | null = null;
  let vsIds: string[] | null = null;
  if (node && node.typeKey === 'sub_process') {
    const parent = node.parentId ? await resolveNode(node.parentId) : null;
    vsIds = parent ? await legacyVsIds(node.companyId, parent.name) : [];
    s = { id: node.id, name: node.name, valueStreamId: vsIds[0] ?? '_' };
  } else {
    const row = await prisma.subValueStream.findFirst({ where: { id, tenantId, level: 3 }, select: { id: true, name: true, valueStreamId: true } });
    if (row) { s = row; vsIds = [row.valueStreamId]; }
  }
  if (!s || !vsIds) return null;
  const links = await prisma.roleValueStream.findMany({ where: { valueStreamId: { in: vsIds.length ? vsIds : ['_'] }, subStream: { startsWith: s.name + ' — ' } }, select: { participationType: true, role: { select: { id: true, name: true, roleLevel: true } } } });
  const roles = dedupeByStrongestPart(links);
  return {
    level: 'step', title: s.name, subtitle: 'Roles · who owns what',
    tiles: [{ label: 'Roles', value: roles.length }],
    sections: [
      { title: 'Roles involved', kind: 'list', items: roles.map((r) => ({ label: r.name, value: 0, hint: r.part, drill: { level: 'role', id: r.id } })) },
    ],
  };
}
async function rolesRole(tenantId: string, id: string): Promise<Dashboard | null> {
  const role = await prisma.role.findFirst({ where: { id, tenantId }, select: { id: true, name: true, roleLevel: true, manager: { select: { id: true, name: true } }, division: { select: { name: true } }, department: { select: { name: true } } } });
  if (!role) return null;
  const [assignments, reports, rvs, tasks] = await Promise.all([
    prisma.assignment.findMany({ where: { roleId: id }, select: { person: { select: { id: true, name: true, employmentType: true } } } }),
    prisma.role.findMany({ where: { managerRoleId: id }, orderBy: { name: 'asc' }, select: { id: true, name: true, roleLevel: true } }),
    prisma.roleValueStream.findMany({ where: { roleId: id }, select: { participationType: true, outputs: true, valueStream: { select: { name: true } } } }),
    prisma.roleTask.findMany({ where: { roleId: id }, select: { text: true } }),
  ]);
  // Deliverables: the outputs this role produces in each value stream (workbook).
  const deliverables = rvs.filter((r) => r.outputs).map((r) => ({ label: r.outputs!, value: 0, hint: r.valueStream.name }));
  return {
    level: 'role', title: role.name, subtitle: [role.roleLevel, role.department?.name ?? role.division?.name].filter(Boolean).join(' · ') || 'Role',
    tiles: [
      { label: 'People', value: assignments.length },
      { label: 'Direct reports', value: reports.length },
      { label: 'Value streams', value: new Set(rvs.map((r) => r.valueStream.name)).size },
      { label: 'Deliverables', value: deliverables.length },
      { label: 'Responsibilities', value: tasks.length, hint: 'role tasks' },
    ],
    sections: [
      { title: 'Reports to', kind: 'list', items: role.manager ? [{ label: role.manager.name, value: 0, drill: { level: 'role', id: role.manager.id } }] : [] },
      { title: 'People in role', kind: 'list', items: assignments.map((a) => ({ label: a.person.name, value: 0, hint: a.person.employmentType, drill: { level: 'person', id: a.person.id } })) },
      { title: 'Deliverables', kind: 'list', items: deliverables },
      { title: 'Responsibilities (role tasks)', kind: 'list', items: tasks.slice(0, 25).map((t) => ({ label: t.text, value: 0 })) },
      { title: 'Direct reports', kind: 'list', items: reports.map((r) => ({ label: r.name, value: 0, hint: r.roleLevel ?? undefined, drill: { level: 'role', id: r.id } })) },
      { title: 'Value-stream participation', kind: 'list', items: rvs.map((r) => ({ label: r.valueStream.name, value: 0, hint: r.participationType })) },
    ],
  };
}
async function rolesPerson(tenantId: string, id: string): Promise<Dashboard | null> {
  const person = await prisma.person.findFirst({ where: { id, tenantId }, select: { id: true, name: true, title: true, location: true, region: true, employmentType: true, vendor: true } });
  if (!person) return null;
  const [assignments, signals, apps, metrics] = await Promise.all([
    prisma.assignment.findMany({ where: { personId: id }, orderBy: [{ isPrimary: 'desc' }], select: { allocationPct: true, role: { select: { id: true, name: true, roleLevel: true, division: { select: { name: true } } } } } }),
    prisma.personSignal.findMany({ where: { personId: id, period: LATEST_PERIOD }, select: { name: true, value: true, unit: true } }),
    prisma.personAppUsage.findMany({ where: { personId: id }, orderBy: { rank: 'asc' }, select: { appName: true, category: true, usagePct: true } }),
    prisma.personMetric.findMany({ where: { personId: id, period: LATEST_PERIOD }, orderBy: { name: 'asc' }, select: { name: true, value: true, unit: true, target: true, direction: true } }),
  ]);
  const sig = (name: string) => signals.find((s) => s.name === name);
  const online = sig('Time online'), gh = sig('GitHub activity'), msgs = sig('Team messages');
  const alloc = assignments[0]?.allocationPct ?? 0;
  const u = (unit: string) => (unit === '%' ? '%' : ` ${unit}`);

  // Deliverables: the outputs of the roles this person holds (workbook).
  const roleIds = assignments.map((a) => a.role.id);
  const deliverableRows = roleIds.length
    ? await prisma.roleValueStream.findMany({ where: { roleId: { in: roleIds }, outputs: { not: null } }, select: { outputs: true, valueStream: { select: { name: true } } } })
    : [];
  const deliverables = deliverableRows.map((r) => ({ label: r.outputs!, value: 0, hint: r.valueStream.name }));

  return {
    level: 'person', title: person.name, subtitle: [person.title, person.location ?? person.region].filter(Boolean).join(' · ') || person.employmentType,
    tiles: [
      ...(online ? [{ label: 'Time online', value: online.value, hint: online.unit, illustrative: true }] : []),
      ...(gh ? [{ label: 'GitHub activity', value: gh.value, hint: gh.unit, illustrative: true }] : []),
      ...(msgs ? [{ label: 'Team messages', value: msgs.value, hint: msgs.unit, illustrative: true }] : []),
      { label: 'Allocation', value: alloc, hint: '%', illustrative: true },
      { label: 'Deliverables', value: deliverables.length },
    ],
    sections: [
      { title: 'Deliverables', kind: 'list', items: deliverables },
      { title: 'Profile', kind: 'kpi', items: [
        { label: 'Location', value: 0, hint: person.location ?? '—' },
        { label: 'Region', value: 0, hint: person.region ?? '—' },
        { label: 'Employment', value: 0, hint: person.employmentType === 'badged' ? 'Badged' : (person.vendor ?? person.employmentType) },
      ] },
      { title: 'Performance · value-stream KPIs', kind: 'kpi', illustrative: true, items: metrics.map((m) => ({
        label: m.name, value: 0,
        hint: `${m.value}${u(m.unit)}`,
        sub: m.target != null ? `target ${m.direction === 'down' ? '≤' : '≥'} ${m.target}${u(m.unit)}` : undefined,
      })) },
      { title: 'Productivity signals', kind: 'list', illustrative: true, items: signals
        .slice().sort((a, b) => ['Time online', 'GitHub activity', 'Team messages', 'Focus hours', 'Meetings'].indexOf(a.name) - ['Time online', 'GitHub activity', 'Team messages', 'Focus hours', 'Meetings'].indexOf(b.name))
        .map((s) => ({ label: s.name, value: s.value, hint: s.unit })) },
      { title: 'Most used apps', kind: 'list', illustrative: true, items: apps.map((a) => ({ label: a.appName, value: a.usagePct, hint: a.category ?? undefined })) },
      { title: 'Roles', kind: 'list', items: assignments.map((a) => ({ label: a.role.name, value: 0, hint: a.role.division?.name ?? a.role.roleLevel ?? undefined, drill: { level: 'role', id: a.role.id } })) },
    ],
  };
}

// Build a sidebar dashboard from a configurable Level node — used when the map
// focuses any Level (esp. an L5 Process Step): Description, Supporting Roles
// (leads + supporting), Key Inputs, Key Outputs, External Participants.
function splitList(v: string | null): string[] {
  if (!v) return [];
  return v.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}
function levelDashboard(l: { name: string; levelNumber: number; description: string | null; leads: string | null; supporting: string | null; inputs: string | null; outputs: string | null; externalParticipants: string | null }): Dashboard {
  const sections: MetricSection[] = [];
  if (l.description) sections.push({ title: 'Step Description', kind: 'kpi', items: [{ label: l.description, value: 0 }] });
  const roles = [...splitList(l.leads), ...splitList(l.supporting)];
  if (roles.length) sections.push({ title: 'Supporting Roles', kind: 'list', items: roles.map((r) => ({ label: r, value: 0 })) });
  const inputs = splitList(l.inputs);
  if (inputs.length) sections.push({ title: 'Key Inputs', kind: 'list', items: inputs.map((r) => ({ label: r, value: 0 })) });
  const outputs = splitList(l.outputs);
  if (outputs.length) sections.push({ title: 'Key Outputs', kind: 'list', items: outputs.map((r) => ({ label: r, value: 0 })) });
  const ext = splitList(l.externalParticipants);
  if (ext.length) sections.push({ title: 'External Participants', kind: 'list', items: ext.map((r) => ({ label: r, value: 0 })) });
  return { level: 'step', title: l.name, subtitle: `Level ${l.levelNumber}`, tiles: [], sections };
}

router.get('/roles/:level/:id?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const id = req.params.id ? decodeURIComponent(req.params.id) : undefined;
    const node = await resolveNode(id);
    // Unified work-branch node → the step-lens dashboard (map drill-down): the
    // PEOPLE assigned to the roles doing this slice of work, their tasks and
    // checklists, the deliverables (+ where memorialized / who approves), and
    // the applications the steps run on — refined to the focused depth
    // (sub_process = its steps; step = that one step).
    if (node && ['sub_process', 'step'].includes(node.typeKey) && req.params.level !== 'valueStream') {
      const lensDash = await metricsStep(req.tenantId, id!, node);
      if (lensDash) return res.json(lensDash);
    }
    if (node && ['value_stream', 'sub_process', 'step', 'io_item'].includes(node.typeKey) && req.params.level !== 'valueStream') {
      const full = await prisma.node.findUnique({ where: { id: node.id }, select: { description: true, attributes: true } });
      const at = (full?.attributes as any) ?? {};
      return res.json(levelDashboard({
        name: node.name,
        levelNumber: node.typeKey === 'value_stream' ? 3 : node.typeKey === 'sub_process' ? 4 : 5,
        description: full?.description ?? null,
        leads: at.leads ?? null, supporting: at.supporting ?? null,
        inputs: at.inputs ?? null, outputs: at.outputs ?? null,
        externalParticipants: at.externalParticipants ?? null,
      }));
    }
    // Legacy Level node → serve its detail (old links keep working).
    if (id && !node) {
      const lvl = await prisma.level.findFirst({ where: { id, tenantId: req.tenantId }, select: { name: true, levelNumber: true, description: true, leads: true, supporting: true, inputs: true, outputs: true, externalParticipants: true } });
      if (lvl) return res.json(levelDashboard(lvl));
    }
    const lid = node?.code ?? id; // legacy id when a unified-node id was passed
    let out: Dashboard | null = null;
    switch (req.params.level) {
      case 'company':     out = await rolesCompany(company.id, company.name); break;
      case 'domain':      out = id ? await rolesDomain(company.id, node?.name ?? id) : null; break;
      case 'division':    out = lid ? await rolesDivision(req.tenantId, company.id, lid) : null; break;
      case 'department':  out = lid ? await rolesDepartment(req.tenantId, lid) : null; break;
      // Value stream: the step-lens dashboard (people doing the work, apps,
      // deliverable counts) plus the participating-roles roster appended by
      // metricsValueStream — the lens narrows in rolesStep/metricsStep below.
      case 'valueStream': out = id ? (await metricsValueStream(req.tenantId, company.id, id, node)) ?? (await rolesValueStream(req.tenantId, company.id, id, node)) : null; break;
      case 'step':        out = id ? (await metricsStep(req.tenantId, id, node)) ?? (await rolesStep(req.tenantId, id, node)) : null; break;
      case 'role':        out = lid ? await rolesRole(req.tenantId, lid) : null; break;
      case 'person':      out = id ? await rolesPerson(req.tenantId, id) : null; break;
    }
    if (!out) return res.status(404).json({ error: 'Not found' });
    res.json(out);
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
  // Accept unified-node ids (the rework's namespace): translate to the legacy id
  // the per-type builders expect. Falls through unchanged for legacy ids.
  const unified = await resolveNode(id);
  if (unified?.code) id = unified.code;
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
  // Real-app TCO rollup across all 6 apps with TCO data (illustrative=false).
  const realApps = await prisma.application.findMany({
    where: { companyId: c, illustrative: false, totalTco: { not: null } },
    select: { licenseCost: true, laborCost: true, vendorServicesCost: true, infraCost: true, depreciationCost: true, overheadCost: true, totalTco: true },
  });
  const tcoByBucket = { license: 0, labor: 0, vendorServices: 0, infra: 0, depreciation: 0, overhead: 0 };
  let totalRealTco = 0;
  for (const a of realApps) {
    tcoByBucket.license += a.licenseCost ?? 0;
    tcoByBucket.labor += a.laborCost ?? 0;
    tcoByBucket.vendorServices += a.vendorServicesCost ?? 0;
    tcoByBucket.infra += a.infraCost ?? 0;
    tcoByBucket.depreciation += a.depreciationCost ?? 0;
    tcoByBucket.overhead += a.overheadCost ?? 0;
    totalRealTco += a.totalTco ?? 0;
  }
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
      // realAppCount / totalRealTco: only the 6 real apps from the TCO sheet (illustrative=false).
      // tcoByBucket: aggregate license/labor/vendorServices/infra/depreciation/overhead spend.
      where: { systems: apps.reduce((a, x) => a + x._count._all, 0), byKind: apps.map((x) => ({ kind: x.kind, count: x._count._all })), realAppCount: realApps.length, totalRealTco, tcoByBucket },
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
  const [roles, ppl, streams, controls, metrics, leaders, risk, cats, standards, divApps] = await Promise.all([
    prisma.role.findMany({ where: roleWhere, select: { id: true } }),
    headcount({ assignments: { some: { role: roleWhere } } }),
    streamsForRoles(roleWhere),
    prisma.role.findMany({ where: roleWhere, select: { id: true } }).then((r) => controlsFor(r.map((x) => x.id))),
    avgPersonMetrics({ assignments: { some: { role: roleWhere } } }),
    prisma.role.findMany({ where: { ...roleWhere, OR: [{ roleLevel: { contains: 'Executive', mode: 'insensitive' } }, { name: { contains: 'Chief', mode: 'insensitive' } }, { name: { contains: 'Head', mode: 'insensitive' } }] }, select: { id: true, name: true }, take: 6 }),
    risksBySeverity({ valueStream: { roleLinks: { some: { role: roleWhere } } } }),
    prisma.role.findMany({ where: roleWhere, select: { id: true } }).then((r) => categoryCounts(r.map((x) => x.id))),
    prisma.standard.findMany({ where: { companyId: div.companyId }, select: { department: true, count: true, charterIncluded: true, owner: true } }),
    // TCO rollup: apps whose primaryDivisionName matches this division's name (from TCO sheet).
    prisma.application.findMany({ where: { companyId: div.companyId, primaryDivisionName: div.name, totalTco: { not: null } }, select: { id: true, name: true, ownershipModel: true, totalTco: true, licenseCost: true, laborCost: true, vendorServicesCost: true, infraCost: true, depreciationCost: true, overheadCost: true } }),
  ]);
  const apps = await appsForStreams(streams.map((s) => s.id));
  const kpi = await kpisFor(streams.map((s) => s.id));
  // Aggregate division-level TCO from apps whose primaryDivisionName matches.
  const divTcoByBucket = { license: 0, labor: 0, vendorServices: 0, infra: 0, depreciation: 0, overhead: 0 };
  let divTotalTco = 0;
  for (const a of divApps) {
    divTcoByBucket.license += a.licenseCost ?? 0;
    divTcoByBucket.labor += a.laborCost ?? 0;
    divTcoByBucket.vendorServices += a.vendorServicesCost ?? 0;
    divTcoByBucket.infra += a.infraCost ?? 0;
    divTcoByBucket.depreciation += a.depreciationCost ?? 0;
    divTcoByBucket.overhead += a.overheadCost ?? 0;
    divTotalTco += a.totalTco ?? 0;
  }
  return {
    type: 'division', id: div.id, name: div.name, higherCategory: div.higherCategory, subtitle: `${div.departments.length} departments · ${roles.length} roles · ${ppl.total} people`, illustrative: false,
    lenses: {
      who: { headcount: ppl, leaders: leaders.map((l) => ({ id: l.id, name: l.name })) },
      what: { roles: roles.length, valueStreams: streams.length, categories: cats },
      how: { valueStreams: streams.slice(0, 14) },
      // tco: real-app spend for apps tagged to this division via primaryDivisionName (from TCO sheet).
      // null means no real app is tagged to this division.
      where: { applications: apps.slice(0, 14), tco: divTotalTco > 0 ? { total: divTotalTco, byBucket: divTcoByBucket, apps: divApps.map((a) => ({ id: a.id, name: a.name, ownershipModel: a.ownershipModel, totalTco: a.totalTco })) } : null },
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
    prisma.applicationValueStream.findMany({ where: { valueStreamId: vs.id }, include: { application: { select: { id: true, name: true, kind: true, vendor: true, criticality: true, illustrative: true, ownershipModel: true, totalTco: true, licenseCost: true, laborCost: true, vendorServicesCost: true, infraCost: true, depreciationCost: true, overheadCost: true } } } }),
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
  // TCO rollup: sum real-app TCO across all apps linked to this value stream.
  const vsTcoByBucket = { license: 0, labor: 0, vendorServices: 0, infra: 0, depreciation: 0, overhead: 0 };
  let vsTotalTco = 0;
  for (const a of apps) {
    if (a.application.illustrative || a.application.totalTco == null) continue;
    vsTcoByBucket.license += a.application.licenseCost ?? 0;
    vsTcoByBucket.labor += a.application.laborCost ?? 0;
    vsTcoByBucket.vendorServices += a.application.vendorServicesCost ?? 0;
    vsTcoByBucket.infra += a.application.infraCost ?? 0;
    vsTcoByBucket.depreciation += a.application.depreciationCost ?? 0;
    vsTcoByBucket.overhead += a.application.overheadCost ?? 0;
    vsTotalTco += a.application.totalTco;
  }
  const appItems = apps.map((a) => child(a.application.id, 'application', a.application.name, { group: a.application.kind === 'External' ? 'External applications' : 'Supporting applications', subtitle: `${a.application.kind}${a.application.vendor ? ' · ' + a.application.vendor : ''}`, badges: { kind: a.application.kind } }));
  return {
    type: 'valueStream', id: vs.id, name: vs.name, subtitle: vs.domain ?? undefined, illustrative: false,
    lenses: {
      who: { roles: who },
      what: { deliverables: subStreams.filter((s) => s.level === 4 && s.outputs).map((s) => ({ process: s.name, output: s.outputs })), io },
      // ownershipGaps: count of L3 process areas with no owning/contributing roles (accountability gap / loss signal).
      how: { processAreas: l3.length, subProcesses: subStreams.filter((s) => s.level === 4).length, ownershipGaps, steps, initiatives: inits.map((i) => ({ id: i.initiativeId, name: i.initiative.name, health: i.initiative.health })) },
      // tco: real-app TCO rollup for apps linked to this value stream (null buckets mean no real apps here).
      where: { applications: apps.map((a) => ({ ...a.application, systemRole: a.systemRole })), tco: vsTotalTco > 0 ? { total: vsTotalTco, byBucket: vsTcoByBucket } : null },
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
  // L4 compound key is "<parentL3> — <L4>"; if the parent isn't known (orphan L4),
  // fall back to matching any L3 parent rather than the literal "undefined — name".
  const compoundKey = isL3 ? null : s.parent?.name ? `${s.parent.name} — ${s.name}` : null;
  const rvsRows = await prisma.roleValueStream.findMany({
    where: {
      valueStreamId: s.valueStreamId,
      subStream: isL3 ? { startsWith: s.name + ' — ' } : (compoundKey ?? { endsWith: ' — ' + s.name }),
    },
    select: { roleId: true, participationType: true, role: { select: { id: true, name: true, division: { select: { higherCategory: true } } } } },
  });
  const roleLinkCount = rvsRows.length;
  // Domain tags: which higher-categories perform this sub-process (Core Business /
  // Corporate Function / IT), derived from the participating roles' divisions.
  const catCount = new Map<string, number>();
  let leadCat: string | null = null;
  for (const r of rvsRows) {
    const cat = r.role.division?.higherCategory ?? null;
    if (cat) { catCount.set(cat, (catCount.get(cat) ?? 0) + 1); if (r.participationType === 'Lead' && !leadCat) leadCat = cat; }
  }
  const categories = [...catCount.keys()].sort((a, b) => (catCount.get(b)! - catCount.get(a)!));
  const domain = { primaryCategory: leadCat ?? categories[0] ?? null, categories, crossDomain: categories.length > 1 };
  // Supporting applications (value-stream-level in v15) and the people who perform
  // this sub-process (via the involved roles) — both surface in the left sidebar.
  const supportApps = await appsForStreams([s.valueStreamId]);
  const roleIds = roles.map((r) => r.id);
  const people = roleIds.length
    ? await prisma.person.findMany({ where: { tenantId, assignments: { some: { roleId: { in: roleIds } } } }, select: { id: true, name: true, title: true, region: true, employmentType: true }, take: 40 })
    : [];
  // byParticipation: group roles by their participationType for this sub-stream.
  // Provides Lead/Core/Support/Control/Oversight breakdown at process-area level.
  const byParticipation: Record<string, { id: string; name: string }[]> = { Lead: [], Core: [], Support: [], Control: [], Oversight: [] };
  for (const r of rvsRows) {
    const pt = r.participationType;
    if (!byParticipation[pt]) byParticipation[pt] = [];
    byParticipation[pt].push({ id: r.role.id, name: r.role.name });
  }
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
    // domain: the higher-categories that perform this sub-process (for domain tags).
    domain,
    lenses: {
      // byParticipation: roles grouped by participation type (Lead/Core/Support/Control/Oversight).
      // people: the individuals performing this sub-process (left-sidebar list).
      who: { rolesInvolved: roles, byParticipation, people },
      what: { output: s.outputs, io }, how: { inputs: s.inputs, outputs: s.outputs, upstream: s.upstream, downstream: s.downstream, steps },
      // applications: supporting systems (value-stream-level in v15) for the left sidebar.
      where: { applications: supportApps }, why: { notes: s.notes }, howWell: {},
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
      // roleFamily / roleLevel: from Extended Role Inventory (v15 data). null for org-roster roles not in that sheet.
      who: { headcount: ppl, division: role.division, department: role.department, manager: role.manager, directReports: reports.length, roleFamily: role.roleFamily, roleLevel: role.roleLevel },
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

  // TCO lens: only populated for real apps (illustrative=false) with TCO data.
  const tco = (!app.illustrative && app.totalTco != null)
    ? {
        license: app.licenseCost, labor: app.laborCost, vendorServices: app.vendorServicesCost,
        infra: app.infraCost, depreciation: app.depreciationCost, overhead: app.overheadCost,
        total: app.totalTco, illustrative: false,
      }
    : null;

  const items = [...roleItems, ...internal.map((a) => toItem(a, 'Internal systems')), ...external.map((a) => toItem(a, 'External systems'))];
  // subtitle includes ownershipModel for real apps (Hybrid/In-house/SaaS).
  const subtitleParts = [app.kind, app.vendor ?? null, app.ownershipModel ? `${app.ownershipModel} ownership` : null, `${app.criticality} criticality`].filter(Boolean);
  return {
    type: 'application', id: app.id, name: app.name, subtitle: subtitleParts.join(' · '), illustrative: app.illustrative,
    lenses: {
      who: { roles: roles.map((r) => ({ id: r.id, name: r.name, org: r.org, department: r.department, participationType: r.p })) },
      // tco: full 6-bucket breakdown for real apps; null for illustrative apps.
      what: { category: app.category, tco }, how: { systemRoles: app.valueStreamLinks.map((l) => ({ stream: l.valueStream.name, role: l.systemRole })) },
      where: { kind: app.kind, ownershipModel: app.ownershipModel, vendor: app.vendor, criticality: app.criticality, internal: internal.length, external: external.length, valueStreams: app.valueStreamLinks.map((l) => ({ id: l.valueStreamId, name: l.valueStream.name })) },
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

// ── Org table: roles & groupings (L1 Segment → L2 Division → L3 Department →
//    L4 Role → L5 Person), each role cross-linked to the value streams it works
//    in motion (L1 Domain → L2 Value Stream → L3 Process Area → L4 Sub-Process).
//    Powers the "Roles" interactive table (not a drill map). People are loaded
//    lazily per role via /role/:id/people; here we only carry the headcount.
router.get('/org-table', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const c = company.id;
    // Structure + names + ordering come from the unified Node tree (renames and
    // reorders in the builder propagate here). Detail rows keep their LEGACY ids
    // (node.code) so the role/division/department detail routes still resolve.
    // Participation detail stays on the typed RoleValueStream junction (hybrid),
    // re-mapped onto the canonical value streams.
    const [nodes, links, headByRole] = await Promise.all([
      prisma.node.findMany({
        where: { companyId: c, typeKey: { in: ['segment', 'division', 'department', 'role', 'value_stream'] } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, typeKey: true, parentId: true, code: true, attributes: true },
      }),
      prisma.roleValueStream.findMany({ where: { valueStream: { companyId: c } }, select: { roleId: true, participationType: true, subStream: true, valueStream: { select: { name: true } } } }),
      prisma.assignment.groupBy({ by: ['roleId'], where: { role: { companyId: c } }, _count: { _all: true } }),
    ]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ofType = (t: string) => nodes.filter((n) => n.typeKey === t);
    const segNodes = ofType('segment');
    const divNodes = ofType('division');
    const deptNodes = ofType('department');
    const roleNodes = ofType('role');
    const vsNodes = ofType('value_stream');
    const vsByName = new Map(vsNodes.map((v) => [v.name, v]));

    const peopleByRole = new Map(headByRole.map((h) => [h.roleId, h._count._all])); // keyed by legacy Role.id (= role node code)

    // legacy role id -> participations, resolved onto the canonical streams.
    const partByRole = new Map<string, any[]>();
    for (const l of links) {
      const cname = canonicalVs(l.valueStream.name);
      const vn = vsByName.get(cname);
      const [l3, l4] = (l.subStream ?? '').split(' — ');
      if (!partByRole.has(l.roleId)) partByRole.set(l.roleId, []);
      partByRole.get(l.roleId)!.push({
        valueStreamId: vn?.id ?? null,
        valueStreamName: cname,
        domain: vn?.parentId ? byId.get(vn.parentId)?.name ?? null : null,
        participationType: l.participationType,
        l3: l3 || null,
        l4: l4 || null,
      });
    }
    const sortPart = (a: any, b: any) => (PART_ORDER[a.participationType] ?? 9) - (PART_ORDER[b.participationType] ?? 9) || a.valueStreamName.localeCompare(b.valueStreamName);

    // Roles nested under departments, then divisions, then segments — plus an
    // explicit Unassigned bucket so no role is silently dropped (audit D1).
    const rolesByParent = new Map<string, any[]>();
    const unassignedRoles: any[] = [];
    for (const r of roleNodes) {
      const legacyId = r.code ?? r.id;
      const a = (r.attributes as any) ?? {};
      const part = (partByRole.get(legacyId) ?? []).sort(sortPart);
      const entry = {
        id: legacyId, name: r.name, roleLevel: a.roleLevel ?? null, roleFamily: a.roleFamily ?? null,
        peopleCount: peopleByRole.get(legacyId) ?? 0,
        valueStreamCount: new Set(part.map((p) => p.valueStreamId)).size,
        participations: part,
      };
      if (!r.parentId) { unassignedRoles.push(entry); continue; }
      if (!rolesByParent.has(r.parentId)) rolesByParent.set(r.parentId, []);
      rolesByParent.get(r.parentId)!.push(entry);
    }

    const divisionRows = divNodes.map((dv) => {
      const depts = deptNodes.filter((d) => d.parentId === dv.id).map((d) => {
        const r = rolesByParent.get(d.id) ?? [];
        return { id: d.code ?? d.id, name: d.name, roles: r, roleCount: r.length, peopleCount: r.reduce((a, x) => a + x.peopleCount, 0) };
      });
      const looseRoles = rolesByParent.get(dv.id) ?? []; // roles hanging directly off the division
      const roleCount = depts.reduce((a, x) => a + x.roleCount, looseRoles.length);
      const peopleCount = depts.reduce((a, x) => a + x.peopleCount, looseRoles.reduce((a2, x2) => a2 + x2.peopleCount, 0));
      const segment = dv.parentId ? byId.get(dv.parentId)?.name ?? 'Core Business' : 'Core Business';
      return { id: dv.code ?? dv.id, name: dv.name, segment, departments: depts, looseRoles, roleCount, peopleCount, _segId: dv.parentId };
    });

    const segments: any[] = segNodes
      .map((s) => {
        const divs = divisionRows.filter((d) => d._segId === s.id).map(({ _segId, ...d }) => d);
        return { name: s.name, divisions: divs, divisionCount: divs.length, roleCount: divs.reduce((a, x) => a + x.roleCount, 0), peopleCount: divs.reduce((a, x) => a + x.peopleCount, 0) };
      })
      .filter((s) => s.divisions.length > 0);
    if (unassignedRoles.length) {
      const peopleCount = unassignedRoles.reduce((a, x) => a + x.peopleCount, 0);
      segments.push({
        name: 'Unassigned',
        divisions: [{ id: '__unassigned', name: 'Unassigned roles', segment: 'Unassigned', departments: [], looseRoles: unassignedRoles, roleCount: unassignedRoles.length, peopleCount }],
        divisionCount: 0, roleCount: unassignedRoles.length, peopleCount,
      });
    }

    // Headline totals come from the ONE shared canonical function (X1/X2) so the
    // Organization header always equals the Home tiles.
    const totals = await structureCounts(req.tenantId!, c);
    res.json({
      company,
      totals: {
        segments: totals.segments, divisions: totals.divisions, departments: totals.departments,
        roles: totals.roles, valueStreams: totals.valueStreams, people: totals.people,
      },
      valueStreams: vsNodes.map((v) => ({ id: v.id, name: v.name, domain: v.parentId ? byId.get(v.parentId)?.name ?? null : null })),
      segments,
    });
  } catch (e) { next(e); }
});

// Standards `owner` is free text naming the accountable role(s), often as a
// C-suite abbreviation or short title. This maps those tokens to the canonical
// Role names that exist in the operating model so the drill-down can link to the
// real role. Anything not listed here falls back to an exact (normalized) match.
const OWNER_ALIAS: Record<string, string> = {
  ciso: 'Chief Info Security Officer', cto: 'Chief Technology Officer', cfo: 'Chief Financial Officer',
  chro: 'Chief HR Officer', cro: 'Chief Risk Officer', cco: 'Head of Compliance', coo: 'Chief Operating Officer',
  cdo: 'Chief Data Officer', cio: 'Chief Information Officer', cpo: 'Chief Product Officer',
  'iso security architect': 'ISO Architect', rte: 'Release Train Engineer', 'pmo director': 'Program Mgmt Office',
};
const normRole = (s: string) => s.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();

// Department standards index — one row per department with its count of
// standards, charter inclusion, and the accountable owner resolved to real
// role(s). Powers the Standards tab + role-level drill-down. Scoped to the
// tenant's company; junk-count rows are excluded (count > 0).
router.get('/standards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true, name: true } });
    if (!company) return res.status(404).json({ error: 'No company' });

    const [standards, roles, headByRole] = await Promise.all([
      prisma.standard.findMany({
        where: { companyId: company.id, count: { gt: 0 } },
        orderBy: [{ count: 'desc' }, { department: 'asc' }],
        select: { id: true, department: true, count: true, charterIncluded: true, owner: true, link: true },
      }),
      prisma.role.findMany({ where: { companyId: company.id }, select: { id: true, name: true, roleLevel: true } }),
      prisma.assignment.groupBy({ by: ['roleId'], where: { role: { companyId: company.id } }, _count: { _all: true } }),
    ]);

    const peopleByRole = new Map(headByRole.map((h) => [h.roleId, h._count._all]));
    const roleByNorm = new Map(roles.map((r) => [normRole(r.name), r]));
    // Resolve one owner token (e.g. "CISO", "Enterprise Architect") to a role.
    const resolveToken = (raw: string) => {
      const key = normRole(raw);
      const target = OWNER_ALIAS[key] ? normRole(OWNER_ALIAS[key]) : key;
      const role = roleByNorm.get(target);
      return role
        ? { label: raw, roleId: role.id, roleName: role.name, roleLevel: role.roleLevel, peopleCount: peopleByRole.get(role.id) ?? 0 }
        : { label: raw, roleId: null, roleName: null, roleLevel: null, peopleCount: 0 };
    };

    const withResponsible = standards.map((s) => ({
      ...s,
      responsible: (s.owner ?? '').split(/[/,]/).map((x) => x.trim()).filter(Boolean).map(resolveToken),
    }));

    const totals = {
      areas: standards.length,
      standards: standards.reduce((a, s) => a + s.count, 0),
      withCharter: standards.filter((s) => s.charterIncluded).length,
    };
    res.json({ company, totals, standards: withResponsible });
  } catch (e) { next(e); }
});

// Standards area detail — the area's charter (mission/scope) plus every
// individual standard, each with its accountable role (resolved) and the value
// streams it applies to (derived from that role's value-stream participation).
router.get('/standards/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { tenantId: req.tenantId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'No company' });
    const area = await prisma.standard.findFirst({
      where: { id: req.params.id, companyId: company.id },
      select: { id: true, department: true, count: true, charterIncluded: true, owner: true, link: true, mission: true, scope: true },
    });
    if (!area) return res.status(404).json({ error: 'Not found' });

    const items = await prisma.standardItem.findMany({
      where: { standardId: area.id },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, category: true, name: true, description: true, buildRun: true, ownerRole: true, ownerRoleId: true, relatedRole: true, relatedCategory: true, itemsLink: true, agentSkill: true, sdlcGates: true, regCitation: true },
    });

    const roleIds = [...new Set(items.map((i) => i.ownerRoleId).filter(Boolean))] as string[];
    const [roleRows, headByRole, vsLinks] = await Promise.all([
      prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true, roleLevel: true } }),
      prisma.assignment.groupBy({ by: ['roleId'], where: { roleId: { in: roleIds } }, _count: { _all: true } }),
      prisma.roleValueStream.findMany({ where: { roleId: { in: roleIds } }, select: { roleId: true, valueStreamId: true, valueStream: { select: { name: true, domain: true, domainRef: { select: { name: true } } } } } }),
    ]);
    const roleById = new Map(roleRows.map((r) => [r.id, r]));
    const peopleByRole = new Map(headByRole.map((h) => [h.roleId, h._count._all]));
    const vsByRole = new Map<string, { id: string; name: string; domain: string | null }[]>();
    for (const l of vsLinks) {
      if (!vsByRole.has(l.roleId)) vsByRole.set(l.roleId, []);
      const arr = vsByRole.get(l.roleId)!;
      if (!arr.some((x) => x.id === l.valueStreamId)) arr.push({ id: l.valueStreamId, name: l.valueStream.name, domain: l.valueStream.domainRef?.name ?? l.valueStream.domain ?? null });
    }

    const enriched = items.map((it) => {
      const role = it.ownerRoleId ? roleById.get(it.ownerRoleId) : null;
      return {
        id: it.id, category: it.category, name: it.name, description: it.description, buildRun: it.buildRun,
        ownerRole: it.ownerRole, relatedRole: it.relatedRole, relatedCategory: it.relatedCategory, itemsLink: it.itemsLink,
        agentSkill: it.agentSkill, sdlcGates: it.sdlcGates, regCitation: it.regCitation,
        responsible: role ? { roleId: role.id, roleName: role.name, roleLevel: role.roleLevel, peopleCount: peopleByRole.get(role.id) ?? 0 } : null,
        valueStreams: it.ownerRoleId ? vsByRole.get(it.ownerRoleId) ?? [] : [],
      };
    });

    const categories = [...new Set(items.map((i) => i.category))];
    res.json({
      area,
      totals: { items: items.length, categories: categories.length, withOwnerRole: enriched.filter((e) => e.responsible).length },
      items: enriched,
    });
  } catch (e) { next(e); }
});

// L5 — people in a role (lazy; illustrative). Loaded when a role row expands.
router.get('/role/:id/people', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await prisma.role.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!role) return res.status(404).json({ error: 'Not found' });
    const rows = await prisma.assignment.findMany({
      where: { roleId: role.id },
      orderBy: { person: { name: 'asc' } },
      select: { allocationPct: true, isPrimary: true, person: { select: { id: true, name: true, title: true, region: true, employmentType: true, vendor: true, illustrative: true } } },
    });
    res.json({ people: rows.map((r) => ({ ...r.person, allocationPct: r.allocationPct, isPrimary: r.isPrimary })) });
  } catch (e) { next(e); }
});

// ── Person (L5) — location, assignment(s) and performance vs the relevant
// value-stream KPIs the person's role(s) participate in. PersonMetric names are
// drawn from those KPIs (see scripts/backfill-roles.ts), so each metric shows
// the latest reading + 6-month history + on/off-target status.
router.get('/person/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const person = await prisma.person.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      select: { id: true, name: true, title: true, location: true, region: true, employmentType: true, vendor: true, illustrative: true },
    });
    if (!person) return res.status(404).json({ error: 'Not found' });

    const [assignments, metricRows, signalRows, appRows] = await Promise.all([
      prisma.assignment.findMany({
        where: { personId: person.id },
        orderBy: [{ isPrimary: 'desc' }],
        select: {
          allocationPct: true, isPrimary: true, employmentType: true,
          role: { select: { id: true, name: true, roleLevel: true, division: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } },
        },
      }),
      prisma.personMetric.findMany({ where: { personId: person.id }, orderBy: { period: 'asc' }, select: { name: true, value: true, unit: true, target: true, direction: true, period: true } }),
      prisma.personSignal.findMany({ where: { personId: person.id }, orderBy: { period: 'asc' }, select: { name: true, value: true, unit: true, period: true } }),
      prisma.personAppUsage.findMany({ where: { personId: person.id }, orderBy: { rank: 'asc' }, select: { appName: true, category: true, usagePct: true, rank: true } }),
    ]);

    // Distinct value streams across the person's roles (for context).
    const roleIds = assignments.map((a) => a.role.id);
    const vsLinks = roleIds.length
      ? await prisma.roleValueStream.findMany({ where: { roleId: { in: roleIds } }, select: { participationType: true, valueStream: { select: { id: true, name: true } } } })
      : [];
    const vsMap = new Map<string, { id: string; name: string; participationType: string }>();
    for (const l of vsLinks) { const cur = vsMap.get(l.valueStream.id); if (!cur || (PART_ORDER[l.participationType] ?? 9) < (PART_ORDER[cur.participationType] ?? 9)) vsMap.set(l.valueStream.id, { id: l.valueStream.id, name: l.valueStream.name, participationType: l.participationType }); }

    // Group metrics by KPI name → latest reading + history + status.
    const byName = new Map<string, { unit: string; target: number | null; direction: string; history: { period: string; value: number }[] }>();
    for (const m of metricRows) {
      if (!byName.has(m.name)) byName.set(m.name, { unit: m.unit, target: m.target, direction: m.direction, history: [] });
      byName.get(m.name)!.history.push({ period: m.period, value: m.value });
    }
    const metrics = [...byName.entries()].map(([name, m]) => {
      const latest = m.history[m.history.length - 1] ?? null;
      const onTarget = m.target == null || !latest ? null : m.direction === 'down' ? latest.value <= m.target : latest.value >= m.target;
      return { name, unit: m.unit, target: m.target, direction: m.direction, latest: latest?.value ?? null, latestPeriod: latest?.period ?? null, onTarget, history: m.history };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Digital-productivity signals → latest reading + history (illustrative).
    const sigByName = new Map<string, { unit: string; history: { period: string; value: number }[] }>();
    for (const s of signalRows) { if (!sigByName.has(s.name)) sigByName.set(s.name, { unit: s.unit, history: [] }); sigByName.get(s.name)!.history.push({ period: s.period, value: s.value }); }
    const SIGNAL_ORDER = ['Time online', 'GitHub activity', 'Team messages', 'Focus hours', 'Meetings'];
    const signals = [...sigByName.entries()].map(([name, s]) => {
      const latest = s.history[s.history.length - 1] ?? null;
      return { name, unit: s.unit, latest: latest?.value ?? null, latestPeriod: latest?.period ?? null, history: s.history };
    }).sort((a, b) => (SIGNAL_ORDER.indexOf(a.name) + 1 || 99) - (SIGNAL_ORDER.indexOf(b.name) + 1 || 99));

    res.json({
      person,
      signals,
      apps: appRows,
      assignments: assignments.map((a) => ({
        roleId: a.role.id, roleName: a.role.name, roleLevel: a.role.roleLevel,
        divisionId: a.role.division?.id ?? null, divisionName: a.role.division?.name ?? null,
        departmentId: a.role.department?.id ?? null, departmentName: a.role.department?.name ?? null,
        allocationPct: a.allocationPct, isPrimary: a.isPrimary, employmentType: a.employmentType,
      })),
      valueStreams: [...vsMap.values()].sort((a, b) => (PART_ORDER[a.participationType] ?? 9) - (PART_ORDER[b.participationType] ?? 9)),
      metrics,
    });
  } catch (e) { next(e); }
});

// ── Employee performance leaderboard for a role / department / division ──
// Ranks every person at the scope by a performance score: the average attainment
// of their KPI metrics vs target (latest month), 100 = exactly on target. Scope
// `role` ranks people within a single role (used by the role-detail performance
// graph); `department`/`division` aggregate across all roles at that level.
router.get('/leaderboard/:scope/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;
    const { scope, id } = req.params;
    if (scope !== 'department' && scope !== 'division' && scope !== 'role') return res.status(400).json({ error: 'bad scope' });
    const roles = await prisma.role.findMany({ where: scope === 'department' ? { departmentId: id, tenantId } : scope === 'division' ? { divisionId: id, tenantId } : { id, tenantId }, select: { id: true, name: true } });
    if (!roles.length) return res.json({ scope, count: 0, period: LATEST_PERIOD, people: [] });
    const roleName = new Map(roles.map((r) => [r.id, r.name]));

    const assignments = await prisma.assignment.findMany({
      where: { roleId: { in: roles.map((r) => r.id) } },
      orderBy: [{ isPrimary: 'desc' }],
      select: { roleId: true, person: { select: { id: true, name: true, region: true, employmentType: true, vendor: true } } },
    });
    const personMap = new Map<string, { id: string; name: string; region: string | null; employmentType: string; vendor: string | null; roleId: string }>();
    for (const a of assignments) if (!personMap.has(a.person.id)) personMap.set(a.person.id, { ...a.person, roleId: a.roleId });
    const personIds = [...personMap.keys()];

    const metricRows = await prisma.personMetric.findMany({ where: { personId: { in: personIds }, period: LATEST_PERIOD }, select: { personId: true, name: true, value: true, unit: true, target: true, direction: true } });
    const byPerson = new Map<string, typeof metricRows>();
    for (const m of metricRows) { const a = byPerson.get(m.personId) ?? []; a.push(m); byPerson.set(m.personId, a); }

    const people = personIds.map((pid) => {
      const ms = (byPerson.get(pid) ?? []).filter((m) => m.target != null && m.value > 0);
      let onTarget = 0; let best: { name: string; value: number; unit: string; pct: number } | null = null;
      const attains = ms.map((m) => {
        const ok = m.direction === 'down' ? m.value <= m.target! : m.value >= m.target!;
        if (ok) onTarget++;
        const at = Math.max(0, Math.min(1.5, m.direction === 'down' ? m.target! / m.value : m.value / m.target!));
        if (!best || at > best.pct) best = { name: m.name, value: m.value, unit: m.unit, pct: at };
        return at;
      });
      const score = attains.length ? Math.round((attains.reduce((a, b) => a + b, 0) / attains.length) * 100) : 0;
      const p = personMap.get(pid)!;
      return { id: pid, name: p.name, roleId: p.roleId, roleName: roleName.get(p.roleId) ?? null, region: p.region, employmentType: p.employmentType, vendor: p.vendor, score, onTarget, total: ms.length, topMetric: best };
    }).filter((p) => p.total > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    res.json({ scope, count: people.length, period: LATEST_PERIOD, people });
  } catch (e) { next(e); }
});

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
