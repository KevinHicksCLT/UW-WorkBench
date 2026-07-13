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
}

const LABEL_W = 148;
const COL_W = 250;

function VersionHead({ version, comparison }: { version: VersionColumn; comparison: Comparison }) {
  let elements = 0;
  let common = 0;
  for (const row of comparison.rows) {
    for (const g of row.groups) {
      if (g.perVersion[version.id]) {
        elements += 1;
        if (g.status === 'COMMON') common += 1;
      }
    }
  }
  return (
    <div style={{ padding: '8px 10px', borderRight: '1px solid #f1f1f1', minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 }}>{version.name}</div>
      <div style={{ fontSize: 10.5, color: '#a3a3a3', marginTop: 1 }}>{version.productName}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
        {version.status && (
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: version.status === 'Active' ? '#dcfce7' : '#f5f5f5',
              color: version.status === 'Active' ? '#15803d' : '#525252',
              border: `1px solid ${version.status === 'Active' ? '#86efac' : '#e5e5e5'}`,
            }}
          >
            {version.status}
          </span>
        )}
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: 9.5,
            fontWeight: 600,
            background: '#f5f5f5',
            border: '1px solid #e5e5e5',
            color: '#525252',
            whiteSpace: 'nowrap',
          }}
        >
          {version.components.size} components
        </span>
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: '#525252',
          marginTop: 5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {elements} elements ·{' '}
        <b style={{ color: MATCH_META.COMMON.fg, fontWeight: 600 }}>{common} common</b>
      </div>
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
    title,
    versionLevelName,
    versions,
    comparison,
    matchFilter,
    onMatchFilter,
    selectedKey,
    onSelect,
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
        background: '#fff',
        border: '1px solid #eaeaea',
        borderRadius: 14,
        boxShadow: '0 1px 4px rgba(0,0,0,.05)',
        padding: 16,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minHeight: 26 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#a3a3a3' }}>
          {versions.length} {versionLevelName.toLowerCase()}
          {versions.length === 1 ? '' : 's'} · {comparison.rawCount} elements →{' '}
          {comparison.normalizedCount} distinct concepts
        </span>
      </div>

      {/* Match counters double as filters (multi-version comparisons only). Each
          says how many of the distinct concepts fall in that match class. */}
      {!single && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#525252', marginRight: 2 }}>
            Of {comparison.normalizedCount} concepts:
          </span>
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
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 999,
                  border: `1px solid ${active ? meta.fg : meta.border}`,
                  background: meta.bg,
                  color: meta.fg,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  font: 'inherit',
                  boxShadow: active ? `0 0 0 2px ${meta.border}` : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: meta.fg }} />
                {meta.label} {countBy(s)}
              </button>
            );
          })}
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

      {/* The matrix. Row = model component, column = picked version. */}
      <div style={{ border: '1px solid #f1f1f1', borderRadius: 10, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${LABEL_W}px repeat(${versions.length}, ${COL_W}px)`,
            background: '#fafafa',
            borderBottom: '2px solid #e5e5e5',
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
            <VersionHead key={v.id} version={v} comparison={comparison} />
          ))}
        </div>

        {comparison.rows.map((row) => {
          const groups = matchFilter
            ? row.groups.filter((g) => g.status === matchFilter)
            : row.groups;
          const common = row.groups.filter((g) => g.status === 'COMMON').length;
          return (
            <div
              key={row.component}
              data-anchor={`bf:${row.component}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `${LABEL_W}px repeat(${versions.length}, ${COL_W}px)`,
                borderBottom: '1px solid #f1f1f1',
                opacity: matchFilter && groups.length === 0 ? 0.4 : 1,
              }}
            >
              <div style={{ padding: '8px 10px', background: '#fcfcfc', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>
                  {row.component}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#a3a3a3',
                    marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.groups.length} concerns
                  {!single && common > 0 && (
                    <>
                      {' · '}
                      <span style={{ color: MATCH_META.COMMON.fg, fontWeight: 600 }}>
                        {common} common
                      </span>
                    </>
                  )}
                </div>
              </div>
              {versions.map((v) => {
                const hasComponent = row.presentIn.includes(v.id);
                const mine = groups.filter((g) => g.perVersion[v.id]);
                return (
                  <div
                    key={v.id}
                    style={{
                      padding: 6,
                      borderLeft: '1px solid #f1f1f1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      minWidth: 0,
                    }}
                  >
                    {!hasComponent ? (
                      <span style={{ fontSize: 10, color: '#d4d4d4', padding: '2px 4px' }}>
                        not in this version
                      </span>
                    ) : mine.length === 0 ? (
                      <span style={{ fontSize: 10, color: '#d4d4d4', padding: '2px 4px' }}>—</span>
                    ) : (
                      mine.map((g) => (
                        <ElementCard
                          key={g.key}
                          group={g}
                          versionId={v.id}
                          selected={g.key === selectedKey}
                          onSelect={onSelect}
                        />
                      ))
                    )}
                  </div>
                );
              })}
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
  );
}
