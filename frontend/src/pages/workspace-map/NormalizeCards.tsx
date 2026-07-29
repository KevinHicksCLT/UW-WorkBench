import { useState } from 'react';
import { api } from '../../lib/api';
import ReviewModal, { REVIEW_STATUS, type ReviewSource } from './ReviewModal';
import ImpactPanel from './impact/ImpactPanel';
import { useImpactGate } from './impact/useImpactGate';
import { AMBER, INDIGO, findingMoves } from './types';
import type { BoardApp, Finding, NormalizationEntry } from './types';

// The Normalize column's card internals: the T-chart column heads, the authored
// entry card (multi-source comparison), the pass-through card (single-source
// boards) and the REVIEW/HELD approve-hold controls. Extracted from
// NormalizeColumn so each module stays readable (SCRUM-222 added the
// shared-vs-unique grouping on top).

// Column divider — a clearly-defined dark rule between the source columns and
// the normalized column so the T-chart reads as distinct panels, not one blur.
const COL_DIVIDER = '#64748b';

/** Distinct source app ids behind one normalization entry. */
export function entryAppIds(entry: NormalizationEntry, findingsById: Map<string, Finding>) {
  return [
    ...new Set(
      entry.findingIds.map((id) => findingsById.get(id)?.appId).filter((id): id is string => !!id),
    ),
  ];
}

/** SHARED (fed by 2+ apps) vs UNIQUE (single app) chip on an entry card. */
export function SharedUniqueChip({ appIds, apps }: { appIds: string[]; apps: BoardApp[] }) {
  const shared = appIds.length > 1;
  const label = shared
    ? `SHARED · ${appIds.length} APPS`
    : `UNIQUE · ${apps.find((a) => a.id === appIds[0])?.name ?? 'one source'}`;
  return (
    <span
      style={{
        padding: '1px 7px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '.04em',
        whiteSpace: 'nowrap',
        background: shared ? '#eef2ff' : '#f8fafc',
        border: `1px solid ${shared ? '#c7d2fe' : '#e2e8f0'}`,
        color: shared ? INDIGO : '#64748b',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

/** Column-header strip: source names, then NORMALIZED. */
export function ColumnHeads({ names }: { names: string[] }) {
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
            // Dark rule between source columns; the last source's right edge is
            // the boundary to the normalized column.
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

/** Right-hand normalized cell shared by both card kinds. */
function NormalizedCell({
  notation,
  name,
  detail,
  badge,
  tone,
}: {
  notation: string | null;
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
      {notation && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: review ? AMBER : INDIGO,
            letterSpacing: '.04em',
          }}
        >
          {notation}
        </span>
      )}
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

/** Footer strip under a card's source rows: Same / Different summary. */
function CardFooter({ kind, text }: { kind: 'same' | 'different' | 'moves'; text: string }) {
  const palette =
    kind === 'same'
      ? { bg: '#f0fdf4', fg: '#166534', label: 'Same:' }
      : kind === 'different'
        ? { bg: '#fffbeb', fg: '#92400e', label: 'Different:' }
        : { bg: '#fef2f2', fg: '#991b1b', label: 'Moves:' };
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

/** Review bar for a REVIEW/HELD entry — opens the shared decision modal with
 *  every source implementation and explicit consequence choices. */
function ReviewActions({
  entry,
  apps,
  findingsById,
  onResolved,
}: {
  entry: NormalizationEntry;
  apps: BoardApp[];
  findingsById: Map<string, Finding>;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const held = entry.matchStatus === 'HELD';

  // Decisions route through the common change-impact gate: the entry's source
  // board-apps resolve to estate applications server-side and the report shows
  // everything they touch before the matchStatus is written.
  const gate = useImpactGate();
  const resolve = (matchStatus: string) => {
    gate.run(
      {
        changeType: matchStatus === 'AUTO' ? 'CONSOLIDATE' : 'HOLD',
        label: entry.name,
        subject: {
          kind: 'application',
          rationalizationAppIds: entryAppIds(entry, findingsById),
        },
      },
      async () => {
        await api.patch(`/rationalization/normalization-entries/${entry.id}`, { matchStatus });
        onResolved();
        setOpen(false);
      },
    );
  };

  const sources: ReviewSource[] = apps.flatMap((a): ReviewSource[] => {
    const mine = entry.findingIds
      .map((id) => findingsById.get(id))
      .filter((f): f is Finding => !!f && f.appId === a.id);
    if (mine.length === 0) return [{ key: a.id, name: a.name, present: false }];
    return mine.map((f) => ({
      key: f.id,
      name: a.name,
      present: true,
      title: f.name,
      detail: f.plainSummary ?? undefined,
      code: f.codeRef ?? undefined,
    }));
  });
  const sourceCount = entry.findingIds.length;

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
        {held
          ? 'On hold — not in the normalized model.'
          : `${sourceCount} source implementation${sourceCount === 1 ? '' : 's'} — needs a decision.`}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '3px 10px',
          borderRadius: 5,
          border: '1px solid #fbbf24',
          background: held ? '#fff' : '#f59e0b',
          color: held ? '#92400e' : '#fff',
          fontSize: 10.5,
          fontWeight: 700,
          cursor: 'pointer',
          font: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {held ? 'Change decision' : 'Review'}
      </button>
      <ReviewModal
        open={open}
        onClose={() => setOpen(false)}
        title={entry.name}
        status={held ? REVIEW_STATUS.held : REVIEW_STATUS.review}
        context={`${entry.layer} layer${entry.notation ? ` · ${entry.notation}` : ''} · ${sourceCount} source${
          sourceCount === 1 ? '' : 's'
        } → 1 normalized capability`}
        question={entry.proposedResolution ?? entry.differenceNote ?? entry.matchBasis}
        sources={sources}
        sourcesLabel="Source implementations"
        choices={[
          {
            key: 'AUTO',
            label: 'Approve — consolidate into the model',
            tone: 'adopt',
            explain:
              sourceCount > 1
                ? `The ${sourceCount} source implementations fold into ONE normalized capability, ` +
                  `“${entry.name}”, in the target build. The differences noted above are resolved by this design.`
                : `“${entry.name}” carries into the normalized model as one capability of the target build.`,
          },
          {
            key: 'HELD',
            label: 'Hold — keep out for now',
            tone: 'hold',
            current: held,
            explain:
              'The sources stay as they are and this capability is parked. It stays OUT of the ' +
              'normalized model (and its greenfield floor) until someone approves it.',
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

/** Authored T-chart card: one normalization entry across the source columns. */
export function EntryCard({
  entry,
  apps,
  findingsById,
  onResolved,
  padTop,
}: {
  entry: NormalizationEntry;
  apps: BoardApp[];
  findingsById: Map<string, Finding>;
  onResolved: () => void;
  /** Extra top spacing that levels this card with its brownfield step (SCRUM-259). */
  padTop?: number;
}) {
  const review = entry.matchStatus === 'REVIEW' || entry.matchStatus === 'HELD';
  const sources = entry.findingIds
    .map((id) => findingsById.get(id))
    .filter((f): f is Finding => !!f);
  const appIds = entryAppIds(entry, findingsById);
  const shared = appIds.length > 1;
  const border = review ? '#fcd34d' : shared ? '#c7d2fe' : '#e2e8f0';
  return (
    <div
      data-anchor={`nz:e:${entry.id}`}
      style={{
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#fff',
        marginTop: padTop || undefined,
      }}
    >
      {/* SCRUM-222: instantly tell a consolidation card (fed by 2+ apps) from an
          app-specific one without tracing connector lines. */}
      {apps.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '5px 6px 0' }}>
          <SharedUniqueChip appIds={appIds} apps={apps} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${apps.length}, 1fr)` }}>
            {apps.map((a, i) => {
              const mine = sources.filter((f) => f.appId === a.id);
              return (
                <div
                  key={a.id}
                  style={{
                    padding: '4px 9px',
                    // Dark rule between adjacent source columns (none after the last).
                    borderRight: i < apps.length - 1 ? `1.5px solid ${COL_DIVIDER}` : undefined,
                    minWidth: 0,
                  }}
                >
                  {mine.length === 0 ? (
                    <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>—</span>
                  ) : (
                    mine.map((f) => (
                      <div key={f.id} style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>
                          {f.name}
                        </div>
                        {f.plainSummary && (
                          <div style={{ fontSize: 10.5, color: '#525252', lineHeight: 1.4 }}>
                            {f.plainSummary}
                          </div>
                        )}
                        {f.codeRef && (
                          <div
                            style={{
                              fontSize: 9.5,
                              color: '#a3a3a3',
                              fontFamily: 'ui-monospace, monospace',
                              wordBreak: 'break-all',
                            }}
                          >
                            {f.codeRef}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
          <CardFooter
            kind={review ? 'different' : 'same'}
            text={
              entry.differenceNote ??
              entry.matchBasis ??
              entry.proposedResolution ??
              'reconciled into one capability'
            }
          />
        </div>
        <NormalizedCell
          notation={entry.notation}
          name={entry.name}
          detail={`${entry.findingIds.length} source · 1 capability`}
          badge={review ? 'REVIEW' : `${entry.findingIds.length}→1 · AUTO`}
          tone={review ? 'review' : 'same'}
        />
      </div>
      {review && (
        <>
          {entry.proposedResolution && (
            <div
              style={{
                padding: '5px 9px',
                borderTop: '1px solid #fde68a',
                background: '#fffbeb',
                fontSize: 10.5,
                color: '#92400e',
                lineHeight: 1.4,
              }}
            >
              <b style={{ fontWeight: 700 }}>To review:</b> {entry.proposedResolution}
            </div>
          )}
          <ReviewActions
            entry={entry}
            apps={apps}
            findingsById={findingsById}
            onResolved={onResolved}
          />
        </>
      )}
    </div>
  );
}

/** Pass-through card: single-source board, one finding carries over 1→1. */
export function PassThroughCard({ finding, padTop }: { finding: Finding; padTop?: number }) {
  const moves = findingMoves(finding);
  const border = moves ? '#fecaca' : '#bbf7d0';
  return (
    <div
      data-anchor={`nz:f:${finding.id}`}
      style={{
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 140px',
        background: '#fff',
        marginTop: padTop || undefined,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '4px 9px', minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>{finding.name}</div>
          {finding.plainSummary && (
            <div style={{ fontSize: 10.5, color: '#525252', lineHeight: 1.4 }}>
              {finding.plainSummary}
            </div>
          )}
          {finding.codeRef && (
            <div
              style={{
                fontSize: 9.5,
                color: '#a3a3a3',
                fontFamily: 'ui-monospace, monospace',
                wordBreak: 'break-all',
              }}
            >
              {finding.codeRef}
            </div>
          )}
        </div>
        <CardFooter
          kind={moves ? 'moves' : 'same'}
          text={
            moves
              ? finding.deadCode
                ? 'dead code — retired with sign-off'
                : `re-homed to ${finding.targetLayer ?? finding.recommendedLayer ?? 'its correct layer'}`
              : 'single source — carries straight into the normalized model'
          }
        />
      </div>
      <NormalizedCell
        notation={null}
        name={finding.name}
        detail={finding.migrationStatus}
        badge={moves ? 'RE-HOME' : '1→1 · PASS-THROUGH'}
        tone={moves ? 'review' : 'same'}
      />
    </div>
  );
}
