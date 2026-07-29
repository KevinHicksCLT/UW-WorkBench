import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useDialogs } from '../../../lib/dialogs';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import ImpactPanel from '../impact/ImpactPanel';
import { useImpactGate } from '../impact/useImpactGate';
import { Picker, type PoolOption } from './SpineBoard';
import VsMapView from './VsMapView';
import VsCompareBoard, { type CompareLevel } from './VsCompareBoard';
import { payloadToItem } from './VsBuilderPanel';
import { type BuilderItem, type DragPayload } from './processBuilder';
import { alignStages, type StageSlot } from './spineCompare';
import { useStreamDetails, useStreamList, useTaskSteps, type StreamDetail } from './useSpineData';

// Value-streams lens — compare ANY number of streams on pure process levels
// (Process level 2 stream › 3 › 4 › 5 task › 6 Work Library step). The MAP
// browses the spines side by side, expanding any number of PL3s at once and
// drilling PL4 → PL5 → PL6 in place. COMPARE is the process editor: columns
// of sequential cards at the chosen level, russian-doll nesting into lower
// levels, and the drag-and-drop new-value-stream builder with a realtime
// flow. Both views feed the same builder; promoting routes through the
// common change-impact gate.

export default function VsStreamBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const dialogs = useDialogs();
  const { data: streams, loading: listLoading, error: listError } = useStreamList();
  const [ids, setIds] = useViewState<string[]>('workspace.vs.ids', []);
  const [mode, setMode] = useViewState<'map' | 'grid'>('workspace.vs.mode', 'map');
  const [level, setLevel] = useViewState<CompareLevel>('workspace.vs.level', '5');
  const [openSlots, setOpenSlots] = useViewState<string[]>('workspace.vs.openSlots', []);
  const [openSubs, setOpenSubs] = useViewState<string[]>('workspace.vs.openSubs', []);
  const [openTasks, setOpenTasks] = useViewState<string[]>('workspace.vs.openTasks', []);
  const [builder, setBuilder] = useViewState<BuilderItem[]>('workspace.vs.builder', []);
  const { load: loadSteps, stepsOf } = useTaskSteps();

  useEffect(() => {
    if (streams && streams.length > 1 && ids.length < 2) setIds([streams[0].id, streams[1].id]);
  }, [streams, ids.length, setIds]);
  useOnChange(ids.join(','), () => {
    setMode('map');
    setOpenSlots([]);
    setOpenSubs([]);
    setOpenTasks([]);
    setBuilder([]);
  });

  const { data: details, loading, error } = useStreamDetails(ids);
  const lanes: StreamDetail[] = useMemo(
    () => ids.map((id) => details?.[id]).filter((d): d is StreamDetail => !!d),
    [details, ids],
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

  const slots: StageSlot[] = useMemo(
    () =>
      lanes.length >= 2
        ? alignStages(
            lanes.map((d) => ({
              lane: d.id,
              stages: d.areas.map((a) => ({ id: a.id, name: a.name })),
            })),
          )
        : [],
    [lanes],
  );

  const addToBuilder = (p: DragPayload) => setBuilder((cur) => [...cur, payloadToItem(p)]);

  // Promoting the composed process routes through the common change-impact
  // gate: every builder item's real ProcessNode ids are assessed against the
  // live graph before the promotion summary shows.
  const gate = useImpactGate();
  const promote = () => {
    const nodeIds = [...new Set(builder.flatMap((b) => b.nodeIds))];
    const agentRun = builder.filter((b) => b.agent).length;
    const summarize = () =>
      dialogs.alert({
        title: 'Promote new value stream',
        message: `${builder.length} steps composed from ${new Set(builder.map((b) => b.source)).size} streams — ${agentRun} run agent-only. Promotion into the live spine is decision-preview only in this workspace; export the builder to take it forward.`,
      });
    if (!nodeIds.length) return summarize();
    gate.run(
      {
        changeType: 'MERGE',
        label: 'New value stream',
        subject: { kind: 'process-nodes', nodeIds },
      },
      summarize,
    );
  };

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
            ? 'click cards to nest deeper · drag into the builder to compose the new process'
            : 'expand process levels in place — every stream opens together, down to level 6'}
        </span>
        {builder.length > 0 && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: '#047857',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 999,
              padding: '2px 10px',
              marginBottom: 10,
            }}
          >
            new process: {builder.length} steps
          </span>
        )}
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
            openTasks={openTasks}
            onToggleTask={(id) => {
              setOpenTasks((cur) =>
                cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
              );
              loadSteps([id]);
            }}
            stepsOf={stepsOf}
            onAdd={addToBuilder}
          />
        ) : (
          <VsCompareBoard
            lanes={lanes}
            level={level}
            onLevel={setLevel}
            items={builder}
            onItemsChange={setBuilder}
            onPromote={promote}
            onAdd={addToBuilder}
            stepsOf={stepsOf}
            loadSteps={loadSteps}
            onBackToMap={() => setMode('map')}
          />
        )}
      </div>
      <ImpactPanel gate={gate} />
    </div>
  );
}
