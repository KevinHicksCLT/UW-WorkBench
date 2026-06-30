import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useDialogs } from '../lib/dialogs';
import { fmt, STAGE_ORDER, STAGE_LABELS } from '../lib/format';
import PageHeader from '../components/PageHeader';
import AssistantMarkdown from '../components/AssistantMarkdown';
import {
  Tile, StatusPill, SeverityCell, Modal, SvgLineChart, generateMonths,
  makeTimelineScale, TimelineAxis, TimelineGrid, ACTIVITY_STATUS_COLOR, ACTIVITY_STATUS_LABEL,
  type Initiative, type Line, type Raid, type Milestone, type Objective, type Activity,
} from '../lib/portfolio';

const TABS = ['Summary', 'Charter', 'Strategic Alignment', 'Financials', 'Workplan', 'Change Log', 'Resources', 'RAID', 'Audit'] as const;
type Tab = (typeof TABS)[number];

export default function PortfolioInitiative() {
  const { id } = useParams();
  const dialogs = useDialogs();
  const [init, setInit] = useState<Initiative | null>(null);
  const [tab, setTab] = useState<Tab>('Summary');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function load() { api.get(`/portfolio/initiatives/${id}`).then(setInit).catch((e) => setError(e.message)); }
  useEffect(() => { load(); }, [id]);

  async function workflow(action: string) {
    setBusy(true);
    try { await api.post(`/portfolio/initiatives/${id}/workflow`, { action }); load(); }
    catch (e) { void dialogs.alert({ title: 'Workflow action failed', message: (e as Error).message }); }
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
        actions={
          <>
            {init.workflowAction === 'SUBMIT' && (
              <button className="btn-primary" disabled={busy} onClick={() => workflow('APPROVE')}>
                Approve → {STAGE_LABELS[STAGE_ORDER[stageIdx + 1]] ?? 'Done'}
              </button>
            )}
            {stageIdx > 0 && <button className="btn-secondary" disabled={busy} onClick={() => workflow('MOVE_BACK')}>Roll Back</button>}
          </>
        }
      />

      {/* Status (FB-04 — stage label + stage ladder removed) */}
      <div className="card-elevated p-5 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase font-semibold tracking-[0.08em] text-[#a3a3a3]">Status</span>
          <select className="input w-36" value={init.status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ON_TRACK">On Track</option>
            <option value="AT_RISK">At Risk</option>
            <option value="OFF_TRACK">Off Track</option>
          </select>
          {init.workflowAction === 'SUBMIT' && <span className="pill-amber">Pending approval</span>}
        </div>
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
      {tab === 'Change Log' && <ChangeLogTab init={init} />}
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
  const dialogs = useDialogs();
  const [complexity, setComplexity] = useState(String(init.complexityScore));
  const [saving, setSaving] = useState(false);
  const dirty = Number(complexity) !== init.complexityScore;

  async function save() {
    const n = Number(complexity);
    if (Number.isNaN(n) || n < 0 || n > 10) { void dialogs.alert({ title: 'Invalid value', message: 'Complexity must be between 0 and 10.' }); return; }
    setSaving(true);
    try { await api.patch(`/portfolio/initiatives/${init.id}`, { complexityScore: n }); reload(); }
    catch (e) { void dialogs.alert({ title: 'Save failed', message: (e as Error).message }); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <CharterNarrative init={init} />
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
    </div>
  );
}

// FB-13: an AI-drafted Project Charter narrative, shown at the top of the Charter
// tab. Generated server-side from the initiative's real data and cached in
// localStorage per initiative so it isn't regenerated on every visit (a manual
// "Regenerate" refreshes it). Renders the returned Markdown with AssistantMarkdown.
function CharterNarrative({ init }: { init: Initiative }) {
  const cacheKey = `charter:${init.id}`;
  const [text, setText] = useState<string>(() => localStorage.getItem(cacheKey) ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/portfolio/initiatives/${init.id}/charter`, {});
      const charter = res.charter ?? '';
      setText(charter);
      if (charter) localStorage.setItem(cacheKey, charter);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }

  // Auto-draft on first view when nothing is cached yet.
  useEffect(() => {
    if (!text && !loading && !error) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init.id]);

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">Project Charter</h3>
          <p className="text-xs text-[#a3a3a3]">AI-drafted from this initiative's data — review before sharing.</p>
        </div>
        <button className="btn-secondary text-xs" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : text ? 'Regenerate' : 'Generate'}
        </button>
      </div>
      {error && <div className="text-sm text-[#be123c]">{error}</div>}
      {!error && loading && !text && <div className="text-sm text-[#a3a3a3] py-2">Drafting the charter…</div>}
      {text && (
        <div className={loading ? 'opacity-50 transition-opacity' : ''}>
          <AssistantMarkdown content={text} />
        </div>
      )}
      {!text && !loading && !error && <div className="text-sm text-[#a3a3a3] py-2">No charter yet.</div>}
    </div>
  );
}

// ── STRATEGIC ALIGNMENT ──────────────────────────────────────────────────
function AlignmentTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
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
    try { await fn(); reload(); } catch (e) { void dialogs.alert({ title: 'Change failed', message: (e as Error).message }); }
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Linked strategic objectives</h3>
        {error && <div className="text-sm text-[#be123c] mb-2">{error}</div>}
        {init.objectives.length === 0 ? (
          <div className="text-sm text-[#a3a3a3] py-2">No objectives linked yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full table-fixed text-sm">
              <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
                <tr>
                  <th className="text-left pb-2 font-semibold">Objective</th>
                  <th className="text-left pb-2 font-semibold">Weight</th>
                  <th className="text-left pb-2 font-semibold">Impact (1–5)</th>
                  <th className="text-left pb-2 font-semibold">Contribution</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {init.objectives.map((l) => (
                  <tr key={l.id} className="border-b border-[#f5f5f5]">
                    <td className="py-2.5 font-medium text-[#171717]">{l.objective.name}</td>
                    <td className="py-2.5 text-left tnum text-[#666666]">{l.objective.weight}</td>
                    <td className="py-2.5">
                      <select
                        className="input text-xs w-24"
                        value={l.impact}
                        onChange={(e) => run(() => api.patch(`/portfolio/initiatives/objectives/${l.id}`, { impact: Number(e.target.value) }))}
                      >
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 text-left tnum text-[#171717]">{Math.round(l.impact * l.objective.weight * 10) / 10}</td>
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
// FB-14: the financials view leads with budget delivery — Project Budget,
// Forecasted Budget, Forecast-to-date and Actuals (cost-side TARGET/FORECAST/
// ACTUAL) — instead of the old benefit-vs-cost view, so value-side figures no
// longer share the headline. FB-15: a Change Impact card surfaces how the
// forecast has moved the budget and the timeline against their baselines.
function FinancialsTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [showCreate, setShowCreate] = useState<'BENEFIT' | 'COST' | null>(null);

  const months = generateMonths(init.startDate, init.dueDate);
  const nowMonth = new Date().toISOString().slice(0, 7);

  // Monthly cost totals per dataset, then cumulative running sums for the chart.
  const monthly = (dataset: string) =>
    months.map((m) => init.costs.reduce((a, l) => a + l.values.filter((v) => v.dataset === dataset && v.periodStart.slice(0, 7) === m).reduce((x, v) => x + v.amount, 0), 0));
  const cumulative = (arr: number[]) => { let run = 0; return arr.map((v) => (run += v)); };

  const budgetM = monthly('TARGET');
  const forecastRawM = monthly('FORECAST');
  const actualM = monthly('ACTUAL');
  // Forecast falls back to the budget baseline per-month wherever no explicit
  // forecast exists (forecasts are typically only authored for remaining/future
  // months, so the to-date portion must still reflect the planned baseline).
  const forecastM = months.map((_m, i) => (forecastRawM[i] !== 0 ? forecastRawM[i] : budgetM[i]));
  // Forecast-to-date = forecast spend expected by today (zero past the current month).
  const forecastToDateM = months.map((m, i) => (m <= nowMonth ? forecastM[i] : 0));

  // Totals for the summary tiles.
  const projectBudget = budgetM.reduce((a, v) => a + v, 0);
  const forecastBudget = forecastM.reduce((a, v) => a + v, 0);
  const forecastToDate = forecastToDateM.reduce((a, v) => a + v, 0);
  const actuals = actualM.reduce((a, v) => a + v, 0);

  // Change impact (FB-15).
  const budgetDelta = forecastBudget - projectBudget;            // forecast vs baseline budget
  const budgetDeltaPct = projectBudget ? budgetDelta / projectBudget : 0;
  const toDateVariance = actuals - forecastToDate;               // actual vs forecast-to-date
  // Timeline: projected finish = latest dated work; slip vs the planned due date.
  const dueMs = new Date(init.dueDate).getTime();
  const workDates = [
    ...init.activities.map((a) => new Date(a.endDate).getTime()),
    ...init.milestones.map((m) => new Date(m.dueDate).getTime()),
  ].filter((n) => !Number.isNaN(n));
  const projectedMs = workDates.length ? Math.max(dueMs, ...workDates) : dueMs;
  const slipDays = Math.round((projectedMs - dueMs) / 86400000);
  const now = Date.now();
  const overdueMilestones = init.milestones.filter((m) => m.status !== 'DONE' && new Date(m.dueDate).getTime() < now).length;

  return (
    <div className="space-y-4">
      {/* Budget summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Project Budget" value={fmt.currency(projectBudget, { compact: true })} hint="Planned cost baseline" />
        <Tile label="Forecasted Budget" value={fmt.currency(forecastBudget, { compact: true })} hint="Latest full-life forecast" tone={budgetDelta > 0 ? 'negative' : 'neutral'} />
        <Tile label="Forecast-to-date" value={fmt.currency(forecastToDate, { compact: true })} hint="Expected spend by today" />
        <Tile label="Actuals" value={fmt.currency(actuals, { compact: true })} hint="Actual cost to date" tone={toDateVariance > 0 ? 'negative' : 'positive'} />
      </div>

      {/* Budget vs forecast vs actuals — cumulative */}
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Budget vs Forecast vs Actuals — cumulative cost</h3>
        <SvgLineChart
          labels={months}
          formatValue={(v) => `$${Math.round(v / 1000)}k`}
          series={[
            { name: 'Project Budget', color: '#4f46e5', data: cumulative(budgetM) },
            { name: 'Forecasted Budget', color: '#b45309', dashed: true, data: cumulative(forecastM) },
            { name: 'Forecast-to-date', color: '#0ea5e9', dashed: true, data: cumulative(forecastToDateM) },
            { name: 'Actuals', color: '#047857', data: cumulative(actualM) },
          ]}
        />
      </div>

      {/* Change Impact on budget & timeline (FB-15) */}
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Change Impact</h3>
        <p className="text-xs text-[#a3a3a3] mb-4">How the current forecast and workplan move this initiative against its baselines.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[#eaeaea] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">Budget</div>
            <div className={'text-2xl font-semibold tnum ' + (budgetDelta > 0 ? 'text-[#be123c]' : budgetDelta < 0 ? 'text-[#047857]' : 'text-[#171717]')}>
              {budgetDelta > 0 ? '+' : ''}{fmt.currency(budgetDelta, { compact: true })}
            </div>
            <div className="text-xs text-[#666666] mt-1">
              Forecast vs budget ({budgetDeltaPct > 0 ? '+' : ''}{fmt.percent(budgetDeltaPct)}).{' '}
              {toDateVariance !== 0
                ? `Actuals are ${fmt.currency(Math.abs(toDateVariance), { compact: true })} ${toDateVariance > 0 ? 'over' : 'under'} forecast-to-date.`
                : 'Actuals track forecast-to-date.'}
            </div>
          </div>
          <div className="rounded-lg border border-[#eaeaea] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">Timeline</div>
            <div className={'text-2xl font-semibold tnum ' + (slipDays > 0 ? 'text-[#be123c]' : 'text-[#047857]')}>
              {slipDays > 0 ? `+${slipDays}d` : 'On schedule'}
            </div>
            <div className="text-xs text-[#666666] mt-1">
              {slipDays > 0
                ? `Latest dated work runs past the ${fmt.date(init.dueDate)} due date by ${slipDays} day${slipDays === 1 ? '' : 's'}.`
                : `All dated work fits within the ${fmt.date(init.dueDate)} due date.`}
              {overdueMilestones > 0 && ` ${overdueMilestones} milestone${overdueMilestones === 1 ? '' : 's'} overdue.`}
            </div>
          </div>
        </div>
      </div>

      <LineSection title="Costs" type="COST" lines={init.costs} onCreate={() => setShowCreate('COST')} onChange={reload} />
      <LineSection title="Benefits" type="BENEFIT" lines={init.benefits} onCreate={() => setShowCreate('BENEFIT')} onChange={reload} />

      {showCreate && <CreateLineModal type={showCreate} init={init} onClose={() => setShowCreate(null)} onCreated={() => { setShowCreate(null); reload(); }} />}
    </div>
  );
}

function LineSection({ title, type, lines, onCreate, onChange }: { title: string; type: 'BENEFIT' | 'COST'; lines: Line[]; onCreate: () => void; onChange: () => void }) {
  const dialogs = useDialogs();
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
                <th className="text-center pb-2 font-semibold">Actual</th>
                <th className="text-center pb-2 font-semibold">Budget</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const actual = l.values.filter((v) => v.dataset === 'ACTUAL').reduce((a, v) => a + v.amount, 0);
                const target = l.values.filter((v) => v.dataset === 'TARGET').reduce((a, v) => a + v.amount, 0);
                return (
                  <tr key={l.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] cursor-pointer group" onClick={() => setEditing(l)}>
                    <td className="py-2.5 font-medium">
                      <button type="button" className="text-[#4f46e5] hover:underline text-left" title="Edit monthly values" onClick={(e) => { e.stopPropagation(); setEditing(l); }}>
                        {l.name} <span className="text-[11px] font-normal text-[#a3a3a3]">(edit)</span>
                      </button>
                    </td>
                    <td className="py-2.5 text-[#666666]">{l.category || '—'}</td>
                    <td className="py-2.5 text-[#666666] text-xs">{fmt.month(l.startDate)} → {fmt.month(l.endDate)}</td>
                    <td className="py-2.5 text-center tnum">{fmt.currency(actual, { compact: true })}</td>
                    <td className="py-2.5 text-center text-[#a3a3a3] tnum">{fmt.currency(target, { compact: true })}</td>
                    <td className="py-2.5 text-right">
                      <button
                        className="text-xs text-[#be123c] hover:underline"
                        onClick={async (e) => { e.stopPropagation(); if (!(await dialogs.confirm({ title: 'Delete this line?', danger: true, message: `"${l.name}" and its monthly values will be deleted.` }))) return; await api.delete(`/portfolio/lines/${type}/${l.id}`); onChange(); }}
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
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.category.trim()) return setError('Category is required.');
    if (!form.startDate || !form.endDate) return setError('Start and end dates are required.');
    if (form.endDate < form.startDate) return setError('End date must be on or after the start date.');
    setError('');
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

// FB-18: actuals, budget (the TARGET dataset) and forecast edited together on a
// single tab — one row per month, one editable column per dataset.
const VALUE_DATASETS = [
  { key: 'ACTUAL', label: 'Actual' },
  { key: 'TARGET', label: 'Budget' },
  { key: 'FORECAST', label: 'Forecast' },
] as const;

function EditValuesModal({ type, line, onClose, onSaved }: { type: 'BENEFIT' | 'COST'; line: Line; onClose: () => void; onSaved: () => void }) {
  const months = generateMonths(line.startDate, line.endDate);
  // values[dataset][month] = amount
  const [values, setValues] = useState<Record<string, Record<string, string | number>>>({ ACTUAL: {}, TARGET: {}, FORECAST: {} });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v: Record<string, Record<string, number>> = { ACTUAL: {}, TARGET: {}, FORECAST: {} };
    for (const x of line.values) (v[x.dataset] ??= {})[x.periodStart.slice(0, 7)] = x.amount;
    setValues(v);
  }, [line]);

  async function save() {
    setSaving(true);
    try {
      // One POST per dataset (each is logged to the audit trail separately).
      for (const { key } of VALUE_DATASETS) {
        const payload = months.map((m) => ({ periodStart: `${m}-01`, amount: Number(values[key]?.[m] || 0) }));
        await api.post('/portfolio/values', { type, lineId: line.id, dataset: key, values: payload });
      }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`${line.name} — monthly values`} onClose={onClose} wide>
      <div className="max-h-96 overflow-y-auto border border-[#eaeaea] rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#a3a3a3] sticky top-0">
            <tr>
              <th className="text-center p-2 font-semibold">Month</th>
              {VALUE_DATASETS.map((d) => <th key={d.key} className="text-center p-2 font-semibold">{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m} className="border-t border-[#f5f5f5]">
                <td className="p-2 text-center text-[#666666]">{m}</td>
                {VALUE_DATASETS.map((d) => (
                  <td key={d.key} className="p-2 text-center">
                    <input
                      type="number"
                      className="input text-center w-28 mx-auto"
                      value={values[d.key]?.[m] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [d.key]: { ...prev[d.key], [m]: e.target.value } }))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

// ── WORKPLAN (timeline) ──────────────────────────────────────────────────
function WorkplanTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const [showCreateM, setShowCreateM] = useState(false);
  const [showCreateA, setShowCreateA] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const dates = [
    ...init.activities.flatMap((a) => [a.startDate, a.endDate]),
    ...init.milestones.map((m) => m.dueDate),
  ];
  const scale = makeTimelineScale(dates.length ? dates : [init.startDate, init.dueDate])!;

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
              const depTypeLabel = DEP_TYPES.find((t) => t.key === a.dependencyType)?.label;
              return (
                <div key={a.id} className="h-10 flex flex-col justify-center cursor-pointer hover:bg-[#fafafa] rounded px-1 min-w-0" onClick={() => setEditing(a)}>
                  <div className="text-sm font-medium text-[#171717] truncate leading-tight">{a.name}</div>
                  {a.assignedTo && <div className="text-[10px] text-[#666666] truncate leading-tight">{a.assignedTo}</div>}
                  {a.dependencyLabel && <div className="text-[10px] text-[#a3a3a3] truncate leading-tight">depends on {depTypeLabel ? `${depTypeLabel.toLowerCase()}: ` : ''}{a.dependencyLabel}</div>}
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
                  onClick={async () => { if (!(await dialogs.confirm({ title: 'Delete milestone?', danger: true, message: `"${m.name}" will be deleted.` }))) return; await api.delete(`/portfolio/initiatives/milestones/${m.id}`); reload(); }}
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

// Dependency types (FB-19). LIST types resolve their value from the company's
// data; FREE_TEXT types (no canonical list) accept a typed-in value.
const DEP_TYPES = [
  { key: 'TEAM', label: 'Team', optionsKey: 'TEAM' },
  { key: 'ROLE', label: 'Role', optionsKey: 'ROLE' },
  { key: 'PERSON', label: 'Person', optionsKey: null },
  { key: 'PROJECT', label: 'Project', optionsKey: 'PROJECT' },
  { key: 'CHANGE_APPROVAL', label: 'Change Control Approval', optionsKey: null },
] as const;
type DepType = (typeof DEP_TYPES)[number]['key'];
type DepOptions = Record<string, { id: string; name: string }[]>;

// Create (activity == null) or edit a workplan activity.
function ActivityModal({ init, activity, onClose, onSaved }: { init: Initiative; activity: Activity | null; onClose: () => void; onSaved: () => void }) {
  const dialogs = useDialogs();
  const [form, setForm] = useState({
    name: activity?.name ?? '',
    startDate: (activity?.startDate ?? init.startDate).slice(0, 10),
    endDate: (activity?.endDate ?? init.dueDate).slice(0, 10),
    status: activity?.status ?? 'PLANNED',
    assignedTo: activity?.assignedTo ?? '',
    dependencyType: (activity?.dependencyType ?? '') as DepType | '',
    dependencyRefId: activity?.dependencyRefId ?? '',
    dependencyLabel: activity?.dependencyLabel ?? '',
  });
  const [options, setOptions] = useState<DepOptions>({});
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/portfolio/dependency-options?companyId=${init.companyId}`).then(setOptions).catch(() => {});
  }, [init.companyId]);

  const typeDef = DEP_TYPES.find((t) => t.key === form.dependencyType);
  const isList = !!typeDef?.optionsKey;
  const valueOptions = typeDef?.optionsKey ? (options[typeDef.optionsKey] ?? []) : [];

  function setType(t: DepType | '') {
    // Reset the chosen value whenever the type changes.
    setForm((f) => ({ ...f, dependencyType: t, dependencyRefId: '', dependencyLabel: '' }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Mandatory-field validation.
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.startDate || !form.endDate) return setError('Start and end dates are required.');
    if (form.endDate < form.startDate) return setError('End date must be on or after the start date.');
    if (form.dependencyType) {
      if (isList && !form.dependencyRefId) return setError(`Select a ${typeDef!.label.toLowerCase()} for the dependency.`);
      if (!isList && !form.dependencyLabel.trim()) return setError(`Enter the ${typeDef!.label.toLowerCase()} this activity depends on.`);
    }
    setError('');
    const dep = {
      dependencyType: form.dependencyType || null,
      dependencyRefId: form.dependencyType && isList ? (form.dependencyRefId || null) : null,
      dependencyLabel: form.dependencyType ? (form.dependencyLabel.trim() || null) : null,
      dependsOnId: null,
    };
    try {
      if (activity) {
        await api.patch(`/portfolio/initiatives/activities/${activity.id}`, {
          name: form.name, startDate: form.startDate, endDate: form.endDate, status: form.status,
          assignedTo: form.assignedTo.trim() || null, ...dep,
        });
      } else {
        await api.post(`/portfolio/initiatives/${init.id}/activities`, {
          name: form.name, startDate: form.startDate, endDate: form.endDate,
          assignedTo: form.assignedTo.trim() || null, ...dep,
        });
      }
      onSaved();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove() {
    if (!activity || !(await dialogs.confirm({ title: 'Delete this activity?', danger: true, message: `"${activity.name}" will be removed from the workplan.` }))) return;
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
        <div><label className="label">Assigned to</label>
          <input className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="e.g. Jane Smith" /></div>
        {activity && (
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
            </select></div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Depends on</label>
            <select className="input" value={form.dependencyType} onChange={(e) => setType(e.target.value as DepType | '')}>
              <option value="">— none —</option>
              {DEP_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{typeDef ? typeDef.label : 'Value'}</label>
            {!form.dependencyType ? (
              <select className="input" disabled><option>— select a type —</option></select>
            ) : isList ? (
              <select
                className="input"
                value={form.dependencyRefId}
                onChange={(e) => {
                  const opt = valueOptions.find((o) => o.id === e.target.value);
                  setForm((f) => ({ ...f, dependencyRefId: e.target.value, dependencyLabel: opt?.name ?? '' }));
                }}
              >
                <option value="">— select {typeDef!.label.toLowerCase()} —</option>
                {valueOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : (
              <input
                className="input"
                value={form.dependencyLabel}
                onChange={(e) => setForm({ ...form, dependencyLabel: e.target.value })}
                placeholder={form.dependencyType === 'PERSON' ? 'e.g. Jane Smith' : 'e.g. CR-1042'}
              />
            )}
          </div>
        </div>
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

// ── CHANGE LOG (FB-27) ─────────────────────────────────────────────────────
type ChangeRequest = {
  id: string; title: string; description: string | null; raisedBy: string;
  costImpact: number; scheduleImpactDays: number; status: string; createdAt: string;
};
const CR_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const;

function ChangeLogTab({ init }: { init: Initiative }) {
  const [rows, setRows] = useState<ChangeRequest[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() { api.get(`/portfolio/initiatives/${init.id}/change-requests`).then(setRows).catch(() => setRows([])); }
  useEffect(() => { load(); }, [init.id]);

  async function setStatus(cr: ChangeRequest, status: string) {
    await api.patch(`/portfolio/change-requests/${cr.id}`, { status });
    load();
  }

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Change log</h3>
        <button className="btn-secondary text-xs" onClick={() => setShowCreate(true)}>+ New change request</button>
      </div>
      {!rows ? (
        <div className="text-sm text-[#a3a3a3]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-[#a3a3a3] py-2">No change requests yet.</div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm table-fixed">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold w-[24%]">Change request</th>
                <th className="text-left pb-2 font-semibold w-[17%]">Raised by</th>
                <th className="text-left pb-2 font-semibold w-[11%]">When</th>
                <th className="text-right pb-2 font-semibold w-[14%] px-3">Cost impact</th>
                <th className="text-right pb-2 font-semibold w-[16%] px-3">Schedule impact</th>
                <th className="text-left pb-2 font-semibold w-[18%] pl-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cr) => (
                <tr key={cr.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] align-top">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-[#171717]">{cr.title}</div>
                    {cr.description && <div className="text-xs text-[#a3a3a3] mt-0.5">{cr.description}</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-[#666666] truncate" title={cr.raisedBy}>{cr.raisedBy}</td>
                  <td className="py-2.5 text-[#666666] text-xs whitespace-nowrap">{fmt.date(cr.createdAt)}</td>
                  <td className={'py-2.5 px-3 text-right tnum whitespace-nowrap ' + (cr.costImpact > 0 ? 'text-[#be123c]' : cr.costImpact < 0 ? 'text-[#047857]' : 'text-[#171717]')}>
                    {cr.costImpact > 0 ? '+' : ''}{fmt.currency(cr.costImpact, { compact: true })}
                  </td>
                  <td className={'py-2.5 px-3 text-right tnum whitespace-nowrap ' + (cr.scheduleImpactDays > 0 ? 'text-[#be123c]' : cr.scheduleImpactDays < 0 ? 'text-[#047857]' : 'text-[#171717]')}>
                    {cr.scheduleImpactDays > 0 ? '+' : ''}{cr.scheduleImpactDays}d
                  </td>
                  <td className="py-2.5 pl-6">
                    <select className="input text-xs w-full" value={cr.status} onChange={(e) => setStatus(cr, e.target.value)}>
                      {CR_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate && <CreateChangeRequestModal initId={init.id} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateChangeRequestModal({ initId, onClose, onCreated }: { initId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', raisedBy: '', costImpact: 0, scheduleImpactDays: 0, status: 'PENDING' });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError('Title is required.');
    setError('');
    try {
      await api.post(`/portfolio/initiatives/${initId}/change-requests`, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        raisedBy: form.raisedBy.trim() || undefined,
        costImpact: Number(form.costImpact) || 0,
        scheduleImpactDays: Number(form.scheduleImpactDays) || 0,
        status: form.status,
      });
      onCreated();
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title="New Change Request" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Title</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div><label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><label className="label">Raised by</label>
          <input className="input" value={form.raisedBy} onChange={(e) => setForm({ ...form, raisedBy: e.target.value })} placeholder="defaults to you" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Change cost ($)</label>
            <input className="input text-right tnum" type="number" value={form.costImpact} onChange={(e) => setForm({ ...form, costImpact: Number(e.target.value) })} /></div>
          <div><label className="label">Schedule impact (days)</label>
            <input className="input text-right tnum" type="number" value={form.scheduleImpactDays} onChange={(e) => setForm({ ...form, scheduleImpactDays: Number(e.target.value) })} /></div>
        </div>
        <div><label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {CR_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select></div>
        {error && <div className="text-sm text-[#be123c]">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  );
}

// ── RESOURCES ────────────────────────────────────────────────────────────
function ResourcesTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const [form, setForm] = useState({
    name: '', roleName: '', allocationPct: 50,
    startDate: init.startDate.slice(0, 10), endDate: init.dueDate.slice(0, 10),
  });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.startDate || !form.endDate) return setError('Start and end dates are required.');
    if (form.endDate < form.startDate) return setError('End date must be on or after the start date.');
    if (Number(form.allocationPct) < 1 || Number(form.allocationPct) > 100) return setError('Allocation must be between 1 and 100%.');
    setError('');
    try {
      await api.post(`/portfolio/initiatives/${init.id}/resources`, {
        name: form.name.trim(),
        roleName: form.roleName.trim() || null,
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
                <th className="text-center pb-2 font-semibold w-28">Allocation %</th>
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
                  <td className="py-2.5 text-center tnum">{r.allocationPct}%</td>
                  <td className="py-2.5 pl-4 text-[#666666] text-xs">{fmt.date(r.startDate)}</td>
                  <td className="py-2.5 text-[#666666] text-xs">{fmt.date(r.endDate)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      className="text-xs text-[#be123c] hover:underline"
                      onClick={async () => { if (!(await dialogs.confirm({ title: 'Remove this resource?', danger: true, message: `${r.name} will be unassigned from this initiative.`, confirmLabel: 'Remove' }))) return; await api.delete(`/portfolio/initiatives/resources/${r.id}`); reload(); }}
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
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Type a name" required />
        </div>
        <div className="w-44">
          <label className="label">Role</label>
          <input className="input" value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} placeholder="e.g. Delivery lead" />
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
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.dueDate) return setError('Due date is required.');
    setError('');
    try { await api.post(`/portfolio/initiatives/${initId}/milestones`, form); onCreated(); }
    catch (err) { setError((err as Error).message); }
  }
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
        {error && <div className="text-sm text-[#be123c]">{error}</div>}
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
    if (!form.type) return setError('Type is required.');
    if (!form.title.trim()) return setError('Title is required.');
    if (form.probability < 1 || form.probability > 5) return setError('Probability must be between 1 and 5.');
    if (form.impact < 1 || form.impact > 5) return setError('Impact must be between 1 and 5.');
    setError('');
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
// Email → display name: "kevin.hicks@…" → "Kevin Hicks".
function actorName(email: string): string {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]+/).filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return parts.length ? parts.join(' ') : email;
}
// "COST_VALUES_UPDATED" → "Cost values updated".
function actionLabel(a: string): string {
  const s = a.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// "2026-07" → "Jul 2026".
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

type ValueChange = { period: string; from: number; to: number };
type AuditEntry = { id: string; action: string; actorEmail: string; createdAt: string; diff: string | null };

// Human-readable detail for one audit entry, parsed from its JSON diff.
function AuditDetail({ entry }: { entry: AuditEntry }) {
  if (!entry.diff) return null;
  let d: Record<string, unknown>;
  try { d = JSON.parse(entry.diff); } catch { return <pre className="mt-1 text-xs text-[#666666] bg-[#fafafa] border border-[#eaeaea] rounded p-2 overflow-auto">{entry.diff}</pre>; }

  // Time-phased value edits — show each changed month as from → to.
  if (Array.isArray(d.changes)) {
    const changes = d.changes as ValueChange[];
    return (
      <div className="mt-1 text-xs text-[#525252]">
        <div className="mb-1">
          Changed <span className="font-medium text-[#171717]">{String(d.field ?? 'values')}</span>
          {d.line ? <> on <span className="font-medium text-[#171717]">{String(d.line)}</span></> : null}
        </div>
        <ul className="space-y-0.5">
          {changes.map((c) => (
            <li key={c.period} className="tnum">
              {monthLabel(c.period)}: <span className="text-[#be123c]">{fmt.currency(c.from, { compact: true })}</span>
              {' → '}<span className="text-[#047857]">{fmt.currency(c.to, { compact: true })}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Workflow stage move — diff carries top-level stage codes.
  if (typeof d.from === 'string' && typeof d.to === 'string') {
    return (
      <div className="mt-1 text-xs text-[#525252]">
        Stage: <span className="text-[#be123c]">{STAGE_LABELS[d.from] ?? d.from}</span>
        {' → '}<span className="text-[#047857]">{STAGE_LABELS[d.to] ?? d.to}</span>
      </div>
    );
  }
  if (typeof d.stage === 'string' && typeof d.requestedNext === 'string') {
    return (
      <div className="mt-1 text-xs text-[#525252]">
        Requested advance: {STAGE_LABELS[d.stage] ?? d.stage} → {STAGE_LABELS[d.requestedNext] ?? d.requestedNext}
      </div>
    );
  }

  // Generic diff — render each field as "key: value" (or "from → to").
  const rows = Object.entries(d).filter(([, v]) => v !== undefined && v !== null);
  if (rows.length === 0) return null;
  return (
    <div className="mt-1 text-xs text-[#525252] space-y-0.5">
      {rows.map(([k, v]) => {
        const fromTo = v && typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object);
        return (
          <div key={k}>
            <span className="text-[#a3a3a3]">{k}:</span>{' '}
            {fromTo
              ? <span className="tnum">{String((v as { from: unknown }).from)} → {String((v as { to: unknown }).to)}</span>
              : <span className="text-[#171717]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function AuditTab({ initId }: { initId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
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
                <div className="text-sm">
                  <span className="font-medium text-[#171717]">{actorName(e.actorEmail)}</span>
                  <span className="text-[#525252]"> · {actionLabel(e.action)}</span>
                </div>
                <AuditDetail entry={e} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
