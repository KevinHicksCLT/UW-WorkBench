import { useMemo, useState } from 'react';
import { EmptyState } from '../../../components/ui';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { INDIGO, AMBER, GREEN } from '../types';
import { compareSpineColumns, type SpineComparison, type SpineItem } from './spineCompare';

// Generic horizontal comparison board for spine lenses (value streams, roles):
// N picked columns side by side, grouped rows inside each, and a computed
// consolidation rail — what repeats WITHIN a column and what can combine
// ACROSS columns. All verdicts derive from compareSpineColumns on the fly.

export interface PoolOption {
  id: string;
  label: string;
  group: string;
  hint?: string;
}

export interface SpineColumn {
  id: string;
  title: string;
  subtitle: string | null;
  groups: { id: string; name: string; items: SpineItem[] }[];
}

interface Props {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
  /** Noun for the compared thing ("value stream" / "role"). */
  noun: string;
  pool: PoolOption[];
  selectedIds: string[];
  onChangeSelection: (ids: string[]) => void;
  columns: SpineColumn[];
  loading: boolean;
  /** Extra toolbar content (e.g. the L3/L4 grouping selector). */
  toolbar?: React.ReactNode;
}

const badge = (kind: 'shared' | 'dup' | 'unique', extra?: string) => {
  if (kind === 'shared')
    return (
      <span
        style={{
          background: '#eef2ff',
          color: INDIGO,
          border: '1px solid #d6dcff',
          borderRadius: 8,
          fontSize: 9,
          fontWeight: 700,
          padding: '0 5px',
          whiteSpace: 'nowrap',
        }}
      >
        shared{extra ? ` ${extra}` : ''}
      </span>
    );
  if (kind === 'dup')
    return (
      <span
        style={{
          background: '#fff8e1',
          color: AMBER,
          border: '1px solid #fde68a',
          borderRadius: 8,
          fontSize: 9,
          fontWeight: 700,
          padding: '0 5px',
          whiteSpace: 'nowrap',
        }}
      >
        dup
      </span>
    );
  return null;
};

function Picker({
  noun,
  pool,
  selectedIds,
  onChangeSelection,
}: {
  noun: string;
  pool: PoolOption[];
  selectedIds: string[];
  onChangeSelection: (ids: string[]) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, PoolOption[]>();
    for (const o of pool) {
      const g = m.get(o.group) ?? [];
      g.push(o);
      m.set(o.group, g);
    }
    return [...m.entries()];
  }, [pool]);

  const renderOptions = (excludeId?: string) =>
    groups.map(([g, opts]) => (
      <optgroup key={g} label={g}>
        {opts.map((o) => (
          <option
            key={o.id}
            value={o.id}
            disabled={selectedIds.includes(o.id) && o.id !== excludeId}
          >
            {o.label}
            {o.hint ? ` — ${o.hint}` : ''}
          </option>
        ))}
      </optgroup>
    ));

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: '#525252' }}>Compare</span>
      {selectedIds.map((id, i) => (
        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ fontSize: 11, color: '#a3a3a3' }}>vs</span>}
          <select
            value={id}
            aria-label={`${noun} ${i + 1}`}
            onChange={(e) =>
              onChangeSelection(selectedIds.map((cur, j) => (j === i ? e.target.value : cur)))
            }
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
              background: '#fff',
              maxWidth: 260,
            }}
          >
            {renderOptions(id)}
          </select>
          <button
            type="button"
            aria-label={`Remove ${noun}`}
            onClick={() =>
              selectedIds.length > 2 && onChangeSelection(selectedIds.filter((x) => x !== id))
            }
            style={{
              border: 'none',
              background: 'transparent',
              color: selectedIds.length > 2 ? '#a3a3a3' : '#e5e5e5',
              cursor: selectedIds.length > 2 ? 'pointer' : 'default',
              fontSize: 12,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <select
        value=""
        aria-label={`Add a ${noun} to compare`}
        onChange={(e) => e.target.value && onChangeSelection([...selectedIds, e.target.value])}
        style={{
          border: '1px dashed #cbd5e1',
          borderRadius: 6,
          padding: '5px 8px',
          fontSize: 12,
          background: '#fff',
          color: '#525252',
          maxWidth: 200,
        }}
      >
        <option value="">＋ Add {noun}…</option>
        {renderOptions()}
      </select>
      <span style={{ fontSize: 11, color: '#a3a3a3' }}>{selectedIds.length} side by side</span>
    </div>
  );
}

function ColumnCard({ col, cmp }: { col: SpineColumn; cmp: SpineComparison }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const stats = cmp.stats.find((s) => s.column === col.id);
  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        background: '#fff',
        border: '1px solid #eaeaea',
        borderRadius: 14,
        boxShadow: '0 1px 4px rgba(0,0,0,.05)',
        padding: 14,
        boxSizing: 'border-box',
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{col.title}</div>
      <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 6 }}>
        {col.subtitle ? `${col.subtitle} · ` : ''}
        {stats?.total ?? 0} steps
      </div>
      {stats && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, color: INDIGO, fontWeight: 700 }}>
            {stats.shared} shared
          </span>
          <span style={{ fontSize: 10.5, color: AMBER, fontWeight: 700 }}>
            {stats.withinDup} internal dup
          </span>
          <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
            {stats.unique} unique
          </span>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 520,
          overflowY: 'auto',
        }}
      >
        {col.groups.map((g) => {
          const isOpen = !!open[g.id];
          const shared = g.items.filter((i) => cmp.markOf.get(i.id) === 'shared').length;
          const dup = g.items.filter((i) => cmp.markOf.get(i.id) === 'dup').length;
          return (
            <div key={g.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setOpen((c) => ({ ...c, [g.id]: !c[g.id] }))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  padding: '6px 8px',
                  background: '#fafafa',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  textAlign: 'left',
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    color: '#a3a3a3',
                    fontSize: 9,
                    display: 'inline-block',
                    transform: isOpen ? 'none' : 'rotate(-90deg)',
                  }}
                >
                  ▾
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, flex: 1, minWidth: 0 }}>
                  {g.name}
                </span>
                <span style={{ fontSize: 10, color: '#737373', whiteSpace: 'nowrap' }}>
                  {g.items.length}
                  {shared > 0 && <b style={{ color: INDIGO }}> · {shared}⇆</b>}
                  {dup > 0 && <b style={{ color: AMBER }}> · {dup}!</b>}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '4px 8px 8px' }}>
                  {g.items.map((it) => (
                    <div
                      key={it.id}
                      style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 0' }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          flexShrink: 0,
                          background:
                            cmp.markOf.get(it.id) === 'shared'
                              ? INDIGO
                              : cmp.markOf.get(it.id) === 'dup'
                                ? AMBER
                                : '#cbd5e1',
                          alignSelf: 'center',
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#171717', flex: 1, minWidth: 0 }}>
                        {it.name}
                      </span>
                      {it.tag && (
                        <span style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {it.tag}
                        </span>
                      )}
                      {badge((cmp.markOf.get(it.id) ?? 'unique') as 'shared' | 'dup' | 'unique')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConsolidationRail({
  cmp,
  titleOf,
}: {
  cmp: SpineComparison;
  titleOf: (columnId: string) => string;
}) {
  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          border: `2px solid #a7f3d0`,
          borderRadius: 14,
          background: '#ecfdf5',
          padding: 14,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Consolidated model</div>
        <div style={{ fontSize: 12, color: '#525252' }}>
          <b style={{ color: '#171717' }}>{cmp.current}</b> current steps →{' '}
          <b style={{ color: GREEN, fontSize: 14 }}>{cmp.normalized}</b> normalized
        </div>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
          {cmp.shared.length} combine across · {cmp.withinDups.length} consolidate within ·{' '}
          {cmp.current - cmp.normalized} steps removed
        </div>
      </div>

      <div
        style={{ border: '1px solid #e0e7ff', borderRadius: 14, background: '#fff', padding: 14 }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '.06em',
            color: INDIGO,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Combine across ({cmp.shared.length})
        </div>
        {cmp.shared.length === 0 && (
          <div style={{ fontSize: 11.5, color: '#a3a3a3' }}>
            Nothing overlaps between the picked columns.
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {cmp.shared.slice(0, 30).map((s) => (
            <div key={s.key}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1e1b4b' }}>
                {s.name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>{s.total}→1</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>
                {[...s.byColumn.keys()].map((c) => titleOf(c)).join(' · ')}
              </div>
            </div>
          ))}
          {cmp.shared.length > 30 && (
            <div style={{ fontSize: 10.5, color: '#a3a3a3' }}>+{cmp.shared.length - 30} more…</div>
          )}
        </div>
      </div>

      <div
        style={{ border: '1px solid #fde68a', borderRadius: 14, background: '#fff', padding: 14 }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '.06em',
            color: AMBER,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Consolidate within ({cmp.withinDups.length})
        </div>
        {cmp.withinDups.length === 0 && (
          <div style={{ fontSize: 11.5, color: '#a3a3a3' }}>
            No internal duplicates in the picked columns.
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {cmp.withinDups.slice(0, 30).map((d) => (
            <div key={`${d.column}:${d.key}`}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#78350f' }}>
                {d.name}{' '}
                <span style={{ color: '#b0a27a', fontWeight: 400 }}>×{d.items.length}</span>
              </div>
              <div style={{ fontSize: 10, color: '#8b7f5e' }}>{titleOf(d.column)}</div>
            </div>
          ))}
          {cmp.withinDups.length > 30 && (
            <div style={{ fontSize: 10.5, color: '#a3a3a3' }}>
              +{cmp.withinDups.length - 30} more…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SpineBoard({
  lens,
  onLens,
  noun,
  pool,
  selectedIds,
  onChangeSelection,
  columns,
  loading,
  toolbar,
}: Props) {
  const items = useMemo(() => columns.flatMap((c) => c.groups.flatMap((g) => g.items)), [columns]);
  const cmp = useMemo(() => compareSpineColumns(items), [items]);
  const titleOf = (id: string) => columns.find((c) => c.id === id)?.title ?? id;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 156px)',
        minHeight: 480,
      }}
    >
      <LensBar lens={lens} onLens={onLens} boards={[]} boardId={null} onBoard={() => undefined} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Picker
          noun={noun}
          pool={pool}
          selectedIds={selectedIds}
          onChangeSelection={onChangeSelection}
        />
        {toolbar}
      </div>
      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          backgroundImage: 'radial-gradient(circle,#ececec 1px,transparent 1px)',
          backgroundSize: '24px 24px',
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {loading ? (
          <div style={{ padding: 30, fontSize: 12.5, color: '#a3a3a3' }}>Loading comparison…</div>
        ) : columns.length === 0 ? (
          <div style={{ padding: 30 }}>
            <EmptyState message={`Pick at least two ${noun}s to compare.`} />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 24,
              padding: 24,
              width: 'max-content',
            }}
          >
            {columns.map((c) => (
              <ColumnCard key={c.id} col={c} cmp={cmp} />
            ))}
            <ConsolidationRail cmp={cmp} titleOf={titleOf} />
          </div>
        )}
      </div>
    </div>
  );
}
