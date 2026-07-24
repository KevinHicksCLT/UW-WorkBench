/**
 * Inspector Sub-tasks / Sub-task testing tabs — surfacing of the Work Library
 * plan as a numbered list of the item-specific steps, with rollup summaries at
 * container levels and deep links into the Work Library. Generic template
 * steps and the pattern/template pickers are intentionally NOT surfaced here
 * (the data stays in the DB and the API — this is a UI-level simplification).
 */
import { Empty } from './atoms';
import ProcedureValue from '../ProcedureValue';
import type { AfterFn, Payload, PlanRow } from './types';

// ── Sub-tasks / Sub-task testing — Work Library plan views ──────────────────
// Read-only surfacing of the item's plan as a numbered list. Editing happens
// in the Work Library (deep link).

// Some stored step keys already start with "1. " — drop that so the rendered
// list number is the only numbering.
export const stripStepNumber = (key: string) => key.replace(/^\d+[.)]\s*/, '');

const PlanLine = ({ r, num }: { r: PlanRow; num: number }) => (
  <div className="flex items-start gap-2 rounded-md bg-white border border-[#eaeef1] px-2.5 py-1.5">
    <span className="text-[11px] tabular-nums text-[#6b7785] flex-shrink-0 leading-snug pt-px">
      {num}.
    </span>
    <span className="flex-1 min-w-0 text-[12px] leading-snug">
      {r.defined ? (
        <>
          <span className="font-medium text-[#374151]">{stripStepNumber(r.key)}: </span>
          <span className="text-[#171717]">
            <ProcedureValue value={r.value ?? ''} />
          </span>
        </>
      ) : (
        <span className="font-medium text-[#374151]">{stripStepNumber(r.key)}</span>
      )}
    </span>
  </div>
);

// Only the item-specific steps surface — generic pattern keys are hidden.
export const specificRows = (rows: PlanRow[]) => rows.filter((r) => !r.generic);

function PlanLines({ rows }: { rows: PlanRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => (
        <PlanLine key={i} r={r} num={i + 1} />
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
  kind: 'Sub-task' | 'Sub-task testing';
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
          to a task to see and edit its steps.
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
}: {
  data: Payload;
  onNav: (p: string) => void;
  edit: boolean;
  after: AfterFn;
}) {
  if (!data.detail) return <PlanRollupSummary data={data} onNav={onNav} kind="Sub-task" />;
  const rows = specificRows(data.plan?.checklist ?? []);
  return (
    <div>
      {!rows.length && <Empty text="No sub-tasks recorded yet — add them in the Work library." />}
      <PlanLines rows={rows} />
      <EditInLibrary nodeId={data.id} onNav={onNav} />
    </div>
  );
}

export function TestingTab({
  data,
  onNav,
}: {
  data: Payload;
  onNav: (p: string) => void;
  edit: boolean;
  after: AfterFn;
}) {
  if (!data.detail) return <PlanRollupSummary data={data} onNav={onNav} kind="Sub-task testing" />;
  const plan = data.plan;
  const rows = specificRows(plan?.testing ?? []);
  const tied = [...(plan?.standards ?? []), ...(plan?.regulations ?? [])];
  const tiedRows = tied.flatMap((t) => [...t.checklist, ...t.testing]);
  return (
    <div>
      {!rows.length && (
        <Empty text="No sub-task tests recorded yet — add them in the Work library." />
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
