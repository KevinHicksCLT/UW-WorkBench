import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';
import PageHeader from '../components/PageHeader.jsx';
import KpiTile from '../components/KpiTile.jsx';
import StatusPill from '../components/StatusPill.jsx';
import StageBadge from '../components/StageBadge.jsx';

export default function ProgramDetail() {
  const { id } = useParams();
  const [program, setProgram] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [showCreateInit, setShowCreateInit] = useState(null); // workstream object

  useEffect(() => { load(); }, [id]);
  async function load() {
    const [p, s] = await Promise.all([
      api.get(`/programs/${id}`),
      api.get(`/programs/${id}/summary`),
    ]);
    setProgram(p);
    setSummary(s);
  }

  if (!program) return <div>Loading…</div>;

  return (
    <div>
      <PageHeader
        title={program.name}
        subtitle={program.description}
        breadcrumbs={[
          { to: '/programs', label: 'Programs' },
          { label: program.name },
        ]}
        actions={
          <button className="btn-primary" onClick={() => setShowCreateWs(true)}>
            + New Workstream
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiTile label="Workstreams" value={program.workstreams.length} tone="accent" />
        <KpiTile label="Initiatives" value={summary?.initiativeCount || 0} tone="accent" />
        <KpiTile
          label="Total Benefit"
          value={fmt.currency(summary?.totalBenefit || 0, { compact: true })}
          tone="positive"
        />
        <KpiTile
          label="Net Benefit"
          value={fmt.currency(summary?.netBenefit || 0, { compact: true })}
          sublabel={`Cost: ${fmt.currency(summary?.totalCost || 0, { compact: true })}`}
          tone={(summary?.netBenefit || 0) > 0 ? 'positive' : 'warning'}
        />
      </div>

      <div className="space-y-4">
        {program.workstreams.map((ws) => (
          <div key={ws.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-lg">{ws.name}</h3>
                <StatusPill status={ws.status} />
                <span className="text-sm text-slate-500">{ws.initiatives.length} initiative{ws.initiatives.length !== 1 && 's'}</span>
              </div>
              <button className="btn-secondary text-xs" onClick={() => setShowCreateInit(ws)}>
                + Initiative
              </button>
            </div>
            {ws.initiatives.length === 0 ? (
              <div className="text-sm text-slate-500 italic py-3">No initiatives yet</div>
            ) : (
              <div className="table-scroll">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="text-left pb-2 font-semibold">Initiative</th>
                    <th className="text-left pb-2 font-semibold w-32">Stage</th>
                    <th className="text-left pb-2 font-semibold w-24">Status</th>
                    <th className="text-right pb-2 font-semibold">Benefit</th>
                    <th className="text-right pb-2 font-semibold">Net</th>
                    <th className="text-left pb-2 font-semibold pl-3">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {ws.initiatives.map((init) => (
                    <tr key={init.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5">
                        <Link to={`/initiatives/${init.id}`} className="font-medium text-brand-700 hover:underline">
                          {init.name}
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <StageBadge stage={init.stage} />
                      </td>
                      <td className="py-2.5">
                        <StatusPill status={init.status} />
                      </td>
                      <td className="py-2.5 text-right text-slate-700">
                        {fmt.currency(init.cumulativeBenefit, { compact: true })}
                      </td>
                      <td className={`py-2.5 text-right font-medium ${init.cumulativeNetBenefit > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {fmt.currency(init.cumulativeNetBenefit, { compact: true })}
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600 text-xs">
                        {init.owner?.name || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreateWs && (
        <CreateWorkstreamModal
          programId={id}
          onClose={() => setShowCreateWs(false)}
          onCreated={() => { setShowCreateWs(false); load(); }}
        />
      )}
      {showCreateInit && (
        <CreateInitiativeModal
          workstream={showCreateInit}
          onClose={() => setShowCreateInit(null)}
          onCreated={() => { setShowCreateInit(null); load(); }}
        />
      )}
    </div>
  );
}

function CreateWorkstreamModal({ programId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/workstreams', { programId, name, description });
      onCreated();
    } catch (err) { setError(err.message); }
  }

  return (
    <Modal onClose={onClose} title="New Workstream">
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

function CreateInitiativeModal({ workstream, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '',
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
  });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/initiatives', { workstreamId: workstream.id, ...form });
      onCreated();
    } catch (err) { setError(err.message); }
  }

  return (
    <Modal onClose={onClose} title={`New Initiative — ${workstream.name}`}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start</label>
            <input className="input" type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><label className="label">Due</label>
            <input className="input" type="date" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ children, title, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 sm:p-6 w-full max-w-lg my-auto max-h-[calc(100vh-2rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
