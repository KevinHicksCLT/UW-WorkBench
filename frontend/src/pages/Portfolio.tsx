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
  monthlyBenefits: { period: string; ACTUAL: number; TARGET: number; FORECAST: number }[];
  topRisks: { id: string; title: string; severity: number; status: string; initiative: { id: string; name: string } }[];
};

type ProgramRow = {
  id: string; name: string; description: string | null; status: string; statusNote: string | null;
  endDate: string;
  workstreams: { id: string; initiatives: { id: string }[] }[];
};

const TABS = ['Application Rationalization Workspace', 'Programs', 'Risks', 'RAID Log'] as const;
type Tab = (typeof TABS)[number];

// Two-letter abbreviations shown when the sidebar is collapsed.
const TAB_SHORT: Record<Tab, string> = {
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
  const [tab, setTab] = useState<Tab>('Application Rationalization Workspace');
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
      <PageHeader
        title="Initiatives"
        subtitle="Strategic portfolio — programs, initiatives, benefits and risks"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left sidebar — collapsible tab navigation */}
        <aside className={'flex-shrink-0 transition-[width] duration-150 ' + (collapsed ? 'lg:w-14' : 'lg:w-56')}>
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={
              'hidden lg:flex items-center gap-2 w-full rounded-md px-3 py-2 mb-1 text-[#666666] hover:text-[#171717] hover:bg-[#fafafa] transition-colors duration-150 ' +
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
                    'whitespace-nowrap lg:whitespace-normal rounded-md px-3 py-2 text-sm transition-colors duration-150 lg:border-l-2 ' +
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
          {tab === 'Application Rationalization Workspace' && (
            <div className="card-elevated p-5 border-l-[3px] border-l-[#4f46e5]">
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

// ── PROGRAMS ───────────────────────────────────────────────────────────────
function ProgramsTab({ programs, counts, onNew }: { programs: ProgramRow[]; counts: Dashboard['counts']; onNew: () => void }) {
  return (
    <div>
      {/* Headline counts banner */}
      <div className="grid grid-cols-2 gap-3 mb-6">
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
                  <StatusPill status={p.status} />
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
