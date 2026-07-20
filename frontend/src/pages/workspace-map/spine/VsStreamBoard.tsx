import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useApi } from '../../../lib/useApi';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, INDIGO } from '../types';
import { Picker, ConsolidationRail, type PoolOption } from './SpineBoard';
import {
  alignStages,
  compareSpineColumns,
  spineKey,
  type SpineComparison,
  type SpineItem,
  type StageSlot,
} from './spineCompare';
import { useStreamDetails, useStreamList, type StreamDetail } from './useSpineData';

// Value-streams lens in the MAP's own card language (the Value Streams tab
// itself is untouched): white rounded cards joined by connector lines, and the
// map's progressive drill — each lane shows its L3 stage cards by default;
// clicking a stage expands its numbered L4 row beneath; clicking an L4 drops
// its numbered L5 task column. A computed NEW PROCESS lane sits between the
// compared flows. The By-product toggle adds per-product sub-lanes that work
// exactly the same — just more flows (blank until per-product processes exist).

interface LaneStage {
  id: string;
  name: string;
  subs: { id: string; name: string; tasks: { id: string; name: string }[] }[];
  tasks: { id: string; name: string }[];
}

interface Lane {
  id: string;
  title: string;
  subtitle: string | null;
  stages: LaneStage[];
  /** Product sub-lanes carry no process yet — stages render dimmed. */
  blank?: boolean;
  tone?: string;
}

const LANE_LABEL_W = 150;
const SLOT_W = 190;
type Mark = 'shared' | 'dup' | 'unique' | undefined;

function laneStages(d: StreamDetail): LaneStage[] {
  return d.areas.map((a) => ({
    id: a.id,
    name: a.name,
    subs: a.subs,
    tasks: a.subs.flatMap((s) => s.tasks),
  }));
}

/** Numbered blue badge — the map's step counter chip. */
function NumBadge({ n }: { n: number }) {
  return (
    <span
      style={{
        width: 15,
        height: 15,
        borderRadius: 999,
        background: '#2563eb',
        color: '#fff',
        fontSize: 8.5,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {n}
    </span>
  );
}

/** The map's card: white, rounded, thin border, subtle shadow. */
function MapCard({
  children,
  onClick,
  selected,
  dimmed,
  tone,
  width,
  height = 64,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  tone?: string;
  width?: number | string;
  /** Fixed height — every box in a row stays the same size. */
  height?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: width ?? '100%',
        height,
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '7px 10px',
        borderRadius: 10,
        background: dimmed ? '#fbfcfe' : '#ffffff',
        border: dimmed
          ? '1px dashed #dbe3ee'
          : selected
            ? '1.5px solid #2563eb'
            : `1px solid ${tone ?? '#e2e8f0'}`,
        boxShadow: dimmed ? 'none' : '0 1px 3px rgba(0,0,0,.06)',
        cursor: onClick ? 'pointer' : 'default',
        font: 'inherit',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        position: 'relative',
      }}
    >
      {children}
    </button>
  );
}

const markDot = (mark: Mark) => (
  <span
    style={{
      width: 6,
      height: 6,
      borderRadius: 999,
      flexShrink: 0,
      background: mark === 'shared' ? INDIGO : mark === 'dup' ? AMBER : '#93b7e0',
    }}
  />
);

/** Horizontal connector between sibling cards (the map's flow line). */
const HConnector = () => (
  <span
    style={{ width: 14, height: 1.5, background: '#c7d5e8', flexShrink: 0, alignSelf: 'center' }}
  />
);
/** Vertical connector between stacked task cards. */
const VConnector = () => (
  <span style={{ width: 1.5, height: 12, background: '#c7d5e8', margin: '0 auto' }} />
);

/** Normalized (new process) steps for one aligned slot. */
function normalizedSteps(
  slot: StageSlot,
  lanes: Lane[],
): { key: string; name: string; sources: number }[] {
  const byKey = new Map<string, { name: string; sources: Set<string> }>();
  for (const lane of lanes) {
    if (lane.blank) continue;
    const stageId = slot.byLane.get(lane.id);
    const stage = stageId ? lane.stages.find((s) => s.id === stageId) : null;
    for (const t of stage?.tasks ?? []) {
      const k = spineKey(t.name);
      const cur = byKey.get(k);
      if (cur) {
        cur.sources.add(lane.id);
        if (t.name.length < cur.name.length) cur.name = t.name;
      } else byKey.set(k, { name: t.name, sources: new Set([lane.id]) });
    }
  }
  return [...byKey.entries()].map(([key, v]) => ({ key, name: v.name, sources: v.sources.size }));
}

/** The dark lane label pill (mirrors the map's segment chip). */
function LaneChip({ title, meta, tone }: { title: string; meta?: string; tone?: string }) {
  return (
    <div style={{ paddingRight: 8 }}>
      <div
        style={{
          display: 'inline-block',
          background: tone ?? '#171717',
          color: '#fff',
          borderRadius: 8,
          padding: '7px 11px',
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1.25,
          boxShadow: '0 2px 6px rgba(0,0,0,.18)',
        }}
      >
        {title}
      </div>
      {meta && <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4 }}>{meta}</div>}
    </div>
  );
}

/** Vertical L5 task column under an expanded L4 card (map style). */
function TaskColumn({
  tasks,
  markFor,
}: {
  tasks: { id: string; name: string }[];
  markFor: (id: string) => Mark;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 180 }}>
      {tasks.map((t, i) => (
        <div key={t.id}>
          {i > 0 && <VConnector />}
          <div
            style={{
              boxSizing: 'border-box',
              padding: '6px 8px',
              borderRadius: 10,
              background: '#fff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              textAlign: 'left',
            }}
          >
            <NumBadge n={i + 1} />
            <span style={{ fontSize: 9.5, color: '#334155', lineHeight: 1.3, flex: 1 }}>
              {t.name}
            </span>
            <span style={{ marginTop: 3 }}>{markDot(markFor(t.id))}</span>
          </div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div style={{ fontSize: 9.5, color: '#a3a3a3', padding: 6 }}>No steps.</div>
      )}
    </div>
  );
}

/** Expanded stage: the numbered L4 row, each card expandable into its L5 column. */
function StageExpansion({
  lane,
  stage,
  slot,
  laneCount,
  markFor,
}: {
  lane: Lane;
  stage: LaneStage;
  slot: StageSlot | null;
  laneCount: number;
  markFor: (taskId: string) => Mark;
}) {
  const [openSub, setOpenSub] = useState<string | null>(null);
  if (lane.blank || stage.subs.length === 0)
    return (
      <div
        style={{
          margin: '6px 0 10px',
          padding: '10px 14px',
          border: '1px dashed #dbe3ee',
          borderRadius: 10,
          fontSize: 10.5,
          color: '#94a3b8',
          background: '#fbfcfe',
        }}
      >
        No process defined for this product yet.
      </div>
    );
  return (
    <div style={{ margin: '6px 0 10px', paddingLeft: 6 }}>
      <div style={{ fontSize: 9.5, color: '#64748b', marginBottom: 6 }}>
        <b style={{ color: '#1e3a5f' }}>{stage.name}</b> — {stage.subs.length} sub-processes ·{' '}
        {stage.tasks.length} steps
        {slot && laneCount > 1 && (
          <>
            {' '}
            · phase in {slot.byLane.size}/{laneCount} flows
          </>
        )}
        <span style={{ color: '#a3a3a3' }}> — click a sub-process for its atomic steps</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {stage.subs.map((sub, i) => (
          <div key={sub.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
            {i > 0 && <HConnector />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: 180 }}>
              <MapCard
                onClick={() => setOpenSub(openSub === sub.id ? null : sub.id)}
                selected={openSub === sub.id}
                height={56}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <NumBadge n={i + 1} />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#171717',
                      lineHeight: 1.25,
                      textAlign: 'left',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {sub.name}
                  </span>
                  <span style={{ fontSize: 8.5, color: '#94a3b8' }}>{sub.tasks.length}</span>
                </span>
              </MapCard>
              {openSub === sub.id && (
                <>
                  <VConnector />
                  <TaskColumn tasks={sub.tasks} markFor={markFor} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VsStreamBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: streams, loading: listLoading, error: listError } = useStreamList();
  const [ids, setIds] = useState<string[]>([]);
  const [byProduct, setByProduct] = useState(false);
  /** Per lane: which stage slot is expanded (progressive drill, one at a time). */
  const [openStage, setOpenStage] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (streams && streams.length > 1 && ids.length === 0) setIds([streams[0].id, streams[1].id]);
  }, [streams, ids.length]);
  useEffect(() => setOpenStage({}), [ids.join(','), byProduct]);

  const { data: details, loading, error } = useStreamDetails(ids);
  const { data: productData } = useApi<{
    roots: { id: string; name: string; children: { id: string; name: string }[] }[];
  }>(byProduct ? '/product-spine/table' : null);
  const segments = useMemo(
    () =>
      (productData?.roots ?? []).flatMap((m) =>
        m.children.map((s) => ({ id: s.id, name: s.name, market: m.name })),
      ),
    [productData],
  );

  const pool: PoolOption[] = useMemo(
    () =>
      (streams ?? []).map((s) => ({
        id: s.id,
        label: s.name,
        group: s.domain ?? 'Other',
        hint: `${s.taskCount} tasks`,
      })),
    [streams],
  );

  const streamLanes: Lane[] = useMemo(() => {
    if (!details) return [];
    return ids
      .map((id) => details[id])
      .filter(Boolean)
      .map((d) => ({ id: d.id, title: d.name, subtitle: d.domain, stages: laneStages(d) }));
  }, [details, ids]);

  // Product sub-lanes are ordinary lanes — just more flows, blank for now.
  const lanesWithProducts: Lane[] = useMemo(() => {
    if (!byProduct) return streamLanes;
    return streamLanes.flatMap((lane) => [
      lane,
      ...segments.map((seg) => ({
        id: `${lane.id}:${seg.id}`,
        title: seg.name,
        subtitle: `${seg.market} · ${lane.title}`,
        stages: lane.stages.map((s) => ({ ...s, subs: [], tasks: [] })),
        blank: true,
        tone: '#3b5bdb',
      })),
    ]);
  }, [byProduct, streamLanes, segments]);

  const items: SpineItem[] = useMemo(
    () =>
      streamLanes.flatMap((l) =>
        l.stages.flatMap((s) =>
          s.tasks.map((t) => ({
            id: `${l.id}:${t.id}`,
            name: t.name,
            column: l.id,
            group: s.name,
          })),
        ),
      ),
    [streamLanes],
  );
  const cmp: SpineComparison = useMemo(() => compareSpineColumns(items), [items]);
  const slots = useMemo(
    () => alignStages(streamLanes.map((l) => ({ lane: l.id, stages: l.stages }))),
    [streamLanes],
  );
  const titleOf = (id: string) => streamLanes.find((l) => l.id === id)?.title ?? id;
  const grid = `${LANE_LABEL_W}px repeat(${slots.length}, ${SLOT_W}px)`;

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const renderLane = (lane: Lane) => {
    const sourceLaneId = lane.blank ? lane.id.split(':')[0] : lane.id;
    const openKey = openStage[lane.id] ?? null;
    const openSlot = slots.find((s) => s.key === openKey) ?? null;
    const openStageDef = openSlot
      ? (lane.stages.find((st) => st.id === openSlot.byLane.get(sourceLaneId)) ?? null)
      : null;
    return (
      <div key={lane.id} style={{ marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, alignItems: 'start' }}>
          <LaneChip
            title={lane.title}
            meta={
              lane.blank
                ? (lane.subtitle ?? undefined)
                : `${lane.subtitle ? `${lane.subtitle} · ` : ''}${lane.stages.reduce((n, s) => n + s.tasks.length, 0)} steps`
            }
            tone={lane.tone}
          />
          {slots.map((slot) => {
            const stageId = slot.byLane.get(sourceLaneId);
            const stage = stageId ? lane.stages.find((s) => s.id === stageId) : null;
            if (!stage)
              return (
                <MapCard key={slot.key} dimmed>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: '#b6c2d1',
                      lineHeight: 1.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {slot.label}
                  </span>
                  <span style={{ fontSize: 8.5, color: '#c3cedb' }}>not in this flow</span>
                </MapCard>
              );
            const shared = lane.blank
              ? 0
              : stage.tasks.filter((t) => cmp.markOf.get(`${lane.id}:${t.id}`) === 'shared').length;
            const dup = lane.blank
              ? 0
              : stage.tasks.filter((t) => cmp.markOf.get(`${lane.id}:${t.id}`) === 'dup').length;
            return (
              <MapCard
                key={slot.key}
                dimmed={lane.blank}
                selected={openKey === slot.key}
                onClick={() =>
                  setOpenStage((c) => ({ ...c, [lane.id]: openKey === slot.key ? null : slot.key }))
                }
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: lane.blank ? '#b6c2d1' : '#171717',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {stage.name}
                </span>
                <span style={{ fontSize: 8.5, color: lane.blank ? '#c3cedb' : '#94a3b8' }}>
                  {lane.blank ? 'no process yet' : `${stage.tasks.length} steps`}
                  {shared > 0 && <b style={{ color: INDIGO }}> · {shared}⇆</b>}
                  {dup > 0 && <b style={{ color: AMBER }}> · {dup}!</b>}
                </span>
              </MapCard>
            );
          })}
        </div>
        {openStageDef && openSlot && (
          <div style={{ display: 'grid', gridTemplateColumns: `${LANE_LABEL_W}px 1fr`, gap: 8 }}>
            <div />
            <StageExpansion
              lane={lane}
              stage={openStageDef}
              slot={openSlot}
              laneCount={streamLanes.length}
              markFor={(tid) => cmp.markOf.get(`${lane.id}:${tid}`)}
            />
          </div>
        )}
        {openKey && !openStageDef && lane.blank && openSlot && (
          <div style={{ display: 'grid', gridTemplateColumns: `${LANE_LABEL_W}px 1fr`, gap: 8 }}>
            <div />
            <div
              style={{
                margin: '6px 0 10px',
                padding: '10px 14px',
                border: '1px dashed #dbe3ee',
                borderRadius: 10,
                fontSize: 10.5,
                color: '#94a3b8',
                background: '#fbfcfe',
              }}
            >
              No process defined for this product yet.
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNewProcessLane = () => {
    const laneId = '__new__';
    const openKey = openStage[laneId] ?? null;
    return (
      <div
        style={{
          margin: '2px 0 10px',
          padding: '10px 0',
          background: 'rgba(236,253,245,.7)',
          borderRadius: 12,
          outline: '2px solid #a7f3d0',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, alignItems: 'start' }}>
          <LaneChip
            title="New process"
            meta={`normalized · ${cmp.normalized} steps`}
            tone="#047857"
          />
          {slots.map((slot) => {
            const steps = normalizedSteps(slot, streamLanes);
            return (
              <MapCard
                key={slot.key}
                tone="#bbe7cf"
                selected={openKey === slot.key}
                onClick={() =>
                  setOpenStage((c) => ({ ...c, [laneId]: openKey === slot.key ? null : slot.key }))
                }
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#14532d',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {slot.label}
                </span>
                <span style={{ fontSize: 8.5, color: '#4d7c60' }}>
                  {steps.length} normalized · {slot.byLane.size}/{streamLanes.length} flows
                </span>
              </MapCard>
            );
          })}
        </div>
        {openKey &&
          (() => {
            const slot = slots.find((s) => s.key === openKey);
            if (!slot) return null;
            const steps = normalizedSteps(slot, streamLanes);
            return (
              <div
                style={{ display: 'grid', gridTemplateColumns: `${LANE_LABEL_W}px 1fr`, gap: 8 }}
              >
                <div />
                <div style={{ margin: '6px 0 4px', paddingLeft: 6 }}>
                  <div style={{ fontSize: 9.5, color: '#4d7c60', marginBottom: 6 }}>
                    <b style={{ color: '#14532d' }}>{slot.label}</b> — {steps.length} normalized
                    steps · {steps.filter((s) => s.sources > 1).length} merged across flows
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 1100 }}>
                    {steps.map((s) => (
                      <div
                        key={s.key}
                        style={{
                          boxSizing: 'border-box',
                          padding: '6px 8px',
                          borderRadius: 10,
                          background: '#fff',
                          border: '1px solid #bbe7cf',
                          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 6,
                          width: 216,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            flexShrink: 0,
                            marginTop: 4,
                            background: s.sources > 1 ? INDIGO : '#86efac',
                          }}
                        />
                        <span style={{ fontSize: 9.5, color: '#14532d', lineHeight: 1.3, flex: 1 }}>
                          {s.name}
                        </span>
                        {s.sources > 1 && (
                          <span style={{ fontSize: 8.5, fontWeight: 800, color: INDIGO }}>
                            {s.sources}→1
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    );
  };

  const laneBlocks: React.ReactNode[] = [];
  lanesWithProducts.forEach((lane) => laneBlocks.push(renderLane(lane)));
  // NEW PROCESS lane renders LAST — every compared flow above feeds into it.
  if (streamLanes.length > 1) {
    laneBlocks.push(
      <div key="__feed__">
        <FeedArrow direction="down" />
        {renderNewProcessLane()}
      </div>,
    );
  } else if (streamLanes.length === 1) {
    laneBlocks.push(<div key="__new__">{renderNewProcessLane()}</div>);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 156px)',
        minHeight: 480,
      }}
    >
      <LensBar lens={lens} onLens={onLens} boards={[]} boardId={null} onBoard={() => undefined} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Picker noun="value stream" pool={pool} selectedIds={ids} onChangeSelection={setIds} />
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            color: '#525252',
            marginBottom: 10,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={byProduct}
            onChange={(e) => setByProduct(e.target.checked)}
          />
          By product
        </label>
        <span style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
          click a stage → its L4 sub-processes · click a sub-process → its L5 steps ·{' '}
          <b style={{ color: INDIGO }}>●</b> shared · <b style={{ color: AMBER }}>●</b> dup within ·{' '}
          <b style={{ color: '#93b7e0' }}>●</b> unique
        </span>
      </div>

      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          backgroundImage: 'radial-gradient(circle,#ececec 1px,transparent 1px)',
          backgroundSize: '24px 24px',
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {loading ? (
          <div style={{ padding: 30, fontSize: 12.5, color: '#a3a3a3' }}>Loading flows…</div>
        ) : streamLanes.length === 0 ? (
          <div style={{ padding: 30 }}>
            <EmptyState message="Pick at least two value streams to compare." />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 24,
              padding: 24,
              width: 'max-content',
            }}
          >
            <div>{laneBlocks}</div>
            <ConsolidationRail cmp={cmp} titleOf={titleOf} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Connector row: the compared flow feeds the new process. */
function FeedArrow({ direction }: { direction: 'down' | 'up' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 24,
        color: '#059669',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span style={{ width: 1, height: 12, background: '#86efac' }} />
      {direction === 'down' ? '▼' : '▲'}
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.05em' }}>
        FEEDS NEW PROCESS
      </span>
      {direction === 'down' ? '▼' : '▲'}
      <span style={{ width: 1, height: 12, background: '#86efac' }} />
    </div>
  );
}
