import { useState } from 'react';
import { LAYERS, GREEN, STATUS_WEIGHT, formatTargetDate } from './types';
import { entryAppIds } from './NormalizeCards';
import type {
  BoardComponent,
  BoardMicroservice,
  Finding,
  Layer,
  LayerExpansion,
  LayerPads,
  NormalizationEntry,
} from './types';

// Right column — the green-field target rendered as an architecture cutaway:
// ONE micro-site card per target service, opened up into its five layer slots
// (UI → Integration → Business → Data → Infrastructure). Each slot is what
// lands on that "floor" of the new build — the normalized component, how many
// capabilities flow into it, its migration status, per-slot % complete and
// target date — and each slot expands to list the normalized items that now
// live there. Each slot is also a connector anchor, so the Normalize column's
// layers wire into the exact floor they land on.

interface Props {
  microservices: BoardMicroservice[];
  components: BoardComponent[];
  findings: Finding[];
  /** Cross-board comparisons: each service's own board's findings, so one
   *  initiative's pass-through floors never count another's findings. */
  findingsByMs?: Map<string, Finding[]>;
  normalizationEntries: NormalizationEntry[];
  /** Per-layer top spacing that lines each service card up with its layer row (SCRUM-222). */
  layerPads?: LayerPads;
  /** Per-row top spacing (keyed by the row's connector anchor) that levels
   *  each expanded floor row with its normalize card (SCRUM-259). */
  rowPads?: Record<string, number>;
  /** Render order (keyed `e:<entryId>` / `f:<findingId>`) matching the
   *  Normalize column's card order — keeps the connectors parallel. */
  rowOrder?: Record<string, number>;
  /** Shared per-layer expansion — one toggle opens the layer in every column. */
  expandedLayers: LayerExpansion;
  onToggleLayer: (layer: Layer) => void;
}

function statusTone(status: string): { border: string; shadow: string; label: string } {
  if (status === 'Live')
    return { border: '#34d399', shadow: '0 4px 14px rgba(16,185,129,.16)', label: 'Live' };
  if (status === 'Building')
    return { border: '#6ee7b7', shadow: '0 2px 8px rgba(16,185,129,.10)', label: 'Building' };
  return { border: '#a7f3d0', shadow: '0 1px 2px rgba(0,0,0,.04)', label: 'Planned' };
}

function slotStatusChip(status: string) {
  const done = STATUS_WEIGHT[status] === 1;
  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        background: done ? '#dcfce7' : '#fff',
        border: `1px solid ${done ? '#86efac' : '#d1d5db'}`,
        color: done ? '#15803d' : '#525252',
      }}
    >
      {status}
    </span>
  );
}

/** One expandable layer slot — the floor of the new build. */
function LayerSlot({
  layer,
  comp,
  lives,
  landed,
  anchor,
  padTop,
  rowPads,
  rowOrder,
  open,
  onToggle,
}: {
  layer: Layer;
  comp: BoardComponent;
  /** Authored normalization entries landing on this floor (multi-source boards). */
  lives: NormalizationEntry[];
  /** The findings that carry into this floor (pass-through boards list these). */
  landed: Finding[];
  anchor: string;
  /** Alignment spacing that levels THIS floor with its layer band — applied per
   *  floor (not per card) so several floors inside one card can spread apart. */
  padTop?: number;
  /** Per-row spacing keyed by the row's connector anchor (SCRUM-259). */
  rowPads?: Record<string, number>;
  /** Render order matching the Normalize column's cards. */
  rowOrder?: Record<string, number>;
  open: boolean;
  onToggle: () => void;
}) {
  const pct = Math.round((STATUS_WEIGHT[comp.migrationStatus] ?? 0) * 100);
  const targetLabel = formatTargetDate(comp.targetDate);
  // What actually landed here: normalization entries (authored or computed)
  // PLUS the findings no entry covers — those carry 1→1 into the model, so a
  // partially-matched comparison never undercounts its floor.
  const covered = new Set(lives.flatMap((e) => e.findingIds));
  const passThrough = landed.filter((f) => !covered.has(f.id));
  const inCount = lives.length + passThrough.length;
  // One merged list, in the Normalize column's order, so the per-row
  // connectors from Normalize land here without crossing (SCRUM-259).
  const floorRows: { key: string; e?: NormalizationEntry; f?: Finding }[] = [
    ...lives.map((e) => ({ key: `e:${e.id}`, e })),
    ...passThrough.map((f) => ({ key: `f:${f.id}`, f })),
  ].sort(
    (a, b) =>
      (rowOrder?.[a.key] ?? Number.MAX_SAFE_INTEGER) -
      (rowOrder?.[b.key] ?? Number.MAX_SAFE_INTEGER),
  );
  return (
    <div
      data-anchor={anchor}
      style={{
        border: '1px solid #d1fae5',
        borderRadius: 8,
        background: '#f8fffb',
        overflow: 'hidden',
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
          style={{ width: 8, height: 8, borderRadius: 999, background: GREEN, flexShrink: 0 }}
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
          <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{layer}</span>
          <span
            style={{
              fontSize: 10.5,
              color: '#525252',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {comp.name}
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
          {inCount} in
        </span>
        {slotStatusChip(comp.migrationStatus)}
      </button>

      {open && (
        <div style={{ padding: '0 10px 7px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                background: '#d1fae5',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: GREEN }} />
            </div>
            <span
              style={{
                fontSize: 9.5,
                color: '#047857',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {pct}%
            </span>
          </div>
          {targetLabel && (
            <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 3 }}>
              Target · {targetLabel}
            </div>
          )}
        </div>
      )}

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
          {inCount === 0 && (
            <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>Nothing lands on this floor.</span>
          )}
          {floorRows.map(({ key, e, f }) =>
            e ? (
              <div
                key={key}
                data-anchor={`${anchor}:${key}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  marginTop: rowPads?.[`${anchor}:${key}`] || undefined,
                }}
              >
                {e.notation && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#4f46e5',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.notation}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#1e1b4b', fontWeight: 600 }}>{e.name}</span>
                <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {e.findingIds.length}→1
                </span>
              </div>
            ) : (
              <div
                key={key}
                data-anchor={`${anchor}:${key}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  marginTop: rowPads?.[`${anchor}:${key}`] || undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>{f!.name}</span>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>1→1</span>
                </div>
                {f!.plainSummary && (
                  <span style={{ fontSize: 10, color: '#525252', lineHeight: 1.35 }}>
                    {f!.plainSummary}
                  </span>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function MicrositeCard({
  ms,
  components,
  findings,
  normalizationEntries,
  layerPads,
  rowPads,
  rowOrder,
  expandedLayers,
  onToggleLayer,
}: {
  ms: BoardMicroservice;
  components: BoardComponent[];
  findings: Finding[];
  normalizationEntries: NormalizationEntry[];
  layerPads?: LayerPads;
  rowPads?: Record<string, number>;
  rowOrder?: Record<string, number>;
  expandedLayers: LayerExpansion;
  onToggleLayer: (layer: Layer) => void;
}) {
  // Collapsed by default: a one-line header plus only the floors something
  // lands on — keeps the card short so the layer rows across the three columns
  // sit close together. Expanding reveals stack/owner/target/progress.
  const [open, setOpen] = useState(false);
  const tone = statusTone(ms.status);
  const mine = components.filter((c) => c.microserviceId === ms.id);
  const byLayer = new Map<Layer, BoardComponent>(mine.map((c) => [c.layer, c]));
  // The findings that carry into a floor (not dead, not eliminated) — the
  // pass-through normalized items listed when the board has no authored entries.
  const landingFindings = (layer: Layer) =>
    findings.filter((f) => f.layer === layer && !f.deadCode && f.capdan !== 'Eliminate');
  const progress =
    mine.length === 0
      ? 0
      : mine.reduce((a, c) => a + (STATUS_WEIGHT[c.migrationStatus] ?? 0), 0) / mine.length;
  const msTarget = formatTargetDate(ms.targetDate);
  // Only floors the comparison feeds (findings/entries arrive pre-scoped to
  // the picked applications); a card nothing in scope lands on hides entirely.
  const floors = LAYERS.filter((layer) => {
    const comp = byLayer.get(layer);
    if (!comp) return false;
    return (
      normalizationEntries.some((e) => e.componentId === comp.id) ||
      landingFindings(layer).length > 0
    );
  });
  if (floors.length === 0) return null;

  return (
    <div
      style={{
        border: `2px solid ${tone.border}`,
        borderRadius: 12,
        background: '#ecfdf5',
        boxShadow: tone.shadow,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* compact header line — expand for stack / owner / target / progress */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
            transform: open ? 'none' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 0, flex: 1 }}>{ms.name}</span>
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
          {tone.label}
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
      {open && (
        <div style={{ padding: '0 13px 9px' }}>
          {ms.techStack && <div style={{ fontSize: 12, color: '#6b7280' }}>{ms.techStack}</div>}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '2px 12px',
              marginTop: 3,
            }}
          >
            {ms.ownerRole && (
              <span style={{ fontSize: 11.5, color: GREEN, fontWeight: 600 }}>
                Owner · {ms.ownerRole}
              </span>
            )}
            {msTarget && (
              <span style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>
                Target · {msTarget}
              </span>
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

      {/* layer slots — only the floors something lands on */}
      <div
        style={{
          background: '#fff',
          borderTop: '1px solid #d1fae5',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        {floors.map((layer) => {
          const comp = byLayer.get(layer);
          if (!comp) return null;
          // Same order as the Normalize column's cards (shared entries first,
          // then single-app ones) so the two columns' rows never cross.
          const findingsById = new Map(findings.map((f) => [f.id, f]));
          const lives = [...normalizationEntries.filter((e) => e.componentId === comp.id)].sort(
            (a, b) =>
              (entryAppIds(a, findingsById).length > 1 ? 0 : 1) -
              (entryAppIds(b, findingsById).length > 1 ? 0 : 1),
          );
          return (
            <LayerSlot
              key={layer}
              layer={layer}
              comp={comp}
              lives={lives}
              landed={landingFindings(layer)}
              anchor={`gf:${ms.id}:${layer}`}
              padTop={layerPads?.[layer]}
              rowPads={rowPads}
              rowOrder={rowOrder}
              open={!!expandedLayers[layer]}
              onToggle={() => onToggleLayer(layer)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function GreenfieldColumn({
  microservices,
  components,
  findings,
  findingsByMs,
  normalizationEntries,
  layerPads,
  rowPads,
  rowOrder,
  expandedLayers,
  onToggleLayer,
}: Props) {
  // Stack the service cards in LAYER order (a card sorts by the highest layer
  // it hosts) so the connectors from the Normalize bands never cross between
  // cards — the UI card sits above the Data card, mirroring the band order.
  const layerRank = (ms: BoardMicroservice): number => {
    const idxs = components
      .filter((c) => c.microserviceId === ms.id)
      .map((c) => LAYERS.indexOf(c.layer))
      .filter((i) => i >= 0);
    return idxs.length ? Math.min(...idxs) : LAYERS.length;
  };
  const orderedMs = [...microservices].sort((a, b) => layerRank(a) - layerRank(b));
  return (
    <div style={{ width: 340, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Greenfield
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orderedMs.map((ms) => (
          <MicrositeCard
            key={ms.id}
            ms={ms}
            components={components}
            findings={findingsByMs?.get(ms.id) ?? findings}
            normalizationEntries={normalizationEntries}
            layerPads={layerPads}
            rowPads={rowPads}
            rowOrder={rowOrder}
            expandedLayers={expandedLayers}
            onToggleLayer={onToggleLayer}
          />
        ))}
        {microservices.length === 0 && (
          <div style={{ fontSize: 12, color: '#a3a3a3', textAlign: 'center', padding: 20 }}>
            No target services planned yet.
          </div>
        )}
      </div>
    </div>
  );
}
