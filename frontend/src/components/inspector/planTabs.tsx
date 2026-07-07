/**
 * Inspector Checklist / Testing tabs — read-only surfacing of the Work Library
 * plan (defined key → green ✓ + value, missing → red ✗ + key) with rollup
 * summaries at container levels and deep links into the Work Library.
 * Extracted verbatim from Inspector.tsx.
 */
import { Empty } from './atoms';
import type { Payload, PlanRow } from './types';

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
          {/* pre-line: multi-line procedure values render one sub-step per line */}
          <span className="text-[#171717] whitespace-pre-line">{r.value}</span>
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

export function ChecklistTab({ data, onNav }: { data: Payload; onNav: (p: string) => void }) {
  if (!data.detail) return <PlanRollupSummary data={data} onNav={onNav} kind="Checklist" />;
  const rows = data.plan?.checklist ?? [];
  return (
    <div>
      {!rows.length && (
        <Empty text="No checklist pattern assigned yet — add one in the Work library." />
      )}
      <PlanLines rows={rows} />
      <EditInLibrary nodeId={data.id} onNav={onNav} />
    </div>
  );
}

export function TestingTab({ data, onNav }: { data: Payload; onNav: (p: string) => void }) {
  if (!data.detail) return <PlanRollupSummary data={data} onNav={onNav} kind="Testing" />;
  const plan = data.plan;
  const rows = plan?.testing ?? [];
  const tied = [...(plan?.standards ?? []), ...(plan?.regulations ?? [])];
  const tiedRows = tied.flatMap((t) => [...t.checklist, ...t.testing]);
  return (
    <div>
      {!rows.length && (
        <Empty text="No testing pattern assigned yet — pick one in the Work library." />
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
