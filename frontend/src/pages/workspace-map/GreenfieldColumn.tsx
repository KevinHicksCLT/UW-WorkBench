import { useState } from 'react';
import { GREEN, STATUS_WEIGHT, formatTargetDate } from './types';
import { entryAppIds } from './NormalizeCards';
import { LayerSlot } from './GreenfieldSlots';
import { floorLanding } from './stats';
import { useBoardVocab } from './vocabulary';
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
// layers wire into the exact floor they land on. The card header carries the
// v3 wireframe's lifecycle chip (Planned / Building / Live — vocabulary
// colors) and the target's inbound total ("N in ›").

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

function statusTone(status: string): { border: string; shadow: string } {
  if (status === 'Live') return { border: '#34d399', shadow: '0 4px 14px rgba(16,185,129,.16)' };
  if (status === 'Building') return { border: '#6ee7b7', shadow: '0 2px 8px rgba(16,185,129,.10)' };
  return { border: '#a7f3d0', shadow: '0 1px 2px rgba(0,0,0,.04)' };
}

/** Lifecycle chip (Planned / Building / Live), colored by the vocabulary. */
function TargetStatusChip({ status }: { status: string }) {
  const { targetStatus } = useBoardVocab();
  const s = targetStatus(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '1px 8px',
        borderRadius: 999,
        background: '#fff',
        border: `1px solid ${s.color}`,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '.06em',
        color: '#047857',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />
      {s.label}
    </span>
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
  const { layers } = useBoardVocab();
  const tone = statusTone(ms.status);
  const mine = components.filter((c) => c.microserviceId === ms.id);
  const byLayer = new Map<Layer, BoardComponent>(mine.map((c) => [c.layer, c]));
  const findingsById = new Map(findings.map((f) => [f.id, f]));
  // Only floors the comparison feeds (findings/entries arrive pre-scoped to
  // the picked applications); a card nothing in scope lands on hides entirely.
  // Entries render in the Normalize column's order (shared first) so the two
  // columns' rows never cross; the floor's inCount = entries + the findings
  // that carry into it 1→1 (not dead, not eliminated) no entry covers.
  const floors = layers.flatMap((layer) => {
    const comp = byLayer.get(layer);
    if (!comp) return [];
    const lives = [...normalizationEntries.filter((e) => e.componentId === comp.id)].sort(
      (a, b) =>
        (entryAppIds(a, findingsById).length > 1 ? 0 : 1) -
        (entryAppIds(b, findingsById).length > 1 ? 0 : 1),
    );
    const landed = findings.filter(
      (f) => f.layer === layer && !f.deadCode && f.capdan !== 'Eliminate',
    );
    if (lives.length === 0 && landed.length === 0) return [];
    return [{ layer, comp, lives, landed, inCount: floorLanding(lives, landed).inCount }];
  });
  const progress =
    mine.length === 0
      ? 0
      : mine.reduce((a, c) => a + (STATUS_WEIGHT[c.migrationStatus] ?? 0), 0) / mine.length;
  const msTarget = formatTargetDate(ms.targetDate);
  // The v3 wireframe's inbound total — everything flowing into this target.
  const inbound = floors.reduce((a, f) => a + f.inCount, 0);
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
        <TargetStatusChip status={ms.status} />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#047857',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {inbound} in ›
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
        {floors.map(({ layer, comp, lives, landed }) => (
          <LayerSlot
            key={layer}
            layer={layer}
            comp={comp}
            lives={lives}
            landed={landed}
            anchor={`gf:${ms.id}:${layer}`}
            padTop={layerPads?.[layer]}
            rowPads={rowPads}
            rowOrder={rowOrder}
            open={!!expandedLayers[layer]}
            onToggle={() => onToggleLayer(layer)}
          />
        ))}
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
  const { layers } = useBoardVocab();
  const layerRank = (ms: BoardMicroservice): number => {
    const idxs = components
      .filter((c) => c.microserviceId === ms.id)
      .map((c) => layers.indexOf(c.layer))
      .filter((i) => i >= 0);
    return idxs.length ? Math.min(...idxs) : layers.length;
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
