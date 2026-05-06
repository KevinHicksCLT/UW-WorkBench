import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';
import PageHeader from '../components/PageHeader.jsx';
import StatusPill from '../components/StatusPill.jsx';

export default function Programs() {
  const [programs, setPrograms] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { load(); }, []);
  function load() { api.get('/programs').then(setPrograms); }

  return (
    <div>
      <PageHeader
        title="Programs"
        subtitle="Top-level transformation programs across the enterprise"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Program
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {programs.map((p) => {
          const initCount = p.workstreams.reduce((a, w) => a + w.initiatives.length, 0);
          return (
            <Link to={`/programs/${p.id}`} key={p.id} className="card hover:border-brand-300 hover:shadow transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-slate-900 text-lg">{p.name}</div>
                  <div className="text-sm text-slate-500 mt-0.5">{p.description}</div>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                <Stat label="Workstreams" value={p.workstreams.length} />
                <Stat label="Initiatives" value={initCount} />
                <Stat label="Ends" value={fmt.month(p.endDate)} />
              </div>
              {p.statusNote && (
                <div className="mt-3 text-xs text-slate-500 italic">{p.statusNote}</div>
              )}
            </Link>
          );
        })}
      </div>

      {showCreate && (
        <CreateProgramModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function CreateProgramModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/programs', form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">New Program</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input" type="date" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
