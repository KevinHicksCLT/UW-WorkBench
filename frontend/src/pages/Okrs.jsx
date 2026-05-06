import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';
import PageHeader from '../components/PageHeader.jsx';
import KpiTile from '../components/KpiTile.jsx';

export default function Okrs() {
  const [objectives, setObjectives] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { load(); }, []);
  function load() { api.get('/okr/objectives').then(setObjectives); }

  const overall = objectives.length > 0
    ? objectives.reduce((a, o) => a + o.achievement, 0) / objectives.length
    : 0;

  return (
    <div>
      <PageHeader
        title="OKRs"
        subtitle="Strategic objectives and KPIs cascaded across the enterprise"
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Objective</button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiTile label="Strategic Objectives" value={objectives.length} tone="accent" />
        <KpiTile
          label="Total KPIs"
          value={objectives.reduce((a, o) => a + o.kpis.length, 0)}
          tone="accent"
        />
        <KpiTile
          label="Avg Achievement"
          value={fmt.percent(overall)}
          tone={overall > 0.6 ? 'positive' : overall > 0.3 ? 'warning' : 'negative'}
        />
      </div>

      <div className="space-y-4">
        {objectives.map((obj) => (
          <ObjectiveCard key={obj.id} objective={obj} reload={load} />
        ))}
      </div>

      {showCreate && (
        <CreateObjectiveModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function ObjectiveCard({ objective, reload }) {
  const [showAddKpi, setShowAddKpi] = useState(false);
  const ach = objective.achievement;
  const tone = ach > 0.6 ? 'bg-emerald-500' : ach > 0.3 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-900 text-lg">{objective.name}</div>
          <div className="text-sm text-slate-500 mt-0.5">{objective.description}</div>
          {objective.ownerName && (
            <div className="text-xs text-slate-500 mt-1">Owner: {objective.ownerName}</div>
          )}
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <div className="text-xs uppercase text-slate-500 font-semibold">Achievement</div>
          <div className="text-2xl font-bold text-slate-900">{fmt.percent(ach)}</div>
        </div>
      </div>

      {/* Achievement bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div className={tone} style={{ width: `${(ach * 100).toFixed(0)}%`, height: '100%' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs uppercase font-semibold text-slate-500">KPIs</h4>
            <button className="text-xs text-brand-600 hover:underline" onClick={() => setShowAddKpi(true)}>+ KPI</button>
          </div>
          {objective.kpis.length === 0 ? (
            <div className="text-sm text-slate-500 italic">No KPIs</div>
          ) : (
            <div className="space-y-2">
              {objective.kpis.map((k) => <KpiRow key={k.id} kpi={k} />)}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-xs uppercase font-semibold text-slate-500 mb-2">
            Supporting Initiatives ({objective.initiativeLinks.length})
          </h4>
          {objective.initiativeLinks.length === 0 ? (
            <div className="text-sm text-slate-500 italic">No linked initiatives</div>
          ) : (
            <ul className="text-sm space-y-1.5">
              {objective.initiativeLinks.map((link) => (
                <li key={link.id} className="flex items-center justify-between">
                  <a href={`/initiatives/${link.initiative.id}`} className="text-brand-700 hover:underline truncate">
                    {link.initiative.name}
                  </a>
                  <span className={`pill text-xs ml-2 ${
                    link.impact === 'HIGH' ? 'pill-blue' : 'pill-slate'
                  }`}>{link.impact}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showAddKpi && (
        <CreateKpiModal
          objectiveId={objective.id}
          onClose={() => setShowAddKpi(false)}
          onCreated={() => { setShowAddKpi(false); reload(); }}
        />
      )}
    </div>
  );
}

function KpiRow({ kpi }) {
  const display = kpi.unit === 'CURRENCY'
    ? fmt.currency(kpi.currentValue, { compact: true })
    : kpi.unit === 'PERCENT'
      ? `${kpi.currentValue}%`
      : fmt.number(kpi.currentValue);
  const target = kpi.unit === 'CURRENCY'
    ? fmt.currency(kpi.targetValue, { compact: true })
    : kpi.unit === 'PERCENT'
      ? `${kpi.targetValue}%`
      : fmt.number(kpi.targetValue);
  const tone = kpi.achievement > 0.6 ? 'bg-emerald-500' : kpi.achievement > 0.3 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-slate-800">{kpi.name}</span>
        <span className="text-xs text-slate-500">{display} / {target}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={tone} style={{ width: `${(kpi.achievement * 100).toFixed(0)}%`, height: '100%' }} />
      </div>
    </div>
  );
}

function CreateObjectiveModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', ownerName: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });
  async function submit(e) {
    e.preventDefault();
    await api.post('/okr/objectives', form);
    onCreated();
  }
  return (
    <Modal title="New Strategic Objective" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><label className="label">Owner</label>
          <input className="input" value={form.ownerName}
            onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start</label>
            <input className="input" type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><label className="label">End</label>
            <input className="input" type="date" value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

function CreateKpiModal({ objectiveId, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', unit: 'NUMBER', direction: 'MAX',
    weight: 1.0, startingValue: 0, targetValue: 100, currentValue: 0,
  });
  async function submit(e) {
    e.preventDefault();
    await api.post('/okr/kpis', { objectiveId, ...form });
    onCreated();
  }
  return (
    <Modal title="New KPI" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Unit</label>
            <select className="input" value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              <option value="NUMBER">Number</option>
              <option value="CURRENCY">Currency</option>
              <option value="PERCENT">Percent</option>
            </select></div>
          <div><label className="label">Direction</label>
            <select className="input" value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="MAX">Higher is better</option>
              <option value="MIN">Lower is better</option>
            </select></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Starting</label>
            <input className="input" type="number" step="0.01" value={form.startingValue}
              onChange={(e) => setForm({ ...form, startingValue: Number(e.target.value) })} /></div>
          <div><label className="label">Current</label>
            <input className="input" type="number" step="0.01" value={form.currentValue}
              onChange={(e) => setForm({ ...form, currentValue: Number(e.target.value) })} /></div>
          <div><label className="label">Target</label>
            <input className="input" type="number" step="0.01" value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: Number(e.target.value) })} required /></div>
        </div>
        <div><label className="label">Weight</label>
          <input className="input" type="number" step="0.1" value={form.weight}
            onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 sm:p-6 w-full max-w-lg my-auto max-h-[calc(100vh-2rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
