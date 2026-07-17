import { useState } from 'react';
import { GREEN } from '../types';
import { MATCH_META } from './spine';
import type {
  Comparison,
  ComponentRow,
  ElementGroup,
  MatchStatus,
  ProductDecisionStatus,
  VersionColumn,
} from './spine';

// Right column of the Products board — the greenfield target: ONE normalized
// product model for the picked LOB, derived on read from the comparison. Each
// component slot expands to show the NORMALIZED elements that land there (the
// model's functionality) — i.e. only what actually carries into the model:
// commons + single-version carries + review groups the reviewer APPROVED.
// Still-open reviews and held-as-variant groups are excluded (they aren't in
// the normalized model yet).

type Decisions = Record<string, ProductDecisionStatus>;

interface Props {
  lobName: string;
  versions: VersionColumn[];
  comparison: Comparison;
  matchFilter: MatchStatus | null;
  decisions: Decisions;
  /** Per-component top spacing that lines each slot up with its band. */
  rowPads?: Record<string, number>;
  /** Shared per-component expansion — one toggle opens the band in every column. */
  expandedComponents: Record<string, boolean>;
  onToggleComponent: (component: string) => void;
}

/** Groups that are IN the normalized model: auto-folds + approved reviews. */
function normalizedGroups(row: ComponentRow, decisions: Decisions): ElementGroup[] {
  return row.groups.filter(
    (g) => g.status === 'COMMON' || g.status === 'SINGLE' || decisions[g.key] === 'APPROVED',
  );
}

function GreenfieldSlot({
  row,
  decisions,
  dim,
  padTop,
  open,
  onToggle,
}: {
  row: ComponentRow;
  decisions: Decisions;
  dim: boolean;
  padTop: number;
  open: boolean;
  onToggle: () => void;
}) {
  const normalized = normalizedGroups(row, decisions);
  const toReconcile = row.groups.filter(
    (g) => (g.status === 'PARTIAL' || g.status === 'UNIQUE') && decisions[g.key] !== 'APPROVED',
  ).length;
  const settled = toReconcile === 0;

  return (
    <div
      data-anchor={`gf:model:${row.component}`}
      style={{
        border: '1px solid #d1fae5',
        borderRadius: 8,
        background: '#f8fffb',
        overflow: 'hidden',
        opacity: dim ? 0.45 : 1,
        marginTop: padTop || undefined,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            color: '#059669',
            fontSize: 9,
            display: 'inline-block',
            transform: open ? 'none' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
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
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>{row.component}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: '#525252' }}>
            {settled ? 'reconciled' : `${toReconcile} to reconcile`}
          </span>
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: '#047857',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {normalized.length} in model
        </span>
      </button>

      {open && (
        <div
          style={{
            borderTop: '1px solid #d1fae5',
            background: '#fff',
            padding: '6px 10px 8px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {normalized.length === 0 ? (
            <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>
              No normalized elements yet — {toReconcile} awaiting a review decision.
            </span>
          ) : (
            normalized.map((g) => {
              // Representative element (first version that carries it) → its functionality.
              const el = Object.values(g.perVersion).find((e) => e) ?? null;
              const adopted = g.status !== 'COMMON' && g.status !== 'SINGLE';
              return (
                <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {g.presentIn}→1
                    </span>
                    {adopted && (
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          color: '#15803d',
                          letterSpacing: '.04em',
                        }}
                      >
                        ADOPTED
                      </span>
                    )}
                  </div>
                  {el?.description && (
                    <span style={{ fontSize: 10, color: '#525252', lineHeight: 1.35 }}>
                      {el.description}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductGreenfieldColumn({
  lobName,
  versions,
  comparison,
  matchFilter,
  decisions,
  rowPads,
  expandedComponents,
  onToggleComponent,
}: Props) {
  // Collapsed by default — the compact header keeps the model card short so
  // the component bands across the three columns sit close together.
  const [headerOpen, setHeaderOpen] = useState(false);
  // Reconciled = normalized elements actually in the model ÷ total groups.
  const inModel = comparison.rows.reduce((a, r) => a + normalizedGroups(r, decisions).length, 0);
  const progress = comparison.normalizedCount === 0 ? 0 : inModel / comparison.normalizedCount;
  const openDecisions = comparison.rows.reduce(
    (a, r) =>
      a +
      r.groups.filter(
        (g) => (g.status === 'PARTIAL' || g.status === 'UNIQUE') && decisions[g.key] !== 'APPROVED',
      ).length,
    0,
  );

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
        {/* compact header line — expand for the model detail + progress */}
        <button
          type="button"
          onClick={() => setHeaderOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 11px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              color: '#059669',
              fontSize: 9,
              display: 'inline-block',
              transform: headerOpen ? 'none' : 'rotate(-90deg)',
              flexShrink: 0,
            }}
          >
            ▾
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 0, flex: 1 }}>{lobName}</span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '.08em',
              color: '#047857',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Proposed
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: '#525252',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {Math.round(progress * 100)}%
          </span>
        </button>
        {headerOpen && (
          <div style={{ padding: '0 13px 9px' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              one normalized model from {versions.length} version
              {versions.length === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 11.5, color: GREEN, marginTop: 3, fontWeight: 600 }}>
              {inModel} normalized elements ·{' '}
              {openDecisions > 0 ? (
                <span style={{ color: MATCH_META.PARTIAL.fg }}>{openDecisions} decisions open</span>
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
        )}

        {/* Component slots — expand to the normalized elements in the model. */}
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
          {comparison.rows.map((row) => (
            <GreenfieldSlot
              key={row.component}
              row={row}
              decisions={decisions}
              dim={
                matchFilter != null &&
                (matchFilter ? row.groups.filter((g) => g.status === matchFilter).length : 0) === 0
              }
              padTop={rowPads?.[row.component] ?? 0}
              open={!!expandedComponents[row.component]}
              onToggle={() => onToggleComponent(row.component)}
            />
          ))}
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
