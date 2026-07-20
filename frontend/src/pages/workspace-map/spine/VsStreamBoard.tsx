import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useApi } from '../../../lib/useApi';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, GREEN, INDIGO } from '../types';
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

// Value-streams lens, MAP-STYLE (mirrors the Value Streams map view):
// every picked stream is one HORIZONTAL FLOW LANE — its real L3 stages as
// chevrons, and under each chevron the map's card language: one card per L4
// sub-process listing its L5 atomic steps. A computed NEW PROCESS lane sits
// BETWEEN the compared streams (both flows feed it — arrows in), carrying the
// normalized flow: aligned stages, shared steps once, uniques carried over.
// The By-product toggle fans each stream into per-product sub-lanes (stages
// only — blank until per-product processes exist) and collapses step detail.

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
}

const LANE_LABEL_W = 150;
const SLOT_W = 236;

function laneStages(d: StreamDetail): LaneStage[] {
  return d.areas.map((a) => ({
    id: a.id,
    name: a.name,
    subs: a.subs,
    tasks: a.subs.flatMap((s) => s.tasks),
  }));
}

const markDot = (mark: 'shared' | 'dup' | 'unique' | undefined) => (
  <span
    style={{
      width: 6,
      height: 6,
      borderRadius: 999,
      flexShrink: 0,
      marginTop: 4,
      background: mark === 'shared' ? INDIGO : mark === 'dup' ? AMBER : '#93b7e0',
    }}
  />
);

/** Chevron stage header — same shape as the map's stage chevrons. */
function Chevron({
  label,
  meta,
  tone,
  dimmed,
  selected,
  onClick,
}: {
  label: string;
  meta?: string;
  tone?: string;
  dimmed?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={label}
      style={{
        width: '100%',
        height: 46,
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        font: 'inherit',
        textAlign: 'left',
        padding: '5px 18px 5px 14px',
        boxSizing: 'border-box',
        background: selected ? '#171717' : dimmed ? '#f5f7fa' : (tone ?? '#eef4fb'),
        color: selected ? '#fff' : dimmed ? '#b6c2d1' : '#1e3a5f',
        clipPath:
          'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 9px 50%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      {meta && (
        <span style={{ fontSize: 9, color: selected ? '#d4d4d4' : dimmed ? '#c3cedb' : '#64748b' }}>
          {meta}
        </span>
      )}
    </button>
  );
}

/** Map-language L4 card: header + its L5 step rows. */
function SubProcessCard({
  name,
  tasks,
  markFor,
}: {
  name: string;
  tasks: { id: string; name: string }[];
  markFor: (taskId: string) => 'shared' | 'dup' | 'unique' | undefined;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #dbe6f5',
        borderRadius: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,.05)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid #edf2fa',
          background: '#f8fbff',
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: '#e3eefc',
            border: '1px solid #c8dcf5',
            color: '#2563eb',
            fontSize: 9,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          ▤
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#1e293b',
            flex: 1,
            minWidth: 0,
            lineHeight: 1.2,
          }}
        >
          {name}
        </span>
        <span style={{ fontSize: 9, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
          {tasks.length}
        </span>
      </div>
      <div style={{ padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {tasks.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            {markDot(markFor(t.id))}
            <span style={{ fontSize: 9.5, color: '#334155', lineHeight: 1.3 }}>{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
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

/** Normalized (new process) steps for one aligned slot. */
function normalizedSteps(
  slot: StageSlot,
  lanes: Lane[],
): { key: string; name: string; sources: number }[] {
  const byKey = new Map<string, { name: string; sources: Set<string> }>();
  for (const lane of lanes) {
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
  return [...byKey.entries()].map(([key, v]) => ({
    key,
    name: v.name,
    sources: v.sources.size,
  }));
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
        height: 26,
        color: GREEN,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span style={{ width: 1, height: 14, background: '#86efac' }} />
      {direction === 'down' ? '▼' : '▲'}
      <span style={{ fontSize: 9.5, color: '#059669', fontWeight: 600, letterSpacing: '.05em' }}>
        FEEDS NEW PROCESS
      </span>
      {direction === 'down' ? '▼' : '▲'}
      <span style={{ width: 1, height: 14, background: '#86efac' }} />
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
  const [detail, setDetail] = useState<'auto' | 'stages' | 'full'>('auto');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    if (streams && streams.length > 1 && ids.length === 0) setIds([streams[0].id, streams[1].id]);
  }, [streams, ids.length]);
  useEffect(() => setSelectedSlot(null), [ids.join(','), byProduct]);

  const { data: details, loading, error } = useStreamDetails(ids);
  // Product segments for the By-product view (market › segment spine, L2).
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

  const lanes: Lane[] = useMemo(() => {
    if (!details) return [];
    return ids
      .map((id) => details[id])
      .filter(Boolean)
      .map((d) => ({ id: d.id, title: d.name, subtitle: d.domain, stages: laneStages(d) }));
  }, [details, ids]);

  const items: SpineItem[] = useMemo(
    () =>
      lanes.flatMap((l) =>
        l.stages.flatMap((s) =>
          s.tasks.map((t) => ({
            id: `${l.id}:${t.id}`,
            name: t.name,
            column: l.id,
            group: s.name,
          })),
        ),
      ),
    [lanes],
  );
  const cmp: SpineComparison = useMemo(() => compareSpineColumns(items), [items]);
  const slots = useMemo(
    () => alignStages(lanes.map((l) => ({ lane: l.id, stages: l.stages }))),
    [lanes],
  );
  const titleOf = (id: string) => lanes.find((l) => l.id === id)?.title ?? id;

  // Detail level: full L4+L5 cards for a 2-stream compare, stages-only beyond
  // that (or whenever By-product is on) — flip manually with the Detail toggle.
  const showDetail = !byProduct && (detail === 'full' || (detail === 'auto' && lanes.length <= 2));
  const grid = `${LANE_LABEL_W}px repeat(${slots.length}, ${SLOT_W}px)`;
  // The NEW PROCESS lane sits between the flows (after the first lane).
  const newProcessAt = Math.min(1, Math.max(0, lanes.length - 1));

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const renderStreamLane = (lane: Lane) => (
    <div
      key={lane.id}
      style={{
        display: 'grid',
        gridTemplateColumns: grid,
        gap: 8,
        alignItems: 'start',
        marginBottom: 4,
      }}
    >
      <LaneChip
        title={lane.title}
        meta={`${lane.subtitle ? `${lane.subtitle} · ` : ''}${lane.stages.reduce((n, s) => n + s.tasks.length, 0)} steps`}
      />
      {slots.map((slot) => {
        const stageId = slot.byLane.get(lane.id);
        const stage = stageId ? lane.stages.find((s) => s.id === stageId) : null;
        if (!stage)
          return (
            <div key={slot.key}>
              <Chevron label={slot.label} meta="not applicable" dimmed />
            </div>
          );
        const shared = stage.tasks.filter(
          (t) => cmp.markOf.get(`${lane.id}:${t.id}`) === 'shared',
        ).length;
        const dup = stage.tasks.filter(
          (t) => cmp.markOf.get(`${lane.id}:${t.id}`) === 'dup',
        ).length;
        return (
          <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Chevron
              label={stage.name}
              meta={`${stage.tasks.length} steps${shared ? ` · ${shared} shared` : ''}${dup ? ` · ${dup} dup` : ''}`}
              selected={selectedSlot === slot.key}
              onClick={() => setSelectedSlot(selectedSlot === slot.key ? null : slot.key)}
            />
            {showDetail && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 340,
                  overflowY: 'auto',
                }}
              >
                {stage.subs.map((sub) => (
                  <SubProcessCard
                    key={sub.id}
                    name={sub.name}
                    tasks={sub.tasks}
                    markFor={(tid) => cmp.markOf.get(`${lane.id}:${tid}`)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderProductLanes = (lane: Lane) =>
    segments.map((seg) => (
      <div
        key={`${lane.id}:${seg.id}`}
        style={{
          display: 'grid',
          gridTemplateColumns: grid,
          gap: 8,
          alignItems: 'start',
          marginBottom: 4,
        }}
      >
        <LaneChip title={seg.name} meta={`${seg.market} · ${lane.title}`} tone="#3b5bdb" />
        {slots.map((slot) => (
          <div key={slot.key}>
            <Chevron label={slot.label} meta="no process for this product yet" dimmed />
          </div>
        ))}
      </div>
    ));

  const renderNewProcessLane = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: grid,
        gap: 8,
        alignItems: 'start',
        margin: '2px 0',
        padding: '8px 0',
        background: 'rgba(236,253,245,.7)',
        borderRadius: 12,
        outline: '2px solid #a7f3d0',
      }}
    >
      <LaneChip title="New process" meta={`normalized · ${cmp.normalized} steps`} tone="#047857" />
      {slots.map((slot) => {
        const steps = normalizedSteps(slot, lanes);
        return (
          <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Chevron
              label={slot.label}
              meta={`${steps.length} normalized · in ${slot.byLane.size}/${lanes.length} flows`}
              tone="#d9f5e7"
              selected={selectedSlot === slot.key}
              onClick={() => setSelectedSlot(selectedSlot === slot.key ? null : slot.key)}
            />
            {showDetail && (
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #bbe7cf',
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,.05)',
                  padding: '6px 8px',
                  maxHeight: 340,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {steps.map((s) => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
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
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          color: INDIGO,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.sources}→1
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

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
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#525252',
            marginBottom: 10,
          }}
        >
          Detail
          <select
            value={detail}
            onChange={(e) => setDetail(e.target.value as 'auto' | 'stages' | 'full')}
            aria-label="Detail level"
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
              background: '#fff',
            }}
          >
            <option value="auto">Auto</option>
            <option value="stages">Stages only</option>
            <option value="full">Full L4 + L5</option>
          </select>
        </label>
        <span style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
          <b style={{ color: INDIGO }}>●</b> shared · <b style={{ color: AMBER }}>●</b> dup within ·{' '}
          <b style={{ color: '#93b7e0' }}>●</b> unique — L5 atomic steps
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
        ) : lanes.length === 0 ? (
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
            <div>
              {lanes.map((lane, i) => (
                <div key={lane.id}>
                  {renderStreamLane(lane)}
                  {byProduct && renderProductLanes(lane)}
                  {i === newProcessAt - 1 && lanes.length > 1 && (
                    <>
                      <FeedArrow direction="down" />
                      {renderNewProcessLane()}
                      <FeedArrow direction="up" />
                    </>
                  )}
                </div>
              ))}
              {lanes.length === 1 && renderNewProcessLane()}
              {selectedSlot && (
                <PhaseNote slot={slots.find((s) => s.key === selectedSlot) ?? null} lanes={lanes} />
              )}
            </div>
            <ConsolidationRail cmp={cmp} titleOf={titleOf} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Slot summary under the lanes when a phase chevron is selected. */
function PhaseNote({ slot, lanes }: { slot: StageSlot | null; lanes: Lane[] }) {
  if (!slot) return null;
  const involved = lanes.filter((l) => slot.byLane.has(l.id));
  const steps = normalizedSteps(slot, lanes);
  const merged = steps.filter((s) => s.sources > 1).length;
  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid #e2e8f0',
        borderLeft: `3px solid ${INDIGO}`,
        borderRadius: 10,
        background: '#fff',
        padding: '8px 12px',
        fontSize: 11.5,
        color: '#334155',
      }}
    >
      <b>{slot.label}</b> — in {involved.length}/{lanes.length} flows · {steps.length} normalized
      steps · <b style={{ color: INDIGO }}>{merged} merge across flows</b> · {steps.length - merged}{' '}
      carry over from a single flow
    </div>
  );
}
