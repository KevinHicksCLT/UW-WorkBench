import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { versionPlaceLabel } from '../../../lib/usStates';
import { MATCH_META, groupCitations, type ProductDecisionStatus } from './spine';
import type { BoardColumn, StateMandate } from './boardApi';
import type { ReviewRow } from './gridModel';

// The Products workspace's drill-down review list — the decision queue.
// Compact rows (the title opens the full element detail modal), a real
// presence GRID (green block = the product carries the element, empty box =
// it doesn't), the decision actions (Retain · Standardize · Retire — click
// the active one again to withdraw it) and a reviewer comment per line.
// Navigation is breadcrumb + browser back — no bespoke back button.

export type ReviewFilter = 'pending' | 'decided' | 'auto' | 'similar' | 'unique' | 'all';

// Decision vocabulary: Retain = keep as a product-specific variant (HELD),
// Standardize = fold into the single enterprise definition (APPROVED),
// Retire = drop from the target model (RETIRED). API statuses unchanged.
const STATUS_ACTIONS: [ProductDecisionStatus, string, string][] = [
  ['HELD', 'Retain', '#0f766e'],
  ['APPROVED', 'Standardize', '#4f46e5'],
  ['RETIRED', 'Retire', '#dc2626'],
];

const STATUS_LABEL: Record<ProductDecisionStatus, string> = {
  APPROVED: 'Standardize — single enterprise coverage definition',
  HELD: 'Retain — kept as a product-specific variant',
  RETIRED: 'Retire — dropped from the target model',
};

function rowText(r: ReviewRow): string {
  const el = Object.values(r.group.perVersion).find(Boolean);
  return `${r.group.name} ${el?.description ?? ''} ${r.lobName}`.toLowerCase();
}

/** The ACTUAL state mandate behind a state-required row — what the state
 *  requires, and the regulatory source it comes from. Compact under the row
 *  title; full text in the detail modal. */
function MandateNote({ m, compact }: { m: StateMandate; compact?: boolean }) {
  const source = [m.citation, m.regulator].filter(Boolean).join(' — ');
  return (
    <div
      style={{
        marginTop: 3,
        padding: '4px 8px',
        borderLeft: '3px solid #f59e0b',
        borderRadius: 4,
        background: '#fffbeb',
      }}
    >
      <div
        style={{
          fontSize: compact ? 10.5 : 12,
          color: '#78350f',
          lineHeight: 1.4,
          ...(compact
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }
            : null),
        }}
        title={compact ? m.mandate : undefined}
      >
        <b style={{ fontWeight: 700 }}>{m.stateName} mandate:</b> {m.mandate}
      </div>
      {source && (
        <div
          style={{
            fontSize: compact ? 9.5 : 11,
            color: '#92400e',
            marginTop: 2,
            ...(compact
              ? {
                  whiteSpace: 'nowrap' as const,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis' as const,
                }
              : null),
          }}
          title={compact ? source : undefined}
        >
          Source:{' '}
          {m.citationUrl ? (
            <a
              href={m.citationUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#92400e', textDecoration: 'underline' }}
            >
              {source}
            </a>
          ) : (
            source
          )}
        </div>
      )}
    </div>
  );
}

/** Retain · Standardize · Retire (or the auto-standardized note) — shared by
 *  the list rows and the forms drill's title header. */
function DecisionActions({
  row,
  saving,
  onAct,
}: {
  row: ReviewRow;
  saving: boolean;
  onAct: (status: ProductDecisionStatus | null) => void;
}) {
  if (!row.needsDecision)
    return (
      <span
        style={{ fontSize: 11.5, fontWeight: 600, color: '#166534' }}
        title="This coverage is identical in every product that carries it, so it standardizes into the canonical model without needing a reviewer decision."
      >
        Common — auto-standardized, no decision needed
      </span>
    );
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {STATUS_ACTIONS.map(([status, label, tone]) => {
        const on = row.decision?.status === status;
        return (
          <button
            key={status}
            type="button"
            disabled={saving}
            title={on ? 'click again to withdraw this decision' : STATUS_LABEL[status]}
            onClick={() => onAct(on ? null : status)}
            style={{
              font: 'inherit',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 6,
              padding: '3px 10px',
              color: on ? '#fff' : tone,
              background: on ? tone : '#fff',
              border: `1px solid ${on ? 'transparent' : tone}`,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {on ? `✓ ${label}` : label}
          </button>
        );
      })}
    </div>
  );
}

/** Full element detail — everything the compact row hides. */
function ElementDetailModal({
  row,
  columns,
  mandate,
  onClose,
}: {
  row: ReviewRow;
  columns: BoardColumn[];
  mandate?: StateMandate;
  onClose: () => void;
}) {
  const meta = MATCH_META[row.group.status];
  const cites = groupCitations(row.group);
  // The board's carriage rule: a coverage on the countrywide version COVERS
  // the product's state-form versions (state forms amend the base policy,
  // they don't drop its coverages). `presence` is that covered set — the same
  // one the heat cells and status colors use — so the modal must read it too,
  // never the raw perVersion map alone.
  const carried = row.presence.filter(Boolean).length;
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.34)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 100,
      }}
    >
      <div
        role="dialog"
        aria-label={row.group.name}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 760,
          maxWidth: 'calc(100% - 60px)',
          maxHeight: 'calc(100vh - 140px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '13px 16px',
            borderBottom: '1px solid #eaeaea',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                color: meta.fg,
              }}
            >
              {row.group.component} · {meta.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#171717', marginTop: 3 }}>
              {row.group.name}
            </div>
            <div style={{ fontSize: 11.5, color: '#525252', marginTop: 3 }}>
              {row.lobName} · in {carried} of {columns.length} products in scope
              {carried > row.group.presentIn
                ? ' (defined on the countrywide form, carried by every state version)'
                : ''}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              font: 'inherit',
              fontSize: 14,
              color: '#525252',
              background: 'none',
              border: 'none',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            overflow: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {mandate && (
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#92400e',
                  marginBottom: 4,
                }}
              >
                State mandate
              </div>
              <MandateNote m={mandate} />
            </div>
          )}
          {cites.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#525252',
                  marginBottom: 4,
                }}
              >
                Lives in
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'ui-monospace, monospace',
                  color: '#262626',
                  lineHeight: 1.5,
                }}
              >
                {cites.join(' · ')}
              </div>
            </div>
          )}
          <div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#525252',
                marginBottom: 4,
              }}
            >
              Per product
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {columns.map((v, i) => {
                const el = row.group.perVersion[v.id];
                // Covered but not defined here = inherited from the product's
                // countrywide form (never "not carried" — that contradicts the
                // board's green cells).
                const inherited = !el && row.presence[i];
                const on = !!el || inherited;
                return (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      border: '1px solid #f1f3f5',
                      borderLeft: `3px solid ${on ? '#16a34a' : '#e5e7eb'}`,
                      borderRadius: 7,
                      padding: '6px 10px',
                      background: el ? '#fff' : '#fafafa',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: on ? '#171717' : '#525252',
                        width: 250,
                        flexShrink: 0,
                      }}
                    >
                      {v.productName} · {versionPlaceLabel(v.name)}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: el ? '#262626' : '#525252',
                        lineHeight: 1.45,
                        fontStyle: inherited ? 'italic' : undefined,
                      }}
                    >
                      {el
                        ? (el.description ?? el.element)
                        : inherited
                          ? v.members > 1
                            ? 'Carried in this product — narrow the scope to one product for per-version detail.'
                            : 'Carried via the countrywide base form — the state form amends it without dropping this coverage.'
                          : 'not carried'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {row.decision?.comment && (
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#525252',
                  marginBottom: 4,
                }}
              >
                Reviewer comment
              </div>
              <div style={{ fontSize: 12, color: '#404040', lineHeight: 1.5 }}>
                {row.decision.comment}
                {row.decision.decidedBy ? (
                  <span style={{ color: '#525252' }}> — {row.decision.decidedBy}</span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ProductReviewList({
  columns,
  rows,
  mandates,
  selfRow = null,
  defaultFilter,
  completePct,
  search = '',
  onDecide,
  labelOf,
  abbr,
  onToggleAbbr,
  groupOf,
  groupOrder,
  chromeHidden = false,
  onDeepScroll,
}: {
  columns: BoardColumn[];
  rows: ReviewRow[];
  /** Row key (`lobId:groupKey`) → the actual state mandate behind the row. */
  mandates?: Record<string, StateMandate>;
  /** Forms drills: the drilled form itself — rendered as the list's TITLE
   *  header (with its own decision controls), never repeated as a table row. */
  selfRow?: ReviewRow | null;
  defaultFilter: ReviewFilter;
  /** Scope completion % — rendered inline with the filter chips. */
  completePct?: number;
  /** Search text from the spine filter bar (the list has no own input). */
  search?: string;
  /** status null = withdraw the decision (undo). */
  onDecide: (
    row: ReviewRow,
    status: ProductDecisionStatus | null,
    comment?: string,
  ) => Promise<void>;
  /** Column label (full or abbreviated) — full name always on hover. */
  labelOf?: (v: BoardColumn) => string;
  abbr?: boolean;
  onToggleAbbr?: () => void;
  /** Group label per row key (`lobId:groupKey`) — anything beyond coverages
   *  gets banded the way the forms register bands its sections. */
  groupOf?: Record<string, string>;
  /** Band order; groups not listed sort last alphabetically. */
  groupOrder?: string[];
  /** True while the board chrome (lens tabs + filter bar) is scroll-hidden —
   *  the toolbar hides with it so only the table + header show. */
  chromeHidden?: boolean;
  /** Scrolling the list down → true (hide the chrome); restore via wheel-up
   *  at the top or the header button. */
  onDeepScroll?: (hidden: boolean) => void;
}) {
  const [filter, setFilter] = useState<ReviewFilter>(defaultFilter);
  // Collapsed band groups (Form / Coverages / Endorsements / …) — the band
  // header stays visible, its rows fold away.
  const [closedBands, setClosedBands] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<ReviewRow | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const counts = {
    pending: rows.filter((r) => r.needsDecision && !r.decision).length,
    decided: rows.filter((r) => r.needsDecision && r.decision).length,
    auto: rows.filter((r) => !r.needsDecision).length,
    similar: rows.filter((r) => r.group.status === 'PARTIAL').length,
    unique: rows.filter((r) => r.group.status === 'UNIQUE').length,
    all: rows.length,
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (filter === 'pending' && (!r.needsDecision || r.decision)) return false;
      if (filter === 'decided' && (!r.needsDecision || !r.decision)) return false;
      if (filter === 'auto' && r.needsDecision) return false;
      if (filter === 'similar' && r.group.status !== 'PARTIAL') return false;
      if (filter === 'unique' && r.group.status !== 'UNIQUE') return false;
      if (q && !rowText(r).includes(q)) return false;
      return true;
    });
    const rank = (r: ReviewRow) => (r.needsDecision ? (r.decision ? 1 : 0) : 2);
    // Grouped lists band first (group order), then the picked sort inside
    // each band — mirrors the forms register's section bands.
    const groupRank = (r: ReviewRow) => {
      if (!groupOf) return 0;
      const g = groupOf[`${r.lobId}:${r.group.key}`] ?? '';
      const i = groupOrder?.indexOf(g) ?? -1;
      return i >= 0 ? i : (groupOrder?.length ?? 0);
    };
    // Fixed order: bands first, needs-decision first inside each, then name.
    return [...filtered].sort((a, b) => {
      const g = groupRank(a) - groupRank(b);
      if (g !== 0) return g;
      return rank(a) - rank(b) || a.group.name.localeCompare(b.group.name);
    });
  }, [rows, filter, search, groupOf, groupOrder]);

  const rowKey = (r: ReviewRow) => `${r.lobId}:${r.group.key}`;

  const act = async (r: ReviewRow, status: ProductDecisionStatus | null, comment?: string) => {
    setSavingKey(rowKey(r));
    try {
      await onDecide(r, status, comment);
      setEditingKey(null);
    } finally {
      setSavingKey(null);
    }
  };

  // FIXED presence-cell width (never minmax/1fr): a 2-product scope renders
  // the same compact cells as a 26-product one instead of page-wide bars.
  // No Status column — the presence blocks carry the status color directly.
  const gridCols = `320px repeat(${columns.length}, 44px) 22px 140px 236px 200px`;
  const colLabel =
    labelOf ?? ((v: BoardColumn) => `${v.productName} · ${versionPlaceLabel(v.name)}`);
  // Header exactly tall enough for the longest angled label — fully visible,
  // never spilling out of the header band.
  const maxLabelChars = columns.reduce((n, v) => Math.max(n, colLabel(v).length), 0);
  // 6.6px/char is deliberately generous for the 10.5px label font — labels
  // must never ellipsize unless the 400px hard cap is hit.
  const headerH = Math.min(400, Math.max(64, Math.round(maxLabelChars * 6.6 * 0.79) + 30));

  // Scrolling down hides everything above the table (parent chrome + this
  // toolbar) and snaps back to the first row, exactly like the grid face.
  const onListScroll = (el: HTMLElement) => {
    if (chromeHidden) return;
    const overflow = el.scrollHeight - el.clientHeight;
    if (el.scrollTop > 0 && overflow > 240) {
      onDeepScroll?.(true);
      el.scrollTop = 0;
    }
  };
  const onListWheel = (el: HTMLElement, deltaY: number) => {
    if (chromeHidden && deltaY < 0 && el.scrollTop === 0) onDeepScroll?.(false);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Forms drill title — the drilled form itself, with its decision and
          note controls; the table below lists only what the form CONTAINS. */}
      {selfRow &&
        (() => {
          const key = rowKey(selfRow);
          const saving = savingKey === key;
          const editing = editingKey === key;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
                padding: '10px 14px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                flexShrink: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '.07em',
                    textTransform: 'uppercase',
                    color: '#64748b',
                  }}
                >
                  Form · {selfRow.lobName}
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(selfRow)}
                  title="open the full form detail"
                  style={{
                    font: 'inherit',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#171717',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    lineHeight: 1.25,
                  }}
                >
                  {selfRow.group.name}
                </button>
                {mandates?.[key] && <MandateNote m={mandates[key]} />}
              </div>
              <div style={{ flex: 1 }} />
              <DecisionActions
                row={selfRow}
                saving={saving}
                onAct={(status) => void act(selfRow, status)}
              />
              {editing ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        void act(selfRow, selfRow.decision?.status ?? 'HELD', draft);
                      if (e.key === 'Escape') setEditingKey(null);
                    }}
                    style={{
                      font: 'inherit',
                      fontSize: 11.5,
                      border: '1px solid #d4d4d4',
                      borderRadius: 6,
                      padding: '3px 8px',
                      width: 220,
                    }}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void act(selfRow, selfRow.decision?.status ?? 'HELD', draft)}
                    style={{
                      font: 'inherit',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#fff',
                      background: '#171717',
                      border: 'none',
                      borderRadius: 6,
                      padding: '3px 9px',
                      cursor: 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(key);
                    setDraft(selfRow.decision?.comment ?? '');
                  }}
                  title="leave a reviewer note on this form"
                  style={{
                    font: 'inherit',
                    fontSize: 12,
                    color: selfRow.decision?.comment ? '#171717' : '#525252',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                    lineHeight: 1.35,
                    maxWidth: 240,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {selfRow.decision?.comment ?? '✎'}
                </button>
              )}
            </div>
          );
        })()}
      {/* Toolbar — the status filter chips + inline completion %. Navigation
          out of the drill is the browser back button / header Back. */}
      <div
        style={{
          display: chromeHidden ? 'none' : 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderBottom: '1px solid #eaeaea',
          flexWrap: 'wrap',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: 28,
            border: '1px solid #d4d4d4',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {(
            [
              ['pending', 'Needs decision', counts.pending],
              ['decided', 'Decided', counts.decided],
              ['auto', 'Common', counts.auto],
              ['similar', 'Similar', counts.similar],
              ['unique', 'Unique', counts.unique],
              ['all', 'All', counts.all],
            ] as [ReviewFilter, string, number][]
          ).map(([key, label, count], i) => {
            const on = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={{
                  font: 'inherit',
                  padding: '0 10px',
                  fontSize: 11.5,
                  lineHeight: '28px',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : '1px solid #eaeaea',
                  background: on ? '#171717' : '#fff',
                  color: on ? '#fff' : '#404040',
                  fontWeight: on ? 600 : 500,
                }}
              >
                {label} <span style={{ opacity: 0.65 }}>{count}</span>
              </button>
            );
          })}
        </div>
        {completePct !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <div
              style={{
                width: 140,
                flexShrink: 0,
                height: 6,
                background: '#e5e7eb',
                borderRadius: 9,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: 6,
                  width: `${completePct}%`,
                  background:
                    completePct >= 100 ? '#16a34a' : completePct > 0 ? '#f59e0b' : '#dc2626',
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#262626', whiteSpace: 'nowrap' }}>
              {completePct}% complete
            </span>
          </div>
        )}
      </div>

      {/* One scroll surface for header + rows: the angled header sticks to the
          top while the table takes every remaining pixel, and horizontal
          scrolling keeps header and body in lockstep. */}
      <div
        style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff' }}
        onScroll={(e) => onListScroll(e.currentTarget)}
        onWheel={(e) => onListWheel(e.currentTarget, e.deltaY)}
      >
        <div style={{ minWidth: '100%', width: 'max-content' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              alignItems: 'end',
              padding: '0 14px',
              borderBottom: '1px solid #eaeaea',
              background: '#fafafa',
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#374151',
              position: 'sticky',
              top: 0,
              zIndex: 3,
              minWidth: '100%',
            }}
          >
            <span
              style={{
                paddingBottom: 6,
                alignSelf: 'end',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>Products</span>
              {onToggleAbbr && (
                <button
                  type="button"
                  onClick={onToggleAbbr}
                  title={
                    abbr
                      ? 'expand the product names'
                      : 'collapse the product names to initials — hover a column for the full name'
                  }
                  style={{
                    font: 'inherit',
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: '#525252',
                    background: '#fff',
                    border: '1px solid #d4d4d4',
                    borderRadius: 5,
                    padding: '2px 6px',
                    cursor: 'pointer',
                  }}
                >
                  {abbr ? '⌄' : '⌃'}
                </button>
              )}
              {chromeHidden && (
                <button
                  type="button"
                  onClick={() => onDeepScroll?.(false)}
                  title="show the filters and toolbar again"
                  style={{
                    font: 'inherit',
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: '#525252',
                    background: '#fff',
                    border: '1px solid #d4d4d4',
                    borderRadius: 5,
                    padding: '2px 7px',
                    cursor: 'pointer',
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ▾ filters
                </button>
              )}
            </span>
            {columns.map((v) => (
              <span
                key={v.id}
                title={`${v.productName} · ${versionPlaceLabel(v.name)}`}
                style={{ height: headerH, position: 'relative', overflow: 'visible' }}
              >
                {/* Divider parallel with the labels. */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: Math.round(headerH / 0.788),
                    height: 1,
                    background: '#dbe1e8',
                    transformOrigin: 'left bottom',
                    transform: 'rotate(-52deg)',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    // Rise from the column's CENTER so the angled name reads
                    // centered over its own column of cells (matches the grid).
                    left: '50%',
                    transformOrigin: 'left bottom',
                    transform: 'rotate(-52deg)',
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                    letterSpacing: '0.02em',
                    textTransform: 'none',
                    fontWeight: 600,
                    color: '#262626',
                    // Clamp only when the header hit its hard cap — below it,
                    // headerH is sized so every label fits in full.
                    ...(headerH >= 400
                      ? {
                          maxWidth: Math.round((headerH - 14) / 0.79),
                          overflow: 'hidden' as const,
                          textOverflow: 'ellipsis' as const,
                        }
                      : null),
                  }}
                >
                  {colLabel(v)}
                </span>
              </span>
            ))}
            <span aria-hidden style={{ alignSelf: 'end' }} />
            {/* Solid chips ABOVE the angled labels so a leaning product name
                can never run over these headings. */}
            {['Product line', 'Decision', 'Comment'].map((h) => (
              <span
                key={h}
                style={{
                  paddingBottom: 6,
                  paddingTop: 4,
                  paddingRight: 6,
                  alignSelf: 'end',
                  position: 'relative',
                  zIndex: 2,
                  background: '#fafafa',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows — compact: the title carries the depth behind a click.
              Grouped drills band the list (Form / Coverages / Coverage parts /
              Endorsements / Clauses) the way the forms register does. */}
          {shown.map((r, i) => {
            const key = rowKey(r);
            const meta = MATCH_META[r.group.status];
            const saving = savingKey === key;
            const editing = editingKey === key;
            const group = groupOf?.[key] ?? null;
            const prevGroup = i > 0 ? (groupOf?.[rowKey(shown[i - 1])] ?? null) : undefined;
            const band = groupOf && group !== prevGroup ? group : null;
            return (
              <div key={key} style={{ display: 'contents' }}>
                {band && (
                  <div
                    role="button"
                    onClick={() => setClosedBands((c) => ({ ...c, [band]: !c[band] }))}
                    title={closedBands[band] ? `expand ${band}` : `collapse ${band}`}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      padding: '5px 14px 4px',
                      background: '#f3f4f6',
                      borderBottom: '1px solid #e5e7eb',
                      minWidth: '100%',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{ fontSize: 10, color: '#525252', alignSelf: 'center' }}
                    >
                      {closedBands[band] ? '▸' : '▾'}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#111827',
                      }}
                    >
                      {band} ({shown.filter((x) => (groupOf?.[rowKey(x)] ?? null) === group).length}
                      )
                    </span>
                  </div>
                )}
                {!(group && closedBands[group]) && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: gridCols,
                      alignItems: 'center',
                      padding: '4px 14px',
                      borderBottom: '1px solid #f1f3f5',
                      background: r.needsDecision && !r.decision ? '#fffdf7' : '#fff',
                    }}
                  >
                    <div style={{ paddingRight: 12, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => setDetail(r)}
                        title="open the full coverage detail"
                        style={{
                          font: 'inherit',
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#00619a',
                          background: 'none',
                          border: 'none',
                          padding: '2px 0',
                          cursor: 'pointer',
                          textAlign: 'left',
                          lineHeight: 1.3,
                        }}
                      >
                        {r.group.name}
                      </button>
                      {mandates?.[key] && <MandateNote m={mandates[key]} compact />}
                    </div>
                    {/* Presence blocks carry the status color directly — green
                    common, amber similar, red unique (no separate column). */}
                    {r.presence.map((p, i) => (
                      <span
                        key={`${key}:${i}`}
                        title={
                          p
                            ? `${columns[i]?.productName ?? ''} carries this ${meta.label.toLowerCase()} coverage`
                            : `not in ${columns[i]?.productName ?? 'this product'}`
                        }
                        style={{
                          alignSelf: 'stretch',
                          display: 'flex',
                          alignItems: 'center',
                          borderLeft: '1px solid #e2e8f0',
                          padding: '3px 3px',
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            height: 18,
                            borderRadius: 4,
                            background: p ? meta.bg : '#fff',
                            border: p ? `1.5px solid ${meta.fg}` : '1px solid #e5e7eb',
                          }}
                        />
                      </span>
                    ))}
                    <span aria-hidden />
                    <span style={{ fontSize: 12, color: '#262626', paddingRight: 8 }}>
                      {r.lobName}
                    </span>
                    <div>
                      <DecisionActions
                        row={r}
                        saving={saving}
                        onAct={(status) => void act(r, status)}
                      />
                    </div>
                    <div style={{ paddingRight: 4 }}>
                      {editing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                void act(r, r.decision?.status ?? 'HELD', draft);
                              if (e.key === 'Escape') setEditingKey(null);
                            }}
                            style={{
                              font: 'inherit',
                              fontSize: 11.5,
                              border: '1px solid #d4d4d4',
                              borderRadius: 6,
                              padding: '3px 8px',
                              flex: 1,
                              minWidth: 0,
                            }}
                          />
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void act(r, r.decision?.status ?? 'HELD', draft)}
                            style={{
                              font: 'inherit',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#fff',
                              background: '#171717',
                              border: 'none',
                              borderRadius: 6,
                              padding: '3px 9px',
                              cursor: 'pointer',
                              opacity: saving ? 0.6 : 1,
                            }}
                          >
                            {saving ? '…' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingKey(key);
                            setDraft(r.decision?.comment ?? '');
                          }}
                          title="leave a reviewer note"
                          style={{
                            font: 'inherit',
                            fontSize: 12,
                            color: r.decision?.comment ? '#171717' : '#525252',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: 0,
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {r.decision?.comment ?? '✎'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {shown.length === 0 && (
            <div style={{ padding: 20, fontSize: 12.5, color: '#525252' }}>
              Nothing matches this filter{search ? ' and search' : ''}.
            </div>
          )}
        </div>
      </div>

      {detail && (
        <ElementDetailModal
          row={detail}
          columns={columns}
          mandate={mandates?.[rowKey(detail)]}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
