import { useState } from 'react';
import { LAYERS, GREEN, AMBER, INDIGO, findingMoves } from './types';
import type { BoardApp, BoardDetail, Finding, NormalizationEntry, Layer } from './types';

// Middle column — the heart of the board. Each layer is a collapsible T-chart:
// one column per legacy source application, a NORMALIZED column on the right.
// Multi-source boards compare the sources row by row (per the design comp);
// a single-application board is a pass-through — every step carries into the
// normalized model 1→1, still at paper-thin detail (summary, code location).
//
// Colour is semantic only: green = same/carries over, amber = needs review,
// red = moves, indigo = the normalized model. Everything else is neutral.

interface Props {
  board: BoardDetail;
  activeLayer: Layer | null;
  /** Findings in the current scope (the panel's active screen) — the column mirrors exactly what the current state shows. */
  findings: Finding[];
}

/** What the layer covers, in the section subtitle (mirrors the design comp). */
const LAYER_TITLE: Record<Layer, string> = {
  UI: 'UI Components / Fields',
  Integration: 'Integration Logic',
  'Business Service': 'Business Service Logic',
  Data: 'Data Schema & Payload',
  Infrastructure: 'Infra Security Rules & Logs',
};

/** Column-header strip: source names, then NORMALIZED. */
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
      {names.map((n) => (
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
            borderRight: '1px solid #e2e8f0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
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
      <b style={{ fontWeight: 700 }}>{palette.label}</b>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {text}
      </span>
    </div>
  );
}

/** Authored T-chart card: one normalization entry across the source columns. */
function EntryCard({
  entry,
  apps,
  findingsById,
}: {
  entry: NormalizationEntry;
  apps: BoardApp[];
  findingsById: Map<string, Finding>;
}) {
  const review = entry.matchStatus === 'REVIEW' || entry.matchStatus === 'HELD';
  const sources = entry.findingIds
    .map((id) => findingsById.get(id))
    .filter((f): f is Finding => !!f);
  const border = review ? '#fcd34d' : '#bbf7d0';
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 140px',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${apps.length}, 1fr)` }}>
          {apps.map((a) => {
            const mine = sources.filter((f) => f.appId === a.id);
            return (
              <div
                key={a.id}
                style={{ padding: '4px 9px', borderRight: '1px solid #e2e8f0', minWidth: 0 }}
              >
                {mine.length === 0 ? (
                  <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>—</span>
                ) : (
                  mine.map((f) => (
                    <div key={f.id} style={{ marginBottom: 4 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
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
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
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
  );
}

/** Pass-through card: single-source board, one finding carries over 1→1. */
function PassThroughCard({ finding }: { finding: Finding }) {
  const moves = findingMoves(finding);
  const border = moves ? '#fecaca' : '#bbf7d0';
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 140px',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '4px 9px', minWidth: 0 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {finding.name}
          </div>
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
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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

function LayerSection({
  layer,
  board,
  apps,
  dim,
  findings,
}: {
  layer: Layer;
  board: BoardDetail;
  apps: BoardApp[];
  dim: boolean;
  findings: Finding[];
}) {
  // Everything starts collapsed — headers carry the counts, expand on demand.
  const [open, setOpen] = useState(false);
  const rows = findings.filter((f) => f.layer === layer);
  const scopeIds = new Set(rows.map((f) => f.id));
  // Authored entries only count when they touch a finding in scope.
  const entries = board.normalizationEntries.filter(
    (e) => e.layer === layer && e.findingIds.some((id) => scopeIds.has(id)),
  );
  const findingsById = new Map(board.findings.map((f) => [f.id, f]));
  const normalizedCount = entries.length || rows.length;
  // Authored entries compare the sources column by column; pass-through mode
  // treats the whole board as ONE application, so a single source column.
  const headNames =
    entries.length > 0 ? apps.map((a) => a.name) : [board.application || board.name];
  if (rows.length === 0 && entries.length === 0) return null;

  return (
    <div
      data-anchor={`nz:${layer}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        opacity: dim ? 0.45 : 1,
        transition: 'opacity .15s',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          {LAYER_TITLE[layer]}
        </span>
        <span style={{ fontSize: 12, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
          {rows.length} raw →{' '}
          <b style={{ fontWeight: 800, color: INDIGO, fontSize: 15 }}>{normalizedCount}</b>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <ColumnHeads names={headNames} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {entries.length > 0
              ? entries.map((e) => (
                  <EntryCard key={e.id} entry={e} apps={apps} findingsById={findingsById} />
                ))
              : rows.map((f) => <PassThroughCard key={f.id} finding={f} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NormalizeColumn({ board, activeLayer, findings }: Props) {
  const legacyApps = board.apps.filter((a) => a.kind === 'LEGACY');
  const apps = legacyApps.length ? legacyApps : board.apps;
  const passThrough = board.normalizationEntries.length === 0;
  // The header pill mirrors the active scope (the panel's selected screen).
  const scopeIds = new Set(findings.map((f) => f.id));
  const scopedEntries = board.normalizationEntries.filter((e) =>
    e.findingIds.some((id) => scopeIds.has(id)),
  );
  const normalized = scopedEntries.length || findings.length;
  const awaiting = scopedEntries.filter(
    (e) => e.matchStatus === 'REVIEW' || e.matchStatus === 'HELD',
  ).length;

  return (
    <div style={{ width: 560, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Normalize
        {!passThrough && (
          <span style={{ fontWeight: 400, fontSize: 12, color: '#a3a3a3' }}>
            {' '}
            · legacy sources → one normalized model
          </span>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
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
          <b style={{ fontWeight: 700, color: '#171717' }}>{findings.length} raw steps</b> →{' '}
          <b style={{ fontWeight: 700, color: GREEN }}>{normalized} normalized</b>
          {awaiting > 0 && (
            <>
              {' '}
              · <b style={{ fontWeight: 600, color: AMBER }}>{awaiting} awaiting review</b>
            </>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LAYERS.map((layer) => (
          <LayerSection
            key={layer}
            layer={layer}
            board={board}
            apps={apps}
            dim={activeLayer != null && activeLayer !== layer}
            findings={findings}
          />
        ))}
      </div>
    </div>
  );
}
