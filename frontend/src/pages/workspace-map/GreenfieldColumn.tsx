import { LAYERS, GREEN, STATUS_WEIGHT } from './types';
import type { BoardComponent, BoardMicroservice, Finding, Layer } from './types';

// Right column — the green-field target rendered as an architecture cutaway:
// ONE micro-site card per target service, opened up into its five layer slots
// (UI → Integration → Business → Data → Infrastructure). Each slot is what
// lands on that "floor" of the new build — the normalized component, how many
// capabilities flow into it, and its migration status — and each slot is a
// connector anchor, so the Normalize column's layers wire into the exact floor
// they land on. A progress bar rolls the component statuses up to one number.

interface Props {
  microservices: BoardMicroservice[];
  components: BoardComponent[];
  findings: Finding[];
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

function MicrositeCard({
  ms,
  components,
  findings,
}: {
  ms: BoardMicroservice;
  components: BoardComponent[];
  findings: Finding[];
}) {
  const tone = statusTone(ms.status);
  const mine = components.filter((c) => c.microserviceId === ms.id);
  const byLayer = new Map<Layer, BoardComponent>(mine.map((c) => [c.layer, c]));
  const landing = (layer: Layer) =>
    findings.filter((f) => f.layer === layer && !f.deadCode && f.capdan !== 'Eliminate').length;
  const progress =
    mine.length === 0
      ? 0
      : mine.reduce((a, c) => a + (STATUS_WEIGHT[c.migrationStatus] ?? 0), 0) / mine.length;

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
      {/* header */}
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
            {tone.label}
          </span>
          <span style={{ fontSize: 11, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(progress * 100)}% migrated
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{ms.name}</div>
        {ms.techStack && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{ms.techStack}</div>
        )}
        {ms.ownerRole && (
          <div style={{ fontSize: 11.5, color: GREEN, marginTop: 3, fontWeight: 600 }}>
            Owner · {ms.ownerRole}
          </div>
        )}
        {/* progress bar */}
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

      {/* layer slots — the floors of the new build */}
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
        {LAYERS.map((layer) => {
          const comp = byLayer.get(layer);
          const inCount = comp ? landing(layer) : 0;
          if (!comp) {
            return (
              <div
                key={layer}
                style={{
                  border: '1px dashed #e2e8f0',
                  borderRadius: 8,
                  padding: '5px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#a3a3a3',
                  fontSize: 11,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: '#e2e8f0' }} />
                <span style={{ fontWeight: 600 }}>{layer}</span>
                <span style={{ marginLeft: 'auto' }}>nothing lands here yet</span>
              </div>
            );
          }
          return (
            <div
              key={layer}
              data-anchor={`gf:${ms.id}:${layer}`}
              style={{
                border: '1px solid #d1fae5',
                borderRadius: 8,
                background: '#f8fffb',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{ width: 8, height: 8, borderRadius: 999, background: GREEN, flexShrink: 0 }}
              />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>{layer}</span>
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
                  {comp.name}
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
                {inCount} in ›
              </span>
              {slotStatusChip(comp.migrationStatus)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GreenfieldColumn({ microservices, components, findings }: Props) {
  return (
    <div style={{ width: 340, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Greenfield
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {microservices.map((ms) => (
          <MicrositeCard key={ms.id} ms={ms} components={components} findings={findings} />
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
