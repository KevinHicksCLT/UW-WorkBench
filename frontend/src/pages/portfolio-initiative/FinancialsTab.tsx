/**
 * Financials tab of the Portfolio Initiative page — budget/forecast/actuals
 * tiles + cumulative chart (FB-14), Change Impact card (FB-15), and the
 * benefit/cost line sections with their create/edit-values modals (FB-18).
 * Extracted verbatim from PortfolioInitiative.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { fmt } from '../../lib/format';
import { Button, Card, EmptyState, ErrorMessage, Input, Label } from '../../components/ui';
import {
  Tile,
  Modal,
  SvgLineChart,
  generateMonths,
  type Initiative,
  type Line,
} from '../../lib/portfolio';

// ── FINANCIALS ───────────────────────────────────────────────────────────
// FB-14: the financials view leads with budget delivery — Project Budget,
// Forecasted Budget, Forecast-to-date and Actuals (cost-side TARGET/FORECAST/
// ACTUAL) — instead of the old benefit-vs-cost view, so value-side figures no
// longer share the headline. FB-15: a Change Impact card surfaces how the
// forecast has moved the budget and the timeline against their baselines.
export function FinancialsTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [showCreate, setShowCreate] = useState<'BENEFIT' | 'COST' | null>(null);

  const months = generateMonths(init.startDate, init.dueDate);
  const nowMonth = new Date().toISOString().slice(0, 7);

  // Monthly cost totals per dataset, then cumulative running sums for the chart.
  const monthly = (dataset: string) =>
    months.map((m) =>
      init.costs.reduce(
        (a, l) =>
          a +
          l.values
            .filter((v) => v.dataset === dataset && v.periodStart.slice(0, 7) === m)
            .reduce((x, v) => x + v.amount, 0),
        0,
      ),
    );
  const cumulative = (arr: number[]) => {
    let run = 0;
    return arr.map((v) => (run += v));
  };

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
  const budgetDelta = forecastBudget - projectBudget; // forecast vs baseline budget
  const budgetDeltaPct = projectBudget ? budgetDelta / projectBudget : 0;
  const toDateVariance = actuals - forecastToDate; // actual vs forecast-to-date
  // Timeline: projected finish = latest dated work; slip vs the planned due date.
  const dueMs = new Date(init.dueDate).getTime();
  const workDates = [
    ...init.activities.map((a) => new Date(a.endDate).getTime()),
    ...init.milestones.map((m) => new Date(m.dueDate).getTime()),
  ].filter((n) => !Number.isNaN(n));
  const projectedMs = workDates.length ? Math.max(dueMs, ...workDates) : dueMs;
  const slipDays = Math.round((projectedMs - dueMs) / 86400000);
  const now = Date.now();
  const overdueMilestones = init.milestones.filter(
    (m) => m.status !== 'DONE' && new Date(m.dueDate).getTime() < now,
  ).length;

  return (
    <div className="space-y-4">
      {/* Budget summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Project Budget"
          value={fmt.currency(projectBudget, { compact: true })}
          hint="Planned cost baseline"
        />
        <Tile
          label="Forecast"
          value={fmt.currency(forecastBudget, { compact: true })}
          hint={
            budgetDelta === 0
              ? 'On budget'
              : `${fmt.currency(Math.abs(budgetDelta), { compact: true })} ${budgetDelta > 0 ? 'over' : 'under'} budget`
          }
          tone={budgetDelta > 0 ? 'negative' : 'neutral'}
        />
        <Tile
          label="Forecast-to-date"
          value={fmt.currency(forecastToDate, { compact: true })}
          hint={
            toDateVariance === 0
              ? 'Matches actuals'
              : `${fmt.currency(Math.abs(toDateVariance), { compact: true })} ${toDateVariance > 0 ? 'below' : 'above'} actuals`
          }
        />
        <Tile
          label="Actuals"
          value={fmt.currency(actuals, { compact: true })}
          hint="Actual cost to date"
          tone={toDateVariance > 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* Budget vs forecast vs actuals — cumulative */}
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">
          Budget vs Forecast vs Actuals — cumulative cost
        </h3>
        <SvgLineChart
          labels={months}
          formatValue={(v) => `$${Math.round(v / 1000)}k`}
          series={[
            { name: 'Project Budget', color: '#4f46e5', data: cumulative(budgetM) },
            { name: 'Forecast', color: '#b45309', dashed: true, data: cumulative(forecastM) },
            {
              name: 'Forecast-to-date',
              color: '#0ea5e9',
              dashed: true,
              data: cumulative(forecastToDateM),
            },
            { name: 'Actuals', color: '#047857', data: cumulative(actualM) },
          ]}
        />
      </Card>

      {/* Change Impact on budget & timeline (FB-15) */}
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Change Impact</h3>
        <p className="text-xs text-[#a3a3a3] mb-4">
          How the current forecast and workplan move this initiative against its baselines.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[#eaeaea] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1 text-center">
              Budget
            </div>
            <div
              className={
                'text-2xl font-semibold tnum text-center ' +
                (budgetDelta > 0
                  ? 'text-[#be123c]'
                  : budgetDelta < 0
                    ? 'text-[#047857]'
                    : 'text-[#171717]')
              }
            >
              {budgetDelta > 0 ? '+' : ''}
              {fmt.currency(budgetDelta, { compact: true })}
            </div>
            <div className="text-xs text-[#666666] mt-1">
              Forecast vs budget ({budgetDeltaPct > 0 ? '+' : ''}
              {fmt.percent(budgetDeltaPct)}).{' '}
              {toDateVariance !== 0
                ? `Actuals are ${fmt.currency(Math.abs(toDateVariance), { compact: true })} ${toDateVariance > 0 ? 'over' : 'under'} forecast-to-date.`
                : 'Actuals track forecast-to-date.'}
            </div>
          </div>
          <div className="rounded-lg border border-[#eaeaea] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1 text-center">
              Timeline
            </div>
            <div
              className={
                'text-2xl font-semibold tnum text-center ' +
                (slipDays > 0 ? 'text-[#be123c]' : 'text-[#047857]')
              }
            >
              {slipDays > 0 ? `+${slipDays}d` : 'On schedule'}
            </div>
            <div className="text-xs text-[#666666] mt-1">
              {slipDays > 0
                ? `Latest dated work runs past the ${fmt.date(init.dueDate)} due date by ${slipDays} day${slipDays === 1 ? '' : 's'}.`
                : `All dated work fits within the ${fmt.date(init.dueDate)} due date.`}
              {overdueMilestones > 0 &&
                ` ${overdueMilestones} milestone${overdueMilestones === 1 ? '' : 's'} overdue.`}
            </div>
          </div>
        </div>
      </Card>

      <LineSection
        title="Costs"
        type="COST"
        lines={init.costs}
        onCreate={() => setShowCreate('COST')}
        onChange={reload}
      />
      <LineSection
        title="Benefits"
        type="BENEFIT"
        lines={init.benefits}
        onCreate={() => setShowCreate('BENEFIT')}
        onChange={reload}
      />

      {showCreate && (
        <CreateLineModal
          type={showCreate}
          init={init}
          onClose={() => setShowCreate(null)}
          onCreated={() => {
            setShowCreate(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function LineSection({
  title,
  type,
  lines,
  onCreate,
  onChange,
}: {
  title: string;
  type: 'BENEFIT' | 'COST';
  lines: Line[];
  onCreate: () => void;
  onChange: () => void;
}) {
  const dialogs = useDialogs();
  const [editing, setEditing] = useState<Line | null>(null);
  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
        <Button variant="secondary" className="text-xs" onClick={onCreate}>
          + Add {type === 'BENEFIT' ? 'benefit' : 'cost'}
        </Button>
      </div>
      {lines.length === 0 ? (
        <EmptyState baseClassName="text-sm text-[#a3a3a3] py-2" message="No lines yet." />
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold">Name</th>
                <th className="text-left pb-2 font-semibold">Category</th>
                <th className="text-center pb-2 font-semibold">Range</th>
                <th className="text-center pb-2 font-semibold">Actual</th>
                <th className="text-center pb-2 font-semibold">Budget</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const actual = l.values
                  .filter((v) => v.dataset === 'ACTUAL')
                  .reduce((a, v) => a + v.amount, 0);
                const target = l.values
                  .filter((v) => v.dataset === 'TARGET')
                  .reduce((a, v) => a + v.amount, 0);
                return (
                  <tr
                    key={l.id}
                    className="border-b border-[#f5f5f5] hover:bg-[#fafafa] cursor-pointer group"
                    onClick={() => setEditing(l)}
                  >
                    <td className="py-2.5 font-medium">
                      <button
                        type="button"
                        className="text-[#4f46e5] hover:underline text-left"
                        title="Edit monthly values"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(l);
                        }}
                      >
                        {l.name}{' '}
                        <span className="text-[11px] font-normal text-[#a3a3a3]">(edit)</span>
                      </button>
                    </td>
                    <td className="py-2.5 text-[#666666]">{l.category || '—'}</td>
                    <td className="py-2.5 text-center text-[#666666] text-xs">
                      {fmt.month(l.startDate)} → {fmt.month(l.endDate)}
                    </td>
                    <td className="py-2.5 text-center tnum">
                      {fmt.currency(actual, { compact: true })}
                    </td>
                    <td className="py-2.5 text-center text-[#a3a3a3] tnum">
                      {fmt.currency(target, { compact: true })}
                    </td>
                    <td className="py-2.5 text-center">
                      <button
                        className="text-xs text-[#be123c] hover:underline"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            !(await dialogs.confirm({
                              title: 'Delete this line?',
                              danger: true,
                              message: `"${l.name}" and its monthly values will be deleted.`,
                            }))
                          ) {
                            return;
                          }
                          await api.delete(`/portfolio/lines/${type}/${l.id}`);
                          onChange();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EditValuesModal
          type={type}
          line={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function CreateLineModal({
  type,
  init,
  onClose,
  onCreated,
}: {
  type: 'BENEFIT' | 'COST';
  init: Initiative;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    category: type === 'BENEFIT' ? 'Cost Savings' : 'OPEX',
    startDate: init.startDate.slice(0, 10),
    endDate: init.dueDate.slice(0, 10),
  });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.category.trim()) return setError('Category is required.');
    if (!form.startDate || !form.endDate) return setError('Start and end dates are required.');
    if (form.endDate < form.startDate)
      return setError('End date must be on or after the start date.');
    setError('');
    try {
      await api.post('/portfolio/lines', { type, initiativeId: init.id, ...form });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title={`New ${type === 'BENEFIT' ? 'Benefit' : 'Cost'} Line`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Category</Label>
          <Input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>End</Label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button>Create</Button>
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

function EditValuesModal({
  type,
  line,
  onClose,
  onSaved,
}: {
  type: 'BENEFIT' | 'COST';
  line: Line;
  onClose: () => void;
  onSaved: () => void;
}) {
  const months = generateMonths(line.startDate, line.endDate);
  // values[dataset][month] = amount
  const [values, setValues] = useState<Record<string, Record<string, string | number>>>({
    ACTUAL: {},
    TARGET: {},
    FORECAST: {},
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v: Record<string, Record<string, number>> = { ACTUAL: {}, TARGET: {}, FORECAST: {} };
    for (const x of line.values) {
      v[x.dataset] ??= {};
      v[x.dataset][x.periodStart.slice(0, 7)] = x.amount;
    }
    setValues(v);
  }, [line]);

  async function save() {
    setSaving(true);
    try {
      // One POST per dataset (each is logged to the audit trail separately).
      for (const { key } of VALUE_DATASETS) {
        const payload = months.map((m) => ({
          periodStart: `${m}-01`,
          amount: Number(values[key]?.[m] || 0),
        }));
        await api.post('/portfolio/values', {
          type,
          lineId: line.id,
          dataset: key,
          values: payload,
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`${line.name} — monthly values`} onClose={onClose} wide>
      <div className="max-h-96 overflow-y-auto border border-[#eaeaea] rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#a3a3a3] sticky top-0">
            <tr>
              <th className="text-center p-2 font-semibold">Month</th>
              {VALUE_DATASETS.map((d) => (
                <th key={d.key} className="text-center p-2 font-semibold">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m} className="border-t border-[#f5f5f5]">
                <td className="p-2 text-center text-[#666666]">{m}</td>
                {VALUE_DATASETS.map((d) => (
                  <td key={d.key} className="p-2 text-center">
                    <Input
                      type="number"
                      className="text-center w-28 mx-auto"
                      value={values[d.key]?.[m] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [d.key]: { ...prev[d.key], [m]: e.target.value },
                        }))
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
