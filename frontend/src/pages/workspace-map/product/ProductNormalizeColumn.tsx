import { useState } from 'react';
import { api } from '../../../lib/api';
import { versionPlaceLabel } from '../../../lib/usStates';
import { GREEN, AMBER, INDIGO } from '../types';
import ReviewModal, { REVIEW_STATUS, type ReviewStatusChip } from '../ReviewModal';
import ImpactPanel from '../impact/ImpactPanel';
import { useImpactGate } from '../impact/useImpactGate';
import OverviewCard, { OVERVIEW_TONES } from './OverviewCard';
import { MATCH_META, groupCitations } from './spine';
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

// Middle column of the Products board. Each model component is a collapsible
// T-chart: one column per compared version, a NORMALIZED column on the right.
// A group that every version carries folds N→1 automatically; a group only
// some versions carry is flagged for review — normalize up (adopt everywhere)
// or keep as a jurisdiction/version variant. That review is signed off with the
// Approve / Hold controls, persisted per group via /product-spine/decisions.

interface Props {
  lobName: string;
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
            fontSize: 10.5,
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
          fontSize: 10.5,
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
  citations,
}: {
  name: string;
  detail: string;
  /** null hides the chip (an open review already says so in the card footer). */
  badge: string | null;
  tone: 'same' | 'review';
  /** Distinct citations across every jurisdiction that carries the concept. */
  citations: string[];
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
      <span style={{ fontSize: 10.5, color: '#525252' }}>{detail}</span>
      {citations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1 }}>
          {citations.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 10.5,
                color: '#6366f1',
                fontFamily: 'ui-monospace, monospace',
                lineHeight: 1.3,
                wordBreak: 'break-all',
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {badge && (
        <span
          style={{
            alignSelf: 'flex-start',
            marginTop: 2,
            padding: '1px 6px',
            borderRadius: 4,
            background: review ? AMBER : '#fff',
            border: `1px solid ${review ? AMBER : '#86efac'}`,
            color: review ? '#fff' : '#15803d',
            fontSize: 9.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      )}
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

/** Review bar for a varies/unique group — opens the shared decision modal
 *  with the full per-version picture and explicit consequence choices. */
function ReviewActions({
  lobId,
  group,
  versions,
  decision,
  onResolved,
}: {
  lobId: string;
  group: ElementGroup;
  versions: VersionColumn[];
  decision: ProductDecisionStatus | undefined;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Standardize/Retain decisions route through the common change-impact gate: the
  // element's carrying versions + source systems are assessed and the write
  // only fires once the user confirms from the report.
  const gate = useImpactGate();
  const resolve = (status: string) => {
    const componentNodeIds = versions
      .filter((v) => group.perVersion[v.id])
      .map((v) => v.components.get(group.component)?.node.id)
      .filter((id): id is string => !!id);
    gate.run(
      {
        changeType: status === 'APPROVED' ? 'ADOPT' : status === 'HELD' ? 'HOLD' : 'RETIRE',
        label: group.name,
        subject: {
          kind: 'product-element',
          lobId,
          component: group.component,
          elementName: group.name,
          componentNodeIds,
        },
      },
      async (chosen) => {
        await api.put('/product-spine/decisions', {
          lobId,
          component: group.component,
          groupKey: group.key,
          status: chosen ?? status,
        });
        onResolved();
        setOpen(false);
      },
    );
  };

  const carriers = versions.filter((v) => group.perVersion[v.id]);
  const missing = versions.length - carriers.length;
  const carrierNames = carriers.map((v) => versionPlaceLabel(v.name)).join(', ');
  const chip: ReviewStatusChip =
    decision === 'APPROVED'
      ? { label: 'Standardized', fg: '#15803d', bg: '#dcfce7', border: '#86efac' }
      : decision === 'HELD'
        ? { label: 'Retained', fg: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' }
        : REVIEW_STATUS.review;

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
          ? 'Standardized — part of the normalized model.'
          : decision === 'HELD'
            ? 'Retained as a version variant — not in the model.'
            : `In ${group.presentIn} of ${versions.length} versions — needs a decision.`}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '3px 10px',
          borderRadius: 5,
          border: '1px solid #fbbf24',
          background: decision ? '#fff' : '#f59e0b',
          color: decision ? '#92400e' : '#fff',
          fontSize: 10.5,
          fontWeight: 700,
          cursor: 'pointer',
          font: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {decision ? 'Change decision' : 'Review'}
      </button>
      <ReviewModal
        open={open}
        onClose={() => setOpen(false)}
        title={group.name}
        status={chip}
        context={`${group.component} · carried by ${group.presentIn} of ${versions.length} compared versions`}
        question={
          group.status === 'UNIQUE'
            ? `Only ${carrierNames || 'one or two versions'} carries this element. Should the single normalized model standardize it for every version, or is it retained as a jurisdiction/version-specific variant?`
            : `${group.presentIn} of ${versions.length} versions carry this element. Should the normalized model standardize it everywhere, or retain it as a variant of the versions that have it?`
        }
        sources={versions.map((v) => {
          const el = group.perVersion[v.id];
          return {
            key: v.id,
            name: versionPlaceLabel(v.name),
            sub: v.productName,
            present: !!el,
            title: el?.element,
            detail: el?.description ?? undefined,
            code: el?.livesIn ?? undefined,
          };
        })}
        sourcesLabel={`Across the ${versions.length} compared versions`}
        choices={[
          {
            key: 'APPROVED',
            label: 'Standardize into the model',
            tone: 'adopt',
            current: decision === 'APPROVED',
            explain:
              `“${group.name}” becomes the single enterprise definition — all ${versions.length} ` +
              `versions align to it${missing > 0 ? `, including the ${missing} that don't carry it today` : ''}. `,
          },
          {
            key: 'HELD',
            label: 'Retain as a version variant',
            tone: 'hold',
            current: decision === 'HELD',
            explain:
              `Stays specific to ${carrierNames || 'its versions'} as a jurisdiction/version variant. ` +
              'It is left OUT of the normalized model unless standardized later.',
          },
        ]}
        busyKey={null}
        error=""
        onChoose={resolve}
      />
      <ImpactPanel gate={gate} />
    </div>
  );
}

function GroupCard({
  group,
  versions,
  lobId,
  decision,
  onResolved,
  padTop,
}: {
  group: ElementGroup;
  versions: VersionColumn[];
  lobId: string;
  decision: ProductDecisionStatus | undefined;
  onResolved: () => void;
  /** Extra top spacing that levels this card with its matrix row (SCRUM-259). */
  padTop?: number;
}) {
  const review = group.status === 'PARTIAL' || group.status === 'UNIQUE';
  const approved = decision === 'APPROVED';
  // An approved review reads as settled (green); still-open or held stays amber.
  const border = review && !approved ? '#fcd34d' : '#bbf7d0';
  const missing = versions.filter((v) => !group.perVersion[v.id]);
  // Distinct citations across every jurisdiction that carries this concept —
  // the normalized element cites all of them, each source listed once.
  const citations = groupCitations(group);
  const badge =
    group.status === 'COMMON'
      ? `${group.presentIn}→1 · AUTO`
      : group.status === 'SINGLE'
        ? '1→1 · PASS-THROUGH'
        : approved
          ? 'STANDARDIZED'
          : decision === 'HELD'
            ? 'RETAINED'
            : null;
  return (
    <div
      data-anchor={`nz:${group.component}:${group.key}`}
      style={{
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#fff',
        marginTop: padTop || undefined,
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
                    <span style={{ fontSize: 10.5, color: '#737373' }}>—</span>
                  ) : (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>
                        {el.element}
                      </div>
                      {el.livesIn && (
                        <div
                          style={{
                            fontSize: 10.5,
                            color: '#737373',
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
                  : `only in ${group.presentIn} of ${versions.length} — standardize everywhere or retain as ${
                      missing.length > 0 ? 'a version variant' : 'variant'
                    }`
            }
          />
        </div>
        <NormalizedCell
          name={group.name}
          detail={`${citations.length || group.presentIn} source${
            (citations.length || group.presentIn) === 1 ? '' : 's'
          } · 1 element`}
          badge={badge}
          tone={review && !approved ? 'review' : 'same'}
          citations={citations}
        />
      </div>
      {review && (
        <ReviewActions
          lobId={lobId}
          group={group}
          versions={versions}
          decision={decision}
          onResolved={onResolved}
        />
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
  rowPads,
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
  /** Full pad map — inner rows read their `${component}:${groupKey}` pads (SCRUM-259). */
  rowPads?: Record<string, number>;
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
          padding: '8px 12px',
          background: '#fafafa',
          border: 'none',
          borderBottom: open ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          <span
            style={{
              color: '#737373',
              fontSize: 10.5,
              display: 'inline-block',
              transform: open ? 'none' : 'rotate(-90deg)',
              marginRight: 6,
            }}
          >
            ▾
          </span>
          {row.component}
        </span>
        <span style={{ fontSize: 11.5, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
          {raw} element{raw === 1 ? '' : 's'} →{' '}
          <b style={{ fontWeight: 800, color: INDIGO, fontSize: 13 }}>{row.groups.length}</b>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <ColumnHeads names={versions.map((v) => versionPlaceLabel(v.name))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {groups.map((g) => (
              <GroupCard
                key={g.key}
                group={g}
                versions={versions}
                lobId={lobId}
                decision={decisions[g.key]}
                onResolved={onResolved}
                padTop={rowPads?.[`${row.component}:${g.key}`]}
              />
            ))}
            {groups.length === 0 && (
              <span style={{ fontSize: 11, color: '#737373', padding: '6px 2px' }}>
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
  // Every row lands in exactly ONE of three buckets, so the headline
  // counts always sum to the row total a reader just saw:
  // in the model (auto-folds + adopted) + kept as variants (held) + need a decision.
  const flagged = comparison.rows.flatMap((r) =>
    r.groups.filter((g) => g.status === 'PARTIAL' || g.status === 'UNIQUE'),
  );
  const approvedCount = flagged.filter((g) => decisions[g.key] === 'APPROVED').length;
  const heldCount = flagged.filter((g) => decisions[g.key] === 'HELD').length;
  const outstandingReview = Math.max(0, comparison.reviewCount - approvedCount - heldCount);
  const autoCount = comparison.rows.reduce(
    (a, r) => a + r.groups.filter((g) => g.status === 'COMMON' || g.status === 'SINGLE').length,
    0,
  );
  const settled = autoCount + approvedCount;
  const decided = settled + heldCount;
  return (
    <div style={{ width: 560, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Normalize
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
            gap: 5,
            border: '1px solid #eaeaea',
            borderRadius: 999,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.05)',
            padding: '3px 12px',
            fontSize: 12,
            color: '#525252',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          <b style={{ fontWeight: 700, color: '#171717' }}>{comparison.rawCount}</b> elements across{' '}
          {versions.length} version{versions.length === 1 ? '' : 's'}
        </span>
      </div>

      <OverviewCard
        tone={OVERVIEW_TONES.normalize}
        tag="Normalizing"
        right={`${
          comparison.normalizedCount === 0
            ? 0
            : Math.round((decided / comparison.normalizedCount) * 100)
        }% decided`}
        track="#e0e7ff"
        segments={[
          { value: settled, color: INDIGO },
          { value: heldCount, color: '#64748b' },
          { value: outstandingReview, color: MATCH_META.PARTIAL.fg },
        ]}
      >
        <span style={{ color: INDIGO }}>
          {settled} elements in the model ·{' '}
          {outstandingReview > 0 ? (
            <span style={{ color: MATCH_META.PARTIAL.fg }}>
              {outstandingReview} elements need a decision
            </span>
          ) : (
            <span style={{ color: GREEN }}>every decision made</span>
          )}
        </span>
      </OverviewCard>

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
            rowPads={rowPads}
            open={!!expandedComponents[row.component]}
            onToggle={() => onToggleComponent(row.component)}
          />
        ))}
      </div>
    </div>
  );
}
