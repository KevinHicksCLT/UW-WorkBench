import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from './format';

// ─── Home dashboard widget catalog ───────────────────────────────────────────
// The single source of truth for what the Home dashboard CAN show. Overview.tsx
// renders the widgets the active company has enabled (in order); DashboardAdmin
// (Data Admin → Home) lets an admin add / remove / reorder them. Every widget is
// fed by data the /dashboard rollup already returns, so adding an area to the
// catalog needs no backend change.

export type Group = { key: string; count: number };

export type Dashboard = {
  company: { id: string; name: string; count: number };
  layout: string[] | null; // chosen widget ids, in order; null → DEFAULT_LAYOUT
  footprintStats: string[] | null; // Model-footprint stat keys; null → FOOTPRINT_DEFAULT
  widgetTitles: Record<string, string> | null; // per-widget custom display titles
  totals: Record<string, number>;
  divisionsByCategory: Group[];
  workforce: { byType: Group[]; byRegion: Group[] };
  initiativesByStatus: Group[];
  initiativesByHealth: Group[];
  risksBySeverity: Group[];
  applicationsByKind: Group[];
  financials: { annualNetImpact: number; annualBenefit: number; annualAddedCost: number; oneTimeCost: number; appRunCost: number };
  topValueStreams: { id: string; name: string; domain: string | null; roles: number }[];
  topDivisions: { id: string; name: string; higherCategory: string | null; roles: number }[];
};

// Where an admin jumps to edit the data behind a widget (Data Admin tab/section).
export type WidgetSource = { tab: string; section?: string; label: string };

export type Widget = {
  id: string;
  title: string;
  desc: string; // shown in the configurator
  kind: 'tile' | 'card';
  source?: WidgetSource;
  render: (d: Dashboard) => ReactNode;
};

// ── Shared presentational pieces (also the building blocks of each widget) ──

function Tile({ label, value, hint, to }: { label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
      <div className="text-2xl font-semibold text-[#171717] mt-1 tnum">{value}</div>
      {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="card-elevated p-4 block h-full transition-colors hover:border-[#4f46e5] group">
        {body}
      </Link>
    );
  }
  return <div className="card-elevated p-4 h-full">{body}</div>;
}

// Horizontal bar list. Bars are scaled to the largest value in the set.
function BarList({ groups, color }: { groups: Group[]; color?: string | ((k: string) => string) }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const c = typeof color === 'function' ? color(g.key) : color ?? '#171717';
        return (
          <div key={g.key} className="flex items-center gap-3">
            <div className="w-32 text-xs text-[#525252] truncate flex-shrink-0">{g.key}</div>
            <div className="flex-1 h-5 bg-[#f5f5f5] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${(g.count / max) * 100}%`, backgroundColor: c, minWidth: g.count ? 2 : 0 }} />
            </div>
            <div className="w-10 text-right text-xs text-[#171717] tnum flex-shrink-0">{g.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ title, children, to, toLabel }: { title: string; children: ReactNode; to?: string; toLabel?: string }) {
  return (
    <div className="card-elevated p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        {to ? (
          <Link to={to} className="text-sm font-semibold text-[#171717] hover:text-[#4f46e5]">{title}</Link>
        ) : (
          <h2 className="text-sm font-semibold text-[#171717]">{title}</h2>
        )}
        {to && <Link to={to} className="text-xs text-[#525252] hover:text-[#171717]">{toLabel ?? 'View'} →</Link>}
      </div>
      {children}
    </div>
  );
}

// Workforce mix is presented in two buckets: badged headcount as "Employees",
// and contractors + SI partners merged into "Contingent Workers".
function workforceBuckets(byType: Group[]): Group[] {
  const count = (k: string) => byType.find((g) => g.key === k)?.count ?? 0;
  return [
    { key: 'Employees', count: count('badged') },
    { key: 'Contingent Workers', count: count('contractor') + count('si_partner') },
  ];
}

const HEALTH_COLOR = (k: string) => ({ Green: '#16a34a', Amber: '#d97706', Red: '#dc2626' }[k] ?? '#94a3b8');
const SEVERITY_COLOR = (k: string) => ({ Critical: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#65a30d' }[k] ?? '#94a3b8');

// ── Source shortcuts (reused across the count tiles of each area) ──
const SRC = {
  org: { tab: 'organization', section: 'divisions', label: 'Organization' },
  vs: { tab: 'valueStreams', section: 'levels', label: 'Value Streams' },
  initiatives: { tab: 'initiatives', section: 'workstreams', label: 'Workspace' },
  work: { tab: 'work', section: 'deliverables', label: 'Deliverables & Tasks' },
  people: { tab: 'people', section: 'people', label: 'People' },
  apps: { tab: 'telemetry', section: 'apps', label: 'Metrics' },
  metrics: { tab: 'telemetry', section: 'metrics', label: 'Metrics' },
  risks: { tab: 'initiatives', section: 'risks', label: 'Workspace' },
  scenarios: { tab: 'initiatives', section: 'scenarios', label: 'Workspace' },
} as const;

// Per-widget custom display title (Data Admin → Home → Edit on a widget row).
const wt = (d: Dashboard, id: string, def: string) => d.widgetTitles?.[id]?.trim() || def;

// Count-tile factory — every operating-model total is an addable headline tile.
const tile = (
  id: string,
  label: string,
  totalKey: string,
  opts: { hint?: (t: Record<string, number>) => string; to?: string; source?: WidgetSource } = {},
): Widget => ({
  id,
  title: `${label} tile`,
  desc: `Headline count of ${label.toLowerCase()}`,
  kind: 'tile',
  source: opts.source,
  render: (d) => <Tile label={wt(d, id, label)} value={d.totals[totalKey] ?? 0} hint={opts.hint?.(d.totals)} to={opts.to} />,
});

// ── The catalog ──
// The stats the "Model footprint" card can list — configurable per company in
// Data Admin → Home (saved to Company.dashboardConfig.footprintStats). These
// are deliberately NOT the headline-tile counts: the card surfaces the model's
// deeper connective tissue instead of repeating the tiles above it.
export const FOOTPRINT_STATS: Record<string, { key: string; label: string; to: string }> = {
  subProcesses: { key: 'subProcesses', label: 'Sub-processes', to: '/overview?view=list' },
  ioItems: { key: 'ioItems', label: 'Inputs & outputs', to: '/work' },
  externalParties: { key: 'externalParties', label: 'External parties', to: '/external' },
  externalInteractions: { key: 'externalInteractions', label: 'External interactions', to: '/external' },
  standards: { key: 'standards', label: 'Standards', to: '/standards' },
  programs: { key: 'programs', label: 'Programs', to: '/portfolio' },
  objectives: { key: 'objectives', label: 'Strategic objectives', to: '/portfolio' },
  openRaid: { key: 'openRaid', label: 'Open RAID items', to: '/portfolio' },
  connections: { key: 'connections', label: 'Model connections', to: '/overview' },
  signals: { key: 'signals', label: 'Trackable signals', to: '/metrics' },
};
export const FOOTPRINT_DEFAULT: string[] = ['subProcesses', 'ioItems', 'externalParties', 'standards'];

export const WIDGET_CATALOG: Widget[] = [
  // Headline count tiles
  tile('tile:divisions', 'Divisions', 'divisions', { hint: (t) => `${t.departments} departments`, to: '/roles', source: SRC.org }),
  tile('tile:roles', 'Roles', 'roles', { to: '/roles', source: SRC.org }),
  tile('tile:valueStreams', 'Value Streams', 'valueStreams', { hint: (t) => `${t.domains} domains`, to: '/overview', source: SRC.vs }),
  tile('tile:initiatives', 'Initiatives', 'initiatives', { to: '/portfolio', source: SRC.initiatives }),
  tile('tile:deliverables', 'Deliverables', 'deliverables', { to: '/work', source: SRC.work }),
  tile('tile:tasks', 'Tasks', 'tasks', { to: '/work', source: SRC.work }),
  tile('tile:people', 'People', 'people', { to: '/roles', source: SRC.people }),
  tile('tile:departments', 'Departments', 'departments', { to: '/roles?view=departments', source: SRC.org }),
  tile('tile:domains', 'Domains', 'domains', { to: '/overview', source: SRC.vs }),
  tile('tile:applications', 'Applications', 'applications', { to: '/portfolio', source: SRC.apps }),
  tile('tile:risks', 'Risks', 'risks', { to: '/portfolio', source: SRC.risks }),
  tile('tile:scenarios', 'Scenarios', 'scenarios', { to: '/portfolio', source: SRC.scenarios }),
  tile('tile:metrics', 'Metrics', 'metrics', { to: '/overview', source: SRC.metrics }),
  tile('tile:processSteps', 'Process Steps', 'processSteps', { to: '/overview?view=list', source: SRC.vs }),

  // Cards
  {
    id: 'card:workforce', title: 'Workforce mix', desc: 'People by employment type and region', kind: 'card', source: SRC.people,
    render: (d) => {
      const total = d.workforce.byType.reduce((a, g) => a + g.count, 0);
      return (
        <Card title={wt(d, 'card:workforce', 'Workforce mix')} to="/roles" toLabel="Roles">
          <div className="text-xs text-[#a3a3a3] mb-2 tnum">{fmt.number(total)} people</div>
          <BarList groups={workforceBuckets(d.workforce.byType)} color="#4f46e5" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-4 mb-2">By region</div>
          <BarList groups={d.workforce.byRegion} color="#0d9488" />
        </Card>
      );
    },
  },
  {
    id: 'card:modelFootprint', title: 'Model footprint', desc: 'Deeper model counts (sub-processes, I/O, standards…) — pick via its Edit', kind: 'card', source: SRC.vs,
    render: (d) => {
      const t = d.totals;
      // Saved keys from a retired catalog fall away; an empty pick = the default.
      const chosen = (d.footprintStats ?? FOOTPRINT_DEFAULT).filter((k) => FOOTPRINT_STATS[k]);
      const rows = (chosen.length ? chosen : FOOTPRINT_DEFAULT).map((k) => FOOTPRINT_STATS[k]);
      return (
        <Card title={wt(d, 'card:modelFootprint', 'Model footprint')}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {rows.map((s) => (
              <Link key={s.label} to={s.to} className="flex items-center justify-between border-b border-[#f5f5f5] pb-1 group">
                <span className="text-[#525252] group-hover:text-[#4f46e5]">{s.label}</span>
                <span className="text-[#171717] tnum">{t[s.key] ?? 0}</span>
              </Link>
            ))}
          </div>
        </Card>
      );
    },
  },
  {
    id: 'card:divisionsByCategory', title: 'Divisions by segment', desc: 'Division counts by CEO segment (Core Business / IT / Corporate)', kind: 'card', source: SRC.org,
    render: (d) => <Card title={wt(d, 'card:divisionsByCategory', 'Divisions by segment')} to="/roles" toLabel="Roles"><BarList groups={d.divisionsByCategory} color="#4f46e5" /></Card>,
  },
  {
    id: 'card:initiativesByStatus', title: 'Initiatives by status', desc: 'Portfolio initiatives grouped by status', kind: 'card', source: SRC.initiatives,
    render: (d) => <Card title={wt(d, 'card:initiativesByStatus', 'Initiatives by status')} to="/portfolio"><BarList groups={d.initiativesByStatus} color="#4f46e5" /></Card>,
  },
  {
    id: 'card:initiativesByHealth', title: 'Initiatives by health', desc: 'Initiatives RAG health (Green / Amber / Red)', kind: 'card', source: SRC.initiatives,
    render: (d) => <Card title={wt(d, 'card:initiativesByHealth', 'Initiatives by health')} to="/portfolio"><BarList groups={d.initiativesByHealth} color={HEALTH_COLOR} /></Card>,
  },
  {
    id: 'card:risksBySeverity', title: 'Risks by severity', desc: 'Open risks grouped by severity', kind: 'card', source: SRC.risks,
    render: (d) => <Card title={wt(d, 'card:risksBySeverity', 'Risks by severity')} to="/portfolio"><BarList groups={d.risksBySeverity} color={SEVERITY_COLOR} /></Card>,
  },
  {
    id: 'card:applicationsByKind', title: 'Applications by kind', desc: 'The application landscape grouped by kind', kind: 'card', source: SRC.apps,
    render: (d) => <Card title={wt(d, 'card:applicationsByKind', 'Applications by kind')} to="/portfolio"><BarList groups={d.applicationsByKind} color="#0d9488" /></Card>,
  },
  {
    id: 'card:financials', title: 'Financial impact', desc: 'Scenario economics — net impact, benefit, cost', kind: 'card', source: SRC.scenarios,
    render: (d) => {
      const f = d.financials;
      const rows: [string, number][] = [
        ['Annual net impact', f.annualNetImpact], ['Annual benefit', f.annualBenefit],
        ['Annual added cost', f.annualAddedCost], ['One-time cost', f.oneTimeCost], ['App run cost (TCO)', f.appRunCost],
      ];
      return (
        <Card title={wt(d, 'card:financials', 'Financial impact')} to="/portfolio">
          <div className="space-y-2 text-sm">
            {rows.map(([label, val]) => (
              <div key={label} className="flex items-center justify-between border-b border-[#f5f5f5] pb-1">
                <span className="text-[#525252]">{label}</span>
                <span className="text-[#171717] tnum">{fmt.currency(val, { compact: true })}</span>
              </div>
            ))}
          </div>
        </Card>
      );
    },
  },
  {
    id: 'card:topValueStreams', title: 'Top value streams', desc: 'Value streams ranked by participating roles', kind: 'card', source: SRC.vs,
    render: (d) => (
      <Card title={wt(d, 'card:topValueStreams', 'Top value streams')} to="/overview">
        <div className="space-y-2 text-sm">
          {d.topValueStreams.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b border-[#f5f5f5] pb-1">
              <span className="text-[#525252] truncate pr-3">{v.name}</span>
              <span className="text-[#171717] tnum flex-shrink-0">{v.roles}</span>
            </div>
          ))}
        </div>
      </Card>
    ),
  },
  {
    id: 'card:topDivisions', title: 'Top divisions', desc: 'Divisions ranked by number of roles', kind: 'card', source: SRC.org,
    render: (d) => (
      <Card title={wt(d, 'card:topDivisions', 'Top divisions')} to="/roles">
        <div className="space-y-2 text-sm">
          {d.topDivisions.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b border-[#f5f5f5] pb-1">
              <span className="text-[#525252] truncate pr-3">{v.name}</span>
              <span className="text-[#171717] tnum flex-shrink-0">{v.roles}</span>
            </div>
          ))}
        </div>
      </Card>
    ),
  },
];

export const WIDGET_MAP: Map<string, Widget> = new Map(WIDGET_CATALOG.map((w) => [w.id, w]));

// The out-of-the-box layout (mirrors the original fixed dashboard) used when a
// company has never configured one.
export const DEFAULT_LAYOUT: string[] = [
  'tile:divisions', 'tile:roles', 'tile:valueStreams', 'tile:initiatives', 'tile:deliverables', 'tile:tasks',
  'card:workforce', 'card:modelFootprint',
];

// Tailwind span for a widget within the 6-col responsive dashboard grid.
export const widgetSpan = (kind: Widget['kind']) =>
  kind === 'card' ? 'col-span-2 sm:col-span-3 lg:col-span-3' : 'col-span-1';
