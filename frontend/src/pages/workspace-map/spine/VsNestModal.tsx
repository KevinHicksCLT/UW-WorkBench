import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { streamBg, streamTone } from './VsNewProcessFlow';
import { LEVEL_SHORT, type DragPayload, type ProcessLevel } from './processBuilder';
import { similar, spineKey } from './spineCompare';
import type { StreamDetail, TaskStep } from './useSpineData';

// The compare view's russian nesting doll — click a card, a modal opens with
// the SAME comparison one process level down, scoped to just that unit:
// PL3 → its PL4s side by side, PL4 → PL5 tasks, PL5 → PL6 Work Library
// steps. Each level pushes onto a breadcrumb stack; every card can still be
// sent to the new-process builder with its ＋.

export interface NestUnit {
  key: string;
  name: string;
  nodeIds: string[];
  childCount: number;
  agent?: number | null;
}

export interface NestColumn {
  stream: string;
  units: NestUnit[] | null;
  /** True when the lane doesn't carry the clicked unit and the column shows
   *  the lane's ENTIRE set at this level instead — comparison never dead-ends
   *  just because the parent differs. */
  fallback?: boolean;
  /** PL6 only: the lane has no task with the clicked name, so the column
   *  shows the steps of its CLOSEST similar task — named here. */
  approx?: string;
}

export interface NestFrame {
  /** The unit that was clicked (title of the frame). */
  title: string;
  /** The level SHOWN inside the frame (clicked level + 1). */
  level: ProcessLevel;
  /** One column per compared stream: its matching children, in order. */
  columns: NestColumn[];
}

/** Every unit a lane has at the given (child) level — the cross-parent
 *  fallback pool. */
function allAt(lane: StreamDetail, level: ProcessLevel): NestUnit[] {
  if (level === '4')
    return lane.areas.flatMap((a) =>
      a.subs.map((s) => ({
        key: spineKey(s.name),
        name: s.name,
        nodeIds: [s.id],
        childCount: s.tasks.length,
      })),
    );
  return lane.areas.flatMap((a) =>
    a.subs.flatMap((s) =>
      s.tasks.map((t) => ({
        key: spineKey(t.name),
        name: t.name,
        nodeIds: [t.id],
        childCount: -1,
        agent: t.agent,
      })),
    ),
  );
}

/** Children of the matched unit one level down, per lane. A lane that does
 *  not carry the clicked unit falls back to ALL of its units at that level —
 *  compare across levels regardless of how the streams are structured. At
 *  PL6 (steps of one specific task) the fallback is the lane's CLOSEST
 *  similar-named task; only when nothing similar exists does the column say
 *  the work is unique to the other stream. */
export function childColumns(
  lanes: StreamDetail[],
  clicked: { key: string; name: string; level: ProcessLevel },
): NestColumn[] {
  return lanes.map((lane) => {
    if (clicked.level === '3') {
      const area = lane.areas.find((a) => spineKey(a.name) === clicked.key);
      if (!area) return { stream: lane.name, units: allAt(lane, '4'), fallback: true };
      return {
        stream: lane.name,
        units: area.subs.map((s) => ({
          key: spineKey(s.name),
          name: s.name,
          nodeIds: [s.id],
          childCount: s.tasks.length,
        })),
      };
    }
    if (clicked.level === '4') {
      for (const area of lane.areas) {
        const sub = area.subs.find((s) => spineKey(s.name) === clicked.key);
        if (sub)
          return {
            stream: lane.name,
            units: sub.tasks.map((t) => ({
              key: spineKey(t.name),
              name: t.name,
              nodeIds: [t.id],
              childCount: -1, // PL6 count unknown until fetched
              agent: t.agent,
            })),
          };
      }
      return { stream: lane.name, units: allAt(lane, '5'), fallback: true };
    }
    // clicked.level === '5' → the frame shows PL6 steps; units resolved live
    // from the steps cache in the modal render (per-lane task id needed).
    for (const area of lane.areas) {
      for (const sub of area.subs) {
        const task = sub.tasks.find((t) => spineKey(t.name) === clicked.key);
        if (task)
          return {
            stream: lane.name,
            units: [{ key: task.id, name: task.name, nodeIds: [task.id], childCount: -1 }],
          };
      }
    }
    // No exact task — the closest similar-named task keeps the comparison
    // alive (token-overlap `similar`, the spine's one matching rule).
    for (const area of lane.areas) {
      for (const sub of area.subs) {
        const near = sub.tasks.find((t) => similar(t.name, clicked.name));
        if (near)
          return {
            stream: lane.name,
            units: [{ key: near.id, name: near.name, nodeIds: [near.id], childCount: -1 }],
            approx: near.name,
          };
      }
    }
    return { stream: lane.name, units: null };
  });
}

export default function VsNestModal({
  stack,
  onPush,
  onPop,
  onClose,
  lanes,
  stepsOf,
  loadSteps,
  onAdd,
}: {
  stack: NestFrame[];
  onPush: (frame: NestFrame) => void;
  onPop: (toDepth: number) => void;
  onClose: () => void;
  lanes: StreamDetail[];
  stepsOf: (taskId: string) => TaskStep[] | undefined;
  loadSteps: (ids: string[]) => void;
  onAdd: (p: DragPayload) => void;
}) {
  const frame = stack[stack.length - 1];
  const isSteps = frame?.level === '6';

  // PL6 frames: the "units" are one task per lane — fetch their steps.
  useEffect(() => {
    if (!frame || !isSteps) return;
    const ids = frame.columns.flatMap((c) => (c.units ? c.units.map((u) => u.key) : []));
    if (ids.length) loadSteps(ids);
  }, [frame, isSteps, loadSteps]);

  if (!frame) return null;

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.38)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 70,
      }}
    >
      <div
        role="dialog"
        aria-label={frame.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: Math.min(320 + frame.columns.length * 300, 1240),
          maxWidth: 'calc(100% - 48px)',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,.3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 16px',
            borderBottom: '1px solid #eaeaea',
            flexWrap: 'wrap',
          }}
        >
          {stack.map((f, i) => (
            <span
              key={`${f.title}:${i}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {i > 0 && <span style={{ color: '#d4d4d4' }}>›</span>}
              <button
                type="button"
                onClick={() => onPop(i + 1)}
                style={{
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: i === stack.length - 1 ? 700 : 500,
                  color: i === stack.length - 1 ? '#171717' : '#525252',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {f.title}
              </button>
            </span>
          ))}
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: '#4338ca',
              background: '#eef2ff',
              border: '1px solid #d6dcff',
              borderRadius: 5,
              padding: '1px 6px',
            }}
          >
            comparing {`Process level ${frame.level}`}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              font: 'inherit',
              fontSize: 15,
              color: '#a3a3a3',
              background: 'none',
              border: 'none',
              padding: '0 4px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: 12, overflow: 'auto', minHeight: 0 }}>
          {frame.columns.map((col, ci) => {
            const tone = streamTone(ci);
            return (
              <div key={col.stream} style={{ width: 290, flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: tone,
                    background: streamBg(ci),
                    border: `1px solid ${tone}33`,
                    borderRadius: 6,
                    padding: '3px 9px',
                    marginBottom: 6,
                  }}
                >
                  {col.stream}
                  {col.fallback && (
                    <span style={{ fontWeight: 500, color: '#64748b' }}>
                      {' '}
                      · no matching parent — all its Process level {frame.level}
                    </span>
                  )}
                  {col.approx && (
                    <span style={{ fontWeight: 500, color: '#64748b' }}>
                      {' '}
                      · closest match — no exact task
                    </span>
                  )}
                </div>
                {col.units === null ? (
                  <div
                    style={{
                      border: '1px dashed #e2e8f0',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 10.5,
                      color: '#94a3b8',
                    }}
                  >
                    No task named — or similar to — “{frame.title}” exists in this stream. This work
                    is unique to the other compared stream{lanes.length > 2 ? 's' : ''}.
                  </div>
                ) : isSteps ? (
                  // PL6: the lane's matched task — its Work Library steps.
                  col.units.map((task) => {
                    const l6 = stepsOf(task.key);
                    return (
                      <div
                        key={task.key}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        {col.approx && (
                          <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
                            {task.name}
                          </div>
                        )}
                        {l6 === undefined ? (
                          <div style={{ fontSize: 10.5, color: '#94a3b8', padding: 4 }}>
                            Loading steps…
                          </div>
                        ) : l6.length === 0 ? (
                          <div style={{ fontSize: 10.5, color: '#94a3b8', padding: 4 }}>
                            No task-specific steps on this task yet.
                          </div>
                        ) : (
                          l6.map((s) => (
                            <div
                              key={s.seq}
                              title={s.detail ?? undefined}
                              style={{
                                display: 'flex',
                                gap: 6,
                                alignItems: 'flex-start',
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderLeft: `3px solid ${tone}`,
                                borderRadius: 7,
                                padding: '5px 8px',
                              }}
                            >
                              <span
                                style={{
                                  flexShrink: 0,
                                  fontSize: 9,
                                  color: '#94a3b8',
                                  fontVariantNumeric: 'tabular-nums',
                                  marginTop: 1,
                                }}
                              >
                                {s.seq}.
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 10.5,
                                  lineHeight: 1.35,
                                  color: '#171717',
                                }}
                              >
                                {s.name}
                                {s.detail && (
                                  <span style={{ display: 'block', fontSize: 9, color: '#64748b' }}>
                                    {s.detail}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      ...(col.fallback ? { maxHeight: 430, overflowY: 'auto' as const } : {}),
                    }}
                  >
                    {col.units.map((u, ui) => (
                      <div
                        key={`${u.key}:${ui}`}
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'flex-start',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderLeft: `3px solid ${tone}`,
                          borderRadius: 7,
                          padding: '5px 8px',
                        }}
                      >
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 9,
                            color: '#94a3b8',
                            fontVariantNumeric: 'tabular-nums',
                            marginTop: 2,
                          }}
                        >
                          {ui + 1}.
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onPush({
                              title: u.name,
                              level: String(Number(frame.level) + 1) as ProcessLevel,
                              columns: childColumns(lanes, {
                                key: u.key,
                                name: u.name,
                                level: frame.level,
                              }),
                            })
                          }
                          title={`Open the ${frame.level === '5' ? 'Process level 6 steps' : `Process level ${Number(frame.level) + 1} comparison`} for this unit`}
                          style={{
                            font: 'inherit',
                            flex: 1,
                            minWidth: 0,
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: 10.5,
                            lineHeight: 1.35,
                            color: '#171717',
                          }}
                        >
                          {u.name}
                          <span style={{ color: '#94a3b8', fontSize: 9 }}>
                            {' '}
                            {u.childCount >= 0
                              ? `· ${u.childCount} ${LEVEL_SHORT[String(Number(frame.level) + 1) as ProcessLevel] ?? ''}`
                              : ''}{' '}
                            ›
                          </span>
                        </button>
                        <button
                          type="button"
                          title="Add to the new process"
                          onClick={() =>
                            onAdd({
                              name: u.name,
                              level: frame.level,
                              source: col.stream,
                              nodeIds: u.nodeIds,
                              agentScore: u.agent,
                            })
                          }
                          style={{
                            font: 'inherit',
                            flexShrink: 0,
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: '1px solid #d1fae5',
                            background: '#f0fdf6',
                            color: '#047857',
                            fontSize: 10,
                            fontWeight: 700,
                            lineHeight: '14px',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          ＋
                        </button>
                      </div>
                    ))}
                    {col.units.length === 0 && (
                      <div style={{ fontSize: 10.5, color: '#94a3b8', padding: 4 }}>
                        Nothing at this level.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
