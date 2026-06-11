import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { fmt, STAGE_ORDER, STAGE_LABELS } from '../lib/format';
import PageHeader from '../components/PageHeader';
import {
  Tile, StatusPill, StageBar, Modal, withCompany,
  makeTimelineScale, TimelineAxis, TimelineGrid,
  type LinkOptions,
} from '../lib/portfolio';

// Program drill-down: KPI rollup + tabbed views over the program's initiatives —
// Workstreams (tables + create), Pipeline (stage columns), Prioritization
// (value-vs-complexity matrix), Roadmap (date bars per workstream), Resources
// (cross-initiative utilization).

type InitRow = {
  id: string; name: string; stage: string; status: string;
  startDate: string; dueDate: string;
  valueScore: number; complexityScore: number;
  cumulativeBenefit: number; cumulativeNetBenefit: number;
  ownerRoleName: string | null; valueStreamName: string | null;
};
type Program = {
  id: string; name: string; description: string | null; status: string;
  computedStatus?: string; statusOverridden?: boolean;
  workstreams: { id: string; name: string; status: string; computedStatus?: string; statusOverridden?: boolean; initiatives: InitRow[] }[];
};
type Summary = { initiativeCount: number; totalBenefit: number; totalCost: number; netBenefit: number };
type ResourceRow = {
  name: string; roleName: string | null; totalAllocationPct: number; overUtilized: boolean;
  assignments: { initiativeId: string; initiativeName: string; allocationPct: number; startDate: string; endDate: string }[];
};

const TABS = ['Workstreams', 'Pipeline', 'Prioritization', 'Roadmap', 'Resources'] as const;
type Tab = (typeof TABS)[number];

const STATUS_COLOR: Record<string, string> = { ON_TRACK: '#047857', AT_RISK: '#b45309', OFF_TRACK: '#be123c' };

export default function PortfolioProgram() {
  const { id } = useParams();
  const { companyId } = useCompany();
  const [program, setProgram] = useState<Program | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [links, setLinks] = useState<LinkOptions | null>(null);
  const [tab, setTab] = useState<Tab>('Workstreams');
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [createInitWs, setCreateInitWs] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');

  function load() {
    Promise.all([api.get(`/portfolio/programs/${id}`), api.get(`/portfolio/programs/${id}/summary`)])
      .then(([p, s]) => { setProgram(p); setSummary(s); })
      .catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => { api.get(withCompany('/portfolio/links', companyId)).then(setLinks).catch(() => {}); }, [companyId]);

  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;
  if (!program) return <div className="text-sm text-[#a3a3a3]">Loading…</div>;

  return (
    <div>
      <PageHeader
        title={program.name}
        subtitle={program.description ?? undefined}
        actions={<button className="btn-primary" onClick={() => setShowCreateWs(true)}>+ New Workstream</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label="Workstreams" value={program.workstreams.length} />
        <Tile label="Initiatives" value={summary?.initiativeCount ?? 0} />
        <Tile label="Total Benefit" value={fmt.currency(summary?.totalBenefit ?? 0, { compact: true })} tone="positive" hint={`Cost ${fmt.currency(summary?.totalCost ?? 0, { compact: true })}`} />
        <Tile label="Net Benefit" value={fmt.currency(summary?.netBenefit ?? 0, { compact: true })} tone={(summary?.netBenefit ?? 0) >= 0 ? 'positive' : 'negative'} />
      </div>

      {/* Tabs */}
      <div className="border-b border-[#eaeaea] mb-5 overflow-x-auto">
        <nav className="flex gap-6 whitespace-nowrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'relative inline-flex items-center h-10 -mb-px px-0.5 text-sm border-b-2 transition-colors duration-150 ' +
                (tab === t ? 'text-[#171717] font-semibold border-[#171717]' : 'text-[#666666] font-medium border-transparent hover:text-[#171717]')
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Workstreams' && <WorkstreamsTab program={program} onCreateInit={setCreateInitWs} />}
      {tab === 'Pipeline' && <PipelineTab program={program} />}
      {tab === 'Prioritization' && <PrioritizationTab program={program} />}
      {tab === 'Roadmap' && <RoadmapTab program={program} />}
      {tab === 'Resources' && <ProgramResourcesTab programId={program.id} />}

      {showCreateWs && <CreateWorkstreamModal programId={id!} onClose={() => setShowCreateWs(false)} onCreated={() => { setShowCreateWs(false); load(); }} />}
      {createInitWs && <CreateInitiativeModal workstream={createInitWs} links={links} onClose={() => setCreateInitWs(null)} onCreated={() => { setCreateInitWs(null); load(); }} />}
    </div>
  );
}

// ── WORKSTREAMS ──────────────────────────────────────────────────────────
function WorkstreamsTab({ program, onCreateInit }: { program: Program; onCreateInit: (ws: { id: string; name: string }) => void }) {
  return (
    <div className="space-y-4">
      {program.workstreams.map((ws) => (
        <div key={ws.id} className="card-elevated p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-[#f5f5f5]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <h3 className="font-semibold text-[#171717]">{ws.name}</h3>
              <StatusPill status={ws.computedStatus ?? ws.status} />
              {ws.statusOverridden && <span className="text-[10px] text-[#b45309]" title={`Manually set to ${ws.status.replaceAll('_', ' ').toLowerCase()} — rolled-up health from its initiatives differs`}>override</span>}
              <span className="text-xs text-[#a3a3a3]">{ws.initiatives.length} initiative{ws.initiatives.length !== 1 && 's'}</span>
            </div>
            <button className="btn-secondary text-xs" onClick={() => onCreateInit({ id: ws.id, name: ws.name })}>+ Initiative</button>
          </div>
          {ws.initiatives.length === 0 ? (
            <div className="text-sm text-[#a3a3a3] py-2">No initiatives yet.</div>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
                  <tr>
                    <th className="text-left pb-2 font-semibold">Initiative</th>
                    <th className="text-left pb-2 font-semibold w-40">Stage</th>
                    <th className="text-left pb-2 font-semibold w-24">Status</th>
                    <th className="text-right pb-2 font-semibold">Benefit</th>
                    <th className="text-right pb-2 font-semibold">Net</th>
                    <th className="text-left pb-2 font-semibold pl-3 w-40">Value stream</th>
                  </tr>
                </thead>
                <tbody>
                  {ws.initiatives.map((init) => (
                    <tr key={init.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                      <td className="py-2.5">
                        <Link to={`/initiatives/${init.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{init.name}</Link>
                      </td>
                      <td className="py-2.5 pr-3"><StageBar stage={init.stage} /></td>
                      <td className="py-2.5"><StatusPill status={init.status} /></td>
                      <td className="py-2.5 text-right text-[#525252] tnum">{fmt.currency(init.cumulativeBenefit, { compact: true })}</td>
                      <td className={`py-2.5 text-right font-medium tnum ${init.cumulativeNetBenefit >= 0 ? 'text-[#047857]' : 'text-[#be123c]'}`}>{fmt.currency(init.cumulativeNetBenefit, { compact: true })}</td>
                      <td className="py-2.5 pl-3 text-[#666666] text-xs truncate">{init.valueStreamName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── PIPELINE ─────────────────────────────────────────────────────────────
function PipelineTab({ program }: { program: Program }) {
  const all = program.workstreams.flatMap((ws) => ws.initiatives);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
      {STAGE_ORDER.map((stage) => {
        const inits = all.filter((i) => i.stage === stage);
        return (
          <div key={stage} className="card-elevated p-3">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#f5f5f5]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{STAGE_LABELS[stage]}</span>
              <span className="text-xs text-[#171717] tnum">{inits.length}</span>
            </div>
            {inits.length === 0 ? (
              <div className="text-xs text-[#a3a3a3] py-2">—</div>
            ) : (
              <div className="space-y-2">
                {inits.map((i) => (
                  <Link key={i.id} to={`/initiatives/${i.id}`} className="block border border-[#eaeaea] rounded-md p-2.5 hover:border-[#a3a3a3] transition-colors">
                    <div className="text-sm font-medium text-[#171717] leading-snug mb-1.5">{i.name}</div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={i.status} />
                      <span className="text-xs text-[#666666] tnum" title="Value score">V {i.valueScore}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PRIORITIZATION ───────────────────────────────────────────────────────
type SortKey = 'name' | 'valueScore' | 'complexityScore' | 'cumulativeNetBenefit';

function PrioritizationTab({ program }: { program: Program }) {
  const all = program.workstreams.flatMap((ws) => ws.initiatives);
  const [sortKey, setSortKey] = useState<SortKey>('valueScore');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const yMax = Math.max(10, Math.ceil(Math.max(0, ...all.map((i) => i.valueScore)) * 1.1));

  const sorted = useMemo(() => {
    return [...all].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sortDir;
    });
  }, [all, sortKey, sortDir]);

  function setSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(k); setSortDir(k === 'name' ? 1 : -1); }
  }
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  return (
    <div className="space-y-4">
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Value vs. Complexity</h3>
        <p className="text-xs text-[#a3a3a3] mb-4">x = complexity score (0–10, charter), y = value score (Σ impact × objective weight).</p>
        <div className="flex gap-2">
          <div className="flex items-center justify-center w-5 flex-shrink-0">
            <span className="text-[10px] text-[#a3a3a3] -rotate-90 whitespace-nowrap">Value →</span>
          </div>
          <div className="flex-1">
            <div className="relative h-80 border border-[#eaeaea] rounded-md bg-[#fcfcfc] overflow-hidden">
              {/* quadrant dividers */}
              <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-[#e5e5e5]" />
              <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-[#e5e5e5]" />
              {/* quadrant labels */}
              <span className="absolute top-2 left-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#047857]/60">Quick Wins</span>
              <span className="absolute top-2 right-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#4f46e5]/60">Strategic Bets</span>
              <span className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#a3a3a3]">Fill-ins</span>
              <span className="absolute bottom-2 right-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#be123c]/60">Money Pits</span>
              {/* dots */}
              {all.map((i) => {
                const x = Math.min(100, Math.max(0, (i.complexityScore / 10) * 100));
                const y = Math.min(100, Math.max(0, (i.valueScore / yMax) * 100));
                return (
                  <Link
                    key={i.id}
                    to={`/initiatives/${i.id}`}
                    className="absolute group"
                    style={{ left: `${x}%`, bottom: `${y}%`, transform: 'translate(-50%, 50%)' }}
                    title={`${i.name} — value ${i.valueScore}, complexity ${i.complexityScore}`}
                  >
                    <span className="block w-3 h-3 rounded-full border-2 border-white shadow" style={{ backgroundColor: STATUS_COLOR[i.status] ?? '#171717' }} />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-[#525252] whitespace-nowrap bg-white/85 px-1 rounded group-hover:text-[#171717]">{i.name}</span>
                  </Link>
                );
              })}
            </div>
            <div className="text-right text-[10px] text-[#a3a3a3] mt-1">Complexity →</div>
          </div>
        </div>
      </div>

      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Initiatives ranked</h3>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold cursor-pointer select-none" onClick={() => setSort('name')}>Initiative{arrow('name')}</th>
                <th className="text-right pb-2 font-semibold cursor-pointer select-none w-24" onClick={() => setSort('valueScore')}>Value{arrow('valueScore')}</th>
                <th className="text-right pb-2 font-semibold cursor-pointer select-none w-28" onClick={() => setSort('complexityScore')}>Complexity{arrow('complexityScore')}</th>
                <th className="text-right pb-2 font-semibold cursor-pointer select-none w-32" onClick={() => setSort('cumulativeNetBenefit')}>Net benefit{arrow('cumulativeNetBenefit')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                  <td className="py-2.5">
                    <Link to={`/initiatives/${i.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{i.name}</Link>
                  </td>
                  <td className="py-2.5 text-right tnum">{i.valueScore}</td>
                  <td className="py-2.5 text-right tnum">{i.complexityScore}</td>
                  <td className={`py-2.5 text-right font-medium tnum ${i.cumulativeNetBenefit >= 0 ? 'text-[#047857]' : 'text-[#be123c]'}`}>{fmt.currency(i.cumulativeNetBenefit, { compact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── ROADMAP ──────────────────────────────────────────────────────────────
function RoadmapTab({ program }: { program: Program }) {
  const all = program.workstreams.flatMap((ws) => ws.initiatives);
  const scale = makeTimelineScale(all.flatMap((i) => [i.startDate, i.dueDate]));
  if (!scale) return <div className="card-elevated p-5 text-sm text-[#a3a3a3]">No initiatives to plot.</div>;

  return (
    <div className="card-elevated p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Roadmap</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#525252]">
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: c }} />
              {k.replaceAll('_', ' ').toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3 border-b border-[#eaeaea] pb-0.5 mb-1">
        <div className="w-56 flex-shrink-0" />
        <div className="flex-1 min-w-0"><TimelineAxis scale={scale} /></div>
      </div>

      {program.workstreams.map((ws) => (
        <div key={ws.id} className="mb-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] py-1.5">{ws.name}</div>
          <div className="flex gap-3">
            <div className="w-56 flex-shrink-0">
              {ws.initiatives.map((i) => (
                <div key={i.id} className="h-8 flex items-center min-w-0">
                  <Link to={`/initiatives/${i.id}`} className="text-sm font-medium text-[#171717] hover:text-[#4f46e5] truncate">{i.name}</Link>
                </div>
              ))}
              {ws.initiatives.length === 0 && <div className="h-8 flex items-center text-xs text-[#a3a3a3]">No initiatives</div>}
            </div>
            <div className="flex-1 min-w-0 relative">
              <TimelineGrid scale={scale} />
              {ws.initiatives.map((i) => {
                const left = scale.pct(i.startDate);
                const width = Math.max(1.2, scale.pct(i.dueDate) - left);
                return (
                  <div key={i.id} className="h-8 relative">
                    <div
                      className="absolute top-2 h-4 rounded"
                      title={`${i.name} — ${fmt.date(i.startDate)} → ${fmt.date(i.dueDate)}`}
                      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: STATUS_COLOR[i.status] ?? '#171717' }}
                    />
                  </div>
                );
              })}
              {ws.initiatives.length === 0 && <div className="h-8" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── RESOURCES ────────────────────────────────────────────────────────────
function ProgramResourcesTab({ programId }: { programId: string }) {
  const [rows, setRows] = useState<ResourceRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/portfolio/programs/${programId}/resources`).then(setRows).catch((e) => setError(e.message)); }, [programId]);

  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;
  if (!rows) return <div className="text-sm text-[#a3a3a3]">Loading…</div>;

  const over = rows.filter((r) => r.overUtilized).length;

  return (
    <div className="card-elevated p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Resource utilization</h3>
        <span className={'text-xs ' + (over > 0 ? 'text-[#be123c] font-medium' : 'text-[#a3a3a3]')}>
          {over > 0 ? `${over} of ${rows.length} resources over-allocated (>100% active today)` : `${rows.length} resources — none over-allocated today`}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-[#a3a3a3] py-2">No resources assigned across this program's initiatives yet.</div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold">Resource</th>
                <th className="text-left pb-2 font-semibold">Role</th>
                <th className="text-right pb-2 font-semibold w-32">Active alloc. %</th>
                <th className="text-left pb-2 font-semibold pl-4">Assignments</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={'border-b border-[#f5f5f5] ' + (r.overUtilized ? 'bg-[#fef2f2]' : '')}>
                  <td className="py-2.5 font-medium text-[#171717]">{r.name}</td>
                  <td className="py-2.5 text-[#666666]">{r.roleName ?? '—'}</td>
                  <td className={'py-2.5 text-right tnum font-medium ' + (r.overUtilized ? 'text-[#be123c]' : 'text-[#171717]')}>
                    {r.totalAllocationPct}%{r.overUtilized && <span className="ml-1.5 text-[10px] uppercase font-semibold">over</span>}
                  </td>
                  <td className="py-2.5 pl-4 text-xs text-[#666666]">
                    {r.assignments.map((a, idx) => (
                      <span key={idx}>
                        {idx > 0 && <span className="text-[#d4d4d4]"> · </span>}
                        <Link to={`/initiatives/${a.initiativeId}`} className="hover:text-[#4f46e5]">{a.initiativeName}</Link>
                        <span className="tnum"> {a.allocationPct}%</span>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateWorkstreamModal({ programId, onClose, onCreated }: { programId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await api.post('/portfolio/workstreams', { programId, ...form }); onCreated(); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title="New Workstream" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        {error && <div className="text-sm text-[#be123c]">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

function CreateInitiativeModal({ workstream, links, onClose, onCreated }: { workstream: { id: string; name: string }; links: LinkOptions | null; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', description: '',
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    valueStreamId: '', divisionId: '', ownerRoleId: '', sponsorRoleId: '',
  });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/portfolio/initiatives', {
        workstreamId: workstream.id,
        name: form.name, description: form.description, startDate: form.startDate, dueDate: form.dueDate,
        valueStreamId: form.valueStreamId || null, divisionId: form.divisionId || null,
        ownerRoleId: form.ownerRoleId || null, sponsorRoleId: form.sponsorRoleId || null,
      });
      onCreated();
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title={`New Initiative — ${workstream.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start</label>
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><label className="label">Due</label>
            <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div>
        </div>
        <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">Operating-model links (optional)</div>
        <div className="grid grid-cols-2 gap-3">
          <LinkSelect label="Value stream" value={form.valueStreamId} options={links?.valueStreams} onChange={(v) => setForm({ ...form, valueStreamId: v })} />
          <LinkSelect label="Division" value={form.divisionId} options={links?.divisions} onChange={(v) => setForm({ ...form, divisionId: v })} />
          <LinkSelect label="Owner role" value={form.ownerRoleId} options={links?.roles} onChange={(v) => setForm({ ...form, ownerRoleId: v })} />
          <LinkSelect label="Sponsor role" value={form.sponsorRoleId} options={links?.roles} onChange={(v) => setForm({ ...form, sponsorRoleId: v })} />
        </div>
        {error && <div className="text-sm text-[#be123c]">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

export function LinkSelect({ label, value, options, onChange }: { label: string; value: string; options?: { id: string; name: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— none —</option>
        {(options ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
