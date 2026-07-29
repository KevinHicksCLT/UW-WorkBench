import { spineKey, type StageSlot } from './spineCompare';
import { streamTone } from './VsNewProcessFlow';
import type { DragPayload } from './processBuilder';
import type { StreamDetail, TaskStep } from './useSpineData';

// The Value-streams lens' HIGH-LEVEL view — one lane per compared stream
// (dark chip left), its real process-level-3 nodes as cards horizontally.
// Any number of PL3 cards can be open AT THE SAME TIME — a click expands the
// matching slot in every compared lane at once; inside, each PL4 expands to
// its PL5 tasks and every task expands once more to its PL6 Work Library
// steps. Cards can be sent straight to the new-process builder (the ＋) or
// dragged there from the Compare view. Nothing auto-jumps.

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

/** Small "send to builder" affordance shared by PL4 headers and PL5 rows. */
function AddBtn({ onAdd, title }: { onAdd: () => void; title: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          onAdd();
        }
      }}
      style={{
        flexShrink: 0,
        width: 15,
        height: 15,
        borderRadius: 4,
        border: '1px solid #d1fae5',
        background: '#f0fdf6',
        color: '#047857',
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '13px',
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      ＋
    </span>
  );
}

export default function VsMapView({
  lanes,
  slots,
  laneCount,
  openSlots,
  onToggleSlot,
  openSubs,
  onToggleSub,
  openTasks,
  onToggleTask,
  stepsOf,
  onAdd,
}: {
  lanes: StreamDetail[];
  slots: StageSlot[];
  laneCount: number;
  /** Expanded PL3 slot keys — any number at once, shared across lanes. */
  openSlots: string[];
  onToggleSlot: (slotKey: string) => void;
  /** Expanded PL4 keys (`slotKey:spineKey(subName)`) — mirrored across lanes. */
  openSubs: string[];
  onToggleSub: (subKey: string) => void;
  /** Expanded PL5 task ids (per stream — PL6 steps differ per stream). */
  openTasks: string[];
  onToggleTask: (taskId: string) => void;
  /** PL6 cache — undefined = not fetched yet. */
  stepsOf: (taskId: string) => TaskStep[] | undefined;
  onAdd: (payload: DragPayload) => void;
}) {
  // slot key per (lane id, stage id) — powers the shared badges.
  const slotOf = new Map<string, StageSlot>();
  for (const s of slots)
    for (const [laneId, stageId] of s.byLane) slotOf.set(`${laneId}:${stageId}`, s);
  const openSet = new Set(openSlots);
  const openSubSet = new Set(openSubs);
  const openTaskSet = new Set(openTasks);
  const openHere = slots.filter((s) => openSet.has(s.key));

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
                  <span
                    style={{ fontSize: 9.5, color: '#a3a3a3', marginTop: 2 }}
                    title="process level 3 nodes · process level 5 tasks"
                  >
                    {lane.areas.length} PL3 ·{' '}
                    {lane.areas.reduce(
                      (n, a) => n + a.subs.reduce((m, s) => m + s.tasks.length, 0),
                      0,
                    )}{' '}
                    PL5
                  </span>
                </div>
                <Connector w={24} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
                  {lane.areas.map((area, ai) => {
                    const slot = slotOf.get(`${lane.id}:${area.id}`);
                    const present = slot?.byLane.size ?? 1;
                    const badge = coverageBadge(present, laneCount);
                    const isOpen = !!slot && openSet.has(slot.key);
                    const steps = area.subs.reduce((n, s) => n + s.tasks.length, 0);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => slot && onToggleSlot(slot.key)}
                        title="Expand this process-level-3 node in every compared stream"
                        style={{
                          font: 'inherit',
                          position: 'relative',
                          width: 158,
                          boxSizing: 'border-box',
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: '#fff',
                          borderLeft: isOpen ? `1.5px solid ${tone}` : '1px solid #e2e8f0',
                          borderRight: isOpen ? `1.5px solid ${tone}` : '1px solid #e2e8f0',
                          borderBottom: isOpen ? `1.5px solid ${tone}` : '1px solid #e2e8f0',
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
                            title="process level 4 · process level 5"
                          >
                            {area.subs.length} PL4 · {steps} PL5
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
                            title={`the same process-level-3 node exists in ${present} of ${laneCount} compared streams`}
                          >
                            {badge.label}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Every open PL3 slot: this lane's PL4s, aligned flush under the
                  card row (no repeated label — the highlighted card above IS
                  the context), expandable to PL5 and further to PL6. */}
              {openHere.map((slot) => {
                const area = lane.areas.find((a) => a.id === slot.byLane.get(lane.id));
                if (!area)
                  return (
                    <div
                      key={slot.key}
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
                      {slot.label} — this stream has no matching process-level-3 node.
                    </div>
                  );
                return (
                  <div
                    key={slot.key}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      margin: '8px 0 0 174px',
                    }}
                  >
                    {area.subs.map((sub, si) => {
                      const subKey = `${slot.key}:${spineKey(sub.name)}`;
                      const subOpen = openSubSet.has(subKey);
                      return (
                        <div
                          key={sub.id}
                          style={{
                            width: subOpen ? 236 : 160,
                            boxSizing: 'border-box',
                            borderRadius: 8,
                            background: '#fff',
                            borderTop: subOpen ? `1.5px solid ${tone}` : '1px solid #e2e8f0',
                            borderRight: subOpen ? `1.5px solid ${tone}` : '1px solid #e2e8f0',
                            borderBottom: subOpen ? `1.5px solid ${tone}` : '1px solid #e2e8f0',
                            borderLeft: `3px solid ${tone}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => onToggleSub(subKey)}
                            title="Expand to process-level-5 tasks in every compared stream"
                            style={{
                              font: 'inherit',
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '6px 9px',
                              background: 'none',
                              border: 'none',
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
                                {sub.tasks.length} PL5 · {subOpen ? 'collapse ▴' : 'expand ▾'}
                              </span>
                            </span>
                            <AddBtn
                              title="Add this process-level-4 node to the new process"
                              onAdd={() =>
                                onAdd({
                                  name: sub.name,
                                  level: '4',
                                  source: lane.name,
                                  nodeIds: [sub.id],
                                })
                              }
                            />
                          </button>
                          {subOpen && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                                padding: '0 7px 7px',
                                maxHeight: 260,
                                overflowY: 'auto',
                              }}
                            >
                              {sub.tasks.map((t, ti) => {
                                const taskOpen = openTaskSet.has(t.id);
                                const l6 = stepsOf(t.id);
                                return (
                                  <div
                                    key={t.id}
                                    style={{
                                      background: '#f8fafc',
                                      border: '1px solid #eef1f4',
                                      borderRadius: 5,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => onToggleTask(t.id)}
                                      title={
                                        t.owner
                                          ? `Owner: ${t.owner} — expand to process-level-6 steps`
                                          : 'Expand to process-level-6 steps'
                                      }
                                      style={{
                                        font: 'inherit',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        gap: 5,
                                        alignItems: 'flex-start',
                                        fontSize: 9,
                                        lineHeight: 1.3,
                                        color: '#334155',
                                        background: 'none',
                                        border: 'none',
                                        padding: '3px 6px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      <span
                                        style={{
                                          flexShrink: 0,
                                          color: '#94a3b8',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        {ti + 1}.
                                      </span>
                                      <span style={{ flex: 1, minWidth: 0 }}>{t.name}</span>
                                      <span style={{ flexShrink: 0, color: '#94a3b8' }}>
                                        {taskOpen ? '▴' : '▾'}
                                      </span>
                                      <AddBtn
                                        title="Add this process-level-5 task to the new process"
                                        onAdd={() =>
                                          onAdd({
                                            name: t.name,
                                            level: '5',
                                            source: lane.name,
                                            nodeIds: [t.id],
                                            agentScore: t.agent,
                                          })
                                        }
                                      />
                                    </button>
                                    {taskOpen && (
                                      <div style={{ padding: '0 6px 4px 17px' }}>
                                        {l6 === undefined ? (
                                          <div style={{ fontSize: 8.5, color: '#94a3b8' }}>
                                            Loading process-level-6 steps…
                                          </div>
                                        ) : l6.length === 0 ? (
                                          <div style={{ fontSize: 8.5, color: '#94a3b8' }}>
                                            No task-specific steps on this task yet.
                                          </div>
                                        ) : (
                                          l6.map((s) => (
                                            <div
                                              key={s.seq}
                                              title={s.detail ?? undefined}
                                              style={{
                                                fontSize: 8.5,
                                                lineHeight: 1.35,
                                                color: '#475569',
                                                display: 'flex',
                                                gap: 4,
                                              }}
                                            >
                                              <span
                                                style={{
                                                  color: '#a3b2c2',
                                                  fontVariantNumeric: 'tabular-nums',
                                                }}
                                              >
                                                {s.seq}.
                                              </span>
                                              <span style={{ flex: 1, minWidth: 0 }}>{s.name}</span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {sub.tasks.length === 0 && (
                                <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                  No process-level-5 tasks under this node.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
