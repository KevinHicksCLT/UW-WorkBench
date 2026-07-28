import { streamTone } from './VsNewProcessFlow';
import type { StageSlot } from './spineCompare';
import type { StreamDetail } from './useSpineData';

// The Value-streams lens' HIGH-LEVEL view — the map's own language: one lane
// per compared stream (dark chip left), its real L3 phases as cards
// horizontally; click a phase to drop its real L4 sub-processes open beneath.
// Nothing repeats — each lane shows its own structure once, and the small
// "k/N" badge on every card says how many compared streams carry the same
// work. Clicking an L4 hands off to the comparison grid at that spot.

interface CardBadge {
  label: string;
  fg: string;
  bg: string;
  border: string;
}

/** In-how-many-streams badge: full = indigo, partial = amber, solo = muted. */
function coverageBadge(present: number, total: number): CardBadge {
  if (present >= total && total > 1)
    return { label: `${present}/${total}`, fg: '#4338ca', bg: '#eef2ff', border: '#d6dcff' };
  if (present > 1)
    return { label: `${present}/${total}`, fg: '#b45309', bg: '#fffbeb', border: '#fde68a' };
  return { label: '1 only', fg: '#737373', bg: '#fafafa', border: '#e5e5e5' };
}

function Connector({ w = 20 }: { w?: number }) {
  return (
    <span
      style={{
        width: w,
        height: 1.5,
        background: '#9ca3af',
        opacity: 0.55,
        flexShrink: 0,
        alignSelf: 'center',
      }}
    />
  );
}

export default function VsMapView({
  lanes,
  slots,
  laneCount,
  openPhase,
  onTogglePhase,
  onOpenGrid,
}: {
  lanes: StreamDetail[];
  slots: StageSlot[];
  laneCount: number;
  /** Currently drilled phase slot key (one at a time, shared across lanes). */
  openPhase: string | null;
  onTogglePhase: (slotKey: string | null) => void;
  onOpenGrid: (phaseSlotKey: string) => void;
}) {
  // slot key per (lane id, stage id) — powers the shared badges.
  const slotOf = new Map<string, StageSlot>();
  for (const s of slots)
    for (const [laneId, stageId] of s.byLane) slotOf.set(`${laneId}:${stageId}`, s);

  return (
    <div
      style={{
        padding: '18px 20px 24px',
        background: '#fff',
        backgroundImage: 'radial-gradient(#e5e5e5 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        overflow: 'auto',
        flex: 1,
        minHeight: 0,
      }}
    >
      <div style={{ width: 'max-content', minWidth: '100%' }}>
        {lanes.map((lane, li) => {
          const tone = streamTone(li);
          return (
            <div key={lane.id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 150,
                    flexShrink: 0,
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#171717',
                    borderTop: `3px solid ${tone}`,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minHeight: 64,
                  }}
                >
                  <span
                    style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}
                  >
                    {lane.name}
                  </span>
                  <span style={{ fontSize: 9.5, color: '#a3a3a3', marginTop: 2 }}>
                    {lane.areas.length} phases ·{' '}
                    {lane.areas.reduce(
                      (n, a) => n + a.subs.reduce((m, s) => m + s.tasks.length, 0),
                      0,
                    )}{' '}
                    steps
                  </span>
                </div>
                <Connector w={24} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
                  {lane.areas.map((area, ai) => {
                    const slot = slotOf.get(`${lane.id}:${area.id}`);
                    const present = slot?.byLane.size ?? 1;
                    const badge = coverageBadge(present, laneCount);
                    const isOpen = !!slot && openPhase === slot.key;
                    const steps = area.subs.reduce((n, s) => n + s.tasks.length, 0);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => slot && onTogglePhase(isOpen ? null : slot.key)}
                        style={{
                          font: 'inherit',
                          position: 'relative',
                          width: 158,
                          boxSizing: 'border-box',
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: '#fff',
                          border: isOpen ? `1.5px solid ${tone}` : '1px solid #e2e8f0',
                          borderTop: `3px solid ${tone}`,
                          boxShadow: isOpen ? `0 0 0 3px ${tone}22` : '0 2px 8px rgba(0,0,0,0.06)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: tone,
                            color: '#fff',
                            fontSize: 8.5,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {ai + 1}
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: '#171717',
                            lineHeight: 1.25,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {area.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span
                            style={{
                              fontSize: 9,
                              color: '#737373',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {area.subs.length} L4 · {steps} steps
                          </span>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 700,
                              color: badge.fg,
                              background: badge.bg,
                              border: `1px solid ${badge.border}`,
                              borderRadius: 5,
                              padding: '0 4px',
                            }}
                            title={`the same phase exists in ${present} of ${laneCount} compared streams`}
                          >
                            {badge.label}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drilled phase: this lane's real L4s, once, with the grid hand-off. */}
              {openPhase &&
                (() => {
                  const slot = slots.find((s) => s.key === openPhase);
                  const area = lane.areas.find((a) => a.id === slot?.byLane.get(lane.id));
                  if (!slot) return null;
                  if (!area)
                    return (
                      <div
                        style={{
                          margin: '8px 0 0 174px',
                          padding: '8px 12px',
                          border: '1px dashed #d4d4d4',
                          borderRadius: 8,
                          fontSize: 10.5,
                          color: '#737373',
                          background: '#fff',
                          width: 'fit-content',
                        }}
                      >
                        This stream has no phase in this slot.
                      </div>
                    );
                  return (
                    <div
                      style={{ display: 'flex', alignItems: 'flex-start', margin: '8px 0 0 174px' }}
                    >
                      <div
                        style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}
                      >
                        {area.subs.map((sub, si) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => onOpenGrid(slot.key)}
                            title="Open the step comparison grid at this sub-process"
                            style={{
                              font: 'inherit',
                              width: 160,
                              boxSizing: 'border-box',
                              padding: '6px 9px',
                              borderRadius: 8,
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              borderLeft: `3px solid ${tone}`,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 6,
                              textAlign: 'left',
                            }}
                          >
                            <span
                              style={{
                                flexShrink: 0,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: '#64748b',
                                color: '#fff',
                                fontSize: 8,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 1,
                              }}
                            >
                              {si + 1}
                            </span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: '#171717',
                                  lineHeight: 1.3,
                                }}
                              >
                                {sub.name}
                              </span>
                              <span style={{ fontSize: 9, color: '#737373' }}>
                                {sub.tasks.length} steps · compare ›
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
