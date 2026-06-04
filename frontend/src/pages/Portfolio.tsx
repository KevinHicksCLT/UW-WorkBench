import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { fmt, STAGE_LABELS } from '../lib/format';
import PageHeader from '../components/PageHeader';
import {
  Tile, SectionCard, BarList, StatusPill, SeverityCell, SvgLineChart, Modal, withCompany,
} from '../lib/portfolio';
import ApplicationRationalization from './GreenfieldMigration';

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

const STATUS_BAR_COLOR: Record<string, string> = { ON_TRACK: '#047857', AT_RISK: '#b45309', OFF_TRACK: '#be123c' };

export default function Portfolio() {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<Dashboard | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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

  const stageBars = Object.entries(STAGE_LABELS).map(([k, label]) => ({ key: label, count: data.byStage[k] ?? 0 }));
  const statusBars = (['ON_TRACK', 'AT_RISK', 'OFF_TRACK'] as const).map((k) => ({ key: k.replace('_', ' '), count: data.byStatus[k] ?? 0 }));
  const months = data.monthlyBenefits.map((m) => m.period);

  return (
    <div>
      <PageHeader
        title="Initiatives"
        subtitle="Strategic portfolio — programs, initiatives, benefits and risks"
        actions={
          <>
            <Link to="/portfolio/raid" className="btn-secondary">RAID Log</Link>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Program</button>
          </>
        }
      />

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label="Programs" value={data.counts.programs} />
        <Tile label="Initiatives" value={data.counts.initiatives} />
        <Tile label="Cumulative Benefit" value={fmt.currency(data.totals.benefit, { compact: true })} tone="positive" hint={`Cost ${fmt.currency(data.totals.cost, { compact: true })}`} />
        <Tile label="Net Benefit" value={fmt.currency(data.totals.net, { compact: true })} tone={data.totals.net >= 0 ? 'positive' : 'negative'} />
      </div>

      {/* Focal point — the Application Rationalization workspace, embedded. */}
      <div className="card-elevated p-5 mb-6 border-l-[3px] border-l-[#4f46e5]">
        <ApplicationRationalization embedded />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <SectionCard title="Monthly benefits — Actual vs Target vs Forecast">
            <SvgLineChart
              labels={months}
              formatValue={(v) => `$${Math.round(v / 1000)}k`}
              series={[
                { name: 'Actual', color: '#047857', data: data.monthlyBenefits.map((m) => m.ACTUAL) },
                { name: 'Target', color: '#a3a3a3', data: data.monthlyBenefits.map((m) => m.TARGET), dashed: true },
                { name: 'Forecast', color: '#4f46e5', data: data.monthlyBenefits.map((m) => m.FORECAST), dashed: true },
              ]}
            />
          </SectionCard>
        </div>
        <SectionCard title="Initiatives">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">By stage</div>
          <BarList groups={stageBars} color="#171717" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-4 mb-2">By status</div>
          <BarList groups={statusBars} color={(k) => STATUS_BAR_COLOR[k.replace(' ', '_')] ?? '#a3a3a3'} />
        </SectionCard>
      </div>

      <div className="mb-6">
        <SectionCard title="Top open risks" actions={<Link to="/portfolio/raid" className="text-xs text-[#525252] hover:text-[#171717]">RAID Log →</Link>}>
          {data.topRisks.length === 0 ? (
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
                  {data.topRisks.map((r) => (
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
      </div>

      {/* Programs directory */}
      <h2 className="text-sm font-semibold text-[#171717] mb-3">Programs</h2>
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

      {showCreate && <CreateProgramModal companyId={companyId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
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
