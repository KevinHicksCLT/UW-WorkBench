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
//
// Split for maintainability (pure code motion — behavior unchanged):
//   components/inspector/types.ts    — payload shapes, tab model, badge counts
//   components/inspector/atoms.tsx   — Select, AddPicker, LinkOut, DetachBtn, Empty
//   components/inspector/OverviewTab — tiles + AI automation + Governance
//   components/inspector/WorkTab     — the deliverable → task chain
//   components/inspector/entityTabs  — Tasks / Roles / Applications / Deliverables
//   components/inspector/planTabs    — Checklist / Testing plan views

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { DOMAIN_HEX } from '../viz/model';
import { SkeletonLoader } from './ui';
import { TABS, TAB_LABELS, type Payload, type Tab } from './inspector/types';
import { OverviewTab, GovernancePanel } from './inspector/OverviewTab';
import { WorkTab } from './inspector/WorkTab';
import { TasksTab, RolesTab, AppsTab, DeliverablesTab } from './inspector/entityTabs';
import { ChecklistTab, TestingTab } from './inspector/planTabs';

// ── Inspector ─────────────────────────────────────────────────────────────────
export default function Inspector({
  nodeId,
  onClose,
  onRetarget,
  accent,
  startCollapsed,
  initialTab,
}: {
  nodeId: string;
  onClose?: () => void;
  // Re-target the inspector to another node (breadcrumb crumb / child drill).
  onRetarget: (id: string) => void;
  accent?: string;
  // Map opens collapsed (rail) so the canvas isn't covered; List opens expanded.
  startCollapsed?: boolean;
  // Tab to land on when the target changes (e.g. an L6 map click -> Work).
  initialTab?: Tab;
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
    api
      .get<Payload>(`/inspector/${encodeURIComponent(nodeId)}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    setTab(initialTab ?? 'Overview');
    setEdit(false);
    // An explicitly-targeted node (not startCollapsed) opens the panel.
    if (!startCollapsed) setCollapsed(false);
  }, [nodeId]);

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
  const after = async (msg: string, sub: string, undo?: () => void) => {
    load();
    showToast(msg, sub, undo);
  };

  const detail = !!data?.detail;
  // At the L5 task level the Tasks tab has no children to drill — hidden.
  // (Testing is back at the task level: it now surfaces the Work Library TEST
  // plan and, in edit mode, assigns a testing pattern from the template
  // catalog — the association the task level was missing.)
  const visibleTabs = detail ? TABS.filter((t) => t !== 'Tasks') : TABS;
  useEffect(() => {
    if (detail && tab === 'Tasks') setTab('Overview');
  }, [detail, tab]);
  // Top-accent bar carries the node's domain color (overridable by the host).
  accent = accent ?? (data?.domain ? DOMAIN_HEX[data.domain] : undefined);

  // ── Collapsed rail (map parity) ─────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside
        className="hidden md:flex flex-col items-center bg-[#eaf1ff] border-l border-[#cdddff] flex-shrink-0 relative z-30"
        style={{
          width: 44,
          ...(accent ? { background: `${accent}14`, borderColor: `${accent}45` } : {}),
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand panel"
          title="Expand panel"
          className="mt-3 w-8 h-8 rounded-full bg-[#0070AD] text-white shadow-sm hover:bg-[#005a8c] flex items-center justify-center"
          style={accent ? { background: accent } : undefined}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0070AD] [writing-mode:vertical-rl] rotate-180 select-none max-h-[60vh] overflow-hidden text-ellipsis"
          style={accent ? { color: accent } : undefined}
          title={data?.name ?? 'Inspector'}
        >
          {data?.name ?? 'Inspector'}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col bg-white border-l border-[#eaeaea] flex-shrink-0 relative z-30 overflow-hidden"
      style={{ width: 560, minWidth: 480, ...(accent ? { borderTop: `3px solid ${accent}` } : {}) }}
    >
      {/* Edit-mode banner — saved to the single source of truth. */}
      {edit && (
        <div
          className="flex-shrink-0 z-20 flex items-center gap-2 px-4 py-2.5 bg-[#e7f6ef] border-b border-[#bfe3d0]"
          style={{ boxShadow: 'inset 4px 0 0 #1e9e6a' }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-[#15603f]">✎ Edit mode</div>
            <div className="text-[10.5px] text-[#1e7a52] leading-snug">
              ⟲ Saved to the single source of truth — every change applies across all tabs &amp; the
              whole app
            </div>
          </div>
          <button
            onClick={() => setEdit(false)}
            className="flex-shrink-0 rounded-md bg-[#1e9e6a] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#178a5b]"
          >
            Done
          </button>
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
                    <button
                      onClick={() => onRetarget(c.id)}
                      className="hover:text-[#1d4ed8] hover:underline"
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="text-[15px] font-bold text-[#171717] leading-snug">
              {loading ? 'Loading…' : (data?.name ?? '—')}
            </div>
            {data && (data.levelLabel || data.code) && (
              <div className="text-[10px] text-[#a3a3a3] mt-0.5">
                {data.levelLabel}
                {data.code ? (
                  <>
                    {' '}
                    ·{' '}
                    <span className="font-semibold text-[#737575] tabular-nums">#{data.code}</span>
                  </>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setCollapsed(true)}
              aria-label="Minimize"
              title="Minimize panel"
              className="text-[#a3a3a3] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-[#a3a3a3] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Identity & status chips + level badge. Edit is available at EVERY
            level: containers (e.g. an L4 sub-process) associate deliverables/
            roles/applications directly on themselves; tasks additionally edit
            relations, plans and patterns. */}
        {data && !loading && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setEdit((e) => !e)}
              className={
                'ml-auto rounded-md px-2.5 py-1 text-[11px] font-semibold ' +
                (edit
                  ? 'bg-[#eaeaea] text-[#525252]'
                  : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]')
              }
            >
              {edit ? 'Done' : '✎ Edit'}
            </button>
          </div>
        )}
      </div>

      {/* Tab strip */}
      {data && !loading && (
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-[#eaeaea] overflow-x-auto">
          {visibleTabs.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  'flex-shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap ' +
                  (active
                    ? 'bg-[#eaf1fe] text-[#1d4ed8] font-semibold'
                    : 'text-[#737575] hover:bg-[#fafafa]')
                }
              >
                {TAB_LABELS[t]}
              </button>
            );
          })}
        </div>
      )}

      {/* Body — the ONLY scroll container, so the header + tabs stay pinned and
          reachable on every tab regardless of content height. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading || !data ? (
          <SkeletonLoader count={6} height={56} className="grid grid-cols-2 gap-2" />
        ) : (
          <>
            {tab === 'Overview' && (
              <OverviewTab data={data} onTab={setTab} onRetarget={onRetarget} />
            )}
            {tab === 'Work' && <WorkTab data={data} edit={edit} onNav={navigate} after={after} />}
            {tab === 'Tasks' && <TasksTab data={data} onRetarget={onRetarget} />}
            {tab === 'Roles' && (
              <RolesTab data={data} edit={edit} after={after} propText={propText} />
            )}
            {tab === 'Applications' && (
              <AppsTab data={data} edit={edit} onNav={navigate} after={after} propText={propText} />
            )}
            {tab === 'Deliverables' && (
              <DeliverablesTab data={data} edit={edit} onNav={navigate} after={after} />
            )}
            {tab === 'Checklist' && (
              <ChecklistTab data={data} onNav={navigate} edit={edit} after={after} />
            )}
            {tab === 'Testing' && (
              <TestingTab data={data} onNav={navigate} edit={edit} after={after} />
            )}
            {tab === 'Governance' && <GovernancePanel data={data} />}

            {/* Auto-association reminder (no manual node ops) — scrolls with content. */}
            {detail && edit && (
              <div className="mt-4 rounded-lg bg-[#f4ecf7] border border-[#e6d6f0] px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-[#6c3fa0]">
                  No manual hierarchy steps.
                </div>
                <div className="text-[11px] text-[#7c4db8] leading-snug">
                  When you add or move an item, the app places it and wires the associations
                  automatically.
                </div>
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
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
              className="flex-shrink-0 text-[12px] font-bold text-[#7fb2ff]"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
