/**
 * AI-adoption heat map + the telemetry signal catalog (KPIs, workforce, system signals).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';

import { activeCompany, processLevelMap } from './helpers.js';

/** Registers this feature's routes on the shared /explorer router (order preserved). */
export function registerTelemetryRoutes(router: Router): void {
const AI_LEVEL_INDEX: Record<string, number> = { not_used: 0, pilot: 1, emerging: 2, scaling: 3, embedded: 4 };
router.get('/value-stream-adoption', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });
    const { idOf } = await processLevelMap(company.id);
    const l2 = idOf(2), l5 = idOf(5);
    const nodes = l2 ? await prisma.processNode.findMany({
      where: { companyId: company.id, processLevelTypeId: l2 },
      orderBy: { displayValue: 'asc' },
      select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
    }) : [];
    const idx = (v: string | undefined) => AI_LEVEL_INDEX[v ?? 'not_used'] ?? 0;
    // Roll the heat-map up from the value stream's L5 tasks: each cell is the mean
    // adoption level (0-4) across the tasks' NodeAiAdoption for that AI mode.
    const all = await prisma.processNode.findMany({ where: { companyId: company.id }, select: { id: true, parentId: true, processLevelTypeId: true } });
    const map = new Map(all.map((n) => [n.id, n]));
    const vsOf = (id: string): string | null => { // nearest L2 ancestor
      let cur = map.get(id);
      while (cur) {
        if (cur.processLevelTypeId === l2) return cur.id;
        cur = cur.parentId ? map.get(cur.parentId) : undefined;
      }
      return null;
    };
    const adopt = await prisma.nodeAiAdoption.findMany({
      where: { processNode: { companyId: company.id, processLevelTypeId: l5 ?? undefined } },
      select: { processNodeId: true, aiAssist: true, aiAugment: true, aiWorkflow: true, aiAutonomous: true },
    });
    const agg = new Map<string, { sum: number[]; n: number }>();
    for (const a of adopt) {
      const vs = vsOf(a.processNodeId); if (!vs) continue;
      const e = agg.get(vs) ?? { sum: [0, 0, 0, 0], n: 0 };
      e.sum[0] += idx(a.aiAssist); e.sum[1] += idx(a.aiAugment); e.sum[2] += idx(a.aiWorkflow); e.sum[3] += idx(a.aiAutonomous); e.n++;
      agg.set(vs, e);
    }
    res.json({
      valueStreams: nodes.map((n) => {
        const e = agg.get(n.id);
        const cells = e && e.n ? e.sum.map((s) => Math.round(s / e.n)) : [0, 0, 0, 0];
        return { id: n.id, name: n.displayValue, domain: n.parent?.displayValue ?? null, cells, useCases: null, stats: null };
      }),
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
  // This split regex shapes the response's sourceTokens — a rewrite risks
  // changing bodies, so the (bounded, small-input) pattern is kept as-is.
  // eslint-disable-next-line sonarjs/super-linear-regex -- behavior-frozen refactor; safe rewrite deferred
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
          id: true, name: true, unit: true, kind: true, period: true, value: true,
          processNode: { select: { id: true, displayValue: true, parent: { select: { displayValue: true } } } },
          role: { select: { id: true, displayValue: true } },
          orgUnit: { select: { id: true } },
          application: { select: { id: true } },
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
    // Metric carries no category/target/level columns; derive them for display:
    //   category    ← the metric's value-stream domain (its grouping)
    //   tracked-at  ← the spine its target FK points at
    //   target      ← a 10% stretch on the current value (illustrative goal)
    const goal = (v: number | null, u: string | null): string | null =>
      v == null ? null : `${v % 1 === 0 ? Math.round(v * 1.1) : +(v * 1.1).toFixed(1)}${u && !/^count$/i.test(u) ? ` ${u}` : ''}`;
    const trackedAt = (m: typeof metrics[number]): string[] =>
      [m.processNode ? 'Value stream' : m.orgUnit ? 'Division' : m.application ? 'System' : 'Individual'];
    const kpis: Signal[] = metrics.map((m) => ({
      id: m.id, kind: m.kind === 'system' ? 'system' : 'kpi', name: m.name, description: null,
      source: null, category: m.processNode?.parent?.displayValue ?? (m.kind === 'system' ? 'System health' : 'Operational'), framework: null, frequency: m.period ?? 'Monthly',
      unit: m.unit, direction: 'up', target: goal(m.value, m.unit),
      levels: trackedAt(m), roleDrill: !!m.role,
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
}
