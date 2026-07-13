import { GREEN } from '../types';
import { MATCH_META } from './spine';
import type { Comparison, MatchStatus, VersionColumn } from './spine';

// Right column of the Products board — the greenfield target: ONE normalized
// product model for the picked LOB, derived on read from the comparison. Each
// component slot shows how many normalized elements land there and how many of
// those still need a review decision before the model is clean.

interface Props {
  lobName: string;
  versions: VersionColumn[];
  comparison: Comparison;
  matchFilter: MatchStatus | null;
}

export default function ProductGreenfieldColumn({
  lobName,
  versions,
  comparison,
  matchFilter,
}: Props) {
  const clean = comparison.normalizedCount - comparison.reviewCount;
  const progress = comparison.normalizedCount === 0 ? 0 : clean / comparison.normalizedCount;

  return (
    <div style={{ width: 340, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Greenfield
      </div>
      <div
        style={{
          border: '2px solid #6ee7b7',
          borderRadius: 12,
          background: '#ecfdf5',
          boxShadow: '0 2px 8px rgba(16,185,129,.10)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '11px 13px 9px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '.1em',
                color: '#047857',
                textTransform: 'uppercase',
              }}
            >
              Proposed
            </span>
            <span style={{ fontSize: 11, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(progress * 100)}% reconciled
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{lobName}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            one normalized model from {versions.length} version
            {versions.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 11.5, color: GREEN, marginTop: 3, fontWeight: 600 }}>
            {comparison.normalizedCount} elements ·{' '}
            {comparison.reviewCount > 0 ? (
              <span style={{ color: MATCH_META.PARTIAL.fg }}>
                {comparison.reviewCount} decisions open
              </span>
            ) : (
              'no open decisions'
            )}
          </div>
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: '#d1fae5',
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: '100%',
                borderRadius: 999,
                background: GREEN,
                transition: 'width .3s',
              }}
            />
          </div>
        </div>

        {/* Component slots — the floors of the normalized product model. */}
        <div
          style={{
            background: '#fff',
            borderTop: '1px solid #d1fae5',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {comparison.rows.map((row) => {
            const shown = matchFilter
              ? row.groups.filter((g) => g.status === matchFilter)
              : row.groups;
            const open = row.groups.filter(
              (g) => g.status === 'PARTIAL' || g.status === 'UNIQUE',
            ).length;
            const settled = open === 0;
            return (
              <div
                key={row.component}
                data-anchor={`gf:model:${row.component}`}
                style={{
                  border: '1px solid #d1fae5',
                  borderRadius: 8,
                  background: '#f8fffb',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: matchFilter && shown.length === 0 ? 0.45 : 1,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: settled ? GREEN : MATCH_META.PARTIAL.fg,
                    flexShrink: 0,
                  }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>
                    {row.component}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 10.5,
                      color: '#525252',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {settled ? 'reconciled' : `${open} to reconcile`}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: '#047857',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.groups.length} in ›
                </span>
              </div>
            );
          })}
          {comparison.rows.length === 0 && (
            <div style={{ fontSize: 11, color: '#a3a3a3', padding: '4px 2px' }}>
              Pick versions to derive the model.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
