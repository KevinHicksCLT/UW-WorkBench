import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, INDIGO } from '../types';
import { Picker, ConsolidationRail, type PoolOption } from './SpineBoard';
import {
  alignStages,
  compareSpineColumns,
  type SpineComparison,
  type SpineItem,
  type StageSlot,
} from './spineCompare';
import { useStreamDetails, useStreamList, type StreamDetail } from './useSpineData';

// Value-streams lens, MAP-STYLE: every picked value stream renders as one
// HORIZONTAL FLOW LANE of stage chevrons (its real L3 areas / L4 sub-processes
// in flow order). Semantically-similar stages align into the same vertical
// slot, so the flows read top-to-bottom: a filled column = the phase exists in
// both flows, a gap = one flow lacks it. Chevron badges surface shared /
// internal-dup steps; clicking an aligned phase opens a per-flow task diff.

interface LaneStage {
  id: string;
  name: string;
  tasks: { id: string; name: string }[];
}

interface Lane {
  id: string;
  title: string;
  subtitle: string | null;
  stages: LaneStage[];
}

const LANE_LABEL_W = 190;
const SLOT_W = 232;

function laneStages(d: StreamDetail, level: 'L3' | 'L4'): LaneStage[] {
  if (level === 'L3')
    return d.areas.map((a) => ({
      id: a.id,
      name: a.name,
      tasks: a.subs.flatMap((s) => s.tasks),
    }));
  return d.areas.flatMap((a) => a.subs.map((s) => ({ id: s.id, name: s.name, tasks: s.tasks })));
}

/** One stage chevron — arrow-shaped card carrying its overlap badges. */
function StageChevron({
  stage,
  cmp,
  laneId,
  selected,
  onSelect,
}: {
  stage: LaneStage;
  cmp: SpineComparison;
  laneId: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const shared = stage.tasks.filter((t) => cmp.markOf.get(`${laneId}:${t.id}`) === 'shared').length;
  const dup = stage.tasks.filter((t) => cmp.markOf.get(`${laneId}:${t.id}`) === 'dup').length;
  const tone = shared > 0 ? INDIGO : dup > 0 ? AMBER : '#94a3b8';
  const bg = shared > 0 ? '#eef2ff' : dup > 0 ? '#fffbeb' : '#f8fafc';
  return (
    <button
      type="button"
      onClick={onSelect}
      title={stage.name}
      style={{
        width: '100%',
        height: 62,
        border: 'none',
        cursor: 'pointer',
        font: 'inherit',
        textAlign: 'left',
        padding: '6px 20px 6px 14px',
        boxSizing: 'border-box',
        background: selected ? '#171717' : bg,
        color: selected ? '#fff' : '#171717',
        clipPath:
          'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 10px 50%)',
        outline: selected ? 'none' : `1px solid ${tone}33`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {stage.name}
      </span>
      <span
        style={{ fontSize: 9.5, color: selected ? '#d4d4d4' : '#64748b', whiteSpace: 'nowrap' }}
      >
        {stage.tasks.length} steps
        {shared > 0 && <b style={{ color: selected ? '#c7d2fe' : INDIGO }}> · {shared} shared</b>}
        {dup > 0 && <b style={{ color: selected ? '#fde68a' : AMBER }}> · {dup} dup</b>}
      </span>
    </button>
  );
}

/** Per-phase task diff: the selected slot's tasks side by side per flow, with
 *  shared/unique verdicts scoped to that phase. */
function PhaseDiff({
  slot,
  lanes,
  onClose,
}: {
  slot: StageSlot;
  lanes: Lane[];
  onClose: () => void;
}) {
  const involved = lanes.filter((l) => slot.byLane.has(l.id));
  const items: SpineItem[] = involved.flatMap((l) => {
    const stage = l.stages.find((s) => s.id === slot.byLane.get(l.id));
    return (stage?.tasks ?? []).map((t) => ({
      id: `${l.id}:${t.id}`,
      name: t.name,
      column: l.id,
      group: slot.label,
    }));
  });
  const cmp = useMemo(() => compareSpineColumns(items), [items]);
  return (
    <div
      style={{
        border: `1px solid #e2e8f0`,
        borderTop: `3px solid ${INDIGO}`,
        borderRadius: 12,
        background: '#fff',
        padding: 14,
        margin: '12px 0 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{slot.label}</span>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          phase diff · {cmp.current} steps → {cmp.normalized} normalized ·{' '}
          <b style={{ color: INDIGO }}>{cmp.shared.length} shared</b> across {involved.length} flow
          {involved.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close phase diff"
          style={{
            marginLeft: 'auto',
            border: 'none',
            background: 'transparent',
            color: '#a3a3a3',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto' }}>
        {involved.map((l) => {
          const stage = l.stages.find((s) => s.id === slot.byLane.get(l.id));
          return (
            <div key={l.id} style={{ width: 320, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#525252', marginBottom: 4 }}>
                {l.title} <span style={{ color: '#a3a3a3', fontWeight: 400 }}>· {stage?.name}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  maxHeight: 300,
                  overflowY: 'auto',
                }}
              >
                {(stage?.tasks ?? []).map((t) => {
                  const mark = cmp.markOf.get(`${l.id}:${t.id}`);
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          flexShrink: 0,
                          alignSelf: 'center',
                          background:
                            mark === 'shared' ? INDIGO : mark === 'dup' ? AMBER : '#cbd5e1',
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#171717' }}>{t.name}</span>
                      {mark === 'shared' && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: INDIGO }}>shared</span>
                      )}
                      {mark === 'dup' && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: AMBER }}>dup</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
  const [level, setLevel] = useState<'L3' | 'L4'>('L3');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    if (streams && streams.length > 1 && ids.length === 0) {
      setIds([streams[0].id, streams[1].id]);
    }
  }, [streams, ids.length]);
  useEffect(() => setSelectedSlot(null), [ids.join(','), level]);

  const { data: details, loading, error } = useStreamDetails(ids);

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
      .map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: d.domain,
        stages: laneStages(d, level),
      }));
  }, [details, ids, level]);

  // Task-level comparison across the whole picked set (drives badges + rail).
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
  const cmp = useMemo(() => compareSpineColumns(items), [items]);

  // Stage alignment: similar phases share one vertical slot across the lanes.
  const slots = useMemo(
    () => alignStages(lanes.map((l) => ({ lane: l.id, stages: l.stages }))),
    [lanes],
  );
  const slot = slots.find((s) => s.key === selectedSlot) ?? null;
  const titleOf = (id: string) => lanes.find((l) => l.id === id)?.title ?? id;

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

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
            gap: 6,
            fontSize: 12,
            color: '#525252',
            marginBottom: 10,
          }}
        >
          Flow stages
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as 'L3' | 'L4')}
            aria-label="Stage level"
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
              background: '#fff',
            }}
          >
            <option value="L3">L3 process areas</option>
            <option value="L4">L4 sub-processes</option>
          </select>
        </label>
        <span style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
          <b style={{ color: INDIGO }}>■</b> shared across flows · <b style={{ color: AMBER }}>■</b>{' '}
          duplicated within · aligned columns = same phase · gap = missing in that flow
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
              {/* Slot header row — the aligned phases across every flow. */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${LANE_LABEL_W}px repeat(${slots.length}, ${SLOT_W}px)`,
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div />
                {slots.map((s) => {
                  const inAll = s.byLane.size === lanes.length;
                  return (
                    <div
                      key={s.key}
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        color: inAll ? INDIGO : s.byLane.size > 1 ? '#475569' : '#94a3b8',
                        padding: '2px 6px',
                        borderBottom: `2px solid ${inAll ? '#c7d2fe' : '#e2e8f0'}`,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={s.label}
                    >
                      {s.label}
                      <span style={{ fontWeight: 600, color: '#a3a3a3' }}>
                        {' '}
                        {s.byLane.size}/{lanes.length}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* One horizontal flow lane per stream. */}
              {lanes.map((lane) => (
                <div
                  key={lane.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `${LANE_LABEL_W}px repeat(${slots.length}, ${SLOT_W}px)`,
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ paddingRight: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                      {lane.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#a3a3a3' }}>
                      {lane.subtitle ? `${lane.subtitle} · ` : ''}
                      {lane.stages.reduce((n, s) => n + s.tasks.length, 0)} steps
                    </div>
                  </div>
                  {slots.map((s) => {
                    const stageId = s.byLane.get(lane.id);
                    const stage = stageId ? lane.stages.find((st) => st.id === stageId) : null;
                    return stage ? (
                      <StageChevron
                        key={s.key}
                        stage={stage}
                        cmp={cmp}
                        laneId={lane.id}
                        selected={selectedSlot === s.key}
                        onSelect={() => setSelectedSlot(selectedSlot === s.key ? null : s.key)}
                      />
                    ) : (
                      <div
                        key={s.key}
                        style={{
                          height: 62,
                          border: '1px dashed #e2e8f0',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9.5,
                          color: '#cbd5e1',
                          boxSizing: 'border-box',
                        }}
                      >
                        not in this flow
                      </div>
                    );
                  })}
                </div>
              ))}
              {slot && (
                <PhaseDiff slot={slot} lanes={lanes} onClose={() => setSelectedSlot(null)} />
              )}
            </div>
            <ConsolidationRail cmp={cmp} titleOf={titleOf} />
          </div>
        )}
      </div>
    </div>
  );
}
