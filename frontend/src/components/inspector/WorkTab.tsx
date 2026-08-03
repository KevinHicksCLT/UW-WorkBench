/**
 * Inspector Work tab — the connected chain in one organized view: Deliverable
 * → the Tasks that produce it → each task's Roles, Applications, Checklist
 * items, and the Testing plan that verifies it. Extracted verbatim from
 * Inspector.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useOpenRole } from '../../lib/roleDrawer';
import { SkeletonLoader } from '../ui';
import ProcedureValue from '../ProcedureValue';
import { AddPicker, Empty, LinkOut, DetachBtn } from './atoms';
import { stripStepNumber } from './planTabs';
import type { AfterFn, Payload, PlanRow, TiedPlan } from './types';

// ── Deliverable chain payload (mirrors GET /inspector/:nodeId/chain) ─────────
type ChainRole = { roleId: string; name: string; relation: string };
type ChainApp = { appId: string; name: string; usageType: string };
type ChainVerify = { actor: string | null; steps: string[]; passWhen: string | null };
type ChainSubTask = {
  n: number;
  action: string;
  actor: string | null;
  steps: string[];
  doneWhen: string | null;
  apps: string[];
  artifacts: string[];
  verify: ChainVerify | null;
  defined: boolean;
};
type ChainTask = {
  taskId: string;
  name: string;
  roles: ChainRole[];
  applications: ChainApp[];
  subTasks: ChainSubTask[];
  dependsOn: { taskId: string; name: string }[];
  checklist: PlanRow[];
  testing: PlanRow[];
  standards: TiedPlan[];
  regulations: TiedPlan[];
};
type ChainDeliv = {
  deliverableId: string;
  title: string;
  linkId: string | null;
  tasks: ChainTask[];
  rollup: { defined: number; total: number };
};

// Work tab — the connected chain in one organized view: Deliverable → the Tasks
// that produce it → each task's Roles, Applications, Checklist items, and the
// Testing plan that verifies it. Read-oriented; associate/detach the deliverable
// in edit mode (at a step).
export function WorkTab({
  data,
  edit,
  onNav,
  after,
}: {
  data: Payload;
  edit: boolean;
  onNav: (p: string) => void;
  after: AfterFn;
}) {
  const [chain, setChain] = useState<ChainDeliv[]>([]);
  const [ver, setVer] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ chain: ChainDeliv[] }>(`/inspector/${data.id}/chain`)
      .then((r) => {
        if (!cancelled) {
          setChain(r.chain);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChain([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data.id, ver]);
  const reload = () => setVer((v) => v + 1);

  const add = async (choice: { id?: string; newName?: string }) => {
    const r = await api.post(`/inspector/${data.id}/deliverables`, {
      deliverableId: choice.id,
      newTitle: choice.newName,
    });
    const linkId = r.deliverable.linkId;
    reload();
    after(`${r.deliverable.title} added`, 'Now in Deliverables & this step', async () => {
      await api.delete(`/inspector/deliverables/${linkId}`);
      reload();
      after('Removed', 'Reverted');
    });
  };
  const detach = async (linkId: string) => {
    await api.delete(`/inspector/deliverables/${linkId}`);
    reload();
    after('Detached', 'The deliverable is kept');
  };

  return (
    <div>
      {edit && (
        <div className="flex justify-end mb-2">
          <AddPicker label="Associate / add deliverable" kind="deliverables" onPick={add} />
        </div>
      )}
      {loading ? (
        <SkeletonLoader height={64} />
      ) : !chain.length ? (
        <Empty
          text={edit ? 'Add the first deliverable above.' : 'No deliverables recorded here.'}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {chain.map((d) => (
            <DelivChain key={d.deliverableId} d={d} edit={edit} onNav={onNav} onDetach={detach} />
          ))}
        </div>
      )}
    </div>
  );
}

// Chain plan row — numbered step; the title reads at full contrast.
const ChainPlanLine = ({ r, num }: { r: PlanRow; num: number }) => (
  <div className="flex items-start gap-1.5">
    <span className="text-[10.5px] tabular-nums text-[#6b7785] mt-px flex-shrink-0">{num}.</span>
    <span className="text-[11.5px] leading-snug">
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

function DelivChain({
  d,
  edit,
  onNav,
  onDetach,
}: {
  d: ChainDeliv;
  edit: boolean;
  onNav: (p: string) => void;
  onDetach: (linkId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const kids = d.tasks.length;
  const pct = d.rollup.total ? Math.round((100 * d.rollup.defined) / d.rollup.total) : null;
  return (
    <div
      className="rounded-lg bg-[#e9f7ef] border border-[#cbead9]"
      style={{ borderLeft: '3px solid #1e9e6a' }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        {kids > 0 && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="text-[#737373] hover:text-[#171717]"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: open ? 'rotate(90deg)' : undefined,
                transition: 'transform 120ms',
              }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}
        <span className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white text-[#196f3d] border border-[#cbead9] flex-shrink-0">
          Deliverable
        </span>
        <span className="text-[12.5px] font-bold text-[#196f3d] flex-1 min-w-0 truncate">
          {d.title}
        </span>
        {pct !== null && (
          <span
            className={
              'text-[9px] px-1.5 py-px rounded-full flex-shrink-0 ' +
              (pct === 100
                ? 'bg-white text-[#196f3d] border border-[#cbead9]'
                : 'bg-[#fdf3e0] text-[#8a5a12]')
            }
            title="Checklist + testing keys defined across this deliverable's tasks"
          >
            {d.rollup.defined} of {d.rollup.total} verified
          </span>
        )}
        {d.tasks.length > 0 && (
          <span className="text-[9px] text-[#5a8a6f]">
            {d.tasks.length} task{d.tasks.length === 1 ? '' : 's'}
          </span>
        )}
        <LinkOut onClick={() => onNav('/deliverables')} />
        {edit && d.linkId && <DetachBtn onClick={() => onDetach(d.linkId!)} />}
      </div>
      {open && kids > 0 && (
        <div className="px-2.5 pb-2.5 pt-0.5 flex flex-col gap-1.5">
          {d.tasks.map((t) => (
            <TaskChain key={t.taskId} t={t} onNav={onNav} />
          ))}
        </div>
      )}
    </div>
  );
}

function MiniHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#a3a3a3] mt-1.5 first:mt-0">
      {children}
    </div>
  );
}

// Sub-tasks / Sub-task testing rendered as distinct sub-cards so the two
// blocks read separately. Only the item-specific steps surface — generic
// pattern keys are hidden at the UI level (the data stays in the DB).
function PlanBlock({
  label,
  accent,
  bg,
  border,
  rows,
}: {
  label: string;
  accent: string;
  bg: string;
  border: string;
  rows: PlanRow[];
}) {
  const specific = rows.filter((r) => !r.generic);
  if (specific.length === 0) return null;
  const defined = specific.filter((r) => r.defined).length;
  return (
    <div
      className="rounded-md mt-1.5"
      style={{ background: bg, border: `1px solid ${border}`, borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        <span
          className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white border"
          style={{ color: accent, borderColor: border }}
        >
          {label}
        </span>
        <span className="text-[9px]" style={{ color: accent }}>
          {defined}/{specific.length}
        </span>
      </div>
      <div className="px-2 pb-2 pt-1 flex flex-col gap-1">
        {specific.map((r, i) => (
          <ChainPlanLine key={`s${i}`} r={r} num={i + 1} />
        ))}
      </div>
    </div>
  );
}

// The task's declared inputs — it cannot complete until these tasks have.
function DependsOnRow({ deps }: { deps: { taskId: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md bg-[#fdf8ef] border border-[#ecdcc0] px-2 py-1.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-[#b45309]">
        Depends on
      </span>
      {deps.map((d) => (
        <span
          key={d.taskId}
          className="text-[10px] font-medium rounded px-1.5 py-px bg-white text-[#92600e] border border-[#ecdcc0]"
        >
          {d.name}
        </span>
      ))}
    </div>
  );
}

// The generic control keys (data owner, evidence retention, reconciliation …)
// rendered as a readable control → evidence grid instead of staying hidden.
function ControlsBlock({ rows }: { rows: PlanRow[] }) {
  const evidenced = rows.filter((r) => r.defined);
  if (!evidenced.length) return null;
  return (
    <div
      className="rounded-md mt-1.5"
      style={{
        background: '#fdf8ef',
        border: '1px solid #ecdcc0',
        borderLeft: '3px solid #b45309',
      }}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white border text-[#b45309] border-[#ecdcc0]">
          Standards &amp; controls
        </span>
        <span className="text-[9px] text-[#b45309]">
          {evidenced.length}/{rows.length} evidenced
        </span>
      </div>
      <div className="px-2 pb-2 pt-1 flex flex-col gap-1">
        {evidenced.map((r, i) => (
          <div key={i} className="rounded bg-white border border-[#ecdcc0] px-2 py-1">
            <div className="text-[10px] font-semibold text-[#92600e]">
              {stripStepNumber(r.key)}
            </div>
            <div className="text-[10.5px] text-[#374151] leading-snug">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// One structured AAA sub-task: Actor · Action · Application chips, the steps,
// and a DoD box that folds the paired verification in (testing lives WITH the
// definition of done, not in a separate block).
function SubTaskCard({ s }: { s: ChainSubTask }) {
  return (
    <div className="rounded-md bg-white border border-[#cbead9] px-2 py-1.5">
      <div className="flex items-start gap-1.5">
        <span className="text-[10.5px] tabular-nums text-[#6b7785] mt-px flex-shrink-0">
          {s.n}.
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-medium text-[#171717] leading-snug">{s.action}</div>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {s.actor && (
              <span className="text-[9px] font-semibold rounded px-1.5 py-px bg-[#e9f7ef] text-[#196f3d] border border-[#cbead9]">
                {s.actor}
              </span>
            )}
            {(s.artifacts.length ? s.artifacts : s.apps).map((a) => (
              <span
                key={a}
                className="text-[9px] font-semibold rounded px-1.5 py-px bg-[#eef4fe] text-[#1d4ed8] border border-[#cdddf5]"
              >
                {a}
              </span>
            ))}
          </div>
          {s.steps.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5">
              {s.steps.map((st, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[9.5px] tabular-nums text-[#a3a3a3] mt-px flex-shrink-0">
                    {i + 1})
                  </span>
                  <span className="text-[11px] text-[#374151] leading-snug">{st}</span>
                </div>
              ))}
            </div>
          )}
          {(s.doneWhen || s.verify) && (
            <div className="mt-1.5 rounded bg-[#f2faf6] border border-[#cbead9] px-1.5 py-1">
              <span className="text-[8px] font-bold uppercase tracking-wide text-[#196f3d]">
                Done when
              </span>
              {s.doneWhen && (
                <div className="text-[10.5px] text-[#15603f] leading-snug">{s.doneWhen}</div>
              )}
              {s.verify && (
                <div className="mt-0.5 text-[10px] text-[#1d4ed8] leading-snug">
                  <span className="font-semibold">
                    Verified{s.verify.actor ? ` by the ${s.verify.actor}` : ''}
                  </span>
                  {s.verify.passWhen && <> — pass when {s.verify.passWhen}</>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The AAA sub-task block replacing the flat Sub-tasks / Sub-task testing pair.
function SubTaskBlock({ subTasks }: { subTasks: ChainSubTask[] }) {
  const defined = subTasks.filter((s) => s.defined).length;
  return (
    <div
      className="rounded-md mt-1.5"
      style={{
        background: '#f2faf6',
        border: '1px solid #cbead9',
        borderLeft: '3px solid #1e9e6a',
      }}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white border text-[#1e9e6a] border-[#cbead9]">
          Sub-tasks
        </span>
        <span className="text-[9px] text-[#1e9e6a]">
          {defined}/{subTasks.length}
        </span>
        <span className="text-[8.5px] text-[#8ba99a]">actor · action · application</span>
      </div>
      <div className="px-2 pb-2 pt-1 flex flex-col gap-1">
        {subTasks.map((s) => (
          <SubTaskCard key={s.n} s={s} />
        ))}
      </div>
    </div>
  );
}

// Standards / Regulations as their own colored sub-cards: header chip + count,
// one titled group per tied item, dashed divider between items.
function TiedBlock({
  label,
  accent,
  bg,
  border,
  items,
}: {
  label: string;
  accent: string;
  bg: string;
  border: string;
  items: TiedPlan[];
}) {
  const rows = items.flatMap((s) => [...s.checklist, ...s.testing]);
  const defined = rows.filter((r) => r.defined).length;
  return (
    <div
      className="rounded-md mt-1.5"
      style={{ background: bg, border: `1px solid ${border}`, borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        <span
          className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white border"
          style={{ color: accent, borderColor: border }}
        >
          {label}
        </span>
        <span className="text-[9px]" style={{ color: accent }}>
          {items.length} · {defined}/{rows.length}
        </span>
      </div>
      <div className="px-2 pb-2 pt-1 flex flex-col gap-1">
        {items.map((s, si) => (
          <div key={s.id}>
            {si > 0 && <div className="mb-1" style={{ borderTop: `1px dashed ${border}` }} />}
            <div className="text-[10.5px] font-semibold leading-snug" style={{ color: accent }}>
              {s.name}
              {s.source && <span className="text-[#a3a3a3] font-normal"> · {s.source}</span>}
            </div>
            {[...s.checklist, ...s.testing].map((r, i) => (
              <ChainPlanLine key={i} r={r} num={i + 1} />
            ))}
            {!s.checklist.length && !s.testing.length && (
              <div className="text-[10px] text-[#a3a3a3]">No evidence steps yet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskChain({ t, onNav }: { t: ChainTask; onNav: (p: string) => void }) {
  const openRole = useOpenRole();
  const [open, setOpen] = useState(true);
  const tied = [...t.standards, ...t.regulations];
  const subTasks = t.subTasks ?? [];
  const deps = t.dependsOn ?? [];
  const checklist = t.checklist.filter((r) => !r.generic);
  const testing = t.testing.filter((r) => !r.generic);
  const kids =
    t.roles.length +
    t.applications.length +
    subTasks.length +
    checklist.length +
    testing.length +
    tied.length;
  const allRows = [
    ...checklist,
    ...testing,
    ...tied.flatMap((x) => [...x.checklist, ...x.testing]),
  ];
  const total = allRows.length + subTasks.length;
  const defined =
    allRows.filter((r) => r.defined).length + subTasks.filter((s) => s.defined).length;
  return (
    <div
      className="rounded-lg bg-[#faf8ff] border border-[#ded5f8]"
      style={{ borderLeft: '3px solid #7c3aed' }}
    >
      <button
        onClick={() => kids > 0 && setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        {kids > 0 && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#737373"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        )}
        <span className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white text-[#6d28d9] border border-[#ded5f8] flex-shrink-0">
          Task
        </span>
        <span className="text-[11.5px] font-semibold text-[#4c1d95] flex-1 min-w-0">{t.name}</span>
        {total > 0 && (
          <span className="text-[9px] text-[#7c5db8]">
            {defined}/{total}
          </span>
        )}
      </button>
      {open && kids > 0 && (
        <div className="px-2.5 pb-2 pl-7 flex flex-col gap-1">
          {deps.length > 0 && <DependsOnRow deps={deps} />}
          {t.roles.length > 0 && <MiniHead>Roles</MiniHead>}
          {t.roles.map((r) => (
            <button
              key={r.roleId}
              onClick={() => openRole(r.roleId)}
              className="flex items-center gap-1.5 text-left group/r"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: r.relation === 'Owner' ? '#1e9e6a' : '#7fc9a6' }}
              />
              <span className="text-[11.5px] text-[#15603f] group-hover/r:underline">{r.name}</span>
              <span className="text-[9px] text-[#8a8a8a]">
                {r.relation === 'Owner' ? 'Owner' : 'Participant'}
              </span>
            </button>
          ))}
          {t.applications.length > 0 && <MiniHead>Applications</MiniHead>}
          {t.applications.map((a) => (
            <button
              key={a.appId}
              onClick={() => onNav(`/applications?focus=${encodeURIComponent(a.appId)}`)}
              className="flex items-center gap-1.5 text-left group/a"
            >
              <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0 bg-[#1d4ed8]" />
              <span className="text-[11.5px] text-[#1d4ed8] group-hover/a:underline">{a.name}</span>
              {a.usageType !== 'performed' && (
                <span className="text-[9px] text-[#8a8a8a]">
                  {a.usageType
                    .split(' · ')
                    .filter((t) => t !== 'performed')
                    .join(' · ')}
                </span>
              )}
            </button>
          ))}
          {subTasks.length > 0 && <SubTaskBlock subTasks={subTasks} />}
          <ControlsBlock rows={t.checklist.filter((r) => r.generic)} />
          {checklist.length > 0 && (
            <PlanBlock
              label="Sub-tasks"
              accent="#1e9e6a"
              bg="#f2faf6"
              border="#cbead9"
              rows={checklist}
            />
          )}
          {testing.length > 0 && (
            <PlanBlock
              label="Sub-task testing"
              accent="#1d4ed8"
              bg="#f0f5fe"
              border="#cdddf5"
              rows={testing}
            />
          )}
          {t.standards.length > 0 && (
            <TiedBlock
              label="Standards"
              accent="#b45309"
              bg="#fdf8ef"
              border="#ecdcc0"
              items={t.standards}
            />
          )}
          {t.regulations.length > 0 && (
            <TiedBlock
              label="Regulations"
              accent="#be123c"
              bg="#fdf3f6"
              border="#f2cdd8"
              items={t.regulations}
            />
          )}
        </div>
      )}
    </div>
  );
}
