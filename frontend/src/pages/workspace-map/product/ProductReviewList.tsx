import { useMemo, useState } from 'react';
import {
  MATCH_META,
  groupCitations,
  type ProductDecisionStatus,
  type VersionColumn,
} from './spine';
import type { ReviewRow } from './gridModel';

// The Products workspace's drill-down review list — the level where work
// actually happens: every element group behind a heatmap row (or the whole
// pending backlog), scrollable / sortable / filterable, with the decision
// actions (Adopt into the model · Keep as variant · Retire) and a reviewer
// comment on each line item.

export type ReviewFilter = 'pending' | 'decided' | 'auto' | 'all';

const STATUS_ACTIONS: [ProductDecisionStatus, string, string][] = [
  ['APPROVED', 'Adopt', '#4f46e5'],
  ['HELD', 'Variant', '#525252'],
  ['RETIRED', 'Retire', '#dc2626'],
];

const STATUS_LABEL: Record<ProductDecisionStatus, { label: string; fg: string; bg: string }> = {
  APPROVED: { label: 'Adopted into model', fg: '#3730a3', bg: '#eef2ff' },
  HELD: { label: 'Kept as variant', fg: '#404040', bg: '#f5f5f5' },
  RETIRED: { label: 'Retired', fg: '#991b1b', bg: '#fef2f2' },
};

type SortKey = 'status' | 'name' | 'line';

function rowText(r: ReviewRow): string {
  const el = Object.values(r.group.perVersion).find(Boolean);
  return `${r.group.name} ${el?.description ?? ''} ${r.lobName}`.toLowerCase();
}

export default function ProductReviewList({
  title,
  subtitle,
  columns,
  rows,
  defaultFilter,
  onBack,
  onDecide,
}: {
  title: string;
  subtitle: string;
  columns: VersionColumn[];
  rows: ReviewRow[];
  defaultFilter: ReviewFilter;
  onBack: () => void;
  onDecide: (row: ReviewRow, status: ProductDecisionStatus, comment?: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<ReviewFilter>(defaultFilter);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('status');
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

  const saveComment = async (r: ReviewRow) => {
    setSavingKey(`${r.lobId}:${r.group.key}`);
    try {
      await onDecide(r, r.decision?.status ?? 'HELD', draft);
      setEditingKey(null);
    } finally {
      setSavingKey(null);
    }
  };

  const rowKey = (r: ReviewRow) => `${r.lobId}:${r.group.key}`;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px',
          borderBottom: '1px solid #eaeaea',
          flexWrap: 'wrap',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            font: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            color: '#171717',
            background: '#fff',
            border: '1px solid #d4d4d4',
            borderRadius: 9999,
            padding: '4px 12px',
            cursor: 'pointer',
          }}
        >
          ‹ Heatmap
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#171717' }}>{title}</div>
          <div style={{ fontSize: 11, color: '#525252' }}>{subtitle}</div>
        </div>
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
            width: 200,
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

      {/* Column header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(260px,1fr) 130px repeat(${columns.length}, 34px) 150px 236px 240px`,
          alignItems: 'end',
          padding: '4px 14px 6px',
          borderBottom: '1px solid #eaeaea',
          background: '#fafafa',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#525252',
          flexShrink: 0,
        }}
      >
        <span>Element</span>
        <span>Status</span>
        {columns.map((v) => (
          <span
            key={v.id}
            title={`${v.productName} · ${v.name}`}
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              height: 84,
              fontSize: 9.5,
              letterSpacing: '0.02em',
              textTransform: 'none',
              fontWeight: 600,
              color: '#404040',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              justifySelf: 'center',
            }}
          >
            {v.productName} · {v.name}
          </span>
        ))}
        <span>Product line</span>
        <span>Decision</span>
        <span>Comment</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff' }}>
        {shown.map((r) => {
          const key = rowKey(r);
          const meta = MATCH_META[r.group.status];
          const el = Object.values(r.group.perVersion).find(Boolean);
          const cites = groupCitations(r.group);
          const saving = savingKey === key;
          const editing = editingKey === key;
          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: `minmax(260px,1fr) 130px repeat(${columns.length}, 34px) 150px 236px 240px`,
                alignItems: 'center',
                padding: '7px 14px',
                borderBottom: '1px solid #f1f3f5',
                background: r.needsDecision && !r.decision ? '#fffdf7' : '#fff',
              }}
            >
              <div style={{ minWidth: 0, paddingRight: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#171717', lineHeight: 1.3 }}>
                  {r.group.name}
                </div>
                {el?.description && (
                  <div style={{ fontSize: 11, color: '#525252', marginTop: 2, lineHeight: 1.4 }}>
                    {el.description}
                  </div>
                )}
                {cites.length > 0 && (
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'ui-monospace, monospace',
                      color: '#737373',
                      marginTop: 3,
                    }}
                  >
                    {cites.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
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
                    padding: '2px 8px',
                  }}
                >
                  {meta.label}
                </span>
              </div>
              {r.presence.map((p, i) => (
                <span
                  key={`${key}:${i}`}
                  title={p ? 'carried by this version' : 'not in this version'}
                  style={{
                    justifySelf: 'center',
                    width: 10,
                    height: 10,
                    borderRadius: 9999,
                    background: p ? '#4f46e5' : '#fff',
                    border: p ? '1px solid #4f46e5' : '1px dashed #a3a3a3',
                  }}
                />
              ))}
              <span style={{ fontSize: 11.5, color: '#404040', paddingRight: 8 }}>{r.lobName}</span>
              <div>
                {r.needsDecision ? (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {STATUS_ACTIONS.map(([status, label, tone]) => {
                      const on = r.decision?.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={saving}
                          onClick={() => void onDecide(r, status)}
                          style={{
                            font: 'inherit',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            borderRadius: 6,
                            padding: '3px 9px',
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
                {r.decision && (
                  <div style={{ fontSize: 10, color: '#737373', marginTop: 3 }}>
                    {STATUS_LABEL[r.decision.status].label}
                    {r.decision.decidedBy ? ` · ${r.decision.decidedBy}` : ''}
                  </div>
                )}
              </div>
              <div style={{ paddingRight: 4 }}>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      style={{
                        font: 'inherit',
                        fontSize: 11.5,
                        border: '1px solid #d4d4d4',
                        borderRadius: 6,
                        padding: '4px 8px',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveComment(r)}
                        style={{
                          font: 'inherit',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#fff',
                          background: '#171717',
                          border: 'none',
                          borderRadius: 6,
                          padding: '3px 10px',
                          cursor: 'pointer',
                          opacity: saving ? 0.6 : 1,
                        }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingKey(null)}
                        style={{
                          font: 'inherit',
                          fontSize: 11,
                          color: '#525252',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKey(key);
                      setDraft(r.decision?.comment ?? '');
                    }}
                    title={r.needsDecision ? 'Leave a reviewer note' : 'Leave a note'}
                    style={{
                      font: 'inherit',
                      fontSize: 11.5,
                      color: r.decision?.comment ? '#171717' : '#737373',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {r.decision?.comment ?? '✎ Add comment'}
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
  );
}
