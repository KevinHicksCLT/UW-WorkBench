import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MATCH_META,
  groupCitations,
  type ProductDecisionStatus,
  type VersionColumn,
} from './spine';
import type { ReviewRow } from './gridModel';

// The Products workspace's drill-down review list — compact rows (title only;
// the title is a link that opens the full element detail modal), a real
// presence GRID (green block = the product carries the element, empty box =
// it doesn't), the decision actions (Adopt · Variant · Retire — click the
// active one again to withdraw it) and a reviewer comment per line.
// Navigation is breadcrumb + browser back — no bespoke back button.

export type ReviewFilter = 'pending' | 'decided' | 'auto' | 'all';

const STATUS_ACTIONS: [ProductDecisionStatus, string, string][] = [
  ['APPROVED', 'Adopt', '#4f46e5'],
  ['HELD', 'Variant', '#525252'],
  ['RETIRED', 'Retire', '#dc2626'],
];

const STATUS_LABEL: Record<ProductDecisionStatus, string> = {
  APPROVED: 'Adopted into model',
  HELD: 'Kept as variant',
  RETIRED: 'Retired',
};

type SortKey = 'status' | 'name' | 'line';

function rowText(r: ReviewRow): string {
  const el = Object.values(r.group.perVersion).find(Boolean);
  return `${r.group.name} ${el?.description ?? ''} ${r.lobName}`.toLowerCase();
}

/** Full element detail — everything the compact row hides. */
function ElementDetailModal({
  row,
  columns,
  onClose,
}: {
  row: ReviewRow;
  columns: VersionColumn[];
  onClose: () => void;
}) {
  const meta = MATCH_META[row.group.status];
  const cites = groupCitations(row.group);
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
              {row.lobName} · in {row.group.presentIn} of {columns.length} products in scope
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
              color: '#737373',
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
          {cites.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#737373',
                  marginBottom: 4,
                }}
              >
                Lives in
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  fontFamily: 'ui-monospace, monospace',
                  color: '#404040',
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
                color: '#737373',
                marginBottom: 4,
              }}
            >
              Per product
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {columns.map((v) => {
                const el = row.group.perVersion[v.id];
                return (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      border: '1px solid #f1f3f5',
                      borderLeft: `3px solid ${el ? '#16a34a' : '#e5e7eb'}`,
                      borderRadius: 7,
                      padding: '6px 10px',
                      background: el ? '#fff' : '#fafafa',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: el ? '#171717' : '#737373',
                        width: 250,
                        flexShrink: 0,
                      }}
                    >
                      {v.productName} · {v.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        color: el ? '#404040' : '#a3a3a3',
                        lineHeight: 1.45,
                      }}
                    >
                      {el ? (el.description ?? el.element) : 'not carried'}
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
                  color: '#737373',
                  marginBottom: 4,
                }}
              >
                Reviewer comment
              </div>
              <div style={{ fontSize: 12, color: '#404040', lineHeight: 1.5 }}>
                {row.decision.comment}
                {row.decision.decidedBy ? (
                  <span style={{ color: '#737373' }}> — {row.decision.decidedBy}</span>
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
  title,
  subtitle,
  columns,
  rows,
  defaultFilter,
  onBack,
  onDecide,
  onScrollDepth,
  labelOf,
  abbr,
  onToggleAbbr,
}: {
  title: string;
  subtitle: string;
  columns: VersionColumn[];
  rows: ReviewRow[];
  defaultFilter: ReviewFilter;
  /** Breadcrumb root ("Products") — also reachable via browser back. */
  onBack: () => void;
  /** status null = withdraw the decision (undo). */
  onDecide: (
    row: ReviewRow,
    status: ProductDecisionStatus | null,
    comment?: string,
  ) => Promise<void>;
  /** Fires when the table scrolls away from (or back to) the top — the
   *  surrounding chrome hides itself to give the table the height. */
  onScrollDepth?: (deep: boolean) => void;
  /** Column label (full or abbreviated) — full name always on hover. */
  labelOf?: (v: VersionColumn) => string;
  abbr?: boolean;
  onToggleAbbr?: () => void;
}) {
  const [filter, setFilter] = useState<ReviewFilter>(defaultFilter);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('status');
  const [detail, setDetail] = useState<ReviewRow | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const counts = {
    pending: rows.filter((r) => r.needsDecision && !r.decision).length,
    decided: rows.filter((r) => r.needsDecision && r.decision).length,
    auto: rows.filter((r) => !r.needsDecision).length,
    all: rows.length,
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (filter === 'pending' && (!r.needsDecision || r.decision)) return false;
      if (filter === 'decided' && (!r.needsDecision || !r.decision)) return false;
      if (filter === 'auto' && r.needsDecision) return false;
      if (q && !rowText(r).includes(q)) return false;
      return true;
    });
    const rank = (r: ReviewRow) => (r.needsDecision ? (r.decision ? 1 : 0) : 2);
    return [...filtered].sort((a, b) => {
      if (sort === 'status') return rank(a) - rank(b) || a.group.name.localeCompare(b.group.name);
      if (sort === 'line')
        return a.lobName.localeCompare(b.lobName) || a.group.name.localeCompare(b.group.name);
      return a.group.name.localeCompare(b.group.name);
    });
  }, [rows, filter, search, sort]);

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

  const gridCols = `minmax(240px,1fr) 110px repeat(${columns.length}, minmax(26px, 34px)) 150px 220px 200px`;
  const colLabel = labelOf ?? ((v: VersionColumn) => `${v.productName} · ${v.name}`);
  // Header exactly tall enough for the longest angled label — fully visible,
  // never spilling out of the header band.
  const maxLabelChars = columns.reduce((n, v) => Math.max(n, colLabel(v).length), 0);
  const headerH = Math.min(330, Math.max(90, Math.round(maxLabelChars * 5.6 * 0.79) + 26));

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar — breadcrumb + list controls. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderBottom: '1px solid #eaeaea',
          flexWrap: 'wrap',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        <nav
          aria-label="Breadcrumb"
          style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: 500,
              color: '#0070AD',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            Products
          </button>
          <span style={{ color: '#a3a3a3', fontSize: 11 }}>›</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#171717' }}>{title}</span>
          <span style={{ fontSize: 11, color: '#525252', marginLeft: 6 }}>{subtitle}</span>
        </nav>
        <div style={{ flex: 1 }} />
        <input
          type="search"
          placeholder="Search elements…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            font: 'inherit',
            fontSize: 12,
            border: '1px solid #d4d4d4',
            borderRadius: 8,
            padding: '5px 10px',
            width: 190,
          }}
        />
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            font: 'inherit',
            fontSize: 12,
            border: '1px solid #d4d4d4',
            borderRadius: 8,
            padding: '5px 8px',
            background: '#fff',
          }}
        >
          <option value="status">Sort: needs decision first</option>
          <option value="name">Sort: element name</option>
          <option value="line">Sort: product line</option>
        </select>
        {onToggleAbbr && (
          <button
            type="button"
            onClick={onToggleAbbr}
            title={
              abbr
                ? 'show full product names'
                : 'collapse product names to initials — hover a column for the full name'
            }
            style={{
              font: 'inherit',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: abbr ? '#fff' : '#525252',
              background: abbr ? '#171717' : '#fff',
              border: '1px solid #d4d4d4',
              borderRadius: 6,
              padding: '5px 9px',
              cursor: 'pointer',
            }}
          >
            ABBR
          </button>
        )}
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
              ['auto', 'In model automatically', counts.auto],
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
      </div>

      {/* One scroll surface for header + rows: the angled header sticks to the
          top while the table takes every remaining pixel, and horizontal
          scrolling keeps header and body in lockstep. */}
      <div
        style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff' }}
        onScroll={(e) => onScrollDepth?.(e.currentTarget.scrollTop > 12)}
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
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#525252',
              position: 'sticky',
              top: 0,
              zIndex: 3,
              minWidth: '100%',
            }}
          >
            <span style={{ paddingBottom: 6, alignSelf: 'end' }}>
              Element — click a title for its full detail
            </span>
            <span style={{ paddingBottom: 6, alignSelf: 'end' }}>Status</span>
            {columns.map((v) => (
              <span
                key={v.id}
                title={`${v.productName} · ${v.name}`}
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
                    // One line over: the label rises from its column's RIGHT
                    // divider, so the text hangs over its own column of cells.
                    left: 'calc(100% + 4px)',
                    transformOrigin: 'left bottom',
                    transform: 'rotate(-52deg)',
                    whiteSpace: 'nowrap',
                    fontSize: 10.5,
                    letterSpacing: '0.02em',
                    textTransform: 'none',
                    fontWeight: 600,
                    color: '#404040',
                    maxWidth: Math.round((headerH - 14) / 0.79),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {colLabel(v)}
                </span>
              </span>
            ))}
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

          {/* Rows — compact: the title carries the depth behind a click. */}
          {shown.map((r) => {
            const key = rowKey(r);
            const meta = MATCH_META[r.group.status];
            const saving = savingKey === key;
            const editing = editingKey === key;
            return (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  alignItems: 'center',
                  padding: '4px 14px',
                  borderBottom: '1px solid #f1f3f5',
                  background: r.needsDecision && !r.decision ? '#fffdf7' : '#fff',
                }}
              >
                <button
                  type="button"
                  onClick={() => setDetail(r)}
                  title="open the full element detail"
                  style={{
                    font: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#0070AD',
                    background: 'none',
                    border: 'none',
                    padding: '2px 12px 2px 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    lineHeight: 1.3,
                  }}
                >
                  {r.group.name}
                </button>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 10,
                      fontWeight: 700,
                      color: meta.fg,
                      background: meta.bg,
                      border: `1px solid ${meta.border}`,
                      borderRadius: 6,
                      padding: '1px 7px',
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                {r.presence.map((p, i) => (
                  <span
                    key={`${key}:${i}`}
                    title={
                      p
                        ? `${columns[i]?.productName ?? ''} carries this element`
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
                        background: p ? '#86efac' : '#fff',
                        border: p ? '1px solid #16a34a' : '1px solid #e5e7eb',
                      }}
                    />
                  </span>
                ))}
                <span style={{ fontSize: 11.5, color: '#404040', paddingRight: 8 }}>
                  {r.lobName}
                </span>
                <div>
                  {r.needsDecision ? (
                    <div
                      style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}
                    >
                      {STATUS_ACTIONS.map(([status, label, tone]) => {
                        const on = r.decision?.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={saving}
                            title={
                              on ? 'click again to withdraw this decision' : STATUS_LABEL[status]
                            }
                            onClick={() => void act(r, on ? null : status)}
                            style={{
                              font: 'inherit',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              borderRadius: 6,
                              padding: '2px 9px',
                              color: on ? '#fff' : '#404040',
                              background: on ? tone : '#fff',
                              border: `1px solid ${on ? 'transparent' : '#d4d4d4'}`,
                              opacity: saving ? 0.6 : 1,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>
                      In model automatically
                    </span>
                  )}
                </div>
                <div style={{ paddingRight: 4 }}>
                  {editing ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void act(r, r.decision?.status ?? 'HELD', draft);
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
                        fontSize: 11.5,
                        color: r.decision?.comment ? '#171717' : '#737373',
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
        <ElementDetailModal row={detail} columns={columns} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
