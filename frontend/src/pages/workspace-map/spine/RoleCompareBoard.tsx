import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useDialogs } from '../../../lib/dialogs';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { AMBER, GREEN, INDIGO } from '../types';
import { Picker, type PoolOption } from './SpineBoard';
import {
  AlignedTaskGrid,
  RoleTaskModal,
  TargetColumn,
  ROLE_COL_W,
  type OpenTask,
} from './RoleTaskColumns';
import {
  buildTarget,
  columnKeySets,
  dedupeTasks,
  recommendedTarget,
  roleFacts,
  roleRecs,
  roleShort,
  type RoleColumnInput,
  type RoleDecision,
  type StepDecision,
} from './roleConsolidation';
import { useRoleDetails, useRoleList, useStreamList } from './useSpineData';

// Roles lens — one role at a time, its actual tasks, one decision. The spine
// is the axis (value stream › L4 sub-process › L5 step): a card per compared
// role carries the evidence and the decision (consolidate into the target /
// deprecate / keep); below, every task column by column with its fate, and the
// green TARGET ROLE column building the resulting role. All live graph data.

const ROLE_TONES = ['#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#64748b', '#0891b2'];

const selectStyle = {
  border: '1px solid #e5e5e5',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  background: '#fff',
  maxWidth: 220,
} as const;

function actionButton(
  label: string,
  on: boolean,
  danger: boolean,
  primary: boolean,
  onClick: () => void,
) {
  return (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        font: 'inherit',
        fontSize: 10.5,
        fontWeight: 600,
        cursor: 'pointer',
        borderRadius: 6,
        padding: '4px 9px',
        color: on ? '#fff' : '#525252',
        background: on ? (danger ? '#dc2626' : primary ? INDIGO : '#525252') : '#fff',
        border: `1px solid ${on ? 'transparent' : '#e5e5e5'}`,
      }}
    >
      {label}
    </button>
  );
}

export default function RoleCompareBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const dialogs = useDialogs();
  const { data: roles, loading: listLoading, error: listError } = useRoleList();
  const [ids, setIds] = useViewState<string[]>('workspace.role.ids', []);
  const [division, setDivision] = useViewState<string>('workspace.role.division', '');
  const [stream, setStream] = useViewState<string>('workspace.role.stream', '');
  const [filter, setFilter] = useViewState<'all' | 'multi' | 'single'>(
    'workspace.role.filter',
    'all',
  );
  const [roleDecisions, setRoleDecisions] = useViewState<Record<string, RoleDecision>>(
    'workspace.role.decisions',
    {},
  );
  const [stepDecisions, setStepDecisions] = useViewState<Record<string, StepDecision>>(
    'workspace.role.stepDecisions',
    {},
  );
  const [openTask, setOpenTask] = useState<OpenTask | null>(null);

  useEffect(() => {
    if (!roles || roles.length < 2 || ids.length > 0) return;
    const busiest = [...roles].sort(
      (a, b) => b.ownedTasks + b.participantTasks - (a.ownedTasks + a.participantTasks),
    );
    const first = busiest[0];
    const sibling = busiest.find((r) => r.id !== first.id && r.department === first.department);
    setIds([first.id, (sibling ?? busiest[1]).id]);
  }, [roles, ids.length, setIds]);
  useOnChange(`${ids.join(',')}|${stream}`, () => {
    setRoleDecisions({});
    setStepDecisions({});
  });

  const { data: details, loading, error } = useRoleDetails(ids);

  const divisions = useMemo(
    () => [...new Set((roles ?? []).map((r) => r.division).filter((d): d is string => !!d))].sort(),
    [roles],
  );
  const pool: PoolOption[] = useMemo(
    () =>
      (roles ?? [])
        .filter(
          (r) =>
            ids.includes(r.id) ||
            ((!division || r.division === division) && (!stream || r.streams.includes(stream))),
        )
        .map((r) => ({
          id: r.id,
          label: r.name,
          group: [r.division, r.department].filter(Boolean).join(' › ') || 'Unassigned',
          hint: `${r.ownedTasks + r.participantTasks} tasks`,
        })),
    [roles, division, stream, ids],
  );

  const { data: streamList } = useStreamList();
  const streams = useMemo(() => (streamList ?? []).map((s) => s.name).sort(), [streamList]);

  const columns: RoleColumnInput[] = useMemo(() => {
    if (!details) return [];
    return ids
      .map((id) => details[id])
      .filter(Boolean)
      .map((d) => ({
        id: d.id,
        name: d.name,
        subtitle: [d.division, d.department].filter(Boolean).join(' › ') || null,
        tasks: dedupeTasks(d.tasks).filter(
          (t) => !stream || (t.valueStream ?? 'Unmapped') === stream,
        ),
      }));
  }, [details, ids, stream]);

  const facts = useMemo(() => roleFacts(columns), [columns]);
  const keySets = useMemo(() => columnKeySets(columns), [columns]);
  const recTargetIdx = useMemo(() => (columns.length ? recommendedTarget(columns) : 0), [columns]);
  const recs = useMemo(
    () => (columns.length ? roleRecs(columns, facts, recTargetIdx) : []),
    [columns, facts, recTargetIdx],
  );

  const decisionOf = (idx: number): RoleDecision =>
    roleDecisions[columns[idx]?.id] ?? recs[idx]?.suggest ?? 'Keep';
  // The target must survive: the recommended target unless the user keeps a
  // different role while consolidating the recommended one away. Cheap
  // derivations (≤ a few thousand string ops) — recomputed per render.
  const targetIdx = (() => {
    if (!columns.length) return 0;
    if (decisionOf(recTargetIdx) === 'Keep') return recTargetIdx;
    const surviving = columns.map((_, i) => i).filter((i) => decisionOf(i) === 'Keep');
    if (surviving.length === 0) return recTargetIdx;
    return surviving.sort((x, y) => facts[y].steps - facts[x].steps)[0];
  })();

  const going = columns.map((_, i) => i !== targetIdx && decisionOf(i) !== 'Keep');
  const target = buildTarget(columns, going, targetIdx, stepDecisions);

  const totalSteps = facts.reduce((n, f) => n + f.steps, 0);
  const targetStreams = new Set(target.steps.map((s) => s.stream)).size;

  // Where the compared roles work — one pill per value stream in scope.
  const streamPills = useMemo(() => {
    const by = new Map<string, { steps: number; shorts: Set<string> }>();
    columns.forEach((c) => {
      for (const t of c.tasks) {
        const vs = t.valueStream ?? 'Unmapped';
        const cur = by.get(vs) ?? { steps: 0, shorts: new Set<string>() };
        cur.steps += 1;
        cur.shorts.add(roleShort(c.name));
        by.set(vs, cur);
      }
    });
    return [...by.entries()]
      .sort((a, b) => b[1].steps - a[1].steps)
      .slice(0, 8)
      .map(([name, v]) => ({ name, meta: `${v.steps} steps · ${[...v.shorts].join(', ')}` }));
  }, [columns]);

  const filterCounts = {
    all: totalSteps,
    multi: facts.reduce((n, f) => n + f.dup, 0),
    single: facts.reduce((n, f) => n + f.only, 0),
  };

  if (listLoading) return <LoadingState message="Loading roles…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const gridCols = `repeat(${columns.length}, ${ROLE_COL_W}px) ${ROLE_COL_W + 14}px`;
  const summary = columns
    .map((c, i) => `${roleShort(c.name)} ${decisionOf(i).toLowerCase()}`)
    .join(' · ');

  const commit = () =>
    dialogs.alert({
      title: 'Commit role changes',
      message: `${summary}. Result: ${target.steps.length} tasks in ${columns[targetIdx]?.name ?? 'the target role'} across ${targetStreams} value streams — ${target.merged} duplicate steps merged away, ${target.moved} moved across as-is. Committing into the live role graph is decision-preview only in this workspace.`,
    });

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
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          aria-label="Division filter"
          style={{ ...selectStyle, marginBottom: 10 }}
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={stream}
          onChange={(e) => setStream(e.target.value)}
          aria-label="Value stream filter"
          style={{ ...selectStyle, marginBottom: 10 }}
        >
          <option value="">All value streams</option>
          {streams.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Picker noun="role" pool={pool} selectedIds={ids} onChangeSelection={setIds} />
        <span style={{ fontSize: 10.5, color: '#a3a3a3', marginBottom: 10 }}>
          {totalSteps} atomic steps in scope · decide per role, the evidence is below
        </span>
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
          <div style={{ padding: 30, fontSize: 12.5, color: '#a3a3a3' }}>Loading roles…</div>
        ) : columns.length < 2 ? (
          <div style={{ padding: 30 }}>
            <EmptyState message="Pick at least two roles to compare." />
          </div>
        ) : (
          <div style={{ width: 'max-content', minWidth: '100%' }}>
            {/* Where these roles work */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderBottom: '1px solid #eaeaea',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  color: '#525252',
                }}
              >
                Where these roles work
              </span>
              {streamPills.map((p) => (
                <span
                  key={p.name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: '#fff',
                    border: '1px solid #eaeaea',
                    borderRadius: 999,
                    padding: '3px 11px',
                    fontSize: 11,
                    color: '#334155',
                  }}
                >
                  <b style={{ fontWeight: 600 }}>{p.name}</b>
                  <span style={{ color: '#94a3b8' }}>{p.meta}</span>
                </span>
              ))}
              <div style={{ flex: 1 }} />
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
                    ['all', 'All steps', filterCounts.all],
                    ['multi', 'Another role does it too', filterCounts.multi],
                    ['single', 'Only one role', filterCounts.single],
                  ] as ['all' | 'multi' | 'single', string, number][]
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

            {/* Role cards + target card */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: 10,
                alignItems: 'stretch',
                padding: '10px 14px',
                borderBottom: '1px solid #eaeaea',
                background: '#fafafa',
              }}
            >
              {columns.map((c, i) => {
                const rec = recs[i];
                const tone = ROLE_TONES[i % ROLE_TONES.length];
                const isTarget = i === targetIdx;
                const recStyle = isTarget
                  ? { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0', label: 'TARGET' }
                  : rec.rec === 'CONSOLIDATE'
                    ? { fg: INDIGO, bg: '#eef2ff', border: '#d6dcff', label: 'CONSOLIDATE' }
                    : { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0', label: 'KEEP' };
                const chosen = decisionOf(i);
                return (
                  <div
                    key={c.id}
                    style={{
                      minWidth: 0,
                      background: '#fff',
                      border: '1px solid #eaeaea',
                      borderLeft: `3px solid ${tone}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: '#171717',
                          flex: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={c.subtitle ?? undefined}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: recStyle.fg,
                          background: recStyle.bg,
                          border: `1px solid ${recStyle.border}`,
                          borderRadius: 5,
                          padding: '2px 6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {recStyle.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 7 }}>
                      <div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: '#171717',
                            lineHeight: 1.1,
                          }}
                        >
                          {facts[i].steps}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>steps</div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: 15, fontWeight: 700, color: tone, lineHeight: 1.1 }}
                        >
                          {facts[i].streams}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
                          {facts[i].streams === 1 ? 'value stream' : 'value streams'}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: 15, fontWeight: 700, color: INDIGO, lineHeight: 1.1 }}
                        >
                          {facts[i].dup}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
                          another role also does
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: 15, fontWeight: 700, color: AMBER, lineHeight: 1.1 }}
                        >
                          {facts[i].only}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>only it does</div>
                      </div>
                    </div>
                    <div
                      style={{ fontSize: 10.5, lineHeight: 1.45, color: '#334155', marginTop: 7 }}
                    >
                      {rec.reason}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
                      {(['Consolidate', 'Deprecate', 'Keep'] as RoleDecision[]).map((label) =>
                        actionButton(
                          label === 'Consolidate' && !isTarget
                            ? `Consolidate → ${roleShort(columns[targetIdx].name)}`
                            : label,
                          chosen === label,
                          label === 'Deprecate',
                          label === 'Consolidate',
                          () => setRoleDecisions((cur) => ({ ...cur, [c.id]: label })),
                        ),
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Target role result card */}
              <div
                style={{
                  minWidth: 0,
                  background: '#f6faf7',
                  border: '2px solid #a7f3d0',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#14532d',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {going.some(Boolean) ? columns[targetIdx].name : 'No change — every role stays'}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#fff',
                      background: '#047857',
                      borderRadius: 5,
                      padding: '2px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    TARGET ROLE
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 7 }}>
                  <div>
                    <div
                      style={{ fontSize: 15, fontWeight: 700, color: '#14532d', lineHeight: 1.1 }}
                    >
                      {target.steps.length}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#4d7c60' }}>tasks after</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: INDIGO, lineHeight: 1.1 }}>
                      {target.merged}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#4d7c60' }}>merged away</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: AMBER, lineHeight: 1.1 }}>
                      {target.moved}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#4d7c60' }}>moved in</div>
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 15, fontWeight: 700, color: '#14532d', lineHeight: 1.1 }}
                    >
                      {targetStreams}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#4d7c60' }}>value streams held</div>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, lineHeight: 1.45, color: '#14532d', marginTop: 7 }}>
                  {going.some(Boolean)
                    ? `${columns
                        .filter((_, i) => going[i])
                        .map((c) => roleShort(c.name))
                        .join(
                          ' + ',
                        )} fold in here: ${target.merged} of their steps are the same work this role already performs, ${target.moved} transfer across unchanged.`
                    : 'Pick Consolidate or Deprecate on a card and the resulting role builds here.'}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 9 }}>
                  <button
                    type="button"
                    onClick={commit}
                    style={{
                      font: 'inherit',
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#fff',
                      background: '#047857',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 9px',
                      cursor: 'pointer',
                    }}
                  >
                    Commit consolidation
                  </button>
                </div>
              </div>
            </div>

            {/* Stream-grouped, semantically aligned task view */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 14px',
                borderBottom: '1px solid #eaeaea',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  color: '#525252',
                }}
              >
                Every task, grouped by value stream
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                same work aligns on the same row across the roles · click any card for its full
                detail
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 14px',
                background: '#fafafa',
              }}
            >
              <div style={{ flex: 'none' }}>
                <AlignedTaskGrid
                  columns={columns}
                  keySets={keySets}
                  going={going}
                  targetIdx={targetIdx}
                  filter={filter}
                  onOpenTask={setOpenTask}
                />
              </div>
              <TargetColumn steps={target.steps} />
            </div>

            {/* Decisions footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '9px 14px',
                background: '#f6faf7',
                borderTop: '2px solid #a7f3d0',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12.5, color: '#525252' }}>
                Decisions so far: <b style={{ color: '#171717' }}>{summary}</b>
              </div>
              <span style={{ width: 1, height: 20, background: '#a7f3d0' }} />
              <div style={{ fontSize: 11.5, color: GREEN }}>
                <b>{target.steps.length}</b> steps after the change, from {totalSteps} today
              </div>
              <div style={{ fontSize: 11.5, color: INDIGO }}>
                <b>{target.merged}</b> duplicate steps removed
              </div>
              <div style={{ fontSize: 11.5, color: AMBER }}>
                <b>{target.moved}</b> steps that move across as-is
              </div>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => {
                  setRoleDecisions({});
                  setStepDecisions({});
                }}
                style={{
                  font: 'inherit',
                  fontSize: 11,
                  color: '#525252',
                  border: '1px solid #e5e5e5',
                  background: '#fff',
                  borderRadius: 6,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                Reset decisions
              </button>
              <button
                type="button"
                onClick={commit}
                style={{
                  font: 'inherit',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#fff',
                  background: '#171717',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Commit role changes
              </button>
            </div>
          </div>
        )}
      </div>

      {openTask && columns[openTask.colIdx] && (
        <RoleTaskModal
          open={openTask}
          columns={columns}
          keySets={keySets}
          going={going}
          targetIdx={targetIdx}
          stepDecisions={stepDecisions}
          onStepDecision={(key, d) => setStepDecisions((cur) => ({ ...cur, [key]: d }))}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}
