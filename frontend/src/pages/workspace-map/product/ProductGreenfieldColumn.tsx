import { GREEN } from '../types';
import OverviewCard, { OVERVIEW_TONES, SegmentBar } from './OverviewCard';
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
        border: `1px solid ${settled ? '#d1fae5' : '#fde68a'}`,
        borderRadius: 8,
        background: settled ? '#f8fffb' : '#fffdf5',
        boxShadow: '0 1px 2px rgba(0,0,0,.03)',
        overflow: 'hidden',
        opacity: dim ? 0.45 : 1,
        transition: 'opacity .15s',
        marginTop: padTop || undefined,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '7px 10px',
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
        <span
          style={{
            minWidth: 0,
            flex: 1,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            overflow: 'hidden',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {row.component}
          </span>
          <span
            style={{
              fontSize: 10,
              color: settled ? '#047857' : '#b45309',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
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
          <b style={{ fontWeight: 700 }}>{normalized.length}</b> in model
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
  // Reconciled = normalized elements actually in the model ÷ total groups.
  const inModel = comparison.rows.reduce((a, r) => a + normalizedGroups(r, decisions).length, 0);
  const openDecisions = comparison.rows.reduce(
    (a, r) =>
      a +
      r.groups.filter(
        (g) => (g.status === 'PARTIAL' || g.status === 'UNIQUE') && decisions[g.key] !== 'APPROVED',
      ).length,
    0,
  );
  // Model composition (the card) — WHAT the target model is made of, not the
  // normalization progress (that story lives on the Normalize card): how many
  // components carry elements, and how each element got in (auto-fold of
  // commons/single carries vs an explicit adopt decision).
  const componentsInModel = comparison.rows.filter(
    (r) => normalizedGroups(r, decisions).length > 0,
  ).length;
  const adoptedIn = comparison.rows.reduce(
    (a, r) =>
      a +
      r.groups.filter(
        (g) => (g.status === 'PARTIAL' || g.status === 'UNIQUE') && decisions[g.key] === 'APPROVED',
      ).length,
    0,
  );
  const autoIn = inModel - adoptedIn;

  return (
    <div style={{ width: 340, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Greenfield
        <span style={{ fontWeight: 400, fontSize: 12, color: '#a3a3a3' }}> · the target model</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #eaeaea',
            borderRadius: 999,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.05)',
            padding: '3px 12px',
            fontSize: 12,
            color: '#525252',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <b style={{ fontWeight: 700, color: GREEN }}>{inModel}</b> in model
          {openDecisions > 0 ? (
            <>
              {' · '}
              <b style={{ fontWeight: 700, color: MATCH_META.PARTIAL.fg }}>{openDecisions}</b> open
            </>
          ) : (
            <span style={{ color: GREEN }}>· reconciled</span>
          )}
        </span>
      </div>
      <OverviewCard
        tone={OVERVIEW_TONES.greenfield}
        title={lobName}
        tag="Proposed"
        right={`${inModel} elements`}
      >
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          one model spanning {componentsInModel} component{componentsInModel === 1 ? '' : 's'},
          replacing {versions.length} filed version{versions.length === 1 ? '' : 's'}
        </div>
        <div style={{ fontSize: 11.5, color: GREEN, marginTop: 3, fontWeight: 600 }}>
          {autoIn} fold in automatically ·{' '}
          <span style={{ color: '#4f46e5' }}>{adoptedIn} adopted by decision</span>
        </div>
        <SegmentBar
          track="#d1fae5"
          segments={[
            { value: autoIn, color: GREEN },
            { value: adoptedIn, color: '#4f46e5' },
          ]}
        />
      </OverviewCard>

      {/* Component slots — standalone cards (not boxed into the model card),
          so the alignment pads open dotted-canvas gaps like the other columns
          instead of dead white space inside one tall card. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <div style={{ fontSize: 11, color: '#a3a3a3', textAlign: 'center', padding: '4px 2px' }}>
            Pick versions to derive the model.
          </div>
        )}
      </div>
    </div>
  );
}
