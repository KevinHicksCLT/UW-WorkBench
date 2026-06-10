import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { fmt } from '../lib/format';
import PageHeader from '../components/PageHeader';
import {
  Tile, StatusPill, StageBar, Modal, withCompany, type LinkOptions,
} from '../lib/portfolio';

// Program drill-down: KPI rollup + each workstream's initiative table. New
// workstreams and initiatives are created here; initiatives can be linked into
// the operating model (value stream / division / owner+sponsor role).

type InitRow = {
  id: string; name: string; stage: string; status: string;
  cumulativeBenefit: number; cumulativeNetBenefit: number;
  ownerRoleName: string | null; valueStreamName: string | null;
};
type Program = {
  id: string; name: string; description: string | null; status: string;
  computedStatus?: string; statusOverridden?: boolean;
  workstreams: { id: string; name: string; status: string; computedStatus?: string; statusOverridden?: boolean; initiatives: InitRow[] }[];
};
type Summary = { initiativeCount: number; totalBenefit: number; totalCost: number; netBenefit: number };

export default function PortfolioProgram() {
  const { id } = useParams();
  const { companyId } = useCompany();
  const [program, setProgram] = useState<Program | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [links, setLinks] = useState<LinkOptions | null>(null);
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
              <button className="btn-secondary text-xs" onClick={() => setCreateInitWs({ id: ws.id, name: ws.name })}>+ Initiative</button>
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
                          <Link to={`/portfolio/initiatives/${init.id}`} className="font-medium text-[#171717] hover:text-[#4f46e5]">{init.name}</Link>
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

      {showCreateWs && <CreateWorkstreamModal programId={id!} onClose={() => setShowCreateWs(false)} onCreated={() => { setShowCreateWs(false); load(); }} />}
      {createInitWs && <CreateInitiativeModal workstream={createInitWs} links={links} onClose={() => setCreateInitWs(null)} onCreated={() => { setCreateInitWs(null); load(); }} />}
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
