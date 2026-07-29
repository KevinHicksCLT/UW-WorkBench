import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { Picker, type PoolOption } from './SpineBoard';
import VsMapView from './VsMapView';
import VsCompareGrid, { type CompareLevel, type RailEntry } from './VsCompareGrid';
import { defaultDecision, type ReconDecision } from './VsNewProcessFlow';
import {
  alignStages,
  buildReconciliation,
  type ReconLaneInput,
  type ReconPhase,
  type ReconRow,
  type StageSlot,
} from './spineCompare';
import { useStreamDetails, useStreamList, type StreamDetail } from './useSpineData';

// Value-streams lens — compare ANY number of streams on pure process levels
// (L2 stream › L3 area › L4 sub-process › L5 task; no invented vocabulary).
// The MAP view shows each compared stream as its own lane; any number of L3
// areas expand at once (mirrored across lanes) and L4s expand further to
// their L5 tasks — browse the whole spine side by side. Comparison is the
// user's own act: hit Compare, then pick WHICH LEVEL to reconcile at with the
// L3/L4/L5 buttons. All live spine data.

export default function VsStreamBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: streams, loading: listLoading, error: listError } = useStreamList();
  const [ids, setIds] = useViewState<string[]>('workspace.vs.ids', []);
  const [mode, setMode] = useViewState<'map' | 'grid'>('workspace.vs.mode', 'map');
  const [level, setLevel] = useViewState<CompareLevel>('workspace.vs.level', '5');
  const [openSlots, setOpenSlots] = useViewState<string[]>('workspace.vs.openSlots', []);
  const [openSubs, setOpenSubs] = useViewState<string[]>('workspace.vs.openSubs', []);
  const [phaseKey, setPhaseKey] = useViewState<string | null>('workspace.vs.phase', null);
  const [subKey, setSubKey] = useViewState<string | null>('workspace.vs.sub', null);
  const [decisions, setDecisions] = useViewState<Record<string, ReconDecision>>(
    'workspace.vs.decisions',
    {},
  );

  useEffect(() => {
    if (streams && streams.length > 1 && ids.length < 2) setIds([streams[0].id, streams[1].id]);
  }, [streams, ids.length, setIds]);
  useOnChange(ids.join(','), () => {
    setMode('map');
    setOpenSlots([]);
    setOpenSubs([]);
    setPhaseKey(null);
    setSubKey(null);
    setDecisions({});
  });
  // Row keys and phase slots are level-specific — changing the compare level
  // resets the drill and the hand decisions.
  useOnChange(level, () => {
    setPhaseKey(null);
    setSubKey(null);
    setDecisions({});
  });

  const { data: details, loading, error } = useStreamDetails(ids);
  const lanes: StreamDetail[] = useMemo(
    () => ids.map((id) => details?.[id]).filter((d): d is StreamDetail => !!d),
    [details, ids],
  );
  const names = lanes.map((l) => l.name);

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

  // The map always shows the full L3→L4→L5 structure; the GRID reconciles at
  // the user-picked level. L5 compares tasks inside aligned L3 areas (the
  // original shape); L4 compares sub-processes inside aligned L3 areas; L3
  // compares the areas themselves in one shared slot.
  const mapInputs: ReconLaneInput[] = useMemo(
    () =>
      lanes.map((d) => ({
        id: d.id,
        stages: d.areas.map((ar) => ({ id: ar.id, name: ar.name, subs: ar.subs })),
      })),
    [lanes],
  );
  const gridInputs: ReconLaneInput[] = useMemo(() => {
    if (level === '5') return mapInputs;
    if (level === '4')
      return lanes.map((d) => ({
        id: d.id,
        stages: d.areas.map((ar) => ({
          id: ar.id,
          name: ar.name,
          subs: [
            {
              name: ar.name,
              tasks: ar.subs.map((s) => ({ id: s.id, name: s.name })),
            },
          ],
        })),
      }));
    return lanes.map((d) => ({
      id: d.id,
      stages: [
        {
          id: `${d.id}:structure`,
          name: 'All L3 areas',
          subs: [{ name: 'L3 areas', tasks: d.areas.map((a) => ({ id: a.id, name: a.name })) }],
        },
      ],
    }));
  }, [lanes, level, mapInputs]);

  const phases: ReconPhase[] = useMemo(
    () => (gridInputs.length >= 2 ? buildReconciliation(gridInputs) : []),
    [gridInputs],
  );
  const slots: StageSlot[] = useMemo(
    () =>
      mapInputs.length >= 2
        ? alignStages(mapInputs.map((l) => ({ lane: l.id, stages: l.stages })))
        : [],
    [mapInputs],
  );

  const phase = phaseKey ? (phases.find((p) => p.key === phaseKey) ?? null) : null;
  const gridPhase = phase ?? phases[0] ?? null;

  // Rail = the drilled area's canonical L4 sub-processes (L5 compare only):
  // every distinct sub name the area's rows reference, once, with row count.
  const rail: RailEntry[] = useMemo(() => {
    if (!gridPhase || level !== '5') return [];
    const seen = new Map<string, number>();
    for (const r of gridPhase.rows) {
      for (const c of r.cells) {
        if (!c) continue;
        seen.set(c.sub, (seen.get(c.sub) ?? 0) + 1);
        break; // one rail credit per row — the first carrying stream names it
      }
    }
    return [...seen.entries()].map(([label, count]) => ({ key: label, label, count }));
  }, [gridPhase, level]);

  const gridRows: ReconRow[] = useMemo(() => {
    if (!gridPhase) return [];
    if (!subKey || level !== '5') return gridPhase.rows;
    return gridPhase.rows.filter((r) => r.cells.some((c) => c && c.sub === subKey));
  }, [gridPhase, subKey, level]);

  const decisionOf = (row: ReconRow): ReconDecision => decisions[row.key] ?? defaultDecision(row);

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const shared = phases.reduce((n, p) => n + p.rows.filter((r) => r.presentIn > 1).length, 0);
  const total = phases.reduce((n, p) => n + p.rows.length, 0);
  const levelNoun = level === '3' ? 'L3 areas' : level === '4' ? 'L4 sub-processes' : 'L5 tasks';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Picker noun="value stream" pool={pool} selectedIds={ids} onChangeSelection={setIds} />
        <span style={{ width: 1, height: 18, background: '#eaeaea', margin: '0 2px 10px' }} />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            borderRadius: 9999,
            border: '1px solid #eaeaea',
            background: '#fff',
            padding: 2,
            marginBottom: 10,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          {(
            [
              ['map', 'Map'],
              ['grid', 'Compare'],
            ] as ['map' | 'grid', string][]
          ).map(([key, label]) => {
            const on = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                style={{
                  font: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 9999,
                  padding: '5px 13px',
                  fontSize: 12,
                  fontWeight: on ? 600 : 500,
                  background: on ? '#171717' : 'transparent',
                  color: on ? '#fff' : '#525252',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: '#525252', marginBottom: 10 }}>
          {mode === 'grid'
            ? `comparing ${levelNoun}: ${total} units of work · ${shared} shared across the ${names.length} streams`
            : `expand L3 areas and L4 sub-processes in place — the same level opens in every stream at once`}
        </span>
      </div>

      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          overflow: 'hidden',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading ? (
          <div style={{ padding: 24, fontSize: 12.5, color: '#737373' }}>Loading flows…</div>
        ) : lanes.length < 2 ? (
          <div style={{ padding: 24 }}>
            <EmptyState message="Pick at least two value streams to compare." />
          </div>
        ) : mode === 'map' ? (
          <VsMapView
            lanes={lanes}
            slots={slots}
            laneCount={lanes.length}
            openSlots={openSlots}
            onToggleSlot={(k) =>
              setOpenSlots((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
            }
            openSubs={openSubs}
            onToggleSub={(k) =>
              setOpenSubs((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
            }
          />
        ) : gridPhase ? (
          <VsCompareGrid
            level={level}
            onLevel={setLevel}
            phase={gridPhase}
            phases={phases}
            onPhase={(k) => {
              setPhaseKey(k);
              setSubKey(null);
            }}
            rail={rail}
            railKey={subKey}
            onRail={setSubKey}
            rows={gridRows}
            names={names}
            decisions={decisions}
            decisionOf={decisionOf}
            onDecide={(rowKey, d) => setDecisions((c) => ({ ...c, [rowKey]: d }))}
            onBackToMap={() => setMode('map')}
          />
        ) : (
          <div style={{ padding: 24 }}>
            <EmptyState message="No aligned L3 areas between these streams yet." />
          </div>
        )}
      </div>
    </div>
  );
}
