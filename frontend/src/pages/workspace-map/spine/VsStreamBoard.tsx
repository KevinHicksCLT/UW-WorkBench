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
import { buildReconciliation, type ReconPhase, type ReconRow } from './spineCompare';
import { useStreamDetails, useStreamList, type StreamDetail } from './useSpineData';

// Value-streams lens — the step reconciliation table: two compared streams,
// one row per canonical unit of work, each stream's own step (with sequence,
// owner and systems) side by side, a computed verdict (merge 2→1, order
// differs, only-one-stream) and a per-row decision. The table closes with the
// horizontal NEW PROCESS flow carrying the full detail of every surviving
// step. Everything derives live from the L3→L4→L5 spine subtrees.

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

const GRID = '34px minmax(240px,1fr) 300px 300px 190px 168px';

function StreamCell({ step, tone }: { step: ReconRow['a']; tone: string }) {
  if (!step) return <span style={{ fontSize: 10.5, color: '#cbd5e1' }}>— not in this stream</span>;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 17,
          height: 17,
          borderRadius: 999,
          background: tone,
          color: '#fff',
          fontSize: 9,
          fontWeight: 800,
          lineHeight: '17px',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {step.seq}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, lineHeight: 1.35, color: '#334155' }}>{step.name}</div>
        <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>
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
              padding: '3px 7px',
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
  const [filter, setFilter] = useViewState<ShowFilter>('workspace.vs.filter', 'all');
  const [decisions, setDecisions] = useViewState<Record<string, ReconDecision>>(
    'workspace.vs.decisions',
    {},
  );

  useEffect(() => {
    if (streams && streams.length > 1 && ids.length < 2) setIds([streams[0].id, streams[1].id]);
  }, [streams, ids.length, setIds]);
  // A different pair starts clean — change-only so a restored comparison keeps
  // its restored decisions on mount.
  useOnChange(ids.slice(0, 2).join(','), () => {
    setPhaseKey(null);
    setDecisions({});
  });

  const pairIds = ids.slice(0, 2);
  const { data: details, loading, error } = useStreamDetails(pairIds);

  const pair: (StreamDetail | null)[] = useMemo(
    () => pairIds.map((id) => details?.[id] ?? null),
    [details, pairIds],
  );
  const [a, b] = pair;

  const phases: ReconPhase[] = useMemo(() => {
    if (!a || !b) return [];
    const lane = (d: StreamDetail) => ({
      id: d.id,
      stages: d.areas.map((ar) => ({ id: ar.id, name: ar.name, subs: ar.subs })),
    });
    return buildReconciliation(lane(a), lane(b));
  }, [a, b]);

  const names: [string, string] = [a?.name ?? 'Stream A', b?.name ?? 'Stream B'];
  const decisionOf = (row: ReconRow): ReconDecision => decisions[row.key] ?? defaultDecision(row);

  const shownPhases = phaseKey ? phases.filter((p) => p.key === phaseKey) : phases;
  const allRows = shownPhases.flatMap((p) => p.rows);
  const counts = {
    all: allRows.length,
    diff: allRows.filter((r) => r.verdict !== 'merge').length,
    merge: allRows.filter((r) => r.verdict === 'merge' || r.verdict === 'order').length,
    solo: allRows.filter((r) => !r.a || !r.b).length,
  };
  const rows = allRows.filter((r) => {
    if (filter === 'diff') return r.verdict !== 'merge';
    if (filter === 'merge') return r.verdict === 'merge' || r.verdict === 'order';
    if (filter === 'solo') return !r.a || !r.b;
    return true;
  });

  const currentSteps = allRows.reduce((n, r) => n + (r.a ? 1 : 0) + (r.b ? 1 : 0), 0);
  const normalized = allRows.reduce((n, r) => {
    const d = decisionOf(r);
    if (d === 'Drop') return n;
    if (d === 'Merge') return n + 1;
    return n + (r.a ? 1 : 0) + (r.b ? 1 : 0);
  }, 0);
  const mergedCount = allRows.filter((r) => r.a && r.b && decisionOf(r) === 'Merge').length;
  const orderCount = allRows.filter((r) => r.verdict === 'order').length;
  const soloCount = allRows.filter((r) => !r.a || !r.b).length;
  const decidedByHand = allRows.filter((r) => decisions[r.key]).length;

  if (listLoading) return <LoadingState message="Loading value streams…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const streamSelect = (slot: 0 | 1) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: STREAM_TONES[slot],
          flexShrink: 0,
        }}
      />
      <Select
        aria-label={`Stream ${slot === 0 ? 'A' : 'B'}`}
        value={pairIds[slot] ?? ''}
        onChange={(e) => {
          const next = [...pairIds];
          next[slot] = e.target.value;
          setIds(next);
        }}
        style={{
          width: 'auto',
          minWidth: 180,
          maxWidth: 300,
          height: 26,
          padding: '0 24px 0 9px',
          fontSize: 11.5,
        }}
      >
        {(streams ?? []).map((s) => (
          <option
            key={s.id}
            value={s.id}
            disabled={pairIds.includes(s.id) && s.id !== pairIds[slot]}
          >
            {s.name} — {s.taskCount} steps
          </option>
        ))}
      </Select>
    </span>
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#525252' }}>Compare</span>
        {streamSelect(0)}
        <span style={{ fontSize: 11, color: '#a3a3a3' }}>vs</span>
        {streamSelect(1)}
        <Select
          aria-label="Phase"
          value={phaseKey ?? ''}
          onChange={(e) => setPhaseKey(e.target.value || null)}
          style={{
            width: 'auto',
            minWidth: 160,
            maxWidth: 280,
            height: 26,
            padding: '0 24px 0 9px',
            fontSize: 11.5,
          }}
        >
          <option value="">All phases</option>
          {phases.map((p) => (
            <option key={p.key} value={p.key}>
              Phase: {p.label}
            </option>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
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
                  padding: '0 10px',
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
          <div style={{ padding: 30, fontSize: 12.5, color: '#a3a3a3' }}>Loading flows…</div>
        ) : !a || !b ? (
          <div style={{ padding: 30 }}>
            <EmptyState message="Pick two value streams to reconcile." />
          </div>
        ) : (
          <div style={{ minWidth: 1200 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
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
              <div style={{ padding: '8px 6px', textAlign: 'center' }}>#</div>
              <div style={{ padding: '8px 10px' }}>Unit of work (canonical wording)</div>
              <div
                style={{
                  padding: '8px 10px',
                  borderLeft: '1px solid #eaeaea',
                  color: STREAM_TONES[0],
                }}
              >
                {names[0]}
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  borderLeft: '1px solid #eaeaea',
                  color: STREAM_TONES[1],
                }}
              >
                {names[1]}
              </div>
              <div style={{ padding: '8px 10px', borderLeft: '1px solid #eaeaea' }}>Verdict</div>
              <div style={{ padding: '8px 10px', borderLeft: '1px solid #eaeaea' }}>Decision</div>
            </div>

            {rows.map((r, i) => {
              const meta = VERDICT_META[r.verdict];
              const v = verdictLabel(r, names);
              return (
                <div
                  key={r.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID,
                    borderBottom: '1px solid #f1f3f5',
                    background: r.verdict === 'order' ? '#fffdf5' : '#fff',
                  }}
                >
                  <div
                    style={{
                      padding: '9px 6px',
                      textAlign: 'center',
                      fontSize: 11,
                      fontFamily: 'ui-monospace, monospace',
                      color: '#a3a3a3',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ padding: '9px 10px', minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        lineHeight: 1.35,
                        color: '#171717',
                      }}
                    >
                      {r.canonName}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                      {r.phaseLabel}
                    </div>
                  </div>
                  <div
                    style={{ padding: '9px 10px', borderLeft: '1px solid #f1f3f5', minWidth: 0 }}
                  >
                    <StreamCell step={r.a} tone={STREAM_TONES[0]} />
                  </div>
                  <div
                    style={{ padding: '9px 10px', borderLeft: '1px solid #f1f3f5', minWidth: 0 }}
                  >
                    <StreamCell step={r.b} tone={STREAM_TONES[1]} />
                  </div>
                  <div style={{ padding: '9px 10px', borderLeft: '1px solid #f1f3f5' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: meta.fg,
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                        borderRadius: 6,
                        padding: '2px 7px',
                      }}
                    >
                      {v.label}
                    </span>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4 }}>{v.note}</div>
                  </div>
                  <div style={{ padding: '9px 10px', borderLeft: '1px solid #f1f3f5' }}>
                    <DecisionButtons
                      chosen={decisionOf(r)}
                      onPick={(d) => setDecisions((c) => ({ ...c, [r.key]: d }))}
                    />
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div style={{ padding: 24, fontSize: 12, color: '#a3a3a3' }}>
                No steps match this filter.
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '11px 14px',
                background: '#f7f8fa',
                borderTop: '1px solid #eaeaea',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12.5, color: '#525252' }}>
                {phaseKey ? 'This phase' : 'These streams'}:{' '}
                <b style={{ color: '#171717' }}>{currentSteps}</b> current steps →{' '}
                <b style={{ color: GREEN, fontSize: 15 }}>{normalized}</b> normalized
              </div>
              <span style={{ width: 1, height: 20, background: '#e5e7eb' }} />
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
              <span style={{ fontSize: 11, color: '#525252' }}>
                {decidedByHand} of {allRows.length} rows decided by hand · the rest use the
                suggested verdict
              </span>
            </div>

            <VsNewProcessFlow
              phases={phases}
              phaseKey={phaseKey}
              onPhase={setPhaseKey}
              decisionOf={decisionOf}
              streamNames={names}
            />
          </div>
        )}
      </div>
    </div>
  );
}
