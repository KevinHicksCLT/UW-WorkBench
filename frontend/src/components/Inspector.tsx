// Inspector.tsx — the unified Value-Streams inspector (Sidebar-Rework-v2).
//
// ONE component, identical on the List and the Map and at every level; only the
// content DENSITY changes. A container node (value stream / area / sub-process)
// renders a live ROLLUP of everything beneath it; an isTask leaf renders the
// full editable DETAIL (roles +RACI, applications +usage, deliverable, checklist
// items, testing template). Every linked entity is a ↗ hyperlink to its
// canonical screen. Editing at the leaf writes to ONE canonical record (the
// /inspector CRUD endpoints) and is reflected everywhere — optimistic, with an
// Undo toast naming where the change landed. No schema/table names ever surface:
// labels are the client's own business terms.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { DOMAIN_HEX } from '../viz/model';
import { automatablePct, scoreToPct, AutomatableMeter, SCORE_DESC, SCORE_COLOR, SCORE_LABEL } from '../lib/automatable';

// ── Payload (mirrors GET /inspector/:nodeId) ─────────────────────────────────
type Relation = 'Owner' | 'Participant';
type RoleDetail = { nodeRoleId: string; roleId: string; name: string; relation: Relation; raci?: string | null };
type RoleRollup = { roleId: string; name: string; relation: Relation; tasks: number };
type AppDetail = { usageId: string; appId: string; name: string; usageType: string };
type AppRollup = { appId: string; name: string; usageType: string; tasks: number };
type DelivDetail = { linkId: string; deliverableId: string; title: string };
type DelivRollup = { deliverableId: string; title: string };
type CheckDetail = { nodeChecklistId: string; checklistItemId: string; text: string };
type CheckRollup = { checklistItemId: string; text: string };
type TestingDetail = { id: string | null; deliverableId: string | null; system: string | null; location: string | null; checkType: string | null; expected: string | null };
type TestingRollup = { id: string; system: string | null; location: string | null; checkType: string | null; expected: string | null };

type Payload = {
  id: string; name: string; levelNumber: number; levelLabel: string;
  isTask: boolean; detail: boolean; automatability: string | null;
  code: string | null;
  attributes: {
    l3num?: string | null; l4num?: string | null; l5num?: string | null;
    how?: string | null; testByPattern?: string | null;
    checklistPattern?: string | null; checklistDifferences?: string | null;
    l4l5Mapping?: string | null; disposition?: string | null;
  } | null;
  domain: string | null; valueStreamId: string | null;
  breadcrumb: { id: string; name: string }[];
  counts: { roles: number; applications: number; deliverables: number; tasks: number; checklist: number; testing: number };
  automation: {
    score: number | null; scored: number; auto: number; pct: number | null; tiers: Record<number, number>;
    byChild: { id: string; name: string; isTask: boolean; scored: number; auto: number; pct: number | null }[];
    byChildLabel: string | null;
  };
  roles: (RoleDetail | RoleRollup)[];
  applications: (AppDetail | AppRollup)[];
  deliverables: (DelivDetail | DelivRollup)[];
  checklist: (CheckDetail | CheckRollup)[];
  testing: TestingDetail | TestingRollup[];
  children: { id: string; name: string; isTask: boolean }[];
};

type Tab = 'Overview' | 'Work' | 'Tasks' | 'Roles' | 'Applications' | 'Deliverables' | 'Checklist' | 'Testing';
const TABS: Tab[] = ['Overview', 'Work', 'Tasks', 'Roles', 'Applications', 'Deliverables', 'Checklist', 'Testing'];

const RACI = ['Responsible', 'Accountable', 'Consulted', 'Informed'];

// ── Small UI atoms ───────────────────────────────────────────────────────────
function Select({ value, onChange, options, w = 130 }: { value: string; onChange: (v: string) => void; options: string[]; w?: number }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: w }}
      className="rounded-md border border-[#9fb6e8] bg-white px-2 py-1 text-[11px] text-[#171717]">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Associate-or-create picker: searches existing entities, or creates a new one
// inline from the typed text. Used for roles / applications / deliverables.
function AddPicker({ label, kind, onPick }: {
  label: string; kind: 'roles' | 'applications' | 'deliverables';
  onPick: (choice: { id?: string; newName?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<{ id: string; name: string; sub?: string | null }[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api.get(`/inspector/search/${kind}?q=${encodeURIComponent(q)}`)
        .then((r: { items: typeof items }) => { if (!cancelled) setItems(r.items); })
        .catch(() => { if (!cancelled) setItems([]); });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, q, kind]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const exact = items.some((i) => i.name.toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-[#9fb6e8] bg-[#eaf1fe] px-2.5 py-1 text-[11.5px] font-semibold text-[#1d4ed8] hover:bg-[#dceafe]">
        ＋ {label}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-[#e2e6ea] bg-white shadow-xl p-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or type a new name…"
            className="w-full rounded-md border border-[#e2e6ea] px-2 py-1.5 text-[12px] mb-1.5 outline-none focus:border-[#9fb6e8]" />
          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
            {q.trim() && !exact && (
              <button onClick={() => { onPick({ newName: q.trim() }); setOpen(false); setQ(''); }}
                className="text-left rounded-md px-2 py-1.5 text-[12px] text-[#15603f] bg-[#e7f6ef] hover:bg-[#d6f0e2]">
                ＋ Create new “{q.trim()}”
              </button>
            )}
            {items.map((i) => (
              <button key={i.id} onClick={() => { onPick({ id: i.id }); setOpen(false); setQ(''); }}
                className="text-left rounded-md px-2 py-1.5 hover:bg-[#f5f8ff]">
                <span className="text-[12px] text-[#171717]">{i.name}</span>
                {i.sub && <span className="block text-[10px] text-[#a3a3a3]">{i.sub}</span>}
              </button>
            ))}
            {!items.length && !q.trim() && <div className="px-2 py-2 text-[11px] text-[#a3a3a3] italic">Type to search…</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inspector ─────────────────────────────────────────────────────────────────
export default function Inspector({ nodeId, onClose, onRetarget, accent, startCollapsed }: {
  nodeId: string;
  onClose?: () => void;
  // Re-target the inspector to another node (breadcrumb crumb / child drill).
  onRetarget: (id: string) => void;
  accent?: string;
  // Map opens collapsed (rail) so the canvas isn't covered; List opens expanded.
  startCollapsed?: boolean;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Overview');
  const [edit, setEdit] = useState(false);
  const [collapsed, setCollapsed] = useState(!!startCollapsed);
  const [toast, setToast] = useState<{ msg: string; sub: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/inspector/${encodeURIComponent(nodeId)}`)
      .then((d: Payload) => { if (!cancelled) { setData(d); setLoading(false); if (!d.detail) setEdit(false); } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [nodeId]);

  useEffect(() => load(), [load]);
  useEffect(() => { setTab('Overview'); setEdit(false); }, [nodeId]);

  const showToast = (msg: string, sub: string, undo?: () => void) => {
    setToast({ msg, sub, undo });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  };
  const propText = (p?: { places: string[]; streams: number }) => {
    if (!p) return 'Applied across the app';
    const bits = [...p.places];
    if (p.streams > 0) bits.push(`${p.streams} value stream${p.streams === 1 ? '' : 's'}`);
    return `Now applied in ${bits.join(', ')}`;
  };
  // Any write reloads the canonical record so every tab + the rollups reflect it.
  const after = async (msg: string, sub: string, undo?: () => void) => { load(); showToast(msg, sub, undo); };

  const detail = !!data?.detail;
  // Top-accent bar carries the node's domain color (overridable by the host).
  accent = accent ?? (data?.domain ? DOMAIN_HEX[data.domain] : undefined);

  // ── Collapsed rail (map parity) ─────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col items-center bg-[#eaf1ff] border-l border-[#cdddff] flex-shrink-0"
        style={{ width: 44, ...(accent ? { background: `${accent}14`, borderColor: `${accent}45` } : {}) }}>
        <button onClick={() => setCollapsed(false)} aria-label="Expand panel" title="Expand panel"
          className="mt-3 w-8 h-8 rounded-full bg-[#0070AD] text-white shadow-sm hover:bg-[#005a8c] flex items-center justify-center"
          style={accent ? { background: accent } : undefined}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0070AD] [writing-mode:vertical-rl] rotate-180 select-none max-h-[60vh] overflow-hidden text-ellipsis"
          style={accent ? { color: accent } : undefined} title={data?.name ?? 'Inspector'}>
          {data?.name ?? 'Inspector'}
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex flex-col bg-white border-l border-[#eaeaea] flex-shrink-0 relative overflow-hidden"
      style={{ width: 420, minWidth: 360, ...(accent ? { borderTop: `3px solid ${accent}` } : {}) }}>

      {/* Edit-mode banner — saved to the single source of truth. */}
      {edit && (
        <div className="flex-shrink-0 z-20 flex items-center gap-2 px-4 py-2.5 bg-[#e7f6ef] border-b border-[#bfe3d0]"
          style={{ boxShadow: 'inset 4px 0 0 #1e9e6a' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-[#15603f]">✎ Edit mode</div>
            <div className="text-[10.5px] text-[#1e7a52] leading-snug">⟲ Saved to the single source of truth — every change applies across all tabs &amp; the whole app</div>
          </div>
          <button onClick={() => setEdit(false)} className="flex-shrink-0 rounded-md bg-[#1e9e6a] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#178a5b]">Done</button>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[#eaeaea]">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {/* Breadcrumb — each crumb re-targets the inspector. */}
            {data?.breadcrumb?.length ? (
              <div className="text-[10.5px] text-[#a3a3a3] truncate mb-1">
                {data.breadcrumb.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && <span className="mx-1">▸</span>}
                    <button onClick={() => onRetarget(c.id)} className="hover:text-[#1d4ed8] hover:underline">{c.name}</button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="text-[15px] font-bold text-[#171717] leading-snug">{loading ? 'Loading…' : data?.name ?? '—'}</div>
            {data && (data.levelLabel || data.code) && (
              <div className="text-[10px] text-[#a3a3a3] mt-0.5">
                {data.levelLabel}{data.code ? <> · <span className="font-semibold text-[#737575] tabular-nums">#{data.code}</span></> : null}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setCollapsed(true)} aria-label="Minimize" title="Minimize panel"
              className="text-[#a3a3a3] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            {onClose && (
              <button onClick={onClose} aria-label="Close" className="text-[#a3a3a3] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Identity & status chips + level badge */}
        {data && !loading && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {detail && (
              <button onClick={() => setEdit((e) => !e)}
                className={'ml-auto rounded-md px-2.5 py-1 text-[11px] font-semibold ' + (edit ? 'bg-[#eaeaea] text-[#525252]' : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]')}>
                {edit ? 'Done' : '✎ Edit'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab strip */}
      {data && !loading && (
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-[#eaeaea] overflow-x-auto">
          {TABS.map((t) => {
            const n = tabCount(data, t);
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={'flex-shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap ' + (active ? 'bg-[#eaf1fe] text-[#1d4ed8] font-semibold' : 'text-[#737575] hover:bg-[#fafafa]')}>
                {t}{n != null && <span className={'ml-1 tabular-nums ' + (active ? 'text-[#1d4ed8]' : 'text-[#a3a3a3]')}>({n})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Body — the ONLY scroll container, so the header + tabs stay pinned and
          reachable on every tab regardless of content height. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading || !data ? (
          <div className="grid grid-cols-2 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton rounded-md" style={{ height: 56 }} />)}</div>
        ) : (
          <>
            {tab === 'Overview' && <OverviewTab data={data} onTab={setTab} onRetarget={onRetarget} />}
            {tab === 'Work' && <WorkTab data={data} edit={edit} onNav={navigate} after={after} />}
            {tab === 'Tasks' && <TasksTab data={data} onRetarget={onRetarget} />}
            {tab === 'Roles' && <RolesTab data={data} edit={edit} onNav={navigate} after={after} propText={propText} />}
            {tab === 'Applications' && <AppsTab data={data} edit={edit} onNav={navigate} after={after} propText={propText} />}
            {tab === 'Deliverables' && <DeliverablesTab data={data} edit={edit} onNav={navigate} after={after} />}
            {tab === 'Checklist' && <ChecklistTab data={data} edit={edit} after={after} />}
            {tab === 'Testing' && <TestingTab data={data} edit={edit} after={after} />}

            {/* Auto-association reminder (no manual node ops) — scrolls with content. */}
            {detail && edit && (
              <div className="mt-4 rounded-lg bg-[#f4ecf7] border border-[#e6d6f0] px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-[#6c3fa0]">No manual hierarchy steps.</div>
                <div className="text-[11px] text-[#7c4db8] leading-snug">When you add or move an item, the app places it and wires the associations automatically.</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Propagation toast + Undo — floats over the body, above the scrollbar. */}
      {toast && (
        <div className="absolute bottom-3 left-4 right-4 z-30 rounded-lg bg-[#1a2733] px-3 py-2.5 flex items-center gap-3 shadow-lg">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-white">✓ {toast.msg}</div>
            <div className="text-[11px] text-[#9fe3c0] leading-snug">{toast.sub}</div>
          </div>
          {toast.undo && <button onClick={() => { toast.undo!(); setToast(null); }} className="flex-shrink-0 text-[12px] font-bold text-[#7fb2ff]">Undo</button>}
        </div>
      )}
    </aside>
  );
}

// Live count for a tab badge.
function tabCount(d: Payload, t: Tab): number | null {
  switch (t) {
    case 'Work': return d.counts.deliverables;
    case 'Tasks': return d.counts.tasks;
    case 'Roles': return d.counts.roles;
    case 'Applications': return d.counts.applications;
    case 'Deliverables': return d.counts.deliverables;
    case 'Checklist': return d.counts.checklist;
    case 'Testing': return d.counts.testing;
    default: return null;
  }
}

const LinkOut = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} title="Open" className="flex-shrink-0 text-[#2563eb] text-[11px] hover:underline">↗ open</button>
);
const DetachBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} title="Detach" className="flex-shrink-0 text-[#d1453b] text-[14px] leading-none hover:scale-110">✕</button>
);

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ data, onTab, onRetarget }: { data: Payload; onTab: (t: Tab) => void; onRetarget: (id: string) => void }) {
  const tiles: { label: string; n: number; tab: Tab }[] = [
    { label: 'Roles', n: data.counts.roles, tab: 'Roles' },
    { label: 'Applications', n: data.counts.applications, tab: 'Applications' },
    { label: 'Deliverables', n: data.counts.deliverables, tab: 'Deliverables' },
    { label: 'Tasks', n: data.counts.tasks, tab: 'Tasks' },
    { label: 'Checklist items', n: data.counts.checklist, tab: 'Checklist' },
    { label: 'Testing templates', n: data.counts.testing, tab: 'Testing' },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <button key={t.label} onClick={() => onTab(t.tab)}
            className="text-left rounded-lg border border-[#eaeaea] bg-[#f7f9fb] px-3 py-2.5 hover:bg-[#f5f8ff] hover:border-[#dbe7ff]">
            <div className="text-[17px] font-bold text-[#171717] tabular-nums leading-none">{t.n}</div>
            <div className="text-[9.5px] text-[#737575] mt-1 leading-tight">{t.label}</div>
          </button>
        ))}
      </div>
      <AutomationPanel data={data} onRetarget={onRetarget} />

      {data.detail && <ProcessDetailPanel data={data} />}

      {data.detail && (
        <div className="mt-4 rounded-lg bg-[#fbfcfd] border border-[#eaeaea] px-3 py-2.5 text-[11px] text-[#737575] leading-snug">
          The real, editable detail of one step. Everything here is the live, shared record.
        </div>
      )}
    </div>
  );
}

// Workbook step fields stored on ProcessNode.attributes/code (How, Test by Pattern,
// Checklist Pattern/Differences, ordinals) — surfaced read-only on the step overview.
function ProcessDetailPanel({ data }: { data: Payload }) {
  const a = data.attributes ?? {};
  const stepNo = a.l5num ?? data.code ?? null;
  const blocks: { label: string; value?: string | null }[] = [
    { label: 'How (test method)', value: a.how },
    { label: 'Test by pattern', value: a.testByPattern },
    { label: 'Checklist pattern', value: a.checklistPattern },
    { label: 'Checklist differences by pattern', value: a.checklistDifferences },
    { label: 'L4/L5 pair mapping', value: a.l4l5Mapping },
    { label: 'Disposition', value: a.disposition },
  ].filter((b) => b.value && String(b.value).trim());
  if (!stepNo && !blocks.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-[#eaeaea] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3] mb-2">Process detail</div>
      {stepNo && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[9.5px] text-[#737575]">Step #</span>
          <span className="text-[11px] font-semibold text-[#171717] tabular-nums">{stepNo}</span>
        </div>
      )}
      {blocks.map((b) => (
        <div key={b.label} className="mb-2.5 last:mb-0">
          <div className="text-[9.5px] font-medium uppercase tracking-wide text-[#a3a3a3] mb-0.5">{b.label}</div>
          <div className="text-[11px] text-[#404040] leading-snug whitespace-pre-line">{b.value}</div>
        </div>
      ))}
    </div>
  );
}

// AI-automation snapshot, computed from the tasks' ability to be automated
// (score ≤ 2 = Workflow/Autonomous tier). Shows the overall % at this node, then
// a "% automatable by <next level down>" breakdown — value stream → PL3, PL3 →
// PL4, PL4 → step — so it adapts to whatever level we're on. At a step it shows
// that step's own 1-5 agent-automatability meter.
const pctColor = (p: number) => (p >= 67 ? '#059669' : p >= 34 ? '#d97706' : '#dc2626');

function AutomationPanel({ data, onRetarget }: { data: Payload; onRetarget: (id: string) => void }) {
  const a = data.automation;
  // Single task → graded % from its 1-5 score (partial reads partial). Group →
  // share of tasks that are agent-runnable (score ≤ 2), as a count.
  const overall = data.detail
    ? (typeof a.score === 'number' ? { pct: scoreToPct(a.score)!, auto: 0, scored: 1 } : null)
    : (a.pct != null ? { pct: a.pct, auto: a.auto, scored: a.scored } : null);
  const rows = (a.byChild ?? []).filter((c) => c.scored > 0).sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0));
  const levelWord = a.byChildLabel ?? 'level';
  return (
    <div className="mt-4 rounded-lg border border-[#eaeaea] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3] mb-2">AI automation</div>
      <div className="flex items-end gap-4">
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums" style={{ color: overall ? pctColor(overall.pct) : '#a3a3a3' }}>{overall ? `${overall.pct}%` : '—'}</div>
          <div className="text-[9.5px] text-[#737575] mt-1">Automatable by AI agents</div>
        </div>
        {!data.detail && overall && (
          <div className="text-[10.5px] text-[#737575] pb-0.5">{overall.auto} of {overall.scored} tasks can be<br />agent-run (Workflow + Autonomous)</div>
        )}
        {data.detail && typeof a.score === 'number' && (
          <div className="pb-0.5"><AutomatableMeter score={a.score} /></div>
        )}
      </div>

      {data.detail && typeof a.score === 'number' && (
        <div className="mt-2 rounded-md bg-[#fbfcfd] border border-[#eaeaea] px-2.5 py-1.5 text-[11px] text-[#525252] leading-snug">
          <span className="font-semibold" style={{ color: SCORE_COLOR[a.score] }}>{SCORE_LABEL[a.score]}</span> — {SCORE_DESC[a.score]}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1.5">% automatable by {levelWord.toLowerCase()}</div>
          <div className="flex flex-col gap-1.5">
            {rows.map((c) => {
              const p = c.pct ?? 0;
              return (
                <button key={c.id} onClick={() => onRetarget(c.id)} className="text-left group/row">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] text-[#171717] truncate group-hover/row:underline decoration-[#c8d6ea]">{c.name}</span>
                    <span className="text-[10.5px] font-semibold tabular-nums flex-shrink-0" style={{ color: pctColor(p) }}>{p}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p}%`, background: pctColor(p) }} />
                  </div>
                  <div className="text-[9px] text-[#a3a3a3] mt-0.5">{c.auto} of {c.scored} tasks</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tasks (children / drill) ────────────────────────────────────────────────
function TasksTab({ data, onRetarget }: { data: Payload; onRetarget: (id: string) => void }) {
  if (!data.children.length) return <Empty text={data.detail ? 'This is a leaf step — no children.' : 'No steps recorded here.'} />;
  return (
    <div>
      <div className="flex flex-col gap-1">
        {data.children.map((c, i) => (
          <button key={c.id} onClick={() => onRetarget(c.id)}
            className="text-left rounded-md border border-[#eaeaea] px-2.5 py-1.5 hover:bg-[#f5f8ff] hover:border-[#dbe7ff] flex items-center gap-2">
            <span className="text-[9px] text-[#a3a3a3] tabular-nums">{i + 1}</span>
            <span className="text-[12px] text-[#171717] flex-1 min-w-0 truncate">{c.name}</span>
            <span className="text-[#a3a3a3] text-[11px]">↗</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Roles ──────────────────────────────────────────────────────────────────
function RolesTab({ data, edit, onNav, after, propText }: {
  data: Payload; edit: boolean; onNav: (p: string) => void;
  after: (msg: string, sub: string, undo?: () => void) => void;
  propText: (p?: { places: string[]; streams: number }) => string;
}) {
  const add = async (choice: { id?: string; newName?: string }, relation: Relation = 'Participant') => {
    const r = await api.post(`/inspector/${data.id}/roles`, { roleId: choice.id, newRoleName: choice.newName, relation });
    const nodeRoleId = r.role.nodeRoleId;
    after(`${r.role.name} added`, propText(r.propagation), async () => { await api.delete(`/inspector/roles/${nodeRoleId}`); after('Removed', 'Reverted across the app'); });
  };
  return (
    <div>
      {edit && <div className="flex justify-end mb-2"><AddPicker label="Associate / add role" kind="roles" onPick={(c) => add(c)} /></div>}
      {!data.roles.length && <Empty text={edit ? 'Add the first role above.' : 'No roles resolved here.'} />}
      <div className="flex flex-col gap-1.5">
        {data.roles.map((r) => {
          const isDetail = 'nodeRoleId' in r;
          return (
            <div key={isDetail ? (r as RoleDetail).nodeRoleId : (r as RoleRollup).roleId}
              className="rounded-lg bg-[#f7fbf8] border border-[#cbead9] px-2.5 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.relation === 'Owner' ? '#1e9e6a' : '#7fc9a6' }} />
              <span className="text-[12.5px] font-semibold text-[#15603f] flex-1 min-w-0 truncate">{r.name}</span>
              {isDetail && edit ? (
                <>
                  <Select value={r.relation} w={108} options={['Owner', 'Participant']}
                    onChange={async (v) => { await api.patch(`/inspector/roles/${(r as RoleDetail).nodeRoleId}`, { relation: v }); after('Updated', 'Saved to the single record'); }} />
                  <Select value={(r as RoleDetail).raci ?? ''} w={122} options={['', ...RACI]}
                    onChange={async (v) => { await api.patch(`/inspector/roles/${(r as RoleDetail).nodeRoleId}`, { raci: v || null }); after('Updated', 'Saved to the single record'); }} />
                </>
              ) : (
                <span className="text-[10px] text-[#15603f] bg-white border border-[#cbead9] rounded px-1.5 py-0.5">
                  {r.relation === 'Owner' ? 'Owner' : 'Participant'}{!isDetail && (r as RoleRollup).tasks ? ` · ${(r as RoleRollup).tasks} tasks` : ''}{isDetail && (r as RoleDetail).raci ? ` · ${(r as RoleDetail).raci}` : ''}
                </span>
              )}
              <LinkOut onClick={() => onNav(`/roles?role=${encodeURIComponent(r.roleId)}`)} />
              {isDetail && edit && <DetachBtn onClick={async () => { await api.delete(`/inspector/roles/${(r as RoleDetail).nodeRoleId}`); after('Detached', 'The role itself is kept'); }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Applications ──────────────────────────────────────────────────────────────
function AppsTab({ data, edit, onNav, after, propText }: {
  data: Payload; edit: boolean; onNav: (p: string) => void;
  after: (msg: string, sub: string, undo?: () => void) => void;
  propText: (p?: { places: string[]; streams: number }) => string;
}) {
  const add = async (choice: { id?: string; newName?: string }, usageType = 'performed') => {
    const r = await api.post(`/inspector/${data.id}/applications`, { applicationId: choice.id, newAppName: choice.newName, usageType });
    const usageId = r.application.usageId;
    after(`${r.application.name} added`, propText(r.propagation), async () => { await api.delete(`/inspector/applications/${usageId}`); after('Removed', 'Reverted across the app'); });
  };
  return (
    <div>
      {edit && <div className="flex justify-end mb-2"><AddPicker label="Associate / add application" kind="applications" onPick={(c) => add(c)} /></div>}
      {!data.applications.length && <Empty text={edit ? 'Add the first application above.' : 'No applications recorded here.'} />}
      <div className="flex flex-col gap-1.5">
        {data.applications.map((a) => {
          const isDetail = 'usageId' in a;
          return (
            <div key={isDetail ? (a as AppDetail).usageId : (a as AppRollup).appId}
              className="rounded-lg bg-[#eff5ff] border border-[#d4e2fc] px-2.5 py-2 flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-[#1d4ed8] flex-1 min-w-0 truncate">{a.name}</span>
              {isDetail && edit ? (
                <Select value={(a as AppDetail).usageType} w={132} options={['performed', 'memorialized']}
                  onChange={async (v) => { await api.patch(`/inspector/applications/${(a as AppDetail).usageId}`, { usageType: v }); after('Updated', 'Saved to the single record'); }} />
              ) : (
                <span className="text-[10px] text-[#1d4ed8] bg-white border border-[#d4e2fc] rounded px-1.5 py-0.5">
                  {a.usageType}{!isDetail && (a as AppRollup).tasks ? ` · ${(a as AppRollup).tasks} tasks` : ''}
                </span>
              )}
              <LinkOut onClick={() => onNav(`/applications?focus=${encodeURIComponent(a.appId)}`)} />
              {isDetail && edit && <DetachBtn onClick={async () => { await api.delete(`/inspector/applications/${(a as AppDetail).usageId}`); after('Detached', 'The application is kept in the catalog'); }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Deliverables ──────────────────────────────────────────────────────────────
// The Deliverables tab IS the connected chain, in one organized view:
//   Deliverable → the Tasks that produce it → each task's Checklist items
//   → the Testing templates that verify it. Read-oriented; associate/detach
//   the deliverable in edit mode (at a step).
type ChainTest = { id: string; system: string | null; location: string | null; checkType: string | null; expected: string | null };
type ChainCheck = { id: string; text: string; group: string | null };
type ChainRole = { roleId: string; name: string; relation: string };
type ChainApp = { appId: string; name: string; usageType: string };
type ChainTask = { taskId: string; name: string; roles: ChainRole[]; applications: ChainApp[]; checklist: ChainCheck[]; testing: ChainTest[] };
type ChainDeliv = { deliverableId: string; title: string; linkId: string | null; tasks: ChainTask[]; testing: ChainTest[] };

// Work tab — the connected chain in one organized view: Deliverable → the Tasks
// that produce it → each task's Roles, Applications, Checklist items, and the
// Testing plan that verifies it. Read-oriented; associate/detach the deliverable
// in edit mode (at a step).
function WorkTab({ data, edit, onNav, after }: {
  data: Payload; edit: boolean; onNav: (p: string) => void;
  after: (msg: string, sub: string, undo?: () => void) => void;
}) {
  const [chain, setChain] = useState<ChainDeliv[]>([]);
  const [ver, setVer] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false; setLoading(true);
    api.get(`/inspector/${data.id}/chain`)
      .then((r: { chain: ChainDeliv[] }) => { if (!cancelled) { setChain(r.chain); setLoading(false); } })
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
      {loading ? <div className="skeleton rounded-md" style={{ height: 64 }} />
        : !chain.length ? <Empty text={edit ? 'Add the first deliverable above.' : 'No deliverables recorded here.'} />
        : <div className="flex flex-col gap-2">{chain.map((d) => <DelivChain key={d.deliverableId} d={d} edit={edit} onNav={onNav} onDetach={detach} />)}</div>}
    </div>
  );
}

const Testing = ({ t }: { t: ChainTest }) => (
  <div className="rounded-md bg-[#fbfcfd] border border-[#e2e6ea] px-2 py-1.5 text-[10.5px] text-[#525252] leading-snug">
    <span className="font-semibold text-[#6b7785]">Testing · </span>
    {[t.system && `System: ${t.system}`, t.location && `Location: ${t.location}`, t.checkType && `Check: ${t.checkType}`].filter(Boolean).join(' · ') || 'template'}
    {t.expected && <div className="text-[#8a8a8a] mt-0.5 line-clamp-2">{t.expected}</div>}
  </div>
);

function DelivChain({ d, edit, onNav, onDetach }: { d: ChainDeliv; edit: boolean; onNav: (p: string) => void; onDetach: (linkId: string) => void }) {
  const [open, setOpen] = useState(true);
  const kids = d.tasks.length + d.testing.length;
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
        {d.tasks.length > 0 && <span className="text-[9px] text-[#5a8a6f]">{d.tasks.length} task{d.tasks.length === 1 ? '' : 's'}</span>}
        <LinkOut onClick={() => onNav('/deliverables')} />
        {edit && d.linkId && <DetachBtn onClick={() => onDetach(d.linkId!)} />}
      </div>
      {open && kids > 0 && (
        <div className="px-2.5 pb-2.5 pt-0.5 flex flex-col gap-1.5">
          {d.tasks.map((t) => <TaskChain key={t.taskId} t={t} onNav={onNav} />)}
          {d.testing.map((t) => <Testing key={t.id} t={t} />)}
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
  const kids = t.roles.length + t.applications.length + t.checklist.length + t.testing.length;
  return (
    <div className="rounded-lg bg-[#faf8ff] border border-[#ded5f8]" style={{ borderLeft: '3px solid #7c3aed' }}>
      <button onClick={() => kids > 0 && setOpen((o) => !o)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left">
        {kids > 0 && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}><path d="M9 6l6 6-6 6" /></svg>
        )}
        <span className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px bg-white text-[#6d28d9] border border-[#ded5f8] flex-shrink-0">Task</span>
        <span className="text-[11.5px] font-semibold text-[#4c1d95] flex-1 min-w-0">{t.name}</span>
        {t.checklist.length > 0 && <span className="text-[9px] text-[#7c5db8]">{t.checklist.length}✓</span>}
      </button>
      {open && kids > 0 && (
        <div className="px-2.5 pb-2 pl-7 flex flex-col gap-1">
          {t.roles.length > 0 && <MiniHead>Roles</MiniHead>}
          {t.roles.map((r) => (
            <button key={r.roleId} onClick={() => onNav(`/roles?role=${encodeURIComponent(r.roleId)}`)} className="flex items-center gap-1.5 text-left group/r">
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
              <span className="text-[9px] text-[#8a8a8a]">{a.usageType}</span>
            </button>
          ))}
          {t.checklist.length > 0 && <MiniHead>Checklist</MiniHead>}
          {t.checklist.map((c) => (
            <div key={c.id} className="flex items-start gap-1.5">
              <span className="text-[#1e9e6a] text-[12px] mt-px flex-shrink-0">✓</span>
              <span className="text-[11.5px] text-[#171717] leading-snug">{c.text}{c.group && <span className="text-[#a3a3a3]"> · {c.group}</span>}</span>
            </div>
          ))}
          {t.testing.length > 0 && <MiniHead>Testing plan</MiniHead>}
          {t.testing.map((tt) => <Testing key={tt.id} t={tt} />)}
        </div>
      )}
    </div>
  );
}

// Deliverables tab — flat list with associate/add + detach (edit at a step).
function DeliverablesTab({ data, edit, onNav, after }: {
  data: Payload; edit: boolean; onNav: (p: string) => void;
  after: (msg: string, sub: string, undo?: () => void) => void;
}) {
  const add = async (choice: { id?: string; newName?: string }) => {
    const r = await api.post(`/inspector/${data.id}/deliverables`, { deliverableId: choice.id, newTitle: choice.newName });
    const linkId = r.deliverable.linkId;
    after(`${r.deliverable.title} added`, 'Now in Deliverables & this step', async () => { await api.delete(`/inspector/deliverables/${linkId}`); after('Removed', 'Reverted'); });
  };
  return (
    <div>
      {edit && <div className="flex justify-end mb-2"><AddPicker label="Associate / add deliverable" kind="deliverables" onPick={add} /></div>}
      {!data.deliverables.length && <Empty text={edit ? 'Add the first deliverable above.' : 'No deliverables recorded here.'} />}
      <div className="flex flex-col gap-1.5">
        {data.deliverables.map((d) => {
          const isDetail = 'linkId' in d;
          return (
            <div key={isDetail ? (d as DelivDetail).linkId : (d as DelivRollup).deliverableId}
              className="rounded-lg bg-[#e9f7ef] border border-[#cbead9] px-2.5 py-2 flex items-center gap-2">
              <span className="text-[12.5px] font-bold text-[#196f3d] flex-1 min-w-0 truncate">{d.title}</span>
              <LinkOut onClick={() => onNav('/deliverables')} />
              {isDetail && edit && <DetachBtn onClick={async () => { await api.delete(`/inspector/deliverables/${(d as DelivDetail).linkId}`); after('Detached', 'The deliverable is kept'); }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Checklist ──────────────────────────────────────────────────────────────────
function ChecklistTab({ data, edit, after }: {
  data: Payload; edit: boolean;
  after: (msg: string, sub: string, undo?: () => void) => void;
}) {
  const [draft, setDraft] = useState('');
  const detail = data.detail;
  const addItem = async () => {
    const text = draft.trim();
    if (!text) return;
    const r = await api.post(`/inspector/${data.id}/checklist`, { text });
    setDraft('');
    const ncId = r.item.nodeChecklistId;
    after('Checklist item added', 'Saved to the single record', async () => { await api.delete(`/inspector/checklist/${ncId}`); after('Removed', 'Reverted'); });
  };
  return (
    <div>
      {!data.checklist.length && !edit && <Empty text="No checklist items recorded here." />}
      <div className="flex flex-col gap-1">
        {data.checklist.map((c) => {
          const isDetail = 'nodeChecklistId' in c;
          return (
            <div key={isDetail ? (c as CheckDetail).nodeChecklistId : (c as CheckRollup).checklistItemId}
              className="rounded-md bg-white border border-[#eaeef1] px-2.5 py-1.5 flex items-center gap-2">
              <span className="text-[#1e9e6a] text-[13px] flex-shrink-0">✓</span>
              {isDetail && edit ? (
                <input defaultValue={c.text}
                  onBlur={async (e) => { const v = e.target.value.trim(); if (v && v !== c.text) { await api.patch(`/inspector/checklist/${(c as CheckDetail).checklistItemId}`, { text: v }); after('Updated', 'Saved to the single record'); } }}
                  className="flex-1 min-w-0 text-[12px] text-[#171717] outline-none border-b border-transparent focus:border-[#9fb6e8]" />
              ) : (
                <span className="flex-1 min-w-0 text-[12px] text-[#171717]">{c.text}</span>
              )}
              {isDetail && edit && <DetachBtn onClick={async () => { await api.delete(`/inspector/checklist/${(c as CheckDetail).nodeChecklistId}`); after('Removed', 'Reverted'); }} />}
            </div>
          );
        })}
      </div>
      {detail && edit && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-[#9fb6e8] px-2.5 py-1.5">
          <span className="text-[#1e9e6a] text-[13px]">✓</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
            placeholder="Add a checklist item…  ⏎" className="flex-1 text-[12px] outline-none" />
          <button onClick={addItem} className="text-[12px] font-semibold text-[#2563eb]">⏎ Add</button>
        </div>
      )}
    </div>
  );
}

// ── Testing template ────────────────────────────────────────────────────────
function TestingTab({ data, edit, after }: {
  data: Payload; edit: boolean;
  after: (msg: string, sub: string, undo?: () => void) => void;
}) {
  if (!data.detail) {
    const rows = (data.testing as TestingRollup[]) ?? [];
    if (!rows.length) return <Empty text="No testing templates recorded here." />;
    return (
      <div>
        <div className="flex flex-col gap-1.5">
          {rows.map((t) => (
            <div key={t.id} className="rounded-lg bg-[#fbfcfd] border border-[#e2e6ea] px-2.5 py-2 text-[11.5px] text-[#171717]">
              <div><b>System:</b> {t.system || '—'} · <b>Location:</b> {t.location || '—'}</div>
              <div><b>Check:</b> {t.checkType || '—'} · <b>Expected:</b> {t.expected || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <TestingEditor data={data} edit={edit} after={after} />;
}

function TestingEditor({ data, edit, after }: {
  data: Payload; edit: boolean;
  after: (msg: string, sub: string, undo?: () => void) => void;
}) {
  const tpl = data.testing as TestingDetail;
  const [form, setForm] = useState({ system: tpl.system ?? '', location: tpl.location ?? '', checkType: tpl.checkType ?? 'presence', expected: tpl.expected ?? '' });
  useEffect(() => { setForm({ system: tpl.system ?? '', location: tpl.location ?? '', checkType: tpl.checkType ?? 'presence', expected: tpl.expected ?? '' }); }, [tpl.id, tpl.system, tpl.location, tpl.checkType, tpl.expected]);

  const save = async () => { await api.put(`/inspector/${data.id}/testing`, form); after('Testing template saved', 'Reflected wherever the template is shown'); };
  const field = (label: string, key: keyof typeof form) => (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#a3a3a3] mb-1">{label}</div>
      {key === 'checkType' ? (
        <Select value={form.checkType} w={140} options={['presence', 'absence']} onChange={(v) => setForm((f) => ({ ...f, checkType: v }))} />
      ) : (
        <input value={form[key]} disabled={!edit} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className={'w-full rounded-md border px-2 py-1 text-[11.5px] ' + (edit ? 'border-[#9fb6e8] bg-white' : 'border-[#e2e6ea] bg-[#fbfcfd] text-[#525252]')} />
      )}
    </div>
  );
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 rounded-lg bg-[#fbfcfd] border border-[#e2e6ea] p-3">
        {field('System', 'system')}
        {field('Location', 'location')}
        {field('Check', 'checkType')}
        {field('Expected', 'expected')}
      </div>
      <div className="text-[10px] text-[#a3a3a3] mt-1.5">Defines how this step is verified for the client's process.</div>
      {edit && <button onClick={save} className="mt-2 rounded-md bg-[#2563eb] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#1d4ed8]">Save testing template</button>}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <div className="text-[11.5px] text-[#a3a3a3] italic leading-snug">{text}</div>;
