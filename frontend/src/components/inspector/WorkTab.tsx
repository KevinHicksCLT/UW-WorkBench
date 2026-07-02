/**
 * Inspector Work tab — the connected chain in one organized view: Deliverable
 * → the Tasks that produce it → each task's Roles, Applications, Checklist
 * items, and the Testing plan that verifies it. Extracted verbatim from
 * Inspector.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { SkeletonLoader } from '../ui';
import { AddPicker, Empty, LinkOut, DetachBtn } from './atoms';
import type { AfterFn, Payload, PlanRow, TiedPlan } from './types';

// ── Deliverable chain payload (mirrors GET /inspector/:nodeId/chain) ─────────
type ChainRole = { roleId: string; name: string; relation: string };
type ChainApp = { appId: string; name: string; usageType: string };
type ChainTask = {
  taskId: string; name: string; roles: ChainRole[]; applications: ChainApp[];
  checklist: PlanRow[]; testing: PlanRow[]; standards: TiedPlan[]; regulations: TiedPlan[];
};
type ChainDeliv = { deliverableId: string; title: string; linkId: string | null; tasks: ChainTask[]; rollup: { defined: number; total: number } };

// Work tab — the connected chain in one organized view: Deliverable → the Tasks
// that produce it → each task's Roles, Applications, Checklist items, and the
// Testing plan that verifies it. Read-oriented; associate/detach the deliverable
// in edit mode (at a step).
export function WorkTab({ data, edit, onNav, after }: {
  data: Payload; edit: boolean; onNav: (p: string) => void;
  after: AfterFn;
}) {
  const [chain, setChain] = useState<ChainDeliv[]>([]);
  const [ver, setVer] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false; setLoading(true);
    api.get<{ chain: ChainDeliv[] }>(`/inspector/${data.id}/chain`)
      .then((r) => { if (!cancelled) { setChain(r.chain); setLoading(false); } })
      .catch(() => { if (!cancelled) { setChain([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [data.id, ver]);
  const reload = () => setVer((v) => v + 1);

  const add = async (choice: { id?: string; newName?: string }) => {
    const r = await api.post(`/inspector/${data.id}/deliverables`, { deliverableId: choice.id, newTitle: choice.newName });
    const linkId = r.deliverable.linkId; reload();
    after(`${r.deliverable.title} added`, 'Now in Deliverables & this step', async () => { await api.delete(`/inspector/deliverables/${linkId}`); reload(); after('Removed', 'Reverted'); });
  };
  const detach = async (linkId: string) => { await api.delete(`/inspector/deliverables/${linkId}`); reload(); after('Detached', 'The deliverable is kept'); };

  return (
    <div>
      {edit && <div className="flex justify-end mb-2"><AddPicker label="Associate / add deliverable" kind="deliverables" onPick={add} /></div>}
      {loading ? <SkeletonLoader height={64} />
        : !chain.length ? <Empty text={edit ? 'Add the first deliverable above.' : 'No deliverables recorded here.'} />
        : <div className="flex flex-col gap-2">{chain.map((d) => <DelivChain key={d.deliverableId} d={d} edit={edit} onNav={onNav} onDetach={detach} />)}</div>}
    </div>
  );
}

// Chain plan row — defined value → green ✓, missing key → red ✗.
const ChainPlanLine = ({ r }: { r: PlanRow }) => (
  <div className="flex items-start gap-1.5">
    <span className={(r.defined ? 'text-[#1e9e6a]' : 'text-[#dc2626]') + ' text-[12px] mt-px flex-shrink-0'}>{r.defined ? '✓' : '✗'}</span>
    <span className="text-[11.5px] leading-snug">
      {r.defined
        ? <><span className="text-[#8a94a0]">{r.key}: </span><span className="text-[#171717]">{r.value}</span></>
        : <span className="text-[#6b7785]">{r.key}</span>}
    </span>
  </div>
);

function DelivChain({ d, edit, onNav, onDetach }: { d: ChainDeliv; edit: boolean; onNav: (p: string) => void; onDetach: (linkId: string) => void }) {
  const [open, setOpen] = useState(true);
  const kids = d.tasks.length;
  const pct = d.rollup.total ? Math.round((100 * d.rollup.defined) / d.rollup.total) : null;
  return (
    <div className="rounded-lg bg-[#e9f7ef] border border-[#cbead9]" style={{ borderLeft: '3px solid #1e9e6a' }}>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        {kids > 0 && (
          <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse' : 'Expand'} className="text-[#737373] hover:text-[#171717]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}><path d="M9 6l6 6-6 6" /></svg>
          </button>
        )}
        <span className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white text-[#196f3d] border border-[#cbead9] flex-shrink-0">Deliverable</span>
        <span className="text-[12.5px] font-bold text-[#196f3d] flex-1 min-w-0 truncate">{d.title}</span>
        {pct !== null && (
          <span className={'text-[9px] px-1.5 py-px rounded-full flex-shrink-0 ' + (pct === 100 ? 'bg-white text-[#196f3d] border border-[#cbead9]' : 'bg-[#fdf3e0] text-[#8a5a12]')}
            title="Checklist + testing keys defined across this deliverable's tasks">
            {d.rollup.defined} of {d.rollup.total} verified
          </span>
        )}
        {d.tasks.length > 0 && <span className="text-[9px] text-[#5a8a6f]">{d.tasks.length} task{d.tasks.length === 1 ? '' : 's'}</span>}
        <LinkOut onClick={() => onNav('/deliverables')} />
        {edit && d.linkId && <DetachBtn onClick={() => onDetach(d.linkId!)} />}
      </div>
      {open && kids > 0 && (
        <div className="px-2.5 pb-2.5 pt-0.5 flex flex-col gap-1.5">
          {d.tasks.map((t) => <TaskChain key={t.taskId} t={t} onNav={onNav} />)}
        </div>
      )}
    </div>
  );
}

function MiniHead({ children }: { children: React.ReactNode }) {
  return <div className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#a3a3a3] mt-1.5 first:mt-0">{children}</div>;
}

function TaskChain({ t, onNav }: { t: ChainTask; onNav: (p: string) => void }) {
  const [open, setOpen] = useState(true);
  const tied = [...t.standards, ...t.regulations];
  const kids = t.roles.length + t.applications.length + t.checklist.length + t.testing.length + tied.length;
  const allRows = [...t.checklist, ...t.testing, ...tied.flatMap((x) => [...x.checklist, ...x.testing])];
  const defined = allRows.filter((r) => r.defined).length;
  return (
    <div className="rounded-lg bg-[#faf8ff] border border-[#ded5f8]" style={{ borderLeft: '3px solid #7c3aed' }}>
      <button onClick={() => kids > 0 && setOpen((o) => !o)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left">
        {kids > 0 && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}><path d="M9 6l6 6-6 6" /></svg>
        )}
        <span className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white text-[#6d28d9] border border-[#ded5f8] flex-shrink-0">Task</span>
        <span className="text-[11.5px] font-semibold text-[#4c1d95] flex-1 min-w-0">{t.name}</span>
        {allRows.length > 0 && <span className="text-[9px] text-[#7c5db8]">{defined}/{allRows.length} ✓</span>}
      </button>
      {open && kids > 0 && (
        <div className="px-2.5 pb-2 pl-7 flex flex-col gap-1">
          {t.roles.length > 0 && <MiniHead>Roles</MiniHead>}
          {t.roles.map((r) => (
            <button key={r.roleId} onClick={() => onNav(`/organization?role=${encodeURIComponent(r.roleId)}`)} className="flex items-center gap-1.5 text-left group/r">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.relation === 'Owner' ? '#1e9e6a' : '#7fc9a6' }} />
              <span className="text-[11.5px] text-[#15603f] group-hover/r:underline">{r.name}</span>
              <span className="text-[9px] text-[#8a8a8a]">{r.relation === 'Owner' ? 'Owner' : 'Participant'}</span>
            </button>
          ))}
          {t.applications.length > 0 && <MiniHead>Applications</MiniHead>}
          {t.applications.map((a) => (
            <button key={a.appId} onClick={() => onNav(`/applications?focus=${encodeURIComponent(a.appId)}`)} className="flex items-center gap-1.5 text-left group/a">
              <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0 bg-[#1d4ed8]" />
              <span className="text-[11.5px] text-[#1d4ed8] group-hover/a:underline">{a.name}</span>
              {a.usageType !== 'performed' && <span className="text-[9px] text-[#8a8a8a]">{a.usageType.split(' · ').filter((t) => t !== 'performed').join(' · ')}</span>}
            </button>
          ))}
          {t.checklist.length > 0 && <MiniHead>Checklist</MiniHead>}
          {t.checklist.map((r, i) => <ChainPlanLine key={i} r={r} />)}
          {t.testing.length > 0 && <MiniHead>Testing</MiniHead>}
          {t.testing.map((r, i) => <ChainPlanLine key={i} r={r} />)}
          {t.standards.length > 0 && <MiniHead>Standards</MiniHead>}
          {t.standards.map((s) => (
            <div key={s.id}>
              <div className="text-[10.5px] font-semibold text-[#525252] leading-snug">{s.name}{s.source && <span className="text-[#a3a3a3] font-normal"> · {s.source}</span>}</div>
              {[...s.checklist, ...s.testing].map((r, i) => <ChainPlanLine key={i} r={r} />)}
              {!s.checklist.length && !s.testing.length && <div className="text-[10px] text-[#a3a3a3]">No evidence steps yet</div>}
            </div>
          ))}
          {t.regulations.length > 0 && <MiniHead>Regulations</MiniHead>}
          {t.regulations.map((s) => (
            <div key={s.id}>
              <div className="text-[10.5px] font-semibold text-[#525252] leading-snug">{s.name}{s.source && <span className="text-[#a3a3a3] font-normal"> · {s.source}</span>}</div>
              {[...s.checklist, ...s.testing].map((r, i) => <ChainPlanLine key={i} r={r} />)}
              {!s.checklist.length && !s.testing.length && <div className="text-[10px] text-[#a3a3a3]">No evidence steps yet</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
