import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { fmt } from '../lib/format';
import PageHeader from '../components/PageHeader';
import {
  Tile, SectionCard, StatusPill, SeverityCell, Modal, withCompany,
} from '../lib/portfolio';
import ApplicationRationalization from './GreenfieldMigration';
import PortfolioRaid from './PortfolioRaid';

// Initiative Tracker landing — executive snapshot across the active company's
// strategic portfolio, plus the program directory. Read-only metrics; programs
// can be created here and drilled into.

type Dashboard = {
  totals: { benefit: number; cost: number; net: number };
  counts: { programs: number; initiatives: number };
  byStage: Record<string, number>;
  byStatus: Record<string, number>;
  raidOpen: Record<string, number>;
  monthlyBenefits: { period: string; ACTUAL: number; TARGET: number; FORECAST: number }[];
  topRisks: { id: string; title: string; severity: number; status: string; initiative: { id: string; name: string } }[];
};

type ProgramRow = {
  id: string; name: string; description: string | null; status: string; statusNote: string | null;
  computedStatus: string; statusOverridden: boolean;
  endDate: string;
  workstreams: { id: string; initiatives: { id: string }[] }[];
};

const TABS = ['Portfolio', 'Application Rationalization Workspace', 'Programs', 'Risks', 'RAID Log'] as const;
type Tab = (typeof TABS)[number];

// Two-letter abbreviations shown when the sidebar is collapsed.
const TAB_SHORT: Record<Tab, string> = {
  Portfolio: 'PF',
  'Application Rationalization Workspace': 'AR',
  Programs: 'PR',
  Risks: 'RK',
  'RAID Log': 'RD',
};

export default function Portfolio() {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<Dashboard | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<Tab>('Portfolio');
  const [collapsed, setCollapsed] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api.get(withCompany('/portfolio/dashboard', companyId)),
      api.get(withCompany('/portfolio/programs', companyId)),
    ])
      .then(([d, p]) => { setData(d); setPrograms(p); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (!companyLoading) load(); }, [companyId, companyLoading]);

  if (loading || companyLoading) return <div className="text-sm text-[#a3a3a3]">Loading portfolio…</div>;
  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Workspace" />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left sidebar — collapsible tab navigation */}
        <aside className={'flex-shrink-0 transition-[width] duration-150 ' + (collapsed ? 'lg:w-12' : 'lg:w-44')}>
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={
              'hidden lg:flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 mb-1 text-[#666666] hover:text-[#171717] hover:bg-[#fafafa] transition-colors duration-150 ' +
              (collapsed ? 'justify-center' : '')
            }
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              className={'transition-transform duration-150 ' + (collapsed ? 'rotate-180' : '')}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {!collapsed && <span className="text-xs font-medium">Collapse</span>}
          </button>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1 lg:mx-0 lg:px-0" aria-label="Initiatives sections">
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? t : undefined}
                  className={
                    'whitespace-nowrap lg:whitespace-normal rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 lg:border-l-2 ' +
                    (collapsed ? 'lg:text-center lg:px-0 lg:font-semibold' : 'text-left') + ' ' +
                    (active
                      ? 'bg-[#f5f5f5] text-[#171717] font-semibold lg:border-[#171717]'
                      : 'text-[#666666] font-medium hover:text-[#171717] hover:bg-[#fafafa] lg:border-transparent')
                  }
                >
                  {/* Mobile always shows full label; desktop collapses to an abbreviation */}
                  <span className={collapsed ? 'lg:hidden' : ''}>{t}</span>
                  {collapsed && <span className="hidden lg:inline">{TAB_SHORT[t]}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {tab === 'Portfolio' && (
            <PortfolioSummaryTab data={data} programs={programs} onViewPrograms={() => setTab('Programs')} />
          )}

          {tab === 'Application Rationalization Workspace' && (
            <div className="card-elevated p-4 border-l-[3px] border-l-[#4f46e5]">
              <ApplicationRationalization embedded />
            </div>
          )}

          {tab === 'Programs' && (
            <ProgramsTab programs={programs} counts={data.counts} onNew={() => setShowCreate(true)} />
          )}

          {tab === 'Risks' && <RisksTab risks={data.topRisks} onViewRaid={() => setTab('RAID Log')} />}

          {tab === 'RAID Log' && <PortfolioRaid embedded />}
        </div>
      </div>

      {showCreate && <CreateProgramModal companyId={companyId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

// ── PORTFOLIO (EPMO aggregation across all programs, I2) ───────────────────
const STAGE_ORDER = ['IDEA', 'PLAN', 'EXECUTE', 'REALIZE', 'COMPLETE'];
const STATUS_ORDER: [string, string, string][] = [
  ['ON_TRACK', 'On track', '#15803d'], ['AT_RISK', 'At risk', '#b45309'], ['OFF_TRACK', 'Off track', '#be123c'],
];

function PortfolioSummaryTab({ data, programs, onViewPrograms }: { data: Dashboard; programs: ProgramRow[]; onViewPrograms: () => void }) {
  const raidTotal = Object.values(data.raidOpen ?? {}).reduce((a, n) => a + n, 0);
  const statusTotal = Object.values(data.byStatus).reduce((a, n) => a + n, 0) || 1;
  return (
    <div className="space-y-4">
      {/* One portfolio number across all programs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label="Total benefit" value={fmt.currency(data.totals.benefit, { compact: true })} />
        <Tile label="Total cost" value={fmt.currency(data.totals.cost, { compact: true })} />
        <Tile label="Net benefit" value={fmt.currency(data.totals.net, { compact: true })} />
        <Tile label="At-risk / off-track" value={(data.byStatus.AT_RISK ?? 0) + (data.byStatus.OFF_TRACK ?? 0)} />
        <Tile label="Open RAID items" value={raidTotal} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status mix */}
        <SectionCard title="Initiative health mix">
          <div className="space-y-2">
            {STATUS_ORDER.map(([key, label, color]) => {
              const n = data.byStatus[key] ?? 0;
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-[#525252]">{label}</span>
                  <div className="flex-1 h-2.5 rounded bg-[#f5f5f5] overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(n / statusTotal) * 100}%`, background: color }} />
                  </div>
                  <span className="w-8 text-right tnum text-[#171717] font-medium">{n}</span>
                </div>
              );
            })}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-5 mb-2">By stage</div>
          <div className="flex flex-wrap gap-2">
            {STAGE_ORDER.map((s) => (
              <span key={s} className="text-xs px-2 py-1 rounded-md bg-[#fafafa] border border-[#eeeeee] text-[#525252]">
                {s.charAt(0) + s.slice(1).toLowerCase()} <span className="font-semibold text-[#171717] tnum">{data.byStage[s] ?? 0}</span>
              </span>
            ))}
          </div>
        </SectionCard>

        {/* Open RAID heatmap */}
        <SectionCard title="Open RAID">
          <div className="grid grid-cols-2 gap-3">
            {(['RISK', 'ISSUE', 'ASSUMPTION', 'DECISION'] as const).map((t) => {
              const n = data.raidOpen?.[t] ?? 0;
              return (
                <div key={t} className={'rounded-md border p-3 ' + (n > 0 && t === 'RISK' ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#eeeeee] bg-[#fafafa]')}>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[#a3a3a3]">{t.charAt(0) + t.slice(1).toLowerCase()}s</div>
                  <div className="text-xl font-semibold tnum text-[#171717]">{n}</div>
                </div>
              );
            })}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-5 mb-2">Top open risks</div>
          {data.topRisks.length === 0 ? <div className="text-sm text-[#a3a3a3]">No open risks.</div> : (
            <div className="space-y-1.5">
              {data.topRisks.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <SeverityCell value={r.severity} />
                  <Link to={`/portfolio/initiatives/${r.initiative.id}`} className="flex-1 min-w-0 truncate text-[#171717] hover:text-[#4f46e5]">{r.title}</Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Program rollup — ties the portfolio number to its programs */}
      <SectionCard title="Programs" actions={<button onClick={onViewPrograms} className="text-xs text-[#525252] hover:text-[#171717]">All programs →</button>}>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left py-2 font-semibold">Program</th>
                <th className="text-left py-2 font-semibold w-32">Health (rolled up)</th>
                <th className="text-right py-2 font-semibold w-28">Workstreams</th>
                <th className="text-right py-2 font-semibold w-24">Initiatives</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} className="border-b border-[#f5f5f5]">
                  <td className="py-2.5"><Link to={`/portfolio/programs/${p.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{p.name}</Link></td>
                  <td className="py-2.5">
                    <StatusPill status={p.computedStatus ?? p.status} />
                    {p.statusOverridden && <span className="ml-1.5 text-[10px] text-[#b45309]" title={`Manually set to ${p.status.replaceAll('_', ' ').toLowerCase()} — rolled-up health differs`}>override</span>}
                  </td>
                  <td className="py-2.5 text-right tnum">{p.workstreams.length}</td>
                  <td className="py-2.5 text-right tnum">{p.workstreams.reduce((a, w) => a + w.initiatives.length, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── PROGRAMS ───────────────────────────────────────────────────────────────
function ProgramsTab({ programs, counts, onNew }: { programs: ProgramRow[]; counts: Dashboard['counts']; onNew: () => void }) {
  return (
    <div>
      {/* Headline counts banner */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Tile label="Programs" value={counts.programs} />
        <Tile label="Initiatives" value={counts.initiatives} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#171717]">Programs</h2>
        <button className="btn-primary" onClick={onNew}>+ New Program</button>
      </div>
      {programs.length === 0 ? (
        <div className="card-elevated p-8 text-center text-sm text-[#a3a3a3]">No programs yet. Create one to start tracking initiatives.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {programs.map((p) => {
            const initCount = p.workstreams.reduce((a, w) => a + w.initiatives.length, 0);
            return (
              <Link key={p.id} to={`/portfolio/programs/${p.id}`} className="card-elevated p-5 hover:border-[#d4d4d4] transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#171717]">{p.name}</div>
                    {p.description && <div className="text-sm text-[#666666] mt-0.5 line-clamp-2">{p.description}</div>}
                  </div>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <StatusPill status={p.computedStatus ?? p.status} />
                    {p.statusOverridden && <span className="text-[10px] text-[#b45309]" title={`Manually set to ${p.status.replaceAll('_', ' ').toLowerCase()} — rolled-up health differs`}>override</span>}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#f5f5f5]">
                  <Stat label="Workstreams" value={p.workstreams.length} />
                  <Stat label="Initiatives" value={initCount} />
                  <Stat label="Ends" value={fmt.month(p.endDate)} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── RISKS ──────────────────────────────────────────────────────────────────
function RisksTab({ risks, onViewRaid }: { risks: Dashboard['topRisks']; onViewRaid: () => void }) {
  return (
    <SectionCard title="Top open risks" actions={<button onClick={onViewRaid} className="text-xs text-[#525252] hover:text-[#171717]">RAID Log →</button>}>
      {risks.length === 0 ? (
        <div className="text-sm text-[#a3a3a3]">No open risks.</div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left py-2 font-semibold">Title</th>
                <th className="text-left py-2 font-semibold">Initiative</th>
                <th className="text-center py-2 font-semibold w-20">Severity</th>
                <th className="text-left py-2 font-semibold w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id} className="border-b border-[#f5f5f5]">
                  <td className="py-2.5 font-medium text-[#171717]">{r.title}</td>
                  <td className="py-2.5">
                    <Link to={`/portfolio/initiatives/${r.initiative.id}`} className="text-[#4f46e5] hover:underline">{r.initiative.name}</Link>
                  </td>
                  <td className="py-2.5 text-center"><SeverityCell value={r.severity} /></td>
                  <td className="py-2.5 text-[#525252] text-xs">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
      <div className="font-semibold text-[#171717] tnum">{value}</div>
    </div>
  );
}

function CreateProgramModal({ companyId, onClose, onCreated }: { companyId: string | null; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', description: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(withCompany('/portfolio/programs', companyId), form);
      onCreated();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal title="New Program" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start date</label>
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><label className="label">End date</label>
            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
        </div>
        {error && <div className="text-sm text-[#be123c]">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}
