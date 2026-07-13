/**
 * Inspector Checklist / Testing tabs — surfacing of the Work Library plan
 * (defined key → green ✓ + value, missing → red ✗ + key) with rollup
 * summaries at container levels and deep links into the Work Library.
 * In edit mode at a task, a pattern picker assigns/unassigns CHECKLIST / TEST
 * templates from the existing Work Library catalog (NodeWorkTemplate — the
 * same records the Work Library screen edits, so both stay in sync).
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Empty } from './atoms';
import ProcedureValue from '../ProcedureValue';
import type { AfterFn, Payload, PlanRow } from './types';

// ── Pattern picker (edit mode, task level) ──────────────────────────────────
// Lists the company's Work Library templates of one kind; clicking toggles the
// assignment via PUT /work-library/plan/task/:id/templates (the full selection
// across BOTH kinds is preserved — only the clicked template flips).
type TemplateLite = { id: string; kind: string; name: string; keys: { id: string }[] };

function TemplatePicker({
  taskId,
  kind,
  label,
  after,
}: {
  taskId: string;
  kind: 'CHECKLIST' | 'TEST';
  label: string;
  after: AfterFn;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateLite[] | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      api.get<{ templates: TemplateLite[] }>('/work-library/templates'),
      api.get<{ assignedTemplateIds: string[] }>(`/work-library/plan/task/${taskId}`),
    ])
      .then(([t, p]) => {
        if (cancelled) return;
        setTemplates(t.templates.filter((x) => x.kind === kind));
        setAssigned(p.assignedTemplateIds);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, taskId, kind]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = async (t: TemplateLite) => {
    if (busy) return;
    const has = assigned.includes(t.id);
    const next = has ? assigned.filter((x) => x !== t.id) : [...assigned, t.id];
    setBusy(true);
    try {
      await api.put(`/work-library/plan/task/${taskId}/templates`, { templateIds: next });
      setAssigned(next);
      after(
        has ? `${t.name} unassigned` : `${t.name} assigned`,
        'Saved to the Work library — this task now carries the pattern everywhere',
      );
    } catch {
      after('Could not update the pattern', 'The Work library rejected the change');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex justify-end mb-2" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-[#9fb6e8] bg-[#eaf1fe] px-2.5 py-1 text-[11.5px] font-semibold text-[#1d4ed8] hover:bg-[#dceafe]"
      >
        ＋ Assign {label} pattern
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-[#e2e6ea] bg-white shadow-xl p-2">
          {templates === null ? (
            <div className="px-2 py-2 text-[11px] text-[#a3a3a3] italic">Loading patterns…</div>
          ) : !templates.length ? (
            <div className="px-2 py-2 text-[11px] text-[#a3a3a3] italic">
              No {label} patterns in the Work library yet.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
              {templates.map((t) => {
                const has = assigned.includes(t.id);
                return (
                  <button
                    key={t.id}
                    disabled={busy}
                    onClick={() => void toggle(t)}
                    className={
                      'text-left rounded-md px-2 py-1.5 disabled:opacity-50 ' +
                      (has ? 'bg-[#e7f6ef] hover:bg-[#d6f0e2]' : 'hover:bg-[#f5f8ff]')
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={'text-[12px] ' + (has ? 'text-[#1e9e6a]' : 'text-transparent')}
                      >
                        ✓
                      </span>
                      <span className="text-[12px] text-[#171717] flex-1 min-w-0 truncate">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-[#a3a3a3]">
                        {t.keys.length} key{t.keys.length === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Checklist / Testing — Work Library plan views ───────────────────────────
// Read-only surfacing of the item's plan: defined key → green ✓ + value,
// missing → red ✗ + key. Editing happens in the Work Library (deep link).
const PlanLine = ({ r }: { r: PlanRow }) => (
  <div className="flex items-start gap-1.5 rounded-md bg-white border border-[#eaeef1] px-2.5 py-1.5">
    <span
      className={
        (r.defined ? 'text-[#1e9e6a]' : 'text-[#dc2626]') +
        ' text-[13px] flex-shrink-0 leading-snug'
      }
    >
      {r.defined ? '✓' : '✗'}
    </span>
    <span className="flex-1 min-w-0 text-[12px] leading-snug">
      {r.defined ? (
        <>
          <span className="text-[#8a94a0]">{r.key}: </span>
          <span className="text-[#171717]">
            <ProcedureValue value={r.value ?? ''} />
          </span>
        </>
      ) : (
        <span className="text-[#6b7785]">{r.key}</span>
      )}
    </span>
  </div>
);

// Generic (pattern) vs specific (this item) steps are rendered as two labeled
// groups so the two kinds are never conflated.
const GroupLabel = ({ label, hint }: { label: string; hint: string }) => (
  <div className="flex items-baseline gap-1.5 mt-1.5 first:mt-0 px-0.5">
    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8a94a0]">{label}</span>
    <span className="text-[10px] text-[#a3a3a3]">{hint}</span>
  </div>
);

function PlanLines({ rows }: { rows: PlanRow[] }) {
  const generic = rows.filter((r) => r.generic);
  const specific = rows.filter((r) => !r.generic);
  return (
    <div className="flex flex-col gap-1">
      {generic.length > 0 && <GroupLabel label="Generic steps" hint="from the assigned pattern" />}
      {generic.map((r, i) => (
        <PlanLine key={`g${i}`} r={r} />
      ))}
      {specific.length > 0 && <GroupLabel label="Specific steps" hint="added for this item only" />}
      {specific.map((r, i) => (
        <PlanLine key={`s${i}`} r={r} />
      ))}
    </div>
  );
}

function EditInLibrary({ nodeId, onNav }: { nodeId: string; onNav: (p: string) => void }) {
  return (
    <button
      onClick={() => onNav(`/work-library?type=task&id=${nodeId}`)}
      className="mt-2.5 w-full rounded-md border border-[#9fb6e8] px-3 py-1.5 text-[11.5px] font-semibold text-[#2563eb] hover:bg-[#f0f6ff]"
    >
      Edit in Work library ↗
    </button>
  );
}

function PlanRollupSummary({
  data,
  onNav,
  kind,
}: {
  data: Payload;
  onNav: (p: string) => void;
  kind: 'Checklist' | 'Testing';
}) {
  const r = data.planRollup;
  if (!r || !r.total)
    return <Empty text={`No ${kind.toLowerCase()} plans recorded in this subtree yet.`} />;
  const pct = Math.round((100 * r.defined) / r.total);
  return (
    <div>
      <div className="rounded-lg bg-[#fbfcfd] border border-[#e2e6ea] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[#171717]">{kind} plans</span>
          <span
            className={
              'text-[10px] px-1.5 py-px rounded-full ' +
              (pct === 100 ? 'bg-[#e9f7ef] text-[#196f3d]' : 'bg-[#fdf3e0] text-[#8a5a12]')
            }
          >
            {r.defined.toLocaleString()} of {r.total.toLocaleString()} keys defined
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#eef1f4] mt-2">
          <div className="h-1.5 rounded-full bg-[#1e9e6a]" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10.5px] text-[#8a94a0] mt-1.5">
          {r.tasksWithPlan.toLocaleString()} of {r.tasks.toLocaleString()} tasks have a plan. Drill
          to a task to see and edit its keys.
        </div>
      </div>
      <button
        onClick={() => onNav('/work-library')}
        className="mt-2.5 w-full rounded-md border border-[#9fb6e8] px-3 py-1.5 text-[11.5px] font-semibold text-[#2563eb] hover:bg-[#f0f6ff]"
      >
        Open Work library ↗
      </button>
    </div>
  );
}

export function ChecklistTab({
  data,
  onNav,
  edit,
  after,
}: {
  data: Payload;
  onNav: (p: string) => void;
  edit: boolean;
  after: AfterFn;
}) {
  if (!data.detail) return <PlanRollupSummary data={data} onNav={onNav} kind="Checklist" />;
  const rows = data.plan?.checklist ?? [];
  return (
    <div>
      {edit && <TemplatePicker taskId={data.id} kind="CHECKLIST" label="checklist" after={after} />}
      {!rows.length && (
        <Empty
          text={
            edit
              ? 'Assign a checklist pattern above — its keys appear here.'
              : 'No checklist pattern assigned yet — add one in the Work library.'
          }
        />
      )}
      <PlanLines rows={rows} />
      <EditInLibrary nodeId={data.id} onNav={onNav} />
    </div>
  );
}

export function TestingTab({
  data,
  onNav,
  edit,
  after,
}: {
  data: Payload;
  onNav: (p: string) => void;
  edit: boolean;
  after: AfterFn;
}) {
  if (!data.detail) return <PlanRollupSummary data={data} onNav={onNav} kind="Testing" />;
  const plan = data.plan;
  const rows = plan?.testing ?? [];
  const tied = [...(plan?.standards ?? []), ...(plan?.regulations ?? [])];
  const tiedRows = tied.flatMap((t) => [...t.checklist, ...t.testing]);
  return (
    <div>
      {edit && <TemplatePicker taskId={data.id} kind="TEST" label="testing" after={after} />}
      {!rows.length && (
        <Empty
          text={
            edit
              ? 'Assign a testing pattern above — its keys appear here.'
              : 'No testing pattern assigned yet — pick one in the Work library.'
          }
        />
      )}
      <PlanLines rows={rows} />
      {tied.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-[#fbfcfd] border border-[#e2e6ea] px-3 py-2 text-[11px] text-[#525252]">
          <div className="flex justify-between">
            <span>Standards applied</span>
            <span>
              {plan!.standards.length} ·{' '}
              {
                plan!.standards
                  .flatMap((s) => [...s.checklist, ...s.testing])
                  .filter((r) => r.defined).length
              }{' '}
              steps evidenced
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Regulations applied</span>
            <span>
              {plan!.regulations.length} ·{' '}
              {
                plan!.regulations
                  .flatMap((s) => [...s.checklist, ...s.testing])
                  .filter((r) => r.defined).length
              }{' '}
              steps evidenced
            </span>
          </div>
          {tiedRows.length === 0 && (
            <div className="text-[10px] text-[#a3a3a3] mt-1">
              No evidence steps yet — add them in the Work library.
            </div>
          )}
        </div>
      )}
      <EditInLibrary nodeId={data.id} onNav={onNav} />
    </div>
  );
}
