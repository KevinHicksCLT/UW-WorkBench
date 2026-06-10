import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { fmt, STAGE_ORDER, STAGE_LABELS } from '../lib/format';
import PageHeader from '../components/PageHeader';
import {
  Tile, StatusPill, StageBar, SeverityCell, Modal, SvgLineChart, generateMonths,
  makeTimelineScale, TimelineAxis, TimelineGrid, ACTIVITY_STATUS_COLOR, ACTIVITY_STATUS_LABEL,
  type Initiative, type Line, type Raid, type Milestone, type Objective, type Activity,
} from '../lib/portfolio';

const TABS = ['Summary', 'Charter', 'Strategic Alignment', 'Financials', 'Workplan', 'Resources', 'RAID', 'Audit'] as const;
type Tab = (typeof TABS)[number];

export default function PortfolioInitiative() {
  const { id } = useParams();
  const [init, setInit] = useState<Initiative | null>(null);
  const [tab, setTab] = useState<Tab>('Summary');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function load() { api.get(`/portfolio/initiatives/${id}`).then(setInit).catch((e) => setError(e.message)); }
  useEffect(() => { load(); }, [id]);

  async function workflow(action: string) {
    setBusy(true);
    try { await api.post(`/portfolio/initiatives/${id}/workflow`, { action }); load(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }
  async function setStatus(status: string) { await api.patch(`/portfolio/initiatives/${id}`, { status }); load(); }

  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;
  if (!init) return <div className="text-sm text-[#a3a3a3]">Loading…</div>;

  const program = init.workstream.program;
  const stageIdx = STAGE_ORDER.indexOf(init.stage);

  return (
    <div>
      <PageHeader
        title={init.name}
        subtitle={init.description ?? undefined}
        actions={
          <>
            {init.workflowAction === 'SUBMIT' && (
              <button className="btn-primary" disabled={busy} onClick={() => workflow('APPROVE')}>
                Approve → {STAGE_LABELS[STAGE_ORDER[stageIdx + 1]] ?? 'Done'}
              </button>
            )}
            {init.workflowAction !== 'SUBMIT' && stageIdx < STAGE_ORDER.length - 1 && (
              <button className="btn-primary" disabled={busy} onClick={() => workflow('SUBMIT')}>Submit for approval</button>
            )}
            {stageIdx > 0 && <button className="btn-secondary" disabled={busy} onClick={() => workflow('MOVE_BACK')}>Move back</button>}
          </>
        }
      />

      {/* Stage + status */}
      <div className="card-elevated p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] uppercase font-semibold tracking-[0.08em] text-[#a3a3a3]">Stage</span>
            <span className="font-semibold text-[#171717]">{STAGE_LABELS[init.stage]}</span>
            {init.workflowAction === 'SUBMIT' && <span className="pill-amber">Pending approval</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase font-semibold tracking-[0.08em] text-[#a3a3a3]">Status</span>
            <select className="input w-36" value={init.status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ON_TRACK">On Track</option>
              <option value="AT_RISK">At Risk</option>
              <option value="OFF_TRACK">Off Track</option>
            </select>
          </div>
        </div>
        <StageBar stage={init.stage} />
        <div className="grid grid-cols-5 mt-2 text-[10px] sm:text-xs text-[#a3a3a3]">
          {STAGE_ORDER.map((s) => <div key={s} className="text-center truncate px-0.5">{STAGE_LABELS[s]}</div>)}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label="Cumulative Benefit" value={fmt.currency(init.cumulativeBenefit, { compact: true })} tone="positive" />
        <Tile label="Cumulative Cost" value={fmt.currency(init.cumulativeCost, { compact: true })} />
        <Tile label="Net Benefit" value={fmt.currency(init.cumulativeNetBenefit, { compact: true })} tone={init.cumulativeNetBenefit >= 0 ? 'positive' : 'negative'} />
        <Tile label="Value Score" value={init.valueScore} hint={`${init.objectives.length} linked objective${init.objectives.length !== 1 ? 's' : ''}`} />
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

      {tab === 'Summary' && <SummaryTab init={init} />}
      {tab === 'Charter' && <CharterTab init={init} reload={load} />}
      {tab === 'Strategic Alignment' && <AlignmentTab init={init} reload={load} />}
      {tab === 'Financials' && <FinancialsTab init={init} reload={load} />}
      {tab === 'Workplan' && <WorkplanTab init={init} reload={load} />}
      {tab === 'Resources' && <ResourcesTab init={init} reload={load} />}
      {tab === 'RAID' && <RaidTab init={init} reload={load} />}
      {tab === 'Audit' && <AuditTab initId={init.id} />}
    </div>
  );
}

// ── SUMMARY ──────────────────────────────────────────────────────────────
function SummaryTab({ init }: { init: Initiative }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card-elevated p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Description</h3>
        <p className="text-sm text-[#525252] whitespace-pre-line">{init.description || 'No description provided.'}</p>
        {init.statusNote && (
          <div className="mt-4 pt-4 border-t border-[#f5f5f5]">
            <h3 className="text-sm font-semibold text-[#171717] mb-2">Status note</h3>
            <p className="text-sm text-[#666666] italic">{init.statusNote}</p>
          </div>
        )}
      </div>
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Details</h3>
        <dl className="text-sm space-y-2">
          <Field label="Workstream" value={init.workstream.name} />
          <Field label="Start" value={fmt.date(init.startDate)} />
          <Field label="Due" value={fmt.date(init.dueDate)} />
          <Field label="State" value={init.state} />
        </dl>
        <h3 className="text-sm font-semibold text-[#171717] mt-4 mb-3 pt-3 border-t border-[#f5f5f5]">Operating model</h3>
        <dl className="text-sm space-y-2">
          <Field label="Value stream" value={init.valueStreamName} to={init.valueStreamId ? `/overview?focus=${init.valueStreamId}` : undefined} />
          <Field label="Division" value={init.divisionName} to={init.divisionId ? `/divisions/${init.divisionId}` : undefined} />
          <Field label="Owner role" value={init.ownerRoleName} to={init.ownerRoleId ? `/roles/${init.ownerRoleId}` : undefined} />
          <Field label="Sponsor role" value={init.sponsorRoleName} to={init.sponsorRoleId ? `/roles/${init.sponsorRoleId}` : undefined} />
        </dl>
      </div>
    </div>
  );
}

function Field({ label, value, to }: { label: string; value: string | null | undefined; to?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#a3a3a3]">{label}</dt>
      <dd className="font-medium text-[#171717] text-right truncate">
        {value ? (to ? <Link to={to} className="text-[#4f46e5] hover:underline">{value}</Link> : value) : '—'}
      </dd>
    </div>
  );
}

// ── CHARTER ──────────────────────────────────────────────────────────────
function CharterTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [complexity, setComplexity] = useState(String(init.complexityScore));
  const [saving, setSaving] = useState(false);
  const dirty = Number(complexity) !== init.complexityScore;

  async function save() {
    const n = Number(complexity);
    if (Number.isNaN(n) || n < 0 || n > 10) { alert('Complexity must be between 0 and 10.'); return; }
    setSaving(true);
    try { await api.patch(`/portfolio/initiatives/${init.id}`, { complexityScore: n }); reload(); }
    catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Complexity Score</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">Delivery complexity, 0 (trivial) – 10 (extreme). Used as the x-axis of the program prioritization matrix.</p>
        <div className="flex items-center gap-3">
          <input
            className="input w-28 text-right tnum"
            type="number" min={0} max={10} step={0.5}
            value={complexity}
            onChange={(e) => setComplexity(e.target.value)}
          />
          <button className="btn-primary text-xs" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Value Score</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">Σ impact × objective weight across linked objectives — maintained automatically from the Strategic Alignment tab.</p>
        <div className="text-3xl font-semibold tnum text-[#171717]">{init.valueScore}</div>
        <div className="text-xs text-[#a3a3a3] mt-1">{init.objectives.length} linked objective{init.objectives.length !== 1 && 's'}</div>
      </div>
    </div>
  );
}

// ── STRATEGIC ALIGNMENT ──────────────────────────────────────────────────
function AlignmentTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [addId, setAddId] = useState('');
  const [addImpact, setAddImpact] = useState(3);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/portfolio/objectives?companyId=${init.companyId}`).then(setObjectives).catch((e) => setError(e.message));
  }, [init.companyId]);

  const linkedIds = new Set(init.objectives.map((l) => l.objectiveId));
  const available = objectives.filter((o) => !linkedIds.has(o.id));

  async function run(fn: () => Promise<unknown>) {
    try { await fn(); reload(); } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">Value Score</h3>
          <p className="text-xs text-[#a3a3a3]">Σ impact × objective weight across linked objectives — recomputed on every change below.</p>
        </div>
        <div className="text-3xl font-semibold tnum text-[#171717]">{init.valueScore}</div>
      </div>

      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Linked strategic objectives</h3>
        {error && <div className="text-sm text-[#be123c] mb-2">{error}</div>}
        {init.objectives.length === 0 ? (
          <div className="text-sm text-[#a3a3a3] py-2">No objectives linked yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
                <tr>
                  <th className="text-left pb-2 font-semibold">Objective</th>
                  <th className="text-right pb-2 font-semibold w-20">Weight</th>
                  <th className="text-left pb-2 font-semibold w-36 pl-4">Impact (1–5)</th>
                  <th className="text-right pb-2 font-semibold w-28">Contribution</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {init.objectives.map((l) => (
                  <tr key={l.id} className="border-b border-[#f5f5f5]">
                    <td className="py-2.5 font-medium text-[#171717]">{l.objective.name}</td>
                    <td className="py-2.5 text-right tnum text-[#666666]">{l.objective.weight}</td>
                    <td className="py-2.5 pl-4">
                      <select
                        className="input text-xs w-24"
                        value={l.impact}
                        onChange={(e) => run(() => api.patch(`/portfolio/initiatives/objectives/${l.id}`, { impact: Number(e.target.value) }))}
                      >
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 text-right tnum text-[#171717]">{Math.round(l.impact * l.objective.weight * 10) / 10}</td>
                    <td className="py-2.5 text-right">
                      <button
                        className="text-[#be123c] hover:underline text-sm"
                        title="Remove link"
                        onClick={() => run(() => api.delete(`/portfolio/initiatives/objectives/${l.id}`))}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-[#f5f5f5]">
          <div className="flex-1 min-w-48">
            <label className="label">Add objective</label>
            <select className="input" value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">— select an objective —</option>
              {available.map((o) => <option key={o.id} value={o.id}>{o.name} (weight {o.weight})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Impact</label>
            <select className="input w-20" value={addImpact} onChange={(e) => setAddImpact(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button
            className="btn-primary text-xs"
            disabled={!addId}
            onClick={() => run(async () => { await api.post(`/portfolio/initiatives/${init.id}/objectives`, { objectiveId: addId, impact: addImpact }); setAddId(''); setAddImpact(3); })}
          >Link objective</button>
        </div>
      </div>
    </div>
  );
}

// ── FINANCIALS ───────────────────────────────────────────────────────────
function FinancialsTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [showCreate, setShowCreate] = useState<'BENEFIT' | 'COST' | null>(null);

  const months = generateMonths(
    init.startDate,
    // chart spans the widest of the line ranges / initiative due date
    init.dueDate,
  );
  const sum = (lines: Line[], dataset: string, month: string) =>
    lines.reduce((a, l) => a + l.values.filter((v) => v.dataset === dataset && v.periodStart.slice(0, 7) === month).reduce((x, v) => x + v.amount, 0), 0);

  return (
    <div className="space-y-4">
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Monthly benefits &amp; costs — Actual vs Target</h3>
        <SvgLineChart
          labels={months}
          formatValue={(v) => `$${Math.round(v / 1000)}k`}
          series={[
            { name: 'Benefit Actual', color: '#047857', data: months.map((m) => sum(init.benefits, 'ACTUAL', m)) },
            { name: 'Benefit Target', color: '#10b981', dashed: true, data: months.map((m) => sum(init.benefits, 'TARGET', m)) },
            { name: 'Cost Actual', color: '#be123c', data: months.map((m) => sum(init.costs, 'ACTUAL', m)) },
            { name: 'Cost Target', color: '#fb7185', dashed: true, data: months.map((m) => sum(init.costs, 'TARGET', m)) },
          ]}
        />
      </div>

      <LineSection title="Benefits" type="BENEFIT" lines={init.benefits} onCreate={() => setShowCreate('BENEFIT')} onChange={reload} />
      <LineSection title="Costs" type="COST" lines={init.costs} onCreate={() => setShowCreate('COST')} onChange={reload} />

      {showCreate && <CreateLineModal type={showCreate} init={init} onClose={() => setShowCreate(null)} onCreated={() => { setShowCreate(null); reload(); }} />}
    </div>
  );
}

function LineSection({ title, type, lines, onCreate, onChange }: { title: string; type: 'BENEFIT' | 'COST'; lines: Line[]; onCreate: () => void; onChange: () => void }) {
  const [editing, setEditing] = useState<Line | null>(null);
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
        <button className="btn-secondary text-xs" onClick={onCreate}>+ Add {type === 'BENEFIT' ? 'benefit' : 'cost'}</button>
      </div>
      {lines.length === 0 ? (
        <div className="text-sm text-[#a3a3a3] py-2">No lines yet.</div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold">Name</th>
                <th className="text-left pb-2 font-semibold">Category</th>
                <th className="text-left pb-2 font-semibold">Range</th>
                <th className="text-right pb-2 font-semibold">Actual</th>
                <th className="text-right pb-2 font-semibold">Target</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const actual = l.values.filter((v) => v.dataset === 'ACTUAL').reduce((a, v) => a + v.amount, 0);
                const target = l.values.filter((v) => v.dataset === 'TARGET').reduce((a, v) => a + v.amount, 0);
                return (
                  <tr key={l.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] cursor-pointer" onClick={() => setEditing(l)}>
                    <td className="py-2.5 font-medium text-[#171717]">{l.name}</td>
                    <td className="py-2.5 text-[#666666]">{l.category || '—'}</td>
                    <td className="py-2.5 text-[#666666] text-xs">{fmt.month(l.startDate)} → {fmt.month(l.endDate)}</td>
                    <td className="py-2.5 text-right tnum">{fmt.currency(actual, { compact: true })}</td>
                    <td className="py-2.5 text-right text-[#a3a3a3] tnum">{fmt.currency(target, { compact: true })}</td>
                    <td className="py-2.5 text-right">
                      <button
                        className="text-xs text-[#be123c] hover:underline"
                        onClick={async (e) => { e.stopPropagation(); if (!confirm('Delete this line?')) return; await api.delete(`/portfolio/lines/${type}/${l.id}`); onChange(); }}
                      >Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EditValuesModal type={type} line={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />}
    </div>
  );
}

function CreateLineModal({ type, init, onClose, onCreated }: { type: 'BENEFIT' | 'COST'; init: Initiative; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', category: type === 'BENEFIT' ? 'Cost Savings' : 'OPEX',
    startDate: init.startDate.slice(0, 10), endDate: init.dueDate.slice(0, 10),
  });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await api.post('/portfolio/lines', { type, initiativeId: init.id, ...form }); onCreated(); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title={`New ${type === 'BENEFIT' ? 'Benefit' : 'Cost'} Line`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Category</label>
          <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start</label>
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><label className="label">End</label>
            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
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

function EditValuesModal({ type, line, onClose, onSaved }: { type: 'BENEFIT' | 'COST'; line: Line; onClose: () => void; onSaved: () => void }) {
  const [dataset, setDataset] = useState<'ACTUAL' | 'TARGET' | 'FORECAST'>('ACTUAL');
  const months = generateMonths(line.startDate, line.endDate);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v: Record<string, number> = {};
    for (const x of line.values) if (x.dataset === dataset) v[x.periodStart.slice(0, 7)] = x.amount;
    setValues(v);
  }, [dataset, line]);

  async function save() {
    setSaving(true);
    try {
      const payload = months.map((m) => ({ periodStart: `${m}-01`, amount: Number(values[m] || 0) }));
      await api.post('/portfolio/values', { type, lineId: line.id, dataset, values: payload });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`${line.name} — monthly values`} onClose={onClose} wide>
      <div className="mb-3 flex items-center gap-2">
        {(['ACTUAL', 'TARGET', 'FORECAST'] as const).map((d) => (
          <button key={d} className={dataset === d ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setDataset(d)}>{d}</button>
        ))}
      </div>
      <div className="max-h-96 overflow-y-auto border border-[#eaeaea] rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#a3a3a3] sticky top-0">
            <tr><th className="text-left p-2 font-semibold">Month</th><th className="text-right p-2 font-semibold">Amount</th></tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m} className="border-t border-[#f5f5f5]">
                <td className="p-2 text-[#666666]">{m}</td>
                <td className="p-2 text-right">
                  <input type="number" className="input text-right w-32 ml-auto" value={values[m] ?? ''} onChange={(e) => setValues({ ...values, [m]: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save ${dataset}`}</button>
      </div>
    </Modal>
  );
}

// ── WORKPLAN (timeline) ──────────────────────────────────────────────────
function WorkplanTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [showCreateM, setShowCreateM] = useState(false);
  const [showCreateA, setShowCreateA] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const dates = [
    ...init.activities.flatMap((a) => [a.startDate, a.endDate]),
    ...init.milestones.map((m) => m.dueDate),
  ];
  const scale = makeTimelineScale(dates.length ? dates : [init.startDate, init.dueDate])!;
  const byId = new Map(init.activities.map((a) => [a.id, a]));

  async function toggle(m: Milestone) {
    await api.patch(`/portfolio/initiatives/milestones/${m.id}`, { status: m.status === 'DONE' ? 'PENDING' : 'DONE' });
    reload();
  }

  return (
    <div className="card-elevated p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Workplan timeline</h3>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-xs" onClick={() => setShowCreateA(true)}>+ Activity</button>
          <button className="btn-secondary text-xs" onClick={() => setShowCreateM(true)}>+ Milestone</button>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-[#525252]">
        {Object.entries(ACTIVITY_STATUS_LABEL).map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: ACTIVITY_STATUS_COLOR[k] }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2 h-2 rotate-45 bg-[#171717]" /> Milestone</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2 h-2 rotate-45 bg-[#b45309]" /> Gate</span>
      </div>

      {/* axis */}
      <div className="flex gap-3 border-b border-[#eaeaea] pb-0.5 mb-1">
        <div className="w-48 flex-shrink-0" />
        <div className="flex-1 min-w-0"><TimelineAxis scale={scale} /></div>
      </div>

      {init.activities.length === 0 && init.milestones.length === 0 ? (
        <div className="text-sm text-[#a3a3a3] py-3">No activities or milestones yet.</div>
      ) : (
        <div className="flex gap-3">
          <div className="w-48 flex-shrink-0">
            {init.activities.map((a) => {
              const dep = a.dependsOnId ? byId.get(a.dependsOnId) : null;
              return (
                <div key={a.id} className="h-10 flex flex-col justify-center cursor-pointer hover:bg-[#fafafa] rounded px-1 min-w-0" onClick={() => setEditing(a)}>
                  <div className="text-sm font-medium text-[#171717] truncate leading-tight">{a.name}</div>
                  {dep && <div className="text-[10px] text-[#a3a3a3] truncate leading-tight">after: {dep.name}</div>}
                </div>
              );
            })}
            {init.milestones.map((m) => (
              <div key={m.id} className="h-10 flex items-center gap-2 px-1 min-w-0">
                <input type="checkbox" checked={m.status === 'DONE'} onChange={() => toggle(m)} className="w-3.5 h-3.5 accent-[#171717] flex-shrink-0" />
                <span className={'text-sm truncate ' + (m.status === 'DONE' ? 'line-through text-[#a3a3a3]' : 'text-[#171717]')}>{m.name}</span>
                {m.isGate && <span className="pill-blue text-[10px] flex-shrink-0">GATE</span>}
                <button
                  className="ml-auto text-[10px] text-[#be123c] hover:underline flex-shrink-0"
                  onClick={async () => { if (!confirm('Delete milestone?')) return; await api.delete(`/portfolio/initiatives/milestones/${m.id}`); reload(); }}
                >del</button>
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0 relative">
            <TimelineGrid scale={scale} />
            {init.activities.map((a) => {
              const left = scale.pct(a.startDate);
              const width = Math.max(1.2, scale.pct(a.endDate) - left);
              return (
                <div key={a.id} className="h-10 relative cursor-pointer" onClick={() => setEditing(a)}>
                  <div
                    className="absolute top-2.5 h-5 rounded"
                    title={`${a.name} — ${fmt.date(a.startDate)} → ${fmt.date(a.endDate)} (${ACTIVITY_STATUS_LABEL[a.status] ?? a.status})`}
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: ACTIVITY_STATUS_COLOR[a.status] ?? '#a3a3a3' }}
                  />
                </div>
              );
            })}
            {init.milestones.map((m) => (
              <div key={m.id} className="h-10 relative">
                <div
                  className="absolute top-3.5 w-3 h-3 rotate-45"
                  title={`${m.name} — due ${fmt.date(m.dueDate)}`}
                  style={{ left: `calc(${scale.pct(m.dueDate)}% - 6px)`, backgroundColor: m.isGate ? '#b45309' : '#171717', opacity: m.status === 'DONE' ? 0.35 : 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateM && <CreateMilestoneModal initId={init.id} onClose={() => setShowCreateM(false)} onCreated={() => { setShowCreateM(false); reload(); }} />}
      {(showCreateA || editing) && (
        <ActivityModal
          init={init}
          activity={editing}
          onClose={() => { setShowCreateA(false); setEditing(null); }}
          onSaved={() => { setShowCreateA(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

// Create (activity == null) or edit a workplan activity.
function ActivityModal({ init, activity, onClose, onSaved }: { init: Initiative; activity: Activity | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: activity?.name ?? '',
    startDate: (activity?.startDate ?? init.startDate).slice(0, 10),
    endDate: (activity?.endDate ?? init.dueDate).slice(0, 10),
    status: activity?.status ?? 'PLANNED',
    dependsOnId: activity?.dependsOnId ?? '',
  });
  const [error, setError] = useState('');
  const options = init.activities.filter((a) => a.id !== activity?.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (activity) {
        await api.patch(`/portfolio/initiatives/activities/${activity.id}`, {
          name: form.name, startDate: form.startDate, endDate: form.endDate, status: form.status,
          dependsOnId: form.dependsOnId || null,
        });
      } else {
        await api.post(`/portfolio/initiatives/${init.id}/activities`, {
          name: form.name, startDate: form.startDate, endDate: form.endDate,
          dependsOnId: form.dependsOnId || null,
        });
      }
      onSaved();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove() {
    if (!activity || !confirm('Delete this activity?')) return;
    try { await api.delete(`/portfolio/initiatives/activities/${activity.id}`); onSaved(); }
    catch (err) { setError((err as Error).message); }
  }

  return (
    <Modal title={activity ? 'Edit Activity' : 'New Activity'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start</label>
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><label className="label">End</label>
            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
        </div>
        {activity && (
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
            </select></div>
        )}
        <div><label className="label">Depends on</label>
          <select className="input" value={form.dependsOnId} onChange={(e) => setForm({ ...form, dependsOnId: e.target.value })}>
            <option value="">— none —</option>
            {options.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        {error && <div className="text-sm text-[#be123c]">{error}</div>}
        <div className="flex justify-between gap-2 pt-2">
          <div>{activity && <button type="button" className="text-xs text-[#be123c] hover:underline" onClick={remove}>Delete activity</button>}</div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary">{activity ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── RESOURCES ────────────────────────────────────────────────────────────
function ResourcesTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [people, setPeople] = useState<{ id: string; name: string; title: string | null }[]>([]);
  const [form, setForm] = useState({
    name: '', roleName: '', allocationPct: 50,
    startDate: init.startDate.slice(0, 10), endDate: init.dueDate.slice(0, 10),
  });
  const [error, setError] = useState('');

  useEffect(() => { api.get(`/portfolio/people?companyId=${init.companyId}`).then(setPeople).catch(() => {}); }, [init.companyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const person = people.find((p) => p.name === form.name.trim());
    try {
      await api.post(`/portfolio/initiatives/${init.id}/resources`, {
        name: form.name.trim(),
        personId: person?.id ?? null,
        roleName: form.roleName.trim() || person?.title || null,
        allocationPct: Number(form.allocationPct),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setForm({ ...form, name: '', roleName: '', allocationPct: 50 });
      setError('');
      reload();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="card-elevated p-5">
      <h3 className="text-sm font-semibold text-[#171717] mb-3">Resources</h3>
      {init.resources.length === 0 ? (
        <div className="text-sm text-[#a3a3a3] py-2">No resources assigned yet.</div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold">Name</th>
                <th className="text-left pb-2 font-semibold">Role</th>
                <th className="text-right pb-2 font-semibold w-28">Allocation %</th>
                <th className="text-left pb-2 font-semibold pl-4 w-28">Start</th>
                <th className="text-left pb-2 font-semibold w-28">End</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {init.resources.map((r) => (
                <tr key={r.id} className="border-b border-[#f5f5f5]">
                  <td className="py-2.5 font-medium text-[#171717]">{r.name}</td>
                  <td className="py-2.5 text-[#666666]">{r.roleName ?? '—'}</td>
                  <td className="py-2.5 text-right tnum">{r.allocationPct}%</td>
                  <td className="py-2.5 pl-4 text-[#666666] text-xs">{fmt.date(r.startDate)}</td>
                  <td className="py-2.5 text-[#666666] text-xs">{fmt.date(r.endDate)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      className="text-xs text-[#be123c] hover:underline"
                      onClick={async () => { if (!confirm('Remove this resource?')) return; await api.delete(`/portfolio/initiatives/resources/${r.id}`); reload(); }}
                    >Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-[#f5f5f5]">
        <div className="flex-1 min-w-44">
          <label className="label">Name</label>
          <input className="input" list="portfolio-people" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pick a person or type a name" required />
          <datalist id="portfolio-people">
            {people.map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
        </div>
        <div className="w-44">
          <label className="label">Role</label>
          <input className="input" value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} placeholder="(from person if blank)" />
        </div>
        <div className="w-24">
          <label className="label">Alloc %</label>
          <input className="input text-right tnum" type="number" min={1} max={100} value={form.allocationPct} onChange={(e) => setForm({ ...form, allocationPct: Number(e.target.value) })} required />
        </div>
        <div>
          <label className="label">Start</label>
          <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        </div>
        <div>
          <label className="label">End</label>
          <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
        </div>
        <button className="btn-primary text-xs">Add resource</button>
        {error && <div className="w-full text-sm text-[#be123c]">{error}</div>}
      </form>
    </div>
  );
}

function CreateMilestoneModal({ initId, onClose, onCreated }: { initId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), isGate: false });
  async function submit(e: React.FormEvent) { e.preventDefault(); await api.post(`/portfolio/initiatives/${initId}/milestones`, form); onCreated(); }
  return (
    <Modal title="New Milestone" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Due date</label>
          <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div>
        <label className="flex items-center gap-2 text-sm text-[#525252]">
          <input type="checkbox" className="accent-[#171717]" checked={form.isGate} onChange={(e) => setForm({ ...form, isGate: e.target.checked })} />
          Stage-gate milestone
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

// ── RAID ─────────────────────────────────────────────────────────────────
function RaidTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Risks, Assumptions, Issues, Decisions</h3>
        <button className="btn-secondary text-xs" onClick={() => setShowCreate(true)}>+ RAID item</button>
      </div>
      {init.raidItems.length === 0 ? (
        <div className="text-sm text-[#a3a3a3]">No RAID items.</div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold w-24">Type</th>
                <th className="text-left pb-2 font-semibold">Title</th>
                <th className="text-center pb-2 font-semibold w-20">Severity</th>
                <th className="text-left pb-2 font-semibold w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {init.raidItems.map((r) => (
                <tr key={r.id} className="border-b border-[#f5f5f5]">
                  <td className="py-2.5"><span className="pill-slate text-xs">{r.type}</span></td>
                  <td className="py-2.5">
                    <div className="font-medium text-[#171717]">{r.title}</div>
                    {r.mitigation && <div className="text-xs text-[#a3a3a3] mt-0.5">{r.mitigation}</div>}
                  </td>
                  <td className="py-2.5 text-center"><SeverityCell value={r.severity} /></td>
                  <td className="py-2.5">
                    <select className="input text-xs" value={r.status} onChange={async (e) => { await api.patch(`/portfolio/raid/${r.id}`, { status: e.target.value }); reload(); }}>
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
      {showCreate && <CreateRaidModal initId={init.id} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />}
    </div>
  );
}

function CreateRaidModal({ initId, onClose, onCreated }: { initId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ type: 'RISK', title: '', description: '', probability: 3, impact: 3, mitigation: '' });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await api.post('/portfolio/raid', { initiativeId: initId, ...form }); onCreated(); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title="New RAID Item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="RISK">Risk</option><option value="ASSUMPTION">Assumption</option><option value="ISSUE">Issue</option><option value="DECISION">Decision</option>
          </select></div>
        <div><label className="label">Title</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Probability (1–5)</label>
            <input className="input" type="number" min={1} max={5} value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} /></div>
          <div><label className="label">Impact (1–5)</label>
            <input className="input" type="number" min={1} max={5} value={form.impact} onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })} /></div>
        </div>
        <div><label className="label">Mitigation</label>
          <textarea className="input" rows={2} value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} /></div>
        {error && <div className="text-sm text-[#be123c]">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

// ── AUDIT ────────────────────────────────────────────────────────────────
function AuditTab({ initId }: { initId: string }) {
  const [entries, setEntries] = useState<{ id: string; action: string; actorEmail: string; createdAt: string; diff: string | null }[]>([]);
  useEffect(() => { api.get(`/audit?entityType=PortfolioInitiative&entityId=${initId}`).then(setEntries).catch(() => {}); }, [initId]);
  return (
    <div className="card-elevated p-5">
      <h3 className="text-sm font-semibold text-[#171717] mb-3">Audit trail</h3>
      {entries.length === 0 ? (
        <div className="text-sm text-[#a3a3a3]">No history yet.</div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 py-2 border-b border-[#f5f5f5] last:border-0">
              <div className="text-xs text-[#a3a3a3] w-36 flex-shrink-0">{new Date(e.createdAt).toLocaleString()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm"><span className="pill-slate text-xs mr-2">{e.action}</span><span className="text-[#525252]">{e.actorEmail}</span></div>
                {e.diff && <pre className="mt-1 text-xs text-[#666666] bg-[#fafafa] border border-[#eaeaea] rounded p-2 overflow-auto">{e.diff}</pre>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
