import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmt, STAGE_ORDER, STAGE_LABELS } from '../lib/format';
import PageHeader from '../components/PageHeader';
import KpiTile from '../components/KpiTile';
import StatusPill from '../components/StatusPill';
import StageBadge from '../components/StageBadge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const TABS = ['Summary', 'Financials', 'Workplan', 'RAID', 'Alignment', 'Audit'];

export default function InitiativeDetail() {
  const { id } = useParams();
  const [init, setInit] = useState<any>(null);
  const [tab, setTab] = useState('Summary');
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, [id]);
  async function load() {
    const data = await api.get(`/initiatives/${id}`);
    setInit(data);
  }

  async function workflow(action: string) {
    setBusy(true);
    try {
      await api.post(`/initiatives/${id}/workflow`, { action });
      await load();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  async function setStatus(status: string) {
    await api.patch(`/initiatives/${id}`, { status });
    await load();
  }

  if (!init) return <div>Loading…</div>;

  const program = init.workstream.program;
  const stageIdx = STAGE_ORDER.indexOf(init.stage);

  return (
    <div>
      <PageHeader
        title={init.name}
        subtitle={init.description}
        breadcrumbs={[
          { to: '/programs', label: 'Programs' },
          { to: `/programs/${program.id}`, label: program.name },
          { label: init.workstream.name },
          { label: init.name },
        ]}
        actions={
          <>
            {init.workflowAction === 'SUBMIT' && (
              <button className="btn-primary" disabled={busy} onClick={() => workflow('APPROVE')}>
                Approve → {STAGE_LABELS[STAGE_ORDER[stageIdx + 1]] || 'Done'}
              </button>
            )}
            {init.workflowAction !== 'SUBMIT' && stageIdx < STAGE_ORDER.length - 1 && (
              <button className="btn-primary" disabled={busy} onClick={() => workflow('SUBMIT')}>
                Submit for Approval
              </button>
            )}
            {stageIdx > 0 && (
              <button className="btn-secondary" disabled={busy} onClick={() => workflow('MOVE_BACK')}>
                Move Back
              </button>
            )}
          </>
        }
      />

      {/* Stage progress + status row */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs uppercase font-semibold text-slate-500">Stage</span>
            <span className="font-semibold text-slate-900">{STAGE_LABELS[init.stage]}</span>
            {init.workflowAction === 'SUBMIT' && (
              <span className="pill-amber">Pending Approval</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-semibold text-slate-500">Status</span>
            <select
              className="input text-sm w-36"
              value={init.status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ON_TRACK">On Track</option>
              <option value="AT_RISK">At Risk</option>
              <option value="OFF_TRACK">Off Track</option>
            </select>
          </div>
        </div>
        <StageBadge stage={init.stage} />
        <div className="grid grid-cols-5 mt-2 text-[10px] sm:text-xs text-slate-500">
          {STAGE_ORDER.map((s) => (
            <div key={s} className="text-center truncate px-0.5">{STAGE_LABELS[s]}</div>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiTile
          label="Cumulative Benefit"
          value={fmt.currency(init.cumulativeBenefit, { compact: true })}
          tone="positive"
        />
        <KpiTile
          label="Cumulative Cost"
          value={fmt.currency(init.cumulativeCost, { compact: true })}
          tone="warning"
        />
        <KpiTile
          label="Net Benefit"
          value={fmt.currency(init.cumulativeNetBenefit, { compact: true })}
          tone={init.cumulativeNetBenefit > 0 ? 'positive' : 'negative'}
        />
        <KpiTile
          label="Value Score"
          value={init.valueScore.toFixed(1)}
          sublabel="Strategic alignment weight"
          tone="accent"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-5 -mx-4 sm:mx-0 overflow-x-auto">
        <nav className="flex gap-1 px-4 sm:px-0 whitespace-nowrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'px-3 sm:px-4 py-2 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ' +
                (tab === t
                  ? 'text-brand-700 border-brand-600'
                  : 'text-slate-500 border-transparent hover:text-slate-800')
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Summary' && <SummaryTab init={init} />}
      {tab === 'Financials' && <FinancialsTab init={init} reload={load} />}
      {tab === 'Workplan' && <WorkplanTab init={init} reload={load} />}
      {tab === 'RAID' && <RaidTab init={init} reload={load} />}
      {tab === 'Alignment' && <AlignmentTab init={init} reload={load} />}
      {tab === 'Audit' && <AuditTab initId={init.id} />}
    </div>
  );
}

function SummaryTab({ init }: { init: any }) {
  const owner = init.owner;
  const sponsor = init.sponsor;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card lg:col-span-2">
        <h3 className="font-semibold text-slate-900 mb-3">Description</h3>
        <p className="text-sm text-slate-700 whitespace-pre-line">
          {init.description || 'No description provided.'}
        </p>
        {init.statusNote && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-2">Status note</h3>
            <p className="text-sm text-slate-600 italic">{init.statusNote}</p>
          </div>
        )}
      </div>
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-3">Details</h3>
        <dl className="text-sm space-y-2">
          <Field label="Owner" value={owner ? `${owner.name}` : '—'} />
          <Field label="Sponsor" value={sponsor ? `${sponsor.name}` : '—'} />
          <Field label="Start" value={fmt.date(init.startDate)} />
          <Field label="Due" value={fmt.date(init.dueDate)} />
          <Field label="State" value={init.state} />
          <Field label="Workstream" value={init.workstream.name} />
        </dl>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

// ── FINANCIALS ─────────────────────────────────────────────────────────

function FinancialsTab({ init, reload }: { init: any; reload: () => void }) {
  const [showCreate, setShowCreate] = useState<any>(null); // 'BENEFIT' | 'COST'

  // Build chart of monthly Actual vs Target
  const monthly: Record<string, any> = {};
  for (const b of init.benefits) {
    for (const v of b.values) {
      const k = v.periodStart.slice(0, 7);
      if (!monthly[k]) monthly[k] = { period: k, ActualB: 0, TargetB: 0, ActualC: 0, TargetC: 0 };
      if (v.dataset === 'ACTUAL') monthly[k].ActualB += v.amount;
      if (v.dataset === 'TARGET') monthly[k].TargetB += v.amount;
    }
  }
  for (const c of init.costs) {
    for (const v of c.values) {
      const k = v.periodStart.slice(0, 7);
      if (!monthly[k]) monthly[k] = { period: k, ActualB: 0, TargetB: 0, ActualC: 0, TargetC: 0 };
      if (v.dataset === 'ACTUAL') monthly[k].ActualC += v.amount;
      if (v.dataset === 'TARGET') monthly[k].TargetC += v.amount;
    }
  }
  const series = Object.values(monthly).sort((a, b) => a.period.localeCompare(b.period));

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-3">Monthly Benefits & Costs — Actual vs Target</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt.currency(v as number)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="ActualB" name="Benefit Actual" stroke="#059669" strokeWidth={2} />
            <Line type="monotone" dataKey="TargetB" name="Benefit Target" stroke="#10b981" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="ActualC" name="Cost Actual" stroke="#dc2626" strokeWidth={2} />
            <Line type="monotone" dataKey="TargetC" name="Cost Target" stroke="#f87171" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <LineSection
        title="Benefits"
        type="BENEFIT"
        lines={init.benefits}
        onCreate={() => setShowCreate('BENEFIT')}
        onChange={reload}
      />
      <LineSection
        title="Costs"
        type="COST"
        lines={init.costs}
        onCreate={() => setShowCreate('COST')}
        onChange={reload}
      />

      {showCreate && (
        <CreateLineModal
          type={showCreate}
          initiative={init}
          onClose={() => setShowCreate(null)}
          onCreated={() => { setShowCreate(null); reload(); }}
        />
      )}
    </div>
  );
}

function LineSection({ title, type, lines, onCreate, onChange }: { title: ReactNode; type: string; lines: any[]; onCreate: () => void; onChange: () => void }) {
  const [editingLine, setEditingLine] = useState<any>(null);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <button className="btn-secondary text-xs" onClick={onCreate}>+ Add {type === 'BENEFIT' ? 'Benefit' : 'Cost'}</button>
      </div>
      {lines.length === 0 ? (
        <div className="text-sm text-slate-500 italic py-2">No lines yet</div>
      ) : (
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="text-left pb-2 font-semibold">Name</th>
              <th className="text-left pb-2 font-semibold">Category</th>
              <th className="text-left pb-2 font-semibold">Range</th>
              <th className="text-right pb-2 font-semibold">Actual</th>
              <th className="text-right pb-2 font-semibold">Target</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const actual = l.values.filter((v: any) => v.dataset === 'ACTUAL').reduce((a: number, v: any) => a + v.amount, 0);
              const target = l.values.filter((v: any) => v.dataset === 'TARGET').reduce((a: number, v: any) => a + v.amount, 0);
              return (
                <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setEditingLine(l)}>
                  <td className="py-2.5 font-medium">{l.name}</td>
                  <td className="py-2.5 text-slate-600">{l.category || '—'}</td>
                  <td className="py-2.5 text-slate-600 text-xs">
                    {fmt.month(l.startDate)} → {fmt.month(l.endDate)}
                  </td>
                  <td className="py-2.5 text-right">{fmt.currency(actual, { compact: true })}</td>
                  <td className="py-2.5 text-right text-slate-500">{fmt.currency(target, { compact: true })}</td>
                  <td className="py-2.5 text-right">
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm('Delete this line?')) return;
                        await api.delete(`/benefits-costs/lines/${type}/${l.id}`);
                        onChange();
                      }}
                    >Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {editingLine && (
        <EditValuesModal
          type={type}
          line={editingLine}
          onClose={() => setEditingLine(null)}
          onSaved={() => { setEditingLine(null); onChange(); }}
        />
      )}
    </div>
  );
}

function CreateLineModal({ type, initiative, onClose, onCreated }: { type: string; initiative: any; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<any>({
    name: '',
    category: type === 'BENEFIT' ? 'Cost Savings' : 'OPEX',
    startDate: initiative.startDate.slice(0, 10),
    endDate: initiative.dueDate.slice(0, 10),
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post('/benefits-costs/lines', { type, initiativeId: initiative.id, ...form });
    onCreated();
  }
  return (
    <Modal title={`New ${type === 'BENEFIT' ? 'Benefit' : 'Cost'} Line`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Category</label>
          <input className="input" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
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

function EditValuesModal({ type, line, onClose, onSaved }: { type: string; line: any; onClose: () => void; onSaved: () => void }) {
  const [dataset, setDataset] = useState('ACTUAL');
  const months = generateMonths(line.startDate, line.endDate);
  const initialValues: Record<string, any> = {};
  for (const v of line.values) {
    if (v.dataset === dataset) {
      initialValues[v.periodStart.slice(0, 7)] = v.amount;
    }
  }
  const [values, setValues] = useState<any>(initialValues);

  // Reset values when dataset changes
  useEffect(() => {
    const v: Record<string, any> = {};
    for (const x of line.values) if (x.dataset === dataset) v[x.periodStart.slice(0, 7)] = x.amount;
    setValues(v);
  }, [dataset]);

  async function save() {
    const payload = months.map((m) => ({
      periodStart: `${m}-01`,
      amount: Number(values[m] || 0),
    }));
    await api.post('/benefits-costs/values', {
      type, lineId: line.id, dataset, values: payload,
    });
    onSaved();
  }

  return (
    <Modal title={`${line.name} — Monthly Values`} onClose={onClose} wide>
      <div className="mb-3 flex items-center gap-2">
        {['ACTUAL', 'TARGET', 'FORECAST'].map((d) => (
          <button key={d}
            className={dataset === d ? 'btn-primary text-xs px-3 py-1' : 'btn-secondary text-xs px-3 py-1'}
            onClick={() => setDataset(d)}>{d}</button>
        ))}
      </div>
      <div className="max-h-96 overflow-y-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0">
            <tr>
              <th className="text-left p-2 font-semibold">Month</th>
              <th className="text-right p-2 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m} className="border-t border-slate-100">
                <td className="p-2 text-slate-600">{m}</td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    className="input text-right w-32 ml-auto"
                    value={values[m] ?? ''}
                    onChange={(e) => setValues({ ...values, [m]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save {dataset}</button>
      </div>
    </Modal>
  );
}

function generateMonths(start: string, end: string) {
  const months = [];
  const s = new Date(start);
  const e = new Date(end);
  let cur = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cur <= e) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months;
}

// ── WORKPLAN (milestones) ──────────────────────────────────────────────

function WorkplanTab({ init, reload }: { init: any; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);

  async function toggleStatus(m: any) {
    const newStatus = m.status === 'DONE' ? 'PENDING' : 'DONE';
    await api.patch(`/initiatives/milestones/${m.id}`, { status: newStatus });
    reload();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Milestones</h3>
        <button className="btn-secondary text-xs" onClick={() => setShowCreate(true)}>+ Milestone</button>
      </div>
      {init.milestones.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No milestones</div>
      ) : (
        <div className="space-y-2">
          {init.milestones.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
              <input
                type="checkbox"
                checked={m.status === 'DONE'}
                onChange={() => toggleStatus(m)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className={`font-medium ${m.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {m.name}
                  {m.isGate && <span className="ml-2 pill-blue text-xs">GATE</span>}
                </div>
                <div className="text-xs text-slate-500">Due {fmt.date(m.dueDate)}</div>
              </div>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={async () => {
                  if (!confirm('Delete?')) return;
                  await api.delete(`/initiatives/milestones/${m.id}`);
                  reload();
                }}
              >Delete</button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateMilestoneModal
          initiativeId={init.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateMilestoneModal({ initiativeId, onClose, onCreated }: { initiativeId: any; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<any>({
    name: '',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    isGate: false,
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post(`/initiatives/${initiativeId}/milestones`, form);
    onCreated();
  }
  return (
    <Modal title="New Milestone" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Due Date</label>
          <input className="input" type="date" value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isGate}
            onChange={(e) => setForm({ ...form, isGate: e.target.checked })} />
          Stage gate milestone
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

// ── RAID ───────────────────────────────────────────────────────────────

function RaidTab({ init, reload }: { init: any; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Risks, Assumptions, Issues, Decisions</h3>
        <button className="btn-secondary text-xs" onClick={() => setShowCreate(true)}>+ RAID Item</button>
      </div>
      {init.raidItems.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No RAID items</div>
      ) : (
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="text-left pb-2 font-semibold w-20">Type</th>
              <th className="text-left pb-2 font-semibold">Title</th>
              <th className="text-center pb-2 font-semibold w-20">Severity</th>
              <th className="text-left pb-2 font-semibold w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {init.raidItems.map((r: any) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-2.5"><span className="pill-slate text-xs">{r.type}</span></td>
                <td className="py-2.5">
                  <div className="font-medium text-slate-800">{r.title}</div>
                  {r.mitigation && <div className="text-xs text-slate-500 mt-0.5">{r.mitigation}</div>}
                </td>
                <td className="py-2.5 text-center">
                  <span className={`inline-flex items-center justify-center w-9 h-7 rounded text-white font-semibold text-xs ${
                    r.severity >= 16 ? 'bg-red-500' : r.severity >= 9 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}>{r.severity}</span>
                </td>
                <td className="py-2.5">
                  <select
                    className="input text-xs"
                    value={r.status}
                    onChange={async (e) => {
                      await api.patch(`/raid/${r.id}`, { status: e.target.value });
                      reload();
                    }}
                  >
                    <option value="OPEN">Open</option>
                    <option value="MITIGATED">Mitigated</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {showCreate && (
        <CreateRaidModal
          initiativeId={init.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateRaidModal({ initiativeId, onClose, onCreated }: { initiativeId: any; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<any>({
    type: 'RISK', title: '', description: '',
    probability: 3, impact: 3, mitigation: '',
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post('/raid', { initiativeId, ...form });
    onCreated();
  }
  return (
    <Modal title="New RAID Item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Type</label>
          <select className="input" value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="RISK">Risk</option>
            <option value="ASSUMPTION">Assumption</option>
            <option value="ISSUE">Issue</option>
            <option value="DECISION">Decision</option>
          </select></div>
        <div><label className="label">Title</label>
          <input className="input" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Probability (1–5)</label>
            <input className="input" type="number" min="1" max="5" value={form.probability}
              onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} /></div>
          <div><label className="label">Impact (1–5)</label>
            <input className="input" type="number" min="1" max="5" value={form.impact}
              onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })} /></div>
        </div>
        <div><label className="label">Mitigation</label>
          <textarea className="input" rows={2} value={form.mitigation}
            onChange={(e) => setForm({ ...form, mitigation: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

// ── ALIGNMENT (objectives) ─────────────────────────────────────────────

function AlignmentTab({ init, reload }: { init: any; reload: () => void }) {
  const [objectives, setObjectives] = useState<any[]>([]);
  const [selectedObj, setSelectedObj] = useState('');
  const [impact, setImpact] = useState('MEDIUM');

  useEffect(() => {
    api.get('/okr/objectives').then(setObjectives);
  }, []);

  async function add() {
    if (!selectedObj) return;
    await api.post(`/initiatives/${init.id}/objectives`, { objectiveId: selectedObj, impact });
    setSelectedObj('');
    reload();
  }

  async function remove(objectiveId: string) {
    await api.delete(`/initiatives/${init.id}/objectives/${objectiveId}`);
    reload();
  }

  const linkedIds = new Set(init.objectiveLinks.map((l: any) => l.objectiveId));
  const available = objectives.filter((o) => !linkedIds.has(o.id));

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-3">Strategic Alignment</h3>

      {init.objectiveLinks.length === 0 ? (
        <div className="text-sm text-slate-500 italic mb-4">No strategic objectives linked.</div>
      ) : (
        <div className="table-scroll mb-4">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="text-left pb-2 font-semibold">Strategic Objective</th>
              <th className="text-left pb-2 font-semibold w-32">Impact</th>
              <th className="text-right pb-2 font-semibold w-20">Achievement</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {init.objectiveLinks.map((l: any) => (
              <tr key={l.objectiveId} className="border-t border-slate-100">
                <td className="py-2.5 font-medium text-slate-800">{l.objective.name}</td>
                <td className="py-2.5">
                  <span className={`pill ${
                    l.impact === 'HIGH' ? 'pill-blue' : l.impact === 'MEDIUM' ? 'pill-slate' : 'pill-slate'
                  }`}>{l.impact}</span>
                </td>
                <td className="py-2.5 text-right">{fmt.percent(l.objective.achievement)}</td>
                <td className="py-2.5 text-right">
                  <button className="text-xs text-red-600 hover:underline" onClick={() => remove(l.objectiveId)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {available.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs uppercase font-semibold text-slate-500 mb-2">Link an objective</h4>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <select className="input sm:flex-1" value={selectedObj} onChange={(e) => setSelectedObj(e.target.value)}>
              <option value="">Select objective…</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <select className="input flex-1 sm:flex-none sm:w-28" value={impact} onChange={(e) => setImpact(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <button className="btn-primary" onClick={add} disabled={!selectedObj}>Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AUDIT ──────────────────────────────────────────────────────────────

function AuditTab({ initId }: { initId: any }) {
  const [entries, setEntries] = useState<any[]>([]);
  useEffect(() => {
    api.get(`/audit?entityType=Initiative&entityId=${initId}`).then(setEntries);
  }, [initId]);

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-3">Audit Trail</h3>
      {entries.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No history yet</div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
              <div className="text-xs text-slate-500 w-32 flex-shrink-0">
                {new Date(e.createdAt).toLocaleString()}
              </div>
              <div className="flex-1">
                <div className="text-sm">
                  <span className="pill-slate text-xs mr-2">{e.action}</span>
                  <span className="text-slate-700">{e.actorEmail}</span>
                </div>
                {e.diff && (
                  <pre className="mt-1 text-xs text-slate-500 bg-slate-50 rounded p-2 overflow-auto">
                    {e.diff}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────

function Modal({ title, children, onClose, wide }: { title: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl p-5 sm:p-6 w-full my-auto max-h-[calc(100vh-2rem)] overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
