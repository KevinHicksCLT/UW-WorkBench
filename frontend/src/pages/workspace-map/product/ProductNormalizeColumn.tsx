import { useState } from 'react';
import { api } from '../../../lib/api';
import { GREEN, AMBER, INDIGO } from '../types';
import { MATCH_META } from './spine';
import type {
  Comparison,
  ComponentRow,
  ElementGroup,
  MatchStatus,
  ProductDecisionStatus,
  VersionColumn,
} from './spine';

// Dark rule between the version columns and the normalized column — matches the
// application board (NormalizeColumn) so both boards read as distinct panels.
const COL_DIVIDER = '#64748b';

type Decisions = Record<string, ProductDecisionStatus>;

/** A labelled, colour-dotted count so each number says what it counts. */
function CountKey({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#525252' }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      <b style={{ fontWeight: 700, color }}>{n}</b> {label}
    </span>
  );
}

// Middle column of the Products board. Each model component is a collapsible
// T-chart: one column per compared version, a NORMALIZED column on the right.
// A group that every version carries folds N→1 automatically; a group only
// some versions carry is flagged for review — normalize up (adopt everywhere)
// or keep as a jurisdiction/version variant. That review is signed off with the
// Approve / Hold controls, persisted per group via /product-spine/decisions.

interface Props {
  versions: VersionColumn[];
  comparison: Comparison;
  matchFilter: MatchStatus | null;
  activeComponent: string | null;
  lobId: string;
  decisions: Decisions;
  onResolved: () => void;
  /** Per-component top spacing that lines this column's rows up with the others. */
  rowPads?: Record<string, number>;
  /** Shared per-component expansion — one toggle opens the band in every column. */
  expandedComponents: Record<string, boolean>;
  onToggleComponent: (component: string) => void;
}

function ColumnHeads({ names }: { names: string[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${names.length}, 1fr) 140px`,
        borderBottom: `2px solid ${INDIGO}`,
        background: 'rgba(255,255,255,.75)',
        borderRadius: '5px 5px 0 0',
        marginTop: 6,
      }}
    >
      {names.map((n, i) => (
        <div
          key={n}
          style={{
            textAlign: 'center',
            padding: '3px 6px 4px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '.08em',
            color: '#171717',
            textTransform: 'uppercase',
            borderRight: `1.5px solid ${COL_DIVIDER}`,
            borderLeft: i === 0 ? undefined : '1px solid #e2e8f0',
          }}
        >
          {n}
        </div>
      ))}
      <div
        style={{
          textAlign: 'center',
          padding: '3px 0 4px',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.08em',
          color: INDIGO,
          textTransform: 'uppercase',
        }}
      >
        Normalized
      </div>
    </div>
  );
}

function NormalizedCell({
  name,
  detail,
  badge,
  tone,
}: {
  name: string;
  detail: string;
  badge: string;
  tone: 'same' | 'review';
}) {
  const review = tone === 'review';
  return (
    <div
      style={{
        borderLeft: `3px solid ${review ? '#f59e0b' : INDIGO}`,
        background: review ? '#fffbeb' : '#f5f6ff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        padding: '6px 9px',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: '#1e1b4b', lineHeight: 1.25 }}>
        {name}
      </span>
      <span style={{ fontSize: 10, color: '#525252' }}>{detail}</span>
      <span
        style={{
          alignSelf: 'flex-start',
          marginTop: 2,
          padding: '1px 6px',
          borderRadius: 4,
          background: review ? AMBER : '#fff',
          border: `1px solid ${review ? AMBER : '#86efac'}`,
          color: review ? '#fff' : '#15803d',
          fontSize: 9,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {badge}
      </span>
    </div>
  );
}

function CardFooter({ kind, text }: { kind: 'same' | 'different'; text: string }) {
  const palette =
    kind === 'same'
      ? { bg: '#f0fdf4', fg: '#166534', label: 'Same:' }
      : { bg: '#fffbeb', fg: '#92400e', label: 'Different:' };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        background: palette.bg,
        fontSize: 10.5,
        color: palette.fg,
        lineHeight: 1.4,
      }}
    >
      <b style={{ fontWeight: 700, flexShrink: 0 }}>{palette.label}</b>
      <span style={{ flex: 1 }}>{text}</span>
    </div>
  );
}

/** Approve (adopt everywhere) / Hold (keep as variant) for a review group. */
function ReviewActions({
  lobId,
  group,
  decision,
  onResolved,
}: {
  lobId: string;
  group: ElementGroup;
  decision: ProductDecisionStatus | undefined;
  onResolved: () => void;
}) {
  const [saving, setSaving] = useState<ProductDecisionStatus | null>(null);
  const [err, setErr] = useState('');

  const resolve = async (status: ProductDecisionStatus) => {
    setErr('');
    setSaving(status);
    try {
      await api.put('/product-spine/decisions', {
        lobId,
        component: group.component,
        groupKey: group.key,
        status,
      });
      onResolved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setSaving(null);
    }
  };

  const btn = (bg: string, fg: string, bd: string): React.CSSProperties => ({
    padding: '3px 10px',
    borderRadius: 5,
    border: `1px solid ${bd}`,
    background: bg,
    color: fg,
    fontSize: 10.5,
    fontWeight: 700,
    cursor: saving ? 'default' : 'pointer',
    opacity: saving ? 0.6 : 1,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 9px',
        borderTop: '1px solid #fde68a',
        background: '#fffbeb',
      }}
    >
      <span style={{ fontSize: 10.5, color: '#92400e', flex: 1 }}>
        {decision === 'APPROVED'
          ? 'Approved — adopts across every version.'
          : decision === 'HELD'
            ? 'Held as a version variant — approve to adopt everywhere.'
            : 'Adopt everywhere, or keep as a version variant.'}
      </span>
      {err && <span style={{ fontSize: 10, color: '#dc2626' }}>{err}</span>}
      {decision !== 'APPROVED' && (
        <button
          type="button"
          disabled={!!saving}
          onClick={() => resolve('APPROVED')}
          style={btn('#16a34a', '#fff', '#15803d')}
        >
          {saving === 'APPROVED' ? 'Approving…' : 'Approve'}
        </button>
      )}
      {decision !== 'HELD' && (
        <button
          type="button"
          disabled={!!saving}
          onClick={() => resolve('HELD')}
          style={btn('#fff', '#92400e', '#fbbf24')}
        >
          {saving === 'HELD' ? 'Holding…' : 'Hold as variant'}
        </button>
      )}
    </div>
  );
}

function GroupCard({
  group,
  versions,
  lobId,
  decision,
  onResolved,
}: {
  group: ElementGroup;
  versions: VersionColumn[];
  lobId: string;
  decision: ProductDecisionStatus | undefined;
  onResolved: () => void;
}) {
  const review = group.status === 'PARTIAL' || group.status === 'UNIQUE';
  const approved = decision === 'APPROVED';
  // An approved review reads as settled (green); still-open or held stays amber.
  const border = review && !approved ? '#fcd34d' : '#bbf7d0';
  const missing = versions.filter((v) => !group.perVersion[v.id]);
  const badge =
    group.status === 'COMMON'
      ? `${group.presentIn}→1 · AUTO`
      : group.status === 'SINGLE'
        ? '1→1 · PASS-THROUGH'
        : approved
          ? 'APPROVED'
          : decision === 'HELD'
            ? 'HELD'
            : 'REVIEW';
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${versions.length}, 1fr)` }}>
            {versions.map((v, i) => {
              const el = group.perVersion[v.id];
              return (
                <div
                  key={v.id}
                  style={{
                    padding: '4px 9px',
                    borderRight: i < versions.length - 1 ? `1.5px solid ${COL_DIVIDER}` : undefined,
                    minWidth: 0,
                  }}
                >
                  {!el ? (
                    <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>—</span>
                  ) : (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>
                        {el.element}
                      </div>
                      {el.livesIn && (
                        <div
                          style={{
                            fontSize: 9.5,
                            color: '#a3a3a3',
                            fontFamily: 'ui-monospace, monospace',
                            wordBreak: 'break-all',
                          }}
                        >
                          {el.livesIn}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <CardFooter
            kind={review ? 'different' : 'same'}
            text={
              group.status === 'COMMON'
                ? `all ${versions.length} versions carry this — folds into one element`
                : group.status === 'SINGLE'
                  ? 'single version — carries straight into the model'
                  : `only in ${group.presentIn} of ${versions.length} — adopt everywhere or keep as ${
                      missing.length > 0 ? 'a version variant' : 'variant'
                    }`
            }
          />
        </div>
        <NormalizedCell
          name={group.name}
          detail={`${group.presentIn} source${group.presentIn === 1 ? '' : 's'} · 1 element`}
          badge={badge}
          tone={review && !approved ? 'review' : 'same'}
        />
      </div>
      {review && (
        <ReviewActions lobId={lobId} group={group} decision={decision} onResolved={onResolved} />
      )}
    </div>
  );
}

function ComponentSection({
  row,
  versions,
  matchFilter,
  dim,
  lobId,
  decisions,
  onResolved,
  padTop,
  open,
  onToggle,
}: {
  row: ComponentRow;
  versions: VersionColumn[];
  matchFilter: MatchStatus | null;
  dim: boolean;
  lobId: string;
  decisions: Decisions;
  onResolved: () => void;
  padTop: number;
  open: boolean;
  onToggle: () => void;
}) {
  const groups = matchFilter ? row.groups.filter((g) => g.status === matchFilter) : row.groups;
  const raw = row.groups.reduce((a, g) => a + g.presentIn, 0);
  if (row.groups.length === 0) return null;

  return (
    <div
      data-anchor={`nz:${row.component}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        opacity: dim || (matchFilter != null && groups.length === 0) ? 0.45 : 1,
        transition: 'opacity .15s',
        overflow: 'hidden',
        marginTop: padTop || undefined,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '10px 12px',
          background: '#fafafa',
          border: 'none',
          borderBottom: open ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          <span
            style={{
              color: '#a3a3a3',
              fontSize: 11,
              display: 'inline-block',
              transform: open ? 'none' : 'rotate(-90deg)',
              marginRight: 6,
            }}
          >
            ▾
          </span>
          {row.component}
        </span>
        <span style={{ fontSize: 12, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
          {raw} current →{' '}
          <b style={{ fontWeight: 800, color: INDIGO, fontSize: 15 }}>{row.groups.length}</b>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <ColumnHeads names={versions.map((v) => v.name)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {groups.map((g) => (
              <GroupCard
                key={g.key}
                group={g}
                versions={versions}
                lobId={lobId}
                decision={decisions[g.key]}
                onResolved={onResolved}
              />
            ))}
            {groups.length === 0 && (
              <span style={{ fontSize: 11, color: '#a3a3a3', padding: '6px 2px' }}>
                nothing matches the current filter
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductNormalizeColumn({
  versions,
  comparison,
  matchFilter,
  activeComponent,
  lobId,
  decisions,
  onResolved,
  rowPads,
  expandedComponents,
  onToggleComponent,
}: Props) {
  // Outstanding review = flagged groups not yet approved (held still counts).
  const approvedCount = comparison.rows.reduce(
    (a, r) =>
      a +
      r.groups.filter(
        (g) => (g.status === 'PARTIAL' || g.status === 'UNIQUE') && decisions[g.key] === 'APPROVED',
      ).length,
    0,
  );
  const outstandingReview = Math.max(0, comparison.reviewCount - approvedCount);
  // Break the normalized total into what it's actually made of, so the numbers
  // are self-explanatory: common (in every version, auto-fold) + varies/unique
  // (need a review decision) + already-approved.
  const commonCount = comparison.rows.reduce(
    (a, r) => a + r.groups.filter((g) => g.status === 'COMMON').length,
    0,
  );
  const singleCount = comparison.rows.reduce(
    (a, r) => a + r.groups.filter((g) => g.status === 'SINGLE').length,
    0,
  );
  const settled = commonCount + singleCount + approvedCount;
  return (
    <div style={{ width: 560, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Normalize
        <span style={{ fontWeight: 400, fontSize: 12, color: '#a3a3a3' }}>
          {' '}
          · {versions.length === 1 ? 'one version → the model' : 'versions → one product model'}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
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
          <b style={{ fontWeight: 700, color: '#171717' }}>{comparison.rawCount}</b> elements across{' '}
          {versions.length} version{versions.length === 1 ? '' : 's'} →{' '}
          <b style={{ fontWeight: 700, color: '#171717' }}>{comparison.normalizedCount}</b> distinct
        </span>
        {versions.length > 1 && (
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
            }}
          >
            <CountKey color={MATCH_META.COMMON.fg} n={commonCount} label="common" />
            <CountKey color={GREEN} n={settled} label="in model" />
            <CountKey color={MATCH_META.PARTIAL.fg} n={outstandingReview} label="to review" />
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {comparison.rows.map((row) => (
          <ComponentSection
            key={row.component}
            row={row}
            versions={versions}
            matchFilter={matchFilter}
            dim={activeComponent != null && activeComponent !== row.component}
            lobId={lobId}
            decisions={decisions}
            onResolved={onResolved}
            padTop={rowPads?.[row.component] ?? 0}
            open={!!expandedComponents[row.component]}
            onToggle={() => onToggleComponent(row.component)}
          />
        ))}
      </div>
    </div>
  );
}
