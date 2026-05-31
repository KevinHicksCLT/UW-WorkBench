import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DrillNodeType } from '../viz/nodes/DrillNode';
import { Card, StatRow, Donut, AttainmentBars, KpiBars, SeverityBars, CategoryBars, FlowStrip, IoMix, EMP_COLOR, REGION_COLOR, HEALTH_COLOR } from '../viz/charts';

const TYPE_LABEL: Record<DrillNodeType, string> = {
  company: 'Company', domain: 'Value-stream domain', division: 'Division', department: 'Department', valueStream: 'Value stream',
  subValueStream: 'Sub-value stream', application: 'Application', initiative: 'Initiative', role: 'Role', person: 'Person', task: 'Task', processStep: 'Process step',
};
const DETAIL_ROUTE: Partial<Record<DrillNodeType, string>> = { role: '/roles', valueStream: '/value-streams', division: '/divisions', department: '/departments' };
type Drill = (i: { type: DrillNodeType; id: string; name: string }) => void;

export default function Inspector({ node, loading, error, onDrill }: { node: any | null; loading: boolean; error: string; onDrill: Drill }) {
  if (loading) return <PanelSkeleton />;
  if (error) return <div className="text-red-600 text-sm p-5">{error}</div>;
  if (!node) return <div className="h-full flex items-center justify-center text-center text-sm text-slate-400 p-6">Select any node for an at-a-glance read on its people, work, flow, systems, risks, and performance.</div>;

  const detail = DETAIL_ROUTE[node.type as DrillNodeType];
  return (
    <div className="space-y-3 p-1 animate-fade-in">
      <div className="px-1">
        <div className="flex items-center gap-2">
          <div className="text-eyebrow uppercase text-accent-600 flex-1">{TYPE_LABEL[node.type as DrillNodeType] ?? node.type}</div>
          {node.illustrative && <span className="illustrative-badge">Illustrative</span>}
        </div>
        <h2 className="text-h2 text-slate-900 leading-tight mt-0.5">{node.name}</h2>
        {node.subtitle && <div className="text-sm text-slate-400 mt-0.5">{node.subtitle}</div>}
        {detail && <Link to={`${detail}/${node.id}`} className="inline-block mt-1.5 text-xs text-accent-600 hover:text-accent-700 hover:underline">Open full detail page ↗</Link>}
      </div>
      {cards(node, onDrill)}
    </div>
  );
}

function cards(node: any, onDrill: Drill): ReactNode {
  const L = node.lenses ?? {};
  const out: ReactNode[] = [];
  const push = (k: string, el: ReactNode) => out.push(<div key={k}>{el}</div>);

  const workforce = (hc: any, title = 'Workforce') => hc && hc.total ? (
    <Card title={title}>
      <Donut center={hc.total} sub="people" data={[{ name: 'Employees', value: hc.badged, color: EMP_COLOR.badged }, { name: 'Contractors', value: hc.contractor, color: EMP_COLOR.contractor }, { name: 'SI partners', value: hc.si_partner, color: EMP_COLOR.si_partner }]} />
      {(hc.Offshore || hc.Nearshore || hc.Onshore) ? (
        <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-slate-100" title="Location mix">
          {(['Onshore', 'Nearshore', 'Offshore'] as const).map((r) => hc[r] ? <span key={r} style={{ width: `${(hc[r] / hc.total) * 100}%`, background: REGION_COLOR[r] }} /> : null)}
        </div>
      ) : null}
      {(hc.Offshore || hc.Nearshore) ? (
        <div className="mt-1 flex flex-wrap gap-2">{(['Onshore', 'Nearshore', 'Offshore'] as const).map((r) => hc[r] ? <span key={r} className="inline-flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: REGION_COLOR[r] }} />{hc[r]} {r}</span> : null)}</div>
      ) : null}
    </Card>
  ) : null;

  const kpiAttainment = () => L.howWell?.attainment?.measured ? (
    <Card title="KPI attainment" hint={`${L.howWell.attainment.onTarget} of ${L.howWell.attainment.measured} measured KPIs on target`} illustrative>
      <AttainmentBars data={L.howWell.attainment.byCategory} />
    </Card>
  ) : null;
  const kpiBars = () => Array.isArray(L.howWell?.metrics) && L.howWell.metrics.length ? (
    <Card title="Key metrics vs target" illustrative><KpiBars metrics={L.howWell.metrics} /></Card>
  ) : null;
  const risk = () => L.why?.bySeverity?.some?.((s: any) => s.count) ? (
    <Card title="Risk profile" hint={`${L.why.risks ?? ''} open risks`}><SeverityBars bySeverity={L.why.bySeverity} /></Card>
  ) : null;
  const systems = () => Array.isArray(L.where?.applications) && L.where.applications.length ? (
    <Card title="Systems & data" illustrative>
      <div className="space-y-1">{L.where.applications.slice(0, 8).map((a: any) => (
        <button key={a.id} onClick={() => onDrill({ type: 'application', id: a.id, name: a.name })} className="drill-row">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.criticality === 'High' ? '#ef4444' : a.criticality === 'Medium' ? '#f59e0b' : '#10b981' }} />
          <span className="truncate flex-1 font-medium">{a.name}</span>
          {a.systemRole && <span className="chip-soft flex-shrink-0 font-normal">{a.systemRole}</span>}
          <span className="drill-chev">›</span>
        </button>))}</div>
    </Card>
  ) : null;
  const categories = (data: any) => Array.isArray(data) && data.length ? (
    <Card title="Work focus" hint="readiness items by category"><CategoryBars data={data} /></Card>
  ) : null;
  const flow = () => Array.isArray(L.how?.steps) && L.how.steps.length ? (
    <Card title={`Process flow · ${L.how.steps.length} steps`}><FlowStrip steps={L.how.steps} /></Card>
  ) : null;
  const refList = (title: string, items: any[], type: DrillNodeType, opts: { dot?: (i: any) => string | undefined; suffix?: (i: any) => any } = {}) => items?.length ? (
    <Card title={title}>
      <div className="space-y-0.5">{items.slice(0, 10).map((r: any, i: number) => (
        <button key={r.id ?? i} onClick={() => r.id && onDrill({ type, id: r.id, name: r.name })} disabled={!r.id} className="drill-row">
          {opts.dot?.(r) && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: opts.dot(r) }} />}
          <span className="truncate flex-1 font-medium">{r.name}</span>
          {opts.suffix?.(r) && <span className="chip-soft flex-shrink-0 font-normal">{opts.suffix(r)}</span>}
          <span className="drill-chev">›</span>
        </button>))}{items.length > 10 && <div className="text-xs text-slate-400 px-1.5">+{items.length - 10} more</div>}</div>
    </Card>
  ) : null;

  switch (node.type) {
    case 'company':
      push('wf', workforce(L.who?.headcount, 'Workforce'));
      push('ops', <Card title="Operating model"><StatRow items={[{ value: L.what?.domains ?? 0, label: 'domains' }, { value: L.what?.valueStreams ?? 0, label: 'value streams' }, { value: L.how?.processSteps ?? 0, label: 'process steps' }, { value: L.what?.kpis ?? 0, label: 'KPIs' }]} /></Card>);
      push('kpi', kpiAttainment());
      push('init', Array.isArray(L.howWell?.initiatives) && L.howWell.initiatives.length ? <Card title="Initiative health"><div className="flex flex-wrap gap-2">{L.howWell.initiatives.map((x: any) => <span key={x.health} className="inline-flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: HEALTH_COLOR[x.health] }} />{x.count} {x.health}</span>)}</div></Card> : null);
      push('risk', risk());
      push('sys', L.where?.systems ? <Card title="Systems landscape" illustrative><StatRow items={[{ value: L.where.systems, label: 'systems' }, ...(L.where.byKind ?? []).slice(0, 3).map((k: any) => ({ value: k.count, label: k.kind }))]} /></Card> : null);
      break;
    case 'domain':
      push('wf', workforce(L.who?.headcount));
      push('ops', <Card title="Coverage"><StatRow items={[{ value: L.what?.valueStreams ?? 0, label: 'value streams' }, { value: L.how?.processSteps ?? 0, label: 'process steps' }, { value: L.what?.io?.total ?? 0, label: 'inputs/outputs' }, { value: L.what?.kpis ?? 0, label: 'KPIs' }]} /></Card>);
      push('kpi', kpiAttainment());
      push('kpibars', kpiBars());
      push('io', L.what?.io?.total ? <Card title="Inputs & outputs"><IoMix io={L.what.io} /></Card> : null);
      push('sys', systems());
      push('risk', risk());
      break;
    case 'division':
    case 'department':
      push('wf', workforce(L.who?.headcount));
      push('lead', refList('Leadership', L.who?.leaders ?? [], 'role'));
      push('cat', categories(L.what?.categories));
      push('vs', refList('Value streams', L.how?.valueStreams ?? [], 'valueStream', { suffix: (r) => r.participationType }));
      push('kpi', kpiAttainment());
      push('sys', systems());
      push('risk', risk());
      push('std', Array.isArray(L.why?.standards) && L.why.standards.length ? <Card title="Standards & governance"><div className="space-y-1">{L.why.standards.slice(0, 6).map((s: any, i: number) => <div key={i} className="flex items-center justify-between text-[11px]"><span className="text-slate-600 truncate">{s.department}</span><span className="tnum text-slate-800">{s.count}{s.charterIncluded ? ' · charter' : ''}</span></div>)}</div></Card> : null);
      break;
    case 'valueStream':
      push('kpibars', kpiBars());
      push('kpi', kpiAttainment());
      push('flow', flow());
      push('io', L.what?.io?.total ? <Card title="Inputs & outputs"><IoMix io={L.what.io} /></Card> : null);
      push('roles', refList('Who runs it', L.who?.roles ?? [], 'role', { suffix: (r) => r.participationType }));
      push('init', refList('Initiatives', L.how?.initiatives ?? [], 'initiative', { dot: (i) => HEALTH_COLOR[i.health] }));
      push('sys', systems());
      push('risk', risk());
      break;
    case 'subValueStream':
      push('flow', flow());
      push('io', L.what?.io?.total ? <Card title="Inputs & outputs"><IoMix io={L.what.io} /></Card> : null);
      push('detail', (L.how?.inputs || L.how?.outputs) ? <Card title="Flow"><KeyVals rows={[['Inputs', L.how.inputs], ['Outputs', L.how.outputs], ['Upstream', L.how.upstream], ['Downstream', L.how.downstream]]} /></Card> : null);
      break;
    case 'processStep':
      push('roles', <Card title="Who runs it"><KeyVals rows={[['Lead', L.who?.leads], ['Supporting', L.who?.supporting], ['External', L.where?.externalParticipants]]} /></Card>);
      push('flow', <Card title="Inputs → outputs"><KeyVals rows={[['Inputs', L.how?.inputs], ['Outputs', L.how?.outputs]]} />{L.how?.description && <p className="text-xs text-slate-500 mt-2">{L.how.description}</p>}</Card>);
      break;
    case 'role':
      push('wf', workforce(L.who?.headcount, 'People in role'));
      push('rep', (L.who?.manager || L.who?.directReports) ? <Card title="Reporting"><div className="space-y-1.5">{L.who.manager && <button onClick={() => onDrill({ type: 'role', id: L.who.manager.id, name: L.who.manager.name })} className="drill-row"><span className="text-slate-400">↑ Reports to</span><span className="flex-1 font-medium">{L.who.manager.name}</span><span className="drill-chev">›</span></button>}<StatRow items={[{ value: L.who.directReports ?? 0, label: 'direct reports' }, { value: L.what?.kpisOwned ?? 0, label: 'KPIs owned' }, { value: L.what?.roleTasks ?? 0, label: 'role tasks' }]} /></div></Card> : null);
      push('cat', categories(L.what?.categories));
      push('vs', refList('Value streams', L.how?.valueStreams ?? [], 'valueStream', { suffix: (r) => r.participationType }));
      push('perf', Array.isArray(L.howWell?.metrics) && L.howWell.metrics.length ? <Card title="Team performance" illustrative><KpiBars metrics={L.howWell.metrics.map((m: any) => ({ ...m }))} /></Card> : null);
      push('sys', systems());
      push('resp', L.what?.responsibilities ? <Card title="Responsibilities"><p className="text-xs text-slate-600">{L.what.responsibilities}</p></Card> : null);
      break;
    case 'person':
      push('id', <Card title="Profile"><KeyVals rows={[['Type', L.who?.employmentType], ['Vendor', L.who?.vendor], ['Region', L.who?.region], ['Location', L.who?.location], ['Title', L.who?.title]]} /></Card>);
      push('tasks', Array.isArray(L.what?.tasksByStatus) && L.what.tasksByStatus.length ? <Card title="Current work"><Donut center={L.what.tasksByStatus.reduce((a: number, s: any) => a + s.count, 0)} sub="tasks" data={L.what.tasksByStatus.map((s: any) => ({ name: s.status, value: s.count, color: s.status === 'Done' ? '#10b981' : s.status === 'Blocked' ? '#ef4444' : s.status === 'In Progress' ? '#3a5ff0' : '#94a3b8' }))} /></Card> : null);
      push('perf', Array.isArray(L.howWell?.latest) && L.howWell.latest.length ? <Card title="Latest performance" illustrative><MetricsGrid metrics={L.howWell.latest} /></Card> : null);
      push('vs', refList('Value streams', L.how?.valueStreams ?? [], 'valueStream'));
      break;
    case 'initiative':
      push('wf', workforce(L.who?.headcount, 'Contributors'));
      push('meta', <Card title="Delivery"><StatRow items={[{ value: L.what?.stage ?? '—', label: 'stage' }, { value: L.howWell?.health ?? '—', label: 'health', tone: HEALTH_COLOR[L.howWell?.health] }, { value: L.what?.budget ? `$${Math.round(L.what.budget / 1e6)}M` : '—', label: 'budget' }]} /></Card>);
      push('vs', refList('Value streams', L.what?.valueStreams ?? [], 'valueStream'));
      push('risk', risk());
      push('perf', Array.isArray(L.howWell?.metrics) && L.howWell.metrics.length ? <Card title="Contributor performance" illustrative><KpiBars metrics={L.howWell.metrics} /></Card> : null);
      break;
    case 'application':
      push('meta', <Card title="System"><KeyVals rows={[['Kind', L.where?.kind], ['Vendor', L.where?.vendor], ['Criticality', L.where?.criticality], ['Category', L.what?.category]]} /></Card>);
      push('sr', Array.isArray(L.how?.systemRoles) && L.how.systemRoles.length ? <Card title="Used in value streams"><div className="space-y-1">{L.how.systemRoles.map((s: any, i: number) => <div key={i} className="flex justify-between text-[11px]"><span className="text-slate-600 truncate">{s.stream}</span><span className="chip-soft">{s.role}</span></div>)}</div></Card> : null);
      break;
    case 'task':
      push('meta', <Card title="Task"><KeyVals rows={[['Status', L.what?.status], ['Assignee', L.who?.assignee?.name]]} /></Card>);
      break;
  }
  return <div className="space-y-3">{out.filter((c: any) => c && c.props.children)}</div>;
}

function KeyVals({ rows }: { rows: [string, any][] }) {
  const real = rows.filter(([, v]) => v != null && v !== '');
  if (!real.length) return <div className="text-xs text-slate-300">—</div>;
  return <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">{real.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-400">{k}</dt><dd className="text-slate-700">{String(v)}</dd></div>)}</dl>;
}
function MetricsGrid({ metrics }: { metrics: any[] }) {
  return <div className="grid grid-cols-2 gap-2">{metrics.map((m, i) => {
    const good = m.target == null ? null : m.direction === 'down' ? m.value <= m.target : m.value >= m.target;
    return <div key={i} className="metric-tile"><div className="text-[10px] uppercase tracking-wide text-slate-400 truncate">{m.name}</div><div className="text-base font-bold text-slate-900 tnum">{m.value}<span className="text-xs font-medium text-slate-400 ml-0.5">{m.unit}</span></div>{m.target != null && <div className={`text-[10px] ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{good ? '✓' : '▲'} target {m.target}{m.unit}</div>}</div>;
  })}</div>;
}
function PanelSkeleton() {
  return <div className="space-y-3 p-1"><div className="px-1 space-y-2"><div className="skeleton h-3 w-24" /><div className="skeleton h-5 w-40" /></div>{[0, 1, 2].map((i) => <div key={i} className="lens-card space-y-2"><div className="skeleton h-3 w-24" /><div className="skeleton h-16 w-full" /></div>)}</div>;
}
