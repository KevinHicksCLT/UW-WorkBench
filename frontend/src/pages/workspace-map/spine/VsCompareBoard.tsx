import { useMemo, useState } from 'react';
import { streamBg, streamTone } from './VsNewProcessFlow';
import VsBuilderPanel from './VsBuilderPanel';
import VsNestModal, { childColumns, type NestFrame } from './VsNestModal';
import { LEVEL_LABEL, setDragPayload, type BuilderItem, type DragPayload } from './processBuilder';
import { spineKey } from './spineCompare';
import type { StreamDetail, TaskStep } from './useSpineData';

// The Value-streams COMPARE view — an interactive process editor. One column
// per compared stream, cards in true sequential order at the picked process
// level (3 / 4 / 5). Click a card and the comparison nests one level down in
// a modal — the russian doll — all the way to Process level 6 (Work Library
// steps). Drag any card into the right-hand builder to compose the
// consolidated / new value stream: reorder, rename, delete there, with the
// resulting flow strip updating in real time underneath.

export type CompareLevel = '3' | '4' | '5';

interface Unit {
  key: string;
  name: string;
  context: string | null;
  nodeIds: string[];
  childCount: number;
  agent?: number | null;
}

function unitsAt(lane: StreamDetail, level: CompareLevel): Unit[] {
  if (level === '3')
    return lane.areas.map((a) => ({
      key: spineKey(a.name),
      name: a.name,
      context: null,
      nodeIds: [a.id],
      childCount: a.subs.length,
    }));
  if (level === '4')
    return lane.areas.flatMap((a) =>
      a.subs.map((s) => ({
        key: spineKey(s.name),
        name: s.name,
        context: a.name,
        nodeIds: [s.id],
        childCount: s.tasks.length,
      })),
    );
  return lane.areas.flatMap((a) =>
    a.subs.flatMap((s) =>
      s.tasks.map((t) => ({
        key: spineKey(t.name),
        name: t.name,
        context: `${a.name} › ${s.name}`,
        nodeIds: [t.id],
        childCount: -1,
        agent: t.agent,
      })),
    ),
  );
}

const NEXT_NOUN: Record<CompareLevel, string> = {
  '3': 'Process level 4',
  '4': 'Process level 5',
  '5': 'Process level 6 steps',
};

export default function VsCompareBoard({
  lanes,
  level,
  onLevel,
  items,
  onItemsChange,
  onPromote,
  onAdd,
  stepsOf,
  loadSteps,
  onBackToMap,
}: {
  lanes: StreamDetail[];
  level: CompareLevel;
  onLevel: (l: CompareLevel) => void;
  items: BuilderItem[];
  onItemsChange: (items: BuilderItem[]) => void;
  onPromote: () => void;
  onAdd: (p: DragPayload) => void;
  stepsOf: (taskId: string) => TaskStep[] | undefined;
  loadSteps: (ids: string[]) => void;
  onBackToMap: () => void;
}) {
  const [stack, setStack] = useState<NestFrame[]>([]);

  const columns = useMemo(
    () => lanes.map((lane) => ({ lane, units: unitsAt(lane, level) })),
    [lanes, level],
  );

  // How many compared streams carry each canonical key at this level.
  const carrierCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const col of columns) {
      const seen = new Set(col.units.map((u) => u.key));
      for (const k of seen) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [columns]);

  const openNest = (u: Unit) =>
    setStack([
      {
        title: u.name,
        level: String(Number(level) + 1) as NestFrame['level'],
        columns: childColumns(lanes, { key: u.key, level }),
      },
    ]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar: back + process-level buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          padding: '10px 14px',
          borderBottom: '1px solid #eaeaea',
        }}
      >
        <button
          type="button"
          onClick={onBackToMap}
          style={{
            font: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            borderRadius: 9999,
            padding: '4px 11px',
            fontSize: 11.5,
            fontWeight: 600,
            background: '#fff',
            color: '#171717',
            border: '1px solid #d4d4d4',
            cursor: 'pointer',
          }}
        >
          ‹ Map
        </button>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#737373',
            margin: '0 2px',
          }}
        >
          Compare at
        </span>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            borderRadius: 9999,
            border: '1px solid #eaeaea',
            background: '#fff',
            padding: 2,
          }}
        >
          {(['3', '4', '5'] as CompareLevel[]).map((l) => {
            const on = l === level;
            return (
              <button
                key={l}
                type="button"
                onClick={() => onLevel(l)}
                style={{
                  font: 'inherit',
                  borderRadius: 9999,
                  padding: '3px 11px',
                  fontSize: 11,
                  fontWeight: on ? 600 : 500,
                  background: on ? '#171717' : 'transparent',
                  color: on ? '#fff' : '#525252',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {LEVEL_LABEL[l]}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 10.5, color: '#737373' }}>
          click a card to nest into its {NEXT_NOUN[level]} · drag cards right to build the new
          process
        </span>
      </div>

      {/* Stream columns + builder */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: '#fafafa',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            padding: '10px 14px',
            width: 'max-content',
            minWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {columns.map((col, ci) => {
            const tone = streamTone(ci);
            return (
              <div key={col.lane.id} style={{ width: 290, flexShrink: 0 }}>
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: tone,
                    background: streamBg(ci),
                    border: `1px solid ${tone}33`,
                    borderRadius: 6,
                    padding: '4px 9px',
                    marginBottom: 6,
                  }}
                >
                  {col.lane.name}
                  <span style={{ fontWeight: 500, color: '#64748b' }}>
                    {' '}
                    · {col.units.length} {LEVEL_LABEL[level].toLowerCase()} units
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {col.units.map((u, ui) => {
                    const carriers = carrierCount.get(u.key) ?? 1;
                    const sharedByAll = carriers >= lanes.length && lanes.length > 1;
                    return (
                      <div
                        key={`${u.key}:${ui}`}
                        draggable
                        onDragStart={(e) =>
                          setDragPayload(e, {
                            name: u.name,
                            level,
                            source: col.lane.name,
                            nodeIds: u.nodeIds,
                            agentScore: u.agent,
                          })
                        }
                        style={{
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderLeft: `3px solid ${tone}`,
                          borderRadius: 7,
                          padding: '5px 8px',
                          cursor: 'grab',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span
                            style={{
                              flexShrink: 0,
                              width: 15,
                              height: 15,
                              borderRadius: 999,
                              background: tone,
                              color: '#fff',
                              fontSize: 8.5,
                              fontWeight: 800,
                              lineHeight: '15px',
                              textAlign: 'center',
                            }}
                          >
                            {ui + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => openNest(u)}
                            title={`Open the nested ${NEXT_NOUN[level]} comparison for this unit`}
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
                            {u.name} <span style={{ color: '#94a3b8', fontSize: 9 }}>›</span>
                          </button>
                          <button
                            type="button"
                            title="Add to the new process"
                            onClick={() =>
                              onAdd({
                                name: u.name,
                                level,
                                source: col.lane.name,
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
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            marginTop: 3,
                            paddingLeft: 21,
                            flexWrap: 'wrap',
                          }}
                        >
                          {level === '5' && u.agent != null && u.agent <= 2 && (
                            <span
                              style={{
                                fontSize: 8,
                                fontWeight: 700,
                                color: '#047857',
                                background: '#ecfdf5',
                                borderRadius: 4,
                                padding: '0 4px',
                              }}
                            >
                              AGENT
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: sharedByAll ? '#4338ca' : carriers > 1 ? '#b45309' : '#737373',
                              background: sharedByAll
                                ? '#eef2ff'
                                : carriers > 1
                                  ? '#fffbeb'
                                  : '#fafafa',
                              borderRadius: 4,
                              padding: '0 4px',
                            }}
                            title={`the same unit exists in ${carriers} of ${lanes.length} compared streams`}
                          >
                            {carriers > 1 ? `${carriers}/${lanes.length}` : '1 only'}
                          </span>
                          {u.context && (
                            <span
                              style={{
                                fontSize: 8.5,
                                color: '#94a3b8',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 190,
                              }}
                              title={u.context}
                            >
                              {u.context}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <VsBuilderPanel
            title="New value stream"
            hint="The consolidated / new process. Drag cards in, reorder, rename, delete — the flow below updates live."
            items={items}
            onChange={onItemsChange}
            onPromote={onPromote}
            promoteLabel="Promote new process"
          />
        </div>
      </div>

      {/* Realtime flow strip — re-renders from the builder on every change. */}
      <div
        style={{
          borderTop: '2px solid #a7f3d0',
          background: '#f6faf7',
          padding: '8px 14px 10px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#14532d' }}>New process flow</span>
          <span style={{ fontSize: 9.5, color: '#4d7c60' }}>
            {items.length === 0
              ? 'builds here in real time as you compose the new value stream'
              : `${items.length} steps · ${items.filter((i) => i.agent).length} agent-run`}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', width: 'max-content' }}>
            {items.map((s, i) => (
              <div key={s.uid} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <span style={{ width: 12, height: 1.5, background: '#bbe7cf', flexShrink: 0 }} />
                )}
                <div
                  style={{
                    width: 170,
                    boxSizing: 'border-box',
                    background: '#fff',
                    border: '1px solid #bbe7cf',
                    borderTop: `3px solid ${s.agent ? '#047857' : '#64748b'}`,
                    borderRadius: 8,
                    padding: '5px 8px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: '#047857',
                        color: '#fff',
                        fontSize: 8,
                        fontWeight: 800,
                        lineHeight: '14px',
                        textAlign: 'center',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: 9.5, lineHeight: 1.3, color: '#14532d' }}>
                      {s.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 3, paddingLeft: 19 }}>
                    <span
                      style={{
                        fontSize: 7.5,
                        fontWeight: 700,
                        color: s.agent ? '#047857' : '#64748b',
                      }}
                    >
                      {s.agent ? 'AGENT' : 'MANUAL'}
                    </span>
                    <span style={{ fontSize: 7.5, color: '#94a3b8' }}>· {s.source}</span>
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ fontSize: 10.5, color: '#4d7c60', padding: '4px 2px' }}>
                No steps yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {stack.length > 0 && (
        <VsNestModal
          stack={stack}
          onPush={(f) => setStack((s) => [...s, f])}
          onPop={(depth) => setStack((s) => s.slice(0, depth))}
          onClose={() => setStack([])}
          lanes={lanes}
          stepsOf={stepsOf}
          loadSteps={loadSteps}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}
