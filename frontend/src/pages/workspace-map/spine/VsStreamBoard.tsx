import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorMessage, LoadingState, Select } from '../../../components/ui';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, GREEN, INDIGO } from '../types';
import VsNewProcessFlow, {
  STREAM_BGS,
  STREAM_TONES,
  defaultDecision,
  type ReconDecision,
} from './VsNewProcessFlow';
import {
  alignStages,
  buildReconciliation,
  type ReconPhase,
  type ReconRow,
  type StageSlot,
} from './spineCompare';
import { useStreamDetails, useStreamList, type StreamDetail } from './useSpineData';

// Value-streams lens — phase-by-level reconciliation, the same progressive
// drill as the rest of the app: pick two streams (L2), land on their aligned
// PHASES (L3), drill a phase into its aligned SUB-PROCESSES (L4), drill a
// sub-process into the atomic STEP reconciliation table (L5) where the
// verdicts and decisions live and the normalized new-process flow closes the
// view. Breadcrumb pops back up. Everything derives live from the spine.

const VERDICT_META: Record<ReconRow['verdict'], { fg: string; bg: string; border: string }> = {
  merge: { fg: INDIGO, bg: '#eef2ff', border: '#d6dcff' },
  order: { fg: AMBER, bg: '#fffbeb', border: '#fde68a' },
  onlyA: { fg: STREAM_TONES[0], bg: STREAM_BGS[0], border: '#99f6e4' },
  onlyB: { fg: STREAM_TONES[1], bg: STREAM_BGS[1], border: '#ddd6fe' },
};

function verdictLabel(row: ReconRow, names: [string, string]): { label: string; note: string } {
  if (row.verdict === 'merge')
    return { label: 'MERGE 2→1', note: 'same work, same point in the flow' };
  if (row.verdict === 'order')
    return {
      label: 'MERGE · ORDER DIFFERS',
      note: `step #${row.a?.seq ?? '?'} here, #${row.b?.seq ?? '?'} there`,
    };
  if (row.verdict === 'onlyA')
    return { label: `ONLY ${names[0].toUpperCase()}`, note: 'carry over 1→1' };
  return { label: `ONLY ${names[1].toUpperCase()}`, note: 'carry over 1→1' };
}

type ShowFilter = 'all' | 'diff' | 'merge' | 'solo';

const STEP_GRID = '30px minmax(220px,1fr) 290px 290px 180px 160px';
const LEVEL_GRID = '30px minmax(220px,1fr) 290px 290px 220px 90px';

function VerdictPill({
  fg,
  bg,
  border,
  label,
  note,
}: {
  fg: string;
  bg: string;
  border: string;
  label: string;
  note?: string;
}) {
  return (
    <div>
      <span
        style={{
          display: 'inline-block',
          fontSize: 9.5,
          fontWeight: 700,
          color: fg,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 6,
          padding: '2px 7px',
        }}
      >
        {label}
      </span>
      {note && <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function StreamCell({ step, tone }: { step: ReconRow['a']; tone: string }) {
  if (!step) return <span style={{ fontSize: 10.5, color: '#cbd5e1' }}>— not in this stream</span>;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: tone,
          color: '#fff',
          fontSize: 9,
          fontWeight: 800,
          lineHeight: '16px',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {step.seq}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, lineHeight: 1.3, color: '#334155' }}>{step.name}</div>
        <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>
          {[step.owner, step.apps.join(' · ')].filter(Boolean).join(' · ') || step.sub}
        </div>
      </div>
    </div>
  );
}

/** A drill-level cell: the stream's own node at this level (or a gap). */
function LevelCell({ name, meta, tone }: { name: string | null; meta: string; tone: string }) {
  if (!name) return <span style={{ fontSize: 10.5, color: '#cbd5e1' }}>— not in this stream</span>;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, color: '#171717' }}>
        <span style={{ color: tone }}>●</span> {name}
      </div>
      <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>{meta}</div>
    </div>
  );
}

function DecisionButtons({
  chosen,
  onPick,
}: {
  chosen: ReconDecision;
  onPick: (d: ReconDecision) => void;
}) {
  const options: ReconDecision[] = ['Merge', 'Keep', 'Drop'];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((label) => {
        const on = chosen === label;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onPick(label)}
            style={{
              font: 'inherit',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 5,
              padding: '2px 7px',
              color: on ? '#fff' : '#525252',
              background: on
                ? label === 'Drop'
                  ? '#dc2626'
                  : label === 'Merge'
                    ? GREEN
                    : '#525252'
                : '#fff',
              border: `1px solid ${on ? 'transparent' : '#e5e5e5'}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface SubSlot {
  key: string;
  label: string;
  a: { name: string; steps: number } | null;
  b: { name: string; steps: number } | null;
}

export default function VsStreamBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: streams, loading: listLoading, error: listError } = useStreamList();
  const [ids, setIds] = useViewState<string[]>('workspace.vs.ids', []);
  const [phaseKey, setPhaseKey] = useViewState<string | null>('workspace.vs.phase', null);
  const [subKey, setSubKey] = useViewState<string | null>('workspace.vs.sub', null);
  const [filter, setFilter] = useViewState<ShowFilter>('workspace.vs.filter', 'all');
  const [decisions, setDecisions] = useViewState<Record<string, ReconDecision>>(
    'workspace.vs.decisions',
    {},
  );

  useEffect(() => {
    if (streams && streams.length > 1 && ids.length < 2) setIds([streams[0].id, streams[1].id]);
  }, [streams, ids.length, setIds]);
  useOnChange(ids.slice(0, 2).join(','), () => {
    setPhaseKey(null);
    setSubKey(null);
    setDecisions({});
  });

  const pairIds = ids.slice(0, 2);
  const { data: details, loading, error } = useStreamDetails(pairIds);
  const pair: (StreamDetail | null)[] = useMemo(
    () => pairIds.map((id) => details?.[id] ?? null),
    [details, pairIds],
  );
  const [a, b] = pair;
  const names: [string, string] = [a?.name ?? 'Stream A', b?.name ?? 'Stream B'];

  const phases: ReconPhase[] = useMemo(() => {
    if (!a || !b) return [];
    const lane = (d: StreamDetail) => ({
      id: d.id,
      stages: d.areas.map((ar) => ({ id: ar.id, name: ar.name, subs: ar.subs })),
    });
    return buildReconciliation(lane(a), lane(b));
  }, [a, b]);

  /** The aligned L3 slots — same alignment the reconciliation uses. */
  const slots: StageSlot[] = useMemo(() => {
    if (!a || !b) return [];
    return alignStages([
      { lane: a.id, stages: a.areas },
      { lane: b.id, stages: b.areas },
    ]);
  }, [a, b]);

  const phase = phaseKey ? (phases.find((p) => p.key === phaseKey) ?? null) : null;
  const slot = phaseKey ? (slots.find((s) => s.key === phaseKey) ?? null) : null;

  /** Aligned L4 sub-processes of the drilled phase. */
  const subSlots: SubSlot[] = useMemo(() => {
    if (!slot || !a || !b) return [];
    const stageOf = (d: StreamDetail) => d.areas.find((ar) => ar.id === slot.byLane.get(d.id));
    const sa = stageOf(a);
    const sb = stageOf(b);
    const aligned = alignStages([
      { lane: 'a', stages: (sa?.subs ?? []).map((s) => ({ id: s.id, name: s.name })) },
      { lane: 'b', stages: (sb?.subs ?? []).map((s) => ({ id: s.id, name: s.name })) },
    ]);
    return aligned.map((sl) => {
      const subA = sa?.subs.find((s) => s.id === sl.byLane.get('a')) ?? null;
      const subB = sb?.subs.find((s) => s.id === sl.byLane.get('b')) ?? null;
      return {
        key: sl.key,
        label: sl.label,
        a: subA ? { name: subA.name, steps: subA.tasks.length } : null,
        b: subB ? { name: subB.name, steps: subB.tasks.length } : null,
      };
    });
  }, [slot, a, b]);

  const sub = subKey ? (subSlots.find((s) => s.key === subKey) ?? null) : null;
  const level: 'phases' | 'subs' | 'steps' = !phase ? 'phases' : !sub ? 'subs' : 'steps';

  const decisionOf = (row: ReconRow): ReconDecision => decisions[row.key] ?? defaultDecision(row);

  // Step rows in scope: the drilled phase, narrowed to the drilled sub.
  const stepRows = useMemo(() => {
    if (!phase) return [];
    if (!sub) return phase.rows;
    return phase.rows.filter(
      (r) => (r.a && r.a.sub === sub.a?.name) || (r.b && r.b.sub === sub.b?.name),
    );
  }, [phase, sub]);

  const counts = {
    all: stepRows.length,
    diff: stepRows.filter((r) => r.verdict !== 'merge').length,
    merge: stepRows.filter((r) => r.verdict === 'merge' || r.verdict === 'order').length,
    solo: stepRows.filter((r) => !r.a || !r.b).length,
  };
  const shownSteps = stepRows.filter((r) => {
    if (filter === 'diff') return r.verdict !== 'merge';
    if (filter === 'merge') return r.verdict === 'merge' || r.verdict === 'order';
    if (filter === 'solo') return !r.a || !r.b;
    return true;
  });

  const scopeRows = level === 'phases' ? phases.flatMap((p) => p.rows) : stepRows;
  const currentSteps = scopeRows.reduce((n, r) => n + (r.a ? 1 : 0) + (r.b ? 1 : 0), 0);
  const normalized = scopeRows.reduce((n, r) => {
    const d = decisionOf(r);
    if (d === 'Drop') return n;
    if (d === 'Merge') return n + 1;
    return n + (r.a ? 1 : 0) + (r.b ? 1 : 0);
  }, 0);
  const mergedCount = scopeRows.filter((r) => r.a && r.b && decisionOf(r) === 'Merge').length;
  const orderCount = scopeRows.filter((r) => r.verdict === 'order').length;
  const soloCount = scopeRows.filter((r) => !r.a || !r.b).length;

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const streamSelect = (slotIdx: 0 | 1) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: STREAM_TONES[slotIdx],
          flexShrink: 0,
        }}
      />
      <Select
        aria-label={`Stream ${slotIdx === 0 ? 'A' : 'B'}`}
        value={pairIds[slotIdx] ?? ''}
        onChange={(e) => {
          const next = [...pairIds];
          next[slotIdx] = e.target.value;
          setIds(next);
        }}
        style={{
          width: 'auto',
          minWidth: 170,
          maxWidth: 290,
          height: 26,
          padding: '0 24px 0 9px',
          fontSize: 11.5,
        }}
      >
        {(streams ?? []).map((s) => (
          <option
            key={s.id}
            value={s.id}
            disabled={pairIds.includes(s.id) && s.id !== pairIds[slotIdx]}
          >
            {s.name} — {s.taskCount} steps
          </option>
        ))}
      </Select>
    </span>
  );

  const crumb = (label: string, onClick: (() => void) | null, last: boolean) => (
    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick ?? undefined}
        style={{
          font: 'inherit',
          fontSize: 11.5,
          fontWeight: last ? 700 : 500,
          color: last ? '#171717' : '#0070AD',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: onClick ? 'pointer' : 'default',
          maxWidth: 300,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>
      {!last && <span style={{ color: '#cbd5e1', fontSize: 11 }}>›</span>}
    </span>
  );

  const headerCells = (last: { label: string; width?: string }[]) => (
    <>
      <div style={{ padding: '7px 6px', textAlign: 'center' }}>#</div>
      <div style={{ padding: '7px 10px' }}>Unit of work (canonical wording)</div>
      <div style={{ padding: '7px 10px', borderLeft: '1px solid #eaeaea', color: STREAM_TONES[0] }}>
        {names[0]}
      </div>
      <div style={{ padding: '7px 10px', borderLeft: '1px solid #eaeaea', color: STREAM_TONES[1] }}>
        {names[1]}
      </div>
      {last.map((c) => (
        <div key={c.label} style={{ padding: '7px 10px', borderLeft: '1px solid #eaeaea' }}>
          {c.label}
        </div>
      ))}
    </>
  );

  const headRow = (grid: string, cells: React.ReactNode) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: grid,
        background: '#fafafa',
        borderBottom: '1px solid #eaeaea',
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '.07em',
        textTransform: 'uppercase',
        color: '#a3a3a3',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}
    >
      {cells}
    </div>
  );

  const phaseStats = (p: ReconPhase) => {
    const both = p.rows.filter((r) => r.a && r.b).length;
    const only = p.rows.length - both;
    return { both, only };
  };

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
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#525252' }}>Compare</span>
        {streamSelect(0)}
        <span style={{ fontSize: 11, color: '#a3a3a3' }}>vs</span>
        {streamSelect(1)}
        <span style={{ width: 1, height: 18, background: '#eaeaea', margin: '0 2px' }} />
        {crumb(
          'Phases',
          level === 'phases'
            ? null
            : () => {
                setPhaseKey(null);
                setSubKey(null);
              },
          level === 'phases',
        )}
        {phase &&
          crumb(phase.label, level === 'subs' ? null : () => setSubKey(null), level === 'subs')}
        {sub && crumb(sub.label, null, true)}
        <div style={{ flex: 1 }} />
        {level === 'steps' && (
          <>
            <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>Show</span>
            <div
              style={{
                display: 'flex',
                height: 26,
                border: '1px solid #eaeaea',
                borderRadius: 6,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              {(
                [
                  ['all', 'All', counts.all],
                  ['diff', 'Differences', counts.diff],
                  ['merge', 'Shared', counts.merge],
                  ['solo', 'Only one stream', counts.solo],
                ] as [ShowFilter, string, number][]
              ).map(([key, label, count], i) => {
                const on = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    style={{
                      font: 'inherit',
                      padding: '0 9px',
                      fontSize: 11,
                      lineHeight: '26px',
                      cursor: 'pointer',
                      border: 'none',
                      borderLeft: i === 0 ? 'none' : '1px solid #eaeaea',
                      background: on ? '#171717' : '#fff',
                      color: on ? '#fff' : '#525252',
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {label} <span style={{ opacity: 0.55 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {loading ? (
          <div style={{ padding: 24, fontSize: 12.5, color: '#a3a3a3' }}>Loading flows…</div>
        ) : !a || !b ? (
          <div style={{ padding: 24 }}>
            <EmptyState message="Pick two value streams to reconcile." />
          </div>
        ) : (
          <div style={{ minWidth: 1100 }}>
            {level === 'phases' && (
              <>
                {headRow(LEVEL_GRID, headerCells([{ label: 'Coverage' }, { label: '' }]))}
                {phases.map((p, i) => {
                  const sl = slots.find((s) => s.key === p.key);
                  const stA = a.areas.find((ar) => ar.id === sl?.byLane.get(a.id)) ?? null;
                  const stB = b.areas.find((ar) => ar.id === sl?.byLane.get(b.id)) ?? null;
                  const st = phaseStats(p);
                  const meta =
                    stA && stB ? VERDICT_META.merge : stA ? VERDICT_META.onlyA : VERDICT_META.onlyB;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPhaseKey(p.key);
                        setSubKey(null);
                      }}
                      style={{
                        font: 'inherit',
                        display: 'grid',
                        gridTemplateColumns: LEVEL_GRID,
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid #f1f3f5',
                        background: '#fff',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          fontSize: 11,
                          fontFamily: 'ui-monospace, monospace',
                          color: '#a3a3a3',
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ padding: '8px 10px', minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#171717' }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>
                          {p.rows.length} units of work in this phase
                        </div>
                      </div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <LevelCell
                          name={stA?.name ?? null}
                          meta={
                            stA
                              ? `${stA.subs.length} sub-processes · ${stA.subs.reduce((n, s) => n + s.tasks.length, 0)} steps`
                              : ''
                          }
                          tone={STREAM_TONES[0]}
                        />
                      </div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <LevelCell
                          name={stB?.name ?? null}
                          meta={
                            stB
                              ? `${stB.subs.length} sub-processes · ${stB.subs.reduce((n, s) => n + s.tasks.length, 0)} steps`
                              : ''
                          }
                          tone={STREAM_TONES[1]}
                        />
                      </div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <VerdictPill
                          {...meta}
                          label={
                            stA && stB
                              ? 'IN BOTH STREAMS'
                              : stA
                                ? `ONLY ${names[0].toUpperCase()}`
                                : `ONLY ${names[1].toUpperCase()}`
                          }
                          note={`${st.both} shared units · ${st.only} in one stream`}
                        />
                      </div>
                      <div
                        style={{
                          padding: '8px 10px',
                          borderLeft: '1px solid #f1f3f5',
                          fontSize: 11,
                          color: '#0070AD',
                          alignSelf: 'center',
                        }}
                      >
                        Drill ›
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {level === 'subs' && phase && (
              <>
                {headRow(LEVEL_GRID, headerCells([{ label: 'Coverage' }, { label: '' }]))}
                {subSlots.map((s, i) => {
                  const meta =
                    s.a && s.b ? VERDICT_META.merge : s.a ? VERDICT_META.onlyA : VERDICT_META.onlyB;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSubKey(s.key)}
                      style={{
                        font: 'inherit',
                        display: 'grid',
                        gridTemplateColumns: LEVEL_GRID,
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid #f1f3f5',
                        background: '#fff',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          fontSize: 11,
                          fontFamily: 'ui-monospace, monospace',
                          color: '#a3a3a3',
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ padding: '8px 10px', minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717' }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>
                          sub-process
                        </div>
                      </div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <LevelCell
                          name={s.a?.name ?? null}
                          meta={s.a ? `${s.a.steps} steps` : ''}
                          tone={STREAM_TONES[0]}
                        />
                      </div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <LevelCell
                          name={s.b?.name ?? null}
                          meta={s.b ? `${s.b.steps} steps` : ''}
                          tone={STREAM_TONES[1]}
                        />
                      </div>
                      <div style={{ padding: '8px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <VerdictPill
                          {...meta}
                          label={
                            s.a && s.b
                              ? 'IN BOTH STREAMS'
                              : s.a
                                ? `ONLY ${names[0].toUpperCase()}`
                                : `ONLY ${names[1].toUpperCase()}`
                          }
                        />
                      </div>
                      <div
                        style={{
                          padding: '8px 10px',
                          borderLeft: '1px solid #f1f3f5',
                          fontSize: 11,
                          color: '#0070AD',
                          alignSelf: 'center',
                        }}
                      >
                        Drill ›
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {level === 'steps' && (
              <>
                {headRow(STEP_GRID, headerCells([{ label: 'Verdict' }, { label: 'Decision' }]))}
                {shownSteps.map((r, i) => {
                  const meta = VERDICT_META[r.verdict];
                  const v = verdictLabel(r, names);
                  return (
                    <div
                      key={r.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: STEP_GRID,
                        borderBottom: '1px solid #f1f3f5',
                        background: r.verdict === 'order' ? '#fffdf5' : '#fff',
                      }}
                    >
                      <div
                        style={{
                          padding: '7px 6px',
                          textAlign: 'center',
                          fontSize: 11,
                          fontFamily: 'ui-monospace, monospace',
                          color: '#a3a3a3',
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ padding: '7px 10px', minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            lineHeight: 1.3,
                            color: '#171717',
                          }}
                        >
                          {r.canonName}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '7px 10px',
                          borderLeft: '1px solid #f1f3f5',
                          minWidth: 0,
                        }}
                      >
                        <StreamCell step={r.a} tone={STREAM_TONES[0]} />
                      </div>
                      <div
                        style={{
                          padding: '7px 10px',
                          borderLeft: '1px solid #f1f3f5',
                          minWidth: 0,
                        }}
                      >
                        <StreamCell step={r.b} tone={STREAM_TONES[1]} />
                      </div>
                      <div style={{ padding: '7px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <VerdictPill {...meta} label={v.label} note={v.note} />
                      </div>
                      <div style={{ padding: '7px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <DecisionButtons
                          chosen={decisionOf(r)}
                          onPick={(d) => setDecisions((c) => ({ ...c, [r.key]: d }))}
                        />
                      </div>
                    </div>
                  );
                })}
                {shownSteps.length === 0 && (
                  <div style={{ padding: 18, fontSize: 12, color: '#a3a3a3' }}>
                    No steps match this filter.
                  </div>
                )}
              </>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '9px 12px',
                background: '#f7f8fa',
                borderTop: '1px solid #eaeaea',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12, color: '#525252' }}>
                {level === 'phases'
                  ? 'These streams'
                  : level === 'subs'
                    ? 'This phase'
                    : sub
                      ? 'This sub-process'
                      : 'This phase'}
                : <b style={{ color: '#171717' }}>{currentSteps}</b> current steps →{' '}
                <b style={{ color: GREEN, fontSize: 14 }}>{normalized}</b> normalized
              </div>
              <span style={{ width: 1, height: 18, background: '#e5e7eb' }} />
              <div style={{ fontSize: 11.5, color: INDIGO }}>
                <b>{mergedCount}</b> merged 2→1
              </div>
              <div style={{ fontSize: 11.5, color: AMBER }}>
                <b>{orderCount}</b> arrive at a different point in the flow
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                <b>{soloCount}</b> carried over 1→1
              </div>
              <div style={{ flex: 1 }} />
              {level !== 'steps' && (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  drill into a {level === 'phases' ? 'phase' : 'sub-process'} to decide step by step
                </span>
              )}
            </div>

            {level === 'steps' && phase && (
              <VsNewProcessFlow
                phases={[{ ...phase, rows: stepRows }]}
                phaseKey={phase.key}
                onPhase={(k) => {
                  if (k === null) {
                    setPhaseKey(null);
                    setSubKey(null);
                  } else {
                    setPhaseKey(k);
                    setSubKey(null);
                  }
                }}
                decisionOf={decisionOf}
                streamNames={names}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
