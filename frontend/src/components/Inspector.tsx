import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DrillNodeType } from '../viz/nodes/DrillNode';
import { DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT } from '../viz/nodes/DrillNode';
import { Card, StatRow, Donut, Placeholder, SeverityBars, CategoryBars, FlowStrip, IoMix, EMP_COLOR, REGION_COLOR, HEALTH_COLOR } from '../viz/charts';

const TYPE_LABEL: Record<DrillNodeType, string> = {
  company: 'Company', domain: 'Value-stream domain', division: 'Division', department: 'Department', valueStream: 'Value stream',
  subValueStream: 'Sub-value stream', application: 'Application', initiative: 'Initiative', role: 'Role', person: 'Person', task: 'Task', processStep: 'Process step',
};
const DETAIL_ROUTE: Partial<Record<DrillNodeType, string>> = { role: '/roles', valueStream: '/value-streams', division: '/divisions', department: '/departments' };
type Drill = (i: { type: DrillNodeType; id: string; name: string }) => void;

// Participation type colors — match the node-level encoding.
const PART_TONE: Record<string, string> = {
  Lead: 'bg-domain-core-50 text-domain-core-700 border-domain-core-200',
  Core: 'bg-accent-50 text-accent-700 border-accent-200',
  Control: 'bg-overlap-50 text-overlap-700 border-overlap-200',
  Oversight: 'bg-slate-100 text-slate-600 border-slate-200',
  Support: 'bg-slate-100 text-slate-400 border-slate-200',
};

export default function Inspector({ node, loading, error, onDrill }: { node: any | null; loading: boolean; error: string; onDrill: Drill }) {
  if (loading) return <PanelSkeleton />;
  if (error) return <div className="text-red-600 text-sm p-5">{error}</div>;
  if (!node) return (
    <div className="h-full flex items-center justify-center text-center text-sm text-slate-400 p-6">
      Select any node for an at-a-glance read on its people, work, flow, systems, risks, and performance.
    </div>
  );

  const detail = DETAIL_ROUTE[node.type as DrillNodeType];
  const domainColor = node.higherCategory ? DOMAIN_HEX[node.higherCategory] : undefined;
  const domainBg = node.higherCategory ? DOMAIN_BG[node.higherCategory] : undefined;
  const domainBorder = node.higherCategory ? DOMAIN_BORDER[node.higherCategory] : undefined;
  const domainText = node.higherCategory ? DOMAIN_TEXT[node.higherCategory] : undefined;

  return (
    <div className="space-y-3 p-1 animate-fade-in">
      <div className="px-1">
        <div className="flex items-center gap-2">
          <div className="text-eyebrow uppercase text-accent-600 flex-1">{TYPE_LABEL[node.type as DrillNodeType] ?? node.type}</div>
          {node.illustrative && <span className="illustrative-badge">Illustrative</span>}
        </div>
        <h2 className="text-h2 text-slate-900 leading-tight mt-0.5">{node.name}</h2>
        {node.subtitle && <div className="text-sm text-slate-400 mt-0.5">{node.subtitle}</div>}

        {/* Domain attribution strip — shown for division and department */}
        {node.higherCategory && domainColor && domainBg && domainBorder && domainText && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border text-[11px] font-semibold"
            style={{ background: domainBg, borderColor: domainBorder, color: domainText }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: domainColor }} />
            {node.higherCategory}
          </div>
        )}

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
    <Card title={title} illustrative>
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

  const trackedKpis = () => {
    const defs = (Array.isArray(L.howWell?.metrics) ? L.howWell.metrics : []).filter((m: any) => m.targetText);
    if (defs.length) return <Card title="Tracked KPIs"><Placeholder note="Live readings connect via a data source." items={defs.map((m: any) => ({ name: m.name, target: m.targetText }))} /></Card>;
    if (L.howWell?.attainment?.total || L.what?.kpis) return <Card title="Performance"><Placeholder note="KPIs are defined here; live readings aren't connected yet." /></Card>;
    return null;
  };
  const perf = (title = 'Performance') => <Card title={title}><Placeholder note="Metrics aren't connected to a live source yet." /></Card>;
  const risk = () => L.why?.bySeverity?.some?.((s: any) => s.count) ? (
    <Card title="Risk profile" hint={`${L.why.risks ?? ''} open risks`} illustrative><SeverityBars bySeverity={L.why.bySeverity} /></Card>
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

  // Value-stream list with participation-type chip encoding.
  // Participation type is an honest data point (Lead / Core / Control / Oversight / Support).
  const valueStreamList = (streams: any[], title = 'Value streams') => streams?.length ? (
    <Card title={title}>
      <div className="space-y-0.5">
        {streams.slice(0, 10).map((r: any, i: number) => (
          <button
            key={r.id ?? i}
            onClick={() => r.id && onDrill({ type: 'valueStream', id: r.id, name: r.name })}
            disabled={!r.id}
            className="drill-row"
          >
            <span className="truncate flex-1 font-medium">{r.name}</span>
            {r.participationType && (
              <span className={`chip border flex-shrink-0 ${PART_TONE[r.participationType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {r.participationType}
              </span>
            )}
            <span className="drill-chev">›</span>
          </button>
        ))}
        {streams.length > 10 && <div className="text-xs text-slate-400 px-1.5">+{streams.length - 10} more</div>}
      </div>
      {/* Overlap signal: if this org unit participates in value streams as both Lead
          and Support (cross-cutting) that is an honest overlap indicator. */}
      {(() => {
        const leads = streams.filter((s: any) => s.participationType === 'Lead').length;
        const control = streams.filter((s: any) => s.participationType === 'Control' || s.participationType === 'Oversight').length;
        if (leads > 0 && control > 0) {
          return (
            <div className="callout-overlap mt-2">
              <span className="dot-overlap flex-shrink-0 mt-0.5" />
              <span>Leads {leads} stream{leads !== 1 ? 's' : ''} and has control/oversight on {control} — dual accountability exists.</span>
            </div>
          );
        }
        return null;
      })()}
    </Card>
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
      push('kpi', trackedKpis());
      push('init', Array.isArray(L.howWell?.initiatives) && L.howWell.initiatives.length ? <Card title="Initiative health" illustrative><div className="flex flex-wrap gap-2">{L.howWell.initiatives.map((x: any) => <span key={x.health} className="inline-flex items-center gap-1 text-[11px] text-slate-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: HEALTH_COLOR[x.health] }} />{x.count} {x.health}</span>)}</div></Card> : null);
      push('risk', risk());
      push('sys', L.where?.systems ? <Card title="Systems landscape" illustrative><StatRow items={[{ value: L.where.systems, label: 'systems' }, ...(L.where.byKind ?? []).slice(0, 3).map((k: any) => ({ value: k.count, label: k.kind }))]} /></Card> : null);
      push('overlaps', (() => {
        const overlaps: any[] = Array.isArray(node.capabilityOverlaps) ? node.capabilityOverlaps : [];
        if (!overlaps.length) return null;
        return (
          <Card title="Capability overlaps across divisions">
            <div className="callout-overlap mb-3">
              <span className="dot-overlap flex-shrink-0 mt-0.5" />
              <span>{overlaps.length} capability {overlaps.length === 1 ? 'type' : 'types'} duplicated across multiple divisions — consolidation opportunity.</span>
            </div>
            <div className="space-y-2">
              {overlaps.map((o: any, i: number) => (
                <div key={i} className="rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-slate-800 truncate">{o.capability}</span>
                    <span className="chip-overlap flex-shrink-0">{o.count} divisions</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(o.divisions as any[]).map((d: any) => (
                      <button
                        key={d.id}
                        onClick={() => onDrill({ type: 'division', id: d.id, name: d.name })}
                        className="chip border border-overlap-200 bg-overlap-50 text-overlap-800 hover:bg-overlap-100 transition-colors"
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })());
      break;
    case 'domain':
      push('wf', workforce(L.who?.headcount));
      push('ops', <Card title="Coverage"><StatRow items={[{ value: L.what?.valueStreams ?? 0, label: 'value streams' }, { value: L.how?.processSteps ?? 0, label: 'process steps' }, { value: L.what?.io?.total ?? 0, label: 'inputs/outputs' }, { value: L.what?.kpis ?? 0, label: 'KPIs' }]} /></Card>);
      push('kpi', trackedKpis());
      push('io', L.what?.io?.total ? <Card title="Inputs & outputs"><IoMix io={L.what.io} /></Card> : null);
      push('sys', systems());
      push('risk', risk());
      break;
    case 'division':
    case 'department':
      push('wf', workforce(L.who?.headcount));
      push('lead', refList('Leadership', L.who?.leaders ?? [], 'role'));
      push('cat', categories(L.what?.categories));
      // Value streams with participation-type chips and honest overlap callout.
      push('vs', valueStreamList(L.how?.valueStreams ?? []));
      push('kpi', trackedKpis());
      push('sys', systems());
      push('risk', risk());
      push('std', Array.isArray(L.why?.standards) && L.why.standards.length ? <Card title="Standards & governance"><div className="space-y-1">{L.why.standards.slice(0, 6).map((s: any, i: number) => <div key={i} className="flex items-center justify-between text-[11px]"><span className="text-slate-600 truncate">{s.department}</span><span className="tnum text-slate-800">{s.count}{s.charterIncluded ? ' · charter' : ''}</span></div>)}</div></Card> : null);
      break;
    case 'valueStream':
      push('kpi', trackedKpis());
      push('flow', flow());
      push('io', L.what?.io?.total ? <Card title="Inputs & outputs"><IoMix io={L.what.io} /></Card> : null);
      push('gaps', (() => {
        const gaps: number = L.how?.ownershipGaps ?? 0;
        if (!gaps) return null;
        return (
          <div className="callout-loss">
            <span className="dot-loss flex-shrink-0 mt-0.5" />
            <span>{gaps} process {gaps === 1 ? 'area has' : 'areas have'} no owning role — accountability gap.</span>
          </div>
        );
      })());
      push('processAreas', (() => {
        // Surface the per-process-area ownership status from the node's children list.
        // children is not in lenses; it lives on node.children.items.
        const childItems: any[] = Array.isArray(node.children?.items) ? node.children.items : [];
        const l3s = childItems.filter((c: any) => c.type === 'subValueStream');
        if (!l3s.length) return null;
        const unowned = l3s.filter((c: any) => c.hasOwner === false);
        if (!unowned.length) return null;
        return (
          <Card title="Unowned process areas">
            <div className="space-y-0.5">
              {unowned.map((c: any, i: number) => (
                <button
                  key={c.id ?? i}
                  onClick={() => c.id && onDrill({ type: 'subValueStream', id: c.id, name: c.name })}
                  disabled={!c.id}
                  className="drill-row"
                >
                  <span className="dot-loss flex-shrink-0" />
                  <span className="truncate flex-1 font-medium">{c.name}</span>
                  <span className="chip-loss flex-shrink-0">No owner</span>
                  <span className="drill-chev">›</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })());
      // Who runs it — with participation type chip encoding.
      push('roles', L.who?.roles?.length ? (
        <Card title="Who runs it">
          <div className="space-y-0.5">
            {(L.who.roles as any[]).slice(0, 10).map((r: any, i: number) => (
              <button key={r.id ?? i} onClick={() => r.id && onDrill({ type: 'role', id: r.id, name: r.name })} disabled={!r.id} className="drill-row">
                <span className="truncate flex-1 font-medium">{r.name}</span>
                {r.participationType && (
                  <span className={`chip border flex-shrink-0 ${PART_TONE[r.participationType] ?? 'chip-soft'}`}>
                    {r.participationType}
                  </span>
                )}
                <span className="drill-chev">›</span>
              </button>
            ))}
            {L.who.roles.length > 10 && <div className="text-xs text-slate-400 px-1.5">+{L.who.roles.length - 10} more</div>}
          </div>
          {/* Gap signal: if there are sub-value-streams but no Lead role, flag it. */}
          {(() => {
            const hasLead = (L.who.roles as any[]).some((r: any) => r.participationType === 'Lead');
            if (!hasLead && L.who.roles.length > 0) {
              return (
                <div className="callout-loss mt-2">
                  <span className="dot-loss flex-shrink-0 mt-0.5" />
                  <span>No Lead role mapped — ownership accountability is unclear.</span>
                </div>
              );
            }
            return null;
          })()}
        </Card>
      ) : null);
      push('init', refList('Initiatives', L.how?.initiatives ?? [], 'initiative', { dot: (i) => HEALTH_COLOR[i.health] }));
      push('sys', systems());
      push('risk', risk());
      break;
    case 'subValueStream':
      push('ownership', (() => {
        const hasOwner: boolean = node.hasOwner ?? true;
        const roleLinkCount: number = node.roleLinkCount ?? 0;
        if (hasOwner) return null;
        return (
          <div className="callout-loss">
            <span className="dot-loss flex-shrink-0 mt-0.5" />
            <span>
              No owning role mapped to this process area
              {roleLinkCount === 0 ? ' — accountability gap.' : `.`}
              {' '}Assign a Lead or Core role to close the gap.
            </span>
          </div>
        );
      })());
      push('flow', flow());
      push('orgs', (() => {
        const roles: any[] = L.who?.rolesInvolved ?? [];
        const hasOwner: boolean = node.hasOwner ?? true;
        if (!roles.length && !hasOwner) {
          return (
            <Card title="Roles involved">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="dot-loss" />
                <span>No roles mapped — this process area is unowned.</span>
              </div>
            </Card>
          );
        }
        return refList('Roles involved', roles, 'role');
      })());
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
      // Value streams with participation-type encoding + overlap/gap callouts.
      push('vs', valueStreamList(L.how?.valueStreams ?? []));
      push('perf', perf('Team performance'));
      push('sys', systems());
      push('resp', L.what?.responsibilities ? <Card title="Responsibilities"><p className="text-xs text-slate-600">{L.what.responsibilities}</p></Card> : null);
      break;
    case 'person':
      push('id', <Card title="Profile"><KeyVals rows={[['Type', L.who?.employmentType], ['Vendor', L.who?.vendor], ['Region', L.who?.region], ['Location', L.who?.location], ['Title', L.who?.title]]} /></Card>);
      push('tasks', Array.isArray(L.what?.tasksByStatus) && L.what.tasksByStatus.length ? <Card title="Current work" illustrative><Donut center={L.what.tasksByStatus.reduce((a: number, s: any) => a + s.count, 0)} sub="tasks" data={L.what.tasksByStatus.map((s: any) => ({ name: s.status, value: s.count, color: s.status === 'Done' ? '#10b981' : s.status === 'Blocked' ? '#ef4444' : s.status === 'In Progress' ? '#3a5ff0' : '#94a3b8' }))} /></Card> : null);
      push('perf', perf('Performance'));
      push('vs', valueStreamList(L.how?.valueStreams ?? []));
      break;
    case 'initiative':
      push('wf', workforce(L.who?.headcount, 'Contributors'));
      push('meta', <Card title="Delivery"><StatRow items={[{ value: L.what?.stage ?? '—', label: 'stage' }, { value: L.howWell?.health ?? '—', label: 'health', tone: HEALTH_COLOR[L.howWell?.health] }, { value: L.what?.budget ? `$${Math.round(L.what.budget / 1e6)}M` : '—', label: 'budget' }]} /></Card>);
      push('vs', refList('Value streams', L.what?.valueStreams ?? [], 'valueStream'));
      push('risk', risk());
      push('perf', perf('Contributor performance'));
      break;
    case 'application':
      push('meta', <Card title="System" illustrative><KeyVals rows={[['Kind', L.where?.kind], ['Vendor', L.where?.vendor], ['Criticality', L.where?.criticality], ['Category', L.what?.category]]} /></Card>);
      push('roles', refList('Supporting roles', L.who?.roles ?? [], 'role', { suffix: (r) => r.org ?? r.department }));
      push('conn', (L.where?.internal != null || L.where?.external != null) ? <Card title="Dependent systems in this flow" illustrative><StatRow items={[{ value: L.where.internal ?? 0, label: 'internal' }, { value: L.where.external ?? 0, label: 'external' }]} /></Card> : null);
      push('vs', refList('Used in value streams', L.where?.valueStreams ?? [], 'valueStream'));
      push('sr', Array.isArray(L.how?.systemRoles) && L.how.systemRoles.length ? <Card title="System role"><div className="space-y-1">{L.how.systemRoles.map((s: any, i: number) => <div key={i} className="flex justify-between text-[11px]"><span className="text-slate-600 truncate">{s.stream}</span><span className="chip-soft">{s.role}</span></div>)}</div></Card> : null);
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

function PanelSkeleton() {
  return <div className="space-y-3 p-1"><div className="px-1 space-y-2"><div className="skeleton h-3 w-24" /><div className="skeleton h-5 w-40" /></div>{[0, 1, 2].map((i) => <div key={i} className="lens-card space-y-2"><div className="skeleton h-3 w-24" /><div className="skeleton h-16 w-full" /></div>)}</div>;
}
