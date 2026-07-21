import { MATCH_META } from './spine';
import type { Comparison, ElementGroup, MatchStatus, VersionColumn } from './spine';

// Left column of the Products board — the version comparison matrix, straight
// off the product spine. One column per picked version (L4), one row per model
// component (L5 axis: Product Taxonomy … Lifecycle Behavior); the cells are
// the versions' real elements, colored by how they match across the picked
// versions: Common (every version) · Varies (some) · Unique (one).

interface Props {
  title: string;
  versionLevelName: string;
  versions: VersionColumn[];
  comparison: Comparison;
  matchFilter: MatchStatus | null;
  onMatchFilter: (s: MatchStatus | null) => void;
  selectedKey: string | null;
  onSelect: (g: ElementGroup | null) => void;
  /** Per-component top spacing that lines the matrix rows up with the other columns. */
  rowPads?: Record<string, number>;
  /** Shared per-component expansion — one toggle opens the band in every column. */
  expandedComponents: Record<string, boolean>;
  onToggleComponent: (component: string) => void;
}

const LABEL_W = 148;
const COL_W = 250;

/** Slim matrix column head — identification only; the status/components chips
 *  and the per-version element counts live up in the Current overview card. */
function VersionHead({ version }: { version: VersionColumn }) {
  return (
    <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f1f1', minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 }}>{version.name}</div>
      <div style={{ fontSize: 10.5, color: '#a3a3a3', marginTop: 1 }}>{version.productName}</div>
    </div>
  );
}

function ElementCard({
  group,
  versionId,
  selected,
  onSelect,
}: {
  group: ElementGroup;
  versionId: string;
  selected: boolean;
  onSelect: (g: ElementGroup | null) => void;
}) {
  const el = group.perVersion[versionId];
  if (!el) return null;
  const meta = MATCH_META[group.status];
  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? null : group)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        borderRadius: 6,
        border: `1px solid ${selected ? meta.fg : meta.border}`,
        borderLeft: `3px solid ${meta.fg}`,
        background: meta.bg,
        boxShadow: selected ? `0 0 0 2px ${meta.border}` : 'none',
        padding: '5px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, color: '#171717' }}>
        {el.element}
      </div>
      {el.description && (
        <div style={{ fontSize: 10, color: '#525252', lineHeight: 1.35, marginTop: 2 }}>
          {el.description}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 5,
          marginTop: 4,
          minWidth: 0,
          flexWrap: 'wrap',
        }}
      >
        {group.status !== 'SINGLE' && (
          <span
            style={{
              padding: '0 6px',
              borderRadius: 999,
              fontSize: 9,
              fontWeight: 700,
              color: '#fff',
              background: meta.fg,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {meta.label}
          </span>
        )}
        {el.livesIn && (
          <span
            style={{
              fontSize: 9,
              color: '#a3a3a3',
              fontFamily: 'ui-monospace, monospace',
              wordBreak: 'break-all',
              minWidth: 0,
            }}
          >
            {el.livesIn}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ProductComparePanel(props: Props) {
  const {
    versionLevelName,
    versions,
    comparison,
    matchFilter,
    onMatchFilter,
    selectedKey,
    onSelect,
    rowPads,
    expandedComponents,
    onToggleComponent,
  } = props;
  const single = versions.length === 1;
  const countBy = (s: MatchStatus) =>
    comparison.rows.reduce((a, r) => a + r.groups.filter((g) => g.status === s).length, 0);
  const filterable: MatchStatus[] = ['COMMON', 'PARTIAL', 'UNIQUE'];

  return (
    <div
      style={{
        width: LABEL_W + versions.length * COL_W + 34,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Current
        <span style={{ fontWeight: 400, fontSize: 12, color: '#a3a3a3' }}>
          {' '}
          · the {versionLevelName.toLowerCase()}s as filed
        </span>
      </div>

      {/* Match counters double as filters (multi-version comparisons only) —
          one white stat pill, presented like the Normalize/Greenfield pills. */}
      {!single && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid #eaeaea',
              borderRadius: 999,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.05)',
              padding: '3px 12px',
              fontSize: 12,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            <b style={{ fontWeight: 700, color: '#171717' }}>{comparison.normalizedCount}</b>
            <span style={{ color: '#525252' }}>concepts</span>
            {filterable.map((s) => {
              const meta = MATCH_META[s];
              const active = matchFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onMatchFilter(active ? null : s)}
                  title={meta.hint}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    border: 'none',
                    borderRadius: 999,
                    background: active ? meta.bg : 'transparent',
                    boxShadow: active ? `0 0 0 1.5px ${meta.fg}` : 'none',
                    padding: '1px 6px',
                    color: '#525252',
                    fontSize: 12,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: meta.fg,
                      flexShrink: 0,
                    }}
                  />
                  <b style={{ fontWeight: 700, color: meta.fg }}>{countBy(s)}</b>{' '}
                  {meta.label.toLowerCase()}
                </button>
              );
            })}
          </span>
          {matchFilter && (
            <button
              type="button"
              onClick={() => onMatchFilter(null)}
              style={{
                border: 'none',
                background: 'none',
                color: '#525252',
                fontSize: 11,
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
              }}
            >
              show all
            </button>
          )}
        </div>
      )}

      {/* Version identification strip — separated from the component rows but
          on the same grid, so each head sits exactly above its column. */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #eaeaea',
          borderRadius: 14,
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
          // 12px panel padding + 1px inner-box border = the matrix's content
          // inset, so the strip's columns sit exactly over the matrix columns.
          padding: '0 13px',
          boxSizing: 'border-box',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${LABEL_W}px repeat(${versions.length}, ${COL_W}px)`,
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '.08em',
              color: '#a3a3a3',
              textTransform: 'uppercase',
              alignSelf: 'end',
            }}
          >
            Component
          </div>
          {versions.map((v) => (
            <VersionHead key={v.id} version={v} />
          ))}
        </div>
      </div>

      {/* The matrix panel. Row = model component, column = picked version. */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #eaeaea',
          borderRadius: 14,
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
          padding: 12,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ border: '1px solid #f1f1f1', borderRadius: 10, overflow: 'hidden' }}>
          {comparison.rows.map((row) => {
            const groups = matchFilter
              ? row.groups.filter((g) => g.status === matchFilter)
              : row.groups;
            const common = row.groups.filter((g) => g.status === 'COMMON').length;
            const open = !!expandedComponents[row.component];
            const counts = (
              <div
                style={{
                  fontSize: 10.5,
                  color: '#737373',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                <b style={{ fontWeight: 700, color: '#525252' }}>{row.groups.length}</b> concerns
                {!single && common > 0 && (
                  <>
                    {' · '}
                    <span style={{ color: MATCH_META.COMMON.fg, fontWeight: 600 }}>
                      {common} common
                    </span>
                  </>
                )}
              </div>
            );
            const chevron = (
              <span
                style={{
                  color: '#a3a3a3',
                  fontSize: 10,
                  display: 'inline-block',
                  transform: open ? 'none' : 'rotate(-90deg)',
                  marginRight: 6,
                  flexShrink: 0,
                }}
              >
                ▾
              </span>
            );
            // Collapsed: one compact clickable strip per component — the legacy
            // state opens with the same shared toggle the other columns use.
            if (!open) {
              return (
                <button
                  key={row.component}
                  type="button"
                  data-anchor={`bf:${row.component}`}
                  onClick={() => onToggleComponent(row.component)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    padding: '8px 10px',
                    background: '#fcfcfc',
                    border: 'none',
                    borderBottom: '1px solid #f1f1f1',
                    borderTop: rowPads?.[row.component] ? '1px solid #f1f1f1' : undefined,
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                    opacity: matchFilter && groups.length === 0 ? 0.4 : 1,
                    marginTop: rowPads?.[row.component] || undefined,
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>
                    {chevron}
                    {row.component}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>{counts}</span>
                </button>
              );
            }
            // Expanded: one ROW PER CONCEPT GROUP — the same concept sits on
            // the same line in every version column (tops aligned; cards may
            // run longer). A concept only one version carries gets its own
            // row with the other columns left blank.
            return (
              <div
                key={row.component}
                data-anchor={`bf:${row.component}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${LABEL_W}px 1fr`,
                  borderBottom: '1px solid #f1f1f1',
                  borderTop: rowPads?.[row.component] ? '1px solid #f1f1f1' : undefined,
                  opacity: matchFilter && groups.length === 0 ? 0.4 : 1,
                  marginTop: rowPads?.[row.component] || undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggleComponent(row.component)}
                  style={{
                    padding: '8px 10px',
                    background: '#fcfcfc',
                    minWidth: 0,
                    border: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>
                    {chevron}
                    {row.component}
                  </div>
                  {counts}
                </button>
                <div>
                  {groups.map((g, gi) => {
                    // Connector anchor lives on the RIGHTMOST populated cell,
                    // not the full-width row: a concept missing from the
                    // trailing versions would otherwise start its arrow at the
                    // row's right edge, leaving dead white space between the
                    // card and the arrow tail.
                    const lastFilled = versions.reduce(
                      (acc, v, i) => (g.perVersion[v.id] ? i : acc),
                      -1,
                    );
                    return (
                      <div
                        key={g.key}
                        data-anchor={lastFilled < 0 ? `bf:${row.component}:${g.key}` : undefined}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${versions.length}, ${COL_W}px)`,
                          alignItems: 'start',
                          borderTop: gi > 0 ? '1px dashed #f1f1f1' : undefined,
                          // SCRUM-259: level this concept row with its normalize card.
                          marginTop: rowPads?.[`${row.component}:${g.key}`] || undefined,
                        }}
                      >
                        {versions.map((v, i) => (
                          <div
                            key={v.id}
                            data-anchor={
                              i === lastFilled ? `bf:${row.component}:${g.key}` : undefined
                            }
                            style={{ padding: 6, borderLeft: '1px solid #f1f1f1', minWidth: 0 }}
                          >
                            {g.perVersion[v.id] ? (
                              <ElementCard
                                group={g}
                                versionId={v.id}
                                selected={g.key === selectedKey}
                                onSelect={onSelect}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {groups.length === 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${versions.length}, ${COL_W}px)`,
                      }}
                    >
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          style={{ padding: 6, borderLeft: '1px solid #f1f1f1', minWidth: 0 }}
                        >
                          <span style={{ fontSize: 10, color: '#d4d4d4', padding: '2px 4px' }}>
                            —
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {single && (
          <div style={{ fontSize: 11.5, color: '#a3a3a3', lineHeight: 1.5 }}>
            One version — its own decomposition. Add versions to compare.
          </div>
        )}
      </div>
    </div>
  );
}
