import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorMessage, LoadingState, Select } from '../../../components/ui';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, GREEN, INDIGO } from '../types';
import { Picker, type PoolOption } from './SpineBoard';
import VsNewProcessFlow, {
  defaultDecision,
  streamBg,
  streamTone,
  type ReconDecision,
} from './VsNewProcessFlow';
import {
  PhasesTable,
  SubsTable,
  VerdictPill,
  type PhaseRowView,
  type SubRowView,
} from './VsLevelTables';
import {
  alignStages,
  buildReconciliation,
  type ReconLaneInput,
  type ReconPhase,
  type ReconRow,
  type StageSlot,
} from './spineCompare';
import { useStreamDetails, useStreamList, type StreamDetail } from './useSpineData';

// Value-streams lens — top-down navigation, bottom-up normalization: compare
// ANY number of streams (L2), land on their aligned phases (L3), narrow with
// the Phase / Sub-process dropdown filters (or row drills) to the atomic step
// table (L5) where the merge/keep/drop decisions are made — and those
// decisions roll back UP as progress on the phase rows. All live spine data.

type ShowFilter = 'all' | 'diff' | 'merge' | 'solo';

function stepGrid(laneCount: number): string {
  return `30px minmax(190px,1fr) repeat(${laneCount}, 235px) 175px 150px`;
}

function StreamCell({ step, tone }: { step: ReconRow['cells'][number]; tone: string }) {
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
        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
          {[step.owner, step.apps.join(' · ')].filter(Boolean).join(' · ') || step.sub}
        </div>
      </div>
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
  perLane: ({ name: string; steps: number } | null)[];
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
  useOnChange(ids.join(','), () => {
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
  const slot = phaseKey ? (slots.find((s) => s.key === phaseKey) ?? null) : null;

  /** Aligned L4 sub-processes of the drilled phase, one entry per lane. */
  const subSlots: SubSlot[] = useMemo(() => {
    if (!slot || lanes.length < 2) return [];
    const stages = lanes.map((d) => d.areas.find((ar) => ar.id === slot.byLane.get(d.id)) ?? null);
    const aligned = alignStages(
      stages.map((st, i) => ({
        lane: String(i),
        stages: (st?.subs ?? []).map((s) => ({ id: s.id, name: s.name })),
      })),
    );
    return aligned.map((sl) => ({
      key: sl.key,
      label: sl.label,
      perLane: stages.map((st, i) => {
        const sub = st?.subs.find((s) => s.id === sl.byLane.get(String(i)));
        return sub ? { name: sub.name, steps: sub.tasks.length } : null;
      }),
    }));
  }, [slot, lanes]);

  const sub = subKey ? (subSlots.find((s) => s.key === subKey) ?? null) : null;
  const level: 'phases' | 'subs' | 'steps' = !phase ? 'phases' : !sub ? 'subs' : 'steps';

  const decisionOf = (row: ReconRow): ReconDecision => decisions[row.key] ?? defaultDecision(row);

  const stepRows = useMemo(() => {
    if (!phase) return [];
    if (!sub) return phase.rows;
    return phase.rows.filter((r) => r.cells.some((c, i) => c && c.sub === sub.perLane[i]?.name));
  }, [phase, sub]);

  const counts = {
    all: stepRows.length,
    diff: stepRows.filter((r) => r.verdict !== 'merge').length,
    merge: stepRows.filter((r) => r.presentIn > 1).length,
    solo: stepRows.filter((r) => r.presentIn === 1).length,
  };
  const shownSteps = stepRows.filter((r) => {
    if (filter === 'diff') return r.verdict !== 'merge';
    if (filter === 'merge') return r.presentIn > 1;
    if (filter === 'solo') return r.presentIn === 1;
    return true;
  });

  const scopeRows = level === 'phases' ? phases.flatMap((p) => p.rows) : stepRows;
  const currentSteps = scopeRows.reduce((n, r) => n + r.presentIn, 0);
  const normalized = scopeRows.reduce((n, r) => {
    const d = decisionOf(r);
    if (d === 'Drop') return n;
    if (d === 'Merge') return n + 1;
    return n + r.presentIn;
  }, 0);
  const mergedCount = scopeRows.filter((r) => r.presentIn > 1 && decisionOf(r) === 'Merge').length;
  const orderCount = scopeRows.filter((r) => r.verdict === 'order').length;
  const soloCount = scopeRows.filter((r) => r.presentIn === 1).length;

  const phaseRowViews: PhaseRowView[] = useMemo(
    () =>
      phases.map((p) => {
        const sl = slots.find((s) => s.key === p.key);
        return {
          key: p.key,
          label: p.label,
          units: p.rows.length,
          shared: p.rows.filter((r) => r.presentIn > 1).length,
          only: p.rows.filter((r) => r.presentIn === 1).length,
          decided: p.rows.filter((r) => decisions[r.key]).length,
          perLane: lanes.map((d) => {
            const st = d.areas.find((ar) => ar.id === sl?.byLane.get(d.id));
            return st
              ? {
                  name: st.name,
                  meta: `${st.subs.length} sub-processes · ${st.subs.reduce((n, s) => n + s.tasks.length, 0)} steps`,
                }
              : { name: null, meta: '' };
          }),
        };
      }),
    [phases, slots, lanes, decisions],
  );

  const subRowViews: SubRowView[] = subSlots.map((s) => ({
    key: s.key,
    label: s.label,
    presentIn: s.perLane.filter(Boolean).length,
    perLane: s.perLane.map((l) =>
      l ? { name: l.name, meta: `${l.steps} steps` } : { name: null, meta: '' },
    ),
  }));

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const selectStyle: React.CSSProperties = {
    width: 'auto',
    minWidth: 150,
    maxWidth: 280,
    height: 26,
    padding: '0 24px 0 9px',
    fontSize: 11.5,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Picker noun="value stream" pool={pool} selectedIds={ids} onChangeSelection={setIds} />
        <span style={{ width: 1, height: 18, background: '#eaeaea', margin: '0 2px 10px' }} />
        <span style={{ fontSize: 10.5, color: '#a3a3a3', marginBottom: 10 }}>Level</span>
        <Select
          aria-label="Phase filter"
          value={phaseKey ?? ''}
          onChange={(e) => {
            setPhaseKey(e.target.value || null);
            setSubKey(null);
          }}
          style={{ ...selectStyle, marginBottom: 10 }}
        >
          <option value="">All phases — the high-level view</option>
          {phases.map((p) => (
            <option key={p.key} value={p.key}>
              Phase: {p.label}
            </option>
          ))}
        </Select>
        {phase && (
          <Select
            aria-label="Sub-process filter"
            value={subKey ?? ''}
            onChange={(e) => setSubKey(e.target.value || null)}
            style={{ ...selectStyle, marginBottom: 10 }}
          >
            <option value="">All sub-processes</option>
            {subSlots.map((s) => (
              <option key={s.key} value={s.key}>
                Sub-process: {s.label}
              </option>
            ))}
          </Select>
        )}
        {phase && !sub && (
          <button
            type="button"
            onClick={() => setSubKey(subSlots[0]?.key ?? null)}
            style={{
              font: 'inherit',
              fontSize: 11,
              color: '#0070AD',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginBottom: 10,
              padding: 0,
            }}
          >
            or jump straight to the steps ›
          </button>
        )}
        <div style={{ flex: 1 }} />
        {level === 'steps' && (
          <div
            style={{
              display: 'flex',
              height: 26,
              border: '1px solid #eaeaea',
              borderRadius: 6,
              overflow: 'hidden',
              background: '#fff',
              marginBottom: 10,
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
        ) : lanes.length < 2 ? (
          <div style={{ padding: 24 }}>
            <EmptyState message="Pick at least two value streams to reconcile." />
          </div>
        ) : (
          <div style={{ minWidth: 900 + lanes.length * 240 }}>
            {level === 'phases' && (
              <PhasesTable rows={phaseRowViews} names={names} onDrill={(k) => setPhaseKey(k)} />
            )}
            {level === 'subs' && (
              <SubsTable rows={subRowViews} names={names} onDrill={(k) => setSubKey(k)} />
            )}

            {level === 'steps' && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: stepGrid(lanes.length),
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
                  <div style={{ padding: '6px 6px', textAlign: 'center' }}>#</div>
                  <div style={{ padding: '6px 10px' }}>Unit of work (canonical wording)</div>
                  {names.map((n, i) => (
                    <div
                      key={n}
                      style={{
                        padding: '6px 10px',
                        borderLeft: '1px solid #eaeaea',
                        color: streamTone(i),
                      }}
                    >
                      {n}
                    </div>
                  ))}
                  <div style={{ padding: '6px 10px', borderLeft: '1px solid #eaeaea' }}>
                    Verdict
                  </div>
                  <div style={{ padding: '6px 10px', borderLeft: '1px solid #eaeaea' }}>
                    Decision
                  </div>
                </div>
                {shownSteps.map((r, i) => {
                  const meta =
                    r.verdict === 'merge'
                      ? { fg: INDIGO, bg: '#eef2ff', border: '#d6dcff' }
                      : r.verdict === 'order'
                        ? { fg: AMBER, bg: '#fffbeb', border: '#fde68a' }
                        : {
                            fg: streamTone(r.onlyIdx ?? 0),
                            bg: streamBg(r.onlyIdx ?? 0),
                            border: '#e2e8f0',
                          };
                  const label =
                    r.verdict === 'merge'
                      ? `MERGE ${r.presentIn}→1`
                      : r.verdict === 'order'
                        ? 'MERGE · ORDER DIFFERS'
                        : `ONLY ${(names[r.onlyIdx ?? 0] ?? '').toUpperCase()}`;
                  const note =
                    r.verdict === 'order'
                      ? r.cells.map((c) => (c ? `#${c.seq}` : '—')).join(' / ')
                      : r.verdict === 'merge'
                        ? 'same work, same point in the flow'
                        : 'carry over 1→1';
                  return (
                    <div
                      key={r.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: stepGrid(lanes.length),
                        borderBottom: '1px solid #f1f3f5',
                        background: r.verdict === 'order' ? '#fffdf5' : '#fff',
                      }}
                    >
                      <div
                        style={{
                          padding: '6px 6px',
                          textAlign: 'center',
                          fontSize: 11,
                          fontFamily: 'ui-monospace, monospace',
                          color: '#a3a3a3',
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ padding: '6px 10px', minWidth: 0 }}>
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
                      {r.cells.map((c, ci) => (
                        <div
                          key={`${r.key}:${ci}`}
                          style={{
                            padding: '6px 10px',
                            borderLeft: '1px solid #f1f3f5',
                            minWidth: 0,
                          }}
                        >
                          <StreamCell step={c} tone={streamTone(ci)} />
                        </div>
                      ))}
                      <div style={{ padding: '6px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <VerdictPill {...meta} label={label} note={note} />
                      </div>
                      <div style={{ padding: '6px 10px', borderLeft: '1px solid #f1f3f5' }}>
                        <DecisionButtons
                          chosen={decisionOf(r)}
                          onPick={(d) => setDecisions((c) => ({ ...c, [r.key]: d }))}
                        />
                      </div>
                    </div>
                  );
                })}
                {shownSteps.length === 0 && (
                  <div style={{ padding: 16, fontSize: 12, color: '#a3a3a3' }}>
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
                padding: '8px 12px',
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
                <b>{mergedCount}</b> merged k→1
              </div>
              <div style={{ fontSize: 11.5, color: AMBER }}>
                <b>{orderCount}</b> arrive at a different point in the flow
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                <b>{soloCount}</b> carried over 1→1
              </div>
              <div style={{ flex: 1 }} />
              {level !== 'steps' ? (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  normalize bottom-up: drill to the steps, decide there, the progress rolls up here
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#525252' }}>
                  {stepRows.filter((r) => decisions[r.key]).length} of {stepRows.length} rows
                  decided by hand · the rest use the suggested verdict
                </span>
              )}
            </div>

            {level === 'steps' && phase && (
              <VsNewProcessFlow
                phases={[{ ...phase, rows: stepRows }]}
                phaseKey={phase.key}
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
