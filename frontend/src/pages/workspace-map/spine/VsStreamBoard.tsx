import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { Picker, type PoolOption } from './SpineBoard';
import VsMapView from './VsMapView';
import VsCompareGrid, { type RailEntry } from './VsCompareGrid';
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

// Value-streams lens — the map at the top, the grid underneath: compare ANY
// number of streams. The MAP view shows each compared stream as its own lane
// (L2 chip → real L3 phases → drill a phase into its real L4s, nothing
// repeated) with a k/N badge saying how many streams carry the same work.
// Clicking an L4 hands off to the COMPARE GRID: sub-process rail, canonical
// L5 tasks once each, one column per stream, merge/keep/drop per row, and the
// normalized new-process flow. All live spine data.

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
        hint: `${s.taskCount} steps`,
      })),
    [streams],
  );

  const laneInputs: ReconLaneInput[] = useMemo(
    () =>
      lanes.map((d) => ({
        id: d.id,
        stages: d.areas.map((ar) => ({ id: ar.id, name: ar.name, subs: ar.subs })),
      })),
    [lanes],
  );
  const phases: ReconPhase[] = useMemo(
    () => (laneInputs.length >= 2 ? buildReconciliation(laneInputs) : []),
    [laneInputs],
  );
  const slots: StageSlot[] = useMemo(
    () =>
      laneInputs.length >= 2
        ? alignStages(laneInputs.map((l) => ({ lane: l.id, stages: l.stages })))
        : [],
    [laneInputs],
  );

  const phase = phaseKey ? (phases.find((p) => p.key === phaseKey) ?? null) : null;
  const gridPhase = phase ?? phases[0] ?? null;

  // Rail = the drilled phase's canonical L4 sub-processes: every distinct sub
  // name the phase's rows reference, once, with its row count.
  const rail: RailEntry[] = useMemo(() => {
    if (!gridPhase) return [];
    const seen = new Map<string, number>();
    for (const r of gridPhase.rows) {
      for (const c of r.cells) {
        if (!c) continue;
        seen.set(c.sub, (seen.get(c.sub) ?? 0) + 1);
        break; // one rail credit per row — the first carrying stream names it
      }
    }
    return [...seen.entries()].map(([label, count]) => ({ key: label, label, count }));
  }, [gridPhase]);

  const gridRows: ReconRow[] = useMemo(() => {
    if (!gridPhase) return [];
    if (!subKey) return gridPhase.rows;
    return gridPhase.rows.filter((r) => r.cells.some((c) => c && c.sub === subKey));
  }, [gridPhase, subKey]);

  const decisionOf = (row: ReconRow): ReconDecision => decisions[row.key] ?? defaultDecision(row);

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const shared = phases.reduce((n, p) => n + p.rows.filter((r) => r.presentIn > 1).length, 0);
  const total = phases.reduce((n, p) => n + p.rows.length, 0);

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
          {total} units of work · <b style={{ color: '#4338ca' }}>{shared}</b> shared across streams
          · badges show in how many of the {names.length} streams the same work exists
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
            openPhase={phaseKey}
            onTogglePhase={(k) => {
              setPhaseKey(k);
              setSubKey(null);
            }}
            onOpenGrid={(k) => {
              setPhaseKey(k);
              setSubKey(null);
              setMode('grid');
            }}
          />
        ) : gridPhase ? (
          <VsCompareGrid
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
            <EmptyState message="No aligned phases between these streams yet." />
          </div>
        )}
      </div>
    </div>
  );
}
