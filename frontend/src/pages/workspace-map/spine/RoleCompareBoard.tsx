import { useEffect, useMemo } from 'react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../components/ui';
import { useDialogs } from '../../../lib/dialogs';
import { useOnChange, useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import ImpactPanel from '../impact/ImpactPanel';
import { useImpactGate } from '../impact/useImpactGate';
import { INDIGO } from '../types';
import { Picker, type PoolOption } from './SpineBoard';
import { RoleRail, RoleFlowStrip } from './RoleBuilderRail';
import { RoleColumns, type TaskFilter } from './RoleTaskColumns';
import { type BuilderItem, type DragPayload } from './processBuilder';
import {
  columnKeySets,
  dedupeTasks,
  isAgentable,
  makeKeyOf,
  recommendedTarget,
  roleFacts,
  roleRecs,
  type RoleColumnInput,
} from './roleConsolidation';
import { useRoleDetails, useRoleList, useStreamList, useTaskSteps } from './useSpineData';

// Roles lens — the role editor. Compact role cards carry the consolidation
// evidence and decision (through the change-impact gate); below, one dense
// column per role with its tasks in flow order, each expandable to its
// Process level 6 Work Library steps. The right rail is the NEW STATE: drag
// tasks into the New role box (kept manual work), the Agent box (an agent
// runs it), or Delete (impact-assessed). The final sequence strip at the
// bottom assembles the new role in real time — reorder, rename, flip
// agent/manual, all editable.

const ROLE_TONES = ['#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#64748b', '#0891b2'];

const selectStyle = {
  border: '1px solid #e5e5e5',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  background: '#fff',
  maxWidth: 220,
} as const;

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
  const [filter, setFilter] = useViewState<TaskFilter>('workspace.role.filter', 'all');
  const [builder, setBuilder] = useViewState<BuilderItem[]>('workspace.role.builder', []);
  const [builderName, setBuilderName] = useViewState<string>(
    'workspace.role.builderName',
    'New role',
  );
  // '' = brand-new role; a role id = consolidate INTO that existing role.
  const [targetRoleId, setTargetRoleId] = useViewState<string>('workspace.role.targetRole', '');
  const [deleted, setDeleted] = useViewState<{ name: string; source: string; nodeIds: string[] }[]>(
    'workspace.role.deleted',
    [],
  );
  const [openTasks, setOpenTasks] = useViewState<string[]>('workspace.role.openTasks', []);
  const { load: loadSteps, stepsOf } = useTaskSteps();

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
    setBuilder([]);
    setDeleted([]);
    setOpenTasks([]);
    setTargetRoleId('');
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

  // Fuzzy canonical-key matching — the same task worded differently across
  // roles still matches (exact matching made every rec degenerate to KEEP).
  const keyOf = useMemo(() => makeKeyOf(columns), [columns]);
  const facts = useMemo(() => roleFacts(columns, keyOf), [columns, keyOf]);
  const keySets = useMemo(() => columnKeySets(columns, keyOf), [columns, keyOf]);
  const recTargetIdx = useMemo(
    () => (columns.length ? recommendedTarget(columns, keyOf) : 0),
    [columns, keyOf],
  );
  const recs = useMemo(
    () => (columns.length ? roleRecs(columns, facts, recTargetIdx, keyOf) : []),
    [columns, facts, recTargetIdx, keyOf],
  );

  // The target follows the rail's Target chooser: an existing role picked
  // there IS the target; otherwise the coverage-recommended one. Fate chips
  // derive from the recommendations (the old per-card decision buttons are
  // gone — the rail is the one decision surface).
  const chosenTargetIdx = targetRoleId ? columns.findIndex((c) => c.id === targetRoleId) : -1;
  const targetIdx = chosenTargetIdx >= 0 ? chosenTargetIdx : recTargetIdx;
  const going = columns.map((_, i) => i !== targetIdx && (recs[i]?.suggest ?? 'Keep') !== 'Keep');

  // Filter counts are DISTINCT units of work (fuzzy canonical key), not raw
  // per-role rows — the same task carried by both roles counts once. "Agent
  // can run it" = at least one carrier scores automatability ≤ 2 (autonomous
  // agent / agentic workflow) on the 1-5 ProcessNode scale.
  const filterCounts = useMemo(() => {
    const info = new Map<string, { cols: Set<number>; agent: boolean }>();
    columns.forEach((c, ci) => {
      for (const t of c.tasks) {
        const k = keyOf(t.name);
        const e = info.get(k) ?? { cols: new Set<number>(), agent: false };
        e.cols.add(ci);
        if (isAgentable(t.agent)) e.agent = true;
        info.set(k, e);
      }
    });
    const rows = [...info.values()];
    return {
      all: rows.length,
      agent: rows.filter((r) => r.agent).length,
      multi: rows.filter((r) => r.cols.size > 1).length,
      single: rows.filter((r) => r.cols.size === 1).length,
    };
  }, [columns, keyOf]);

  // Destructive rail drops and the commit route through the common
  // change-impact gate; nothing records until confirmed.
  const gate = useImpactGate();
  const deleteTask = (p: DragPayload) => {
    gate.run(
      {
        changeType: 'DROP',
        label: p.name,
        subject: { kind: 'process-nodes', nodeIds: p.nodeIds },
      },
      () => setDeleted((cur) => [...cur, { name: p.name, source: p.source, nodeIds: p.nodeIds }]),
    );
  };
  const targetRole = targetRoleId ? (columns.find((c) => c.id === targetRoleId) ?? null) : null;
  const effectiveName = targetRole?.name ?? builderName;
  const commit = () => {
    const nodeIds = [...new Set(builder.flatMap((b) => b.nodeIds))];
    const agentRun = builder.filter((b) => b.agent).length;
    const summarize = () =>
      dialogs.alert({
        title: targetRole ? `Consolidate into ${targetRole.name}` : `Commit “${builderName}”`,
        message: `${builder.length} tasks ${targetRole ? `consolidate into the existing role ${targetRole.name}` : `in ${builderName}`} — ${agentRun} run agent-only, ${builder.length - agentRun} stay manual, ${deleted.length} deleted from the model. Committing into the live role graph is decision-preview only in this workspace; export the sequence to take it forward.`,
      });
    if (!nodeIds.length) return summarize();
    gate.run(
      targetRole
        ? {
            changeType: 'CONSOLIDATE',
            label: targetRole.name,
            subject: { kind: 'role', roleId: targetRole.id, taskIds: nodeIds },
          }
        : {
            changeType: 'CONSOLIDATE',
            label: builderName,
            subject: { kind: 'process-nodes', nodeIds },
          },
      summarize,
    );
  };

  if (listLoading) return <LoadingState message="Loading roles…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const cardGrid = `repeat(${columns.length}, minmax(240px, 340px))`;

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
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          aria-label="Division filter"
          style={{ ...selectStyle, marginBottom: 8 }}
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
          style={{ ...selectStyle, marginBottom: 8 }}
        >
          <option value="">All value streams</option>
          {streams.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Picker noun="role" pool={pool} selectedIds={ids} onChangeSelection={setIds} />
      </div>

      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 24, fontSize: 12.5, color: '#a3a3a3' }}>Loading roles…</div>
        ) : columns.length < 2 ? (
          <div style={{ padding: 24 }}>
            <EmptyState message="Pick at least two roles to compare." />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ width: 'max-content', minWidth: '100%' }}>
                {/* Role decision cards — compact, one line of stats. */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: cardGrid,
                    gap: 6,
                    alignItems: 'stretch',
                    padding: '6px 10px',
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
                    return (
                      <div
                        key={c.id}
                        style={{
                          minWidth: 0,
                          background: '#fff',
                          border: '1px solid #eaeaea',
                          borderLeft: `3px solid ${tone}`,
                          borderRadius: 8,
                          padding: '6px 9px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#171717',
                              flex: 1,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={`${c.name}${c.subtitle ? ` — ${c.subtitle}` : ''} · ${rec.reason}`}
                          >
                            {c.name}
                          </span>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 700,
                              color: recStyle.fg,
                              background: recStyle.bg,
                              border: `1px solid ${recStyle.border}`,
                              borderRadius: 5,
                              padding: '1px 5px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {recStyle.label}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 4,
                            fontSize: 10,
                            color: '#525252',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>
                            <b style={{ color: '#171717' }}>{facts[i].steps}</b> steps
                          </span>
                          <span>
                            <b style={{ color: '#047857' }}>{facts[i].agentable}</b> agent-runnable
                          </span>
                          <span>
                            <b style={{ color: INDIGO }}>{facts[i].dup}</b> shared
                          </span>
                          <span>
                            <b style={{ color: '#b45309' }}>{facts[i].only}</b> only here
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Filter row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 10px',
                    borderBottom: '1px solid #eaeaea',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      height: 24,
                      border: '1px solid #eaeaea',
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: '#fff',
                    }}
                  >
                    {(
                      [
                        [
                          'all',
                          'All work',
                          filterCounts.all,
                          'Distinct units of work across the compared roles — the same task in both roles counts once',
                        ],
                        [
                          'agent',
                          'Agent can run it',
                          filterCounts.agent,
                          'Tasks whose automatability score is 1 (autonomous agent) or 2 (agentic workflow) on the 1-5 scale stored per task in the operating model — an agent performs them end-to-end, no human in the loop',
                        ],
                        [
                          'multi',
                          'Another role does it too',
                          filterCounts.multi,
                          'Distinct work carried by two or more of the compared roles (fuzzy name match)',
                        ],
                        [
                          'single',
                          'Only one role',
                          filterCounts.single,
                          'Distinct work only one compared role carries',
                        ],
                      ] as [TaskFilter, string, number, string][]
                    ).map(([key, label, count, tip], i) => {
                      const on = filter === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFilter(key)}
                          title={tip}
                          style={{
                            font: 'inherit',
                            padding: '0 9px',
                            fontSize: 10.5,
                            lineHeight: '24px',
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
                  <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                    expand a task for its level-6 steps · drag any task into the rail on the right
                  </span>
                </div>

                {/* Task columns + new-state rail */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    padding: '8px 10px',
                    background: '#fafafa',
                  }}
                >
                  <RoleColumns
                    columns={columns}
                    keySets={keySets}
                    keyOf={keyOf}
                    going={going}
                    targetIdx={targetIdx}
                    filter={filter}
                    openTasks={openTasks}
                    onToggleTask={(id) => {
                      setOpenTasks((cur) =>
                        cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                      );
                      loadSteps([id]);
                    }}
                    stepsOf={stepsOf}
                  />
                  <RoleRail
                    name={builderName}
                    onRename={setBuilderName}
                    targetRoleId={targetRoleId}
                    onTargetRole={setTargetRoleId}
                    roleOptions={columns.map((c) => ({ id: c.id, name: c.name }))}
                    items={builder}
                    onChange={setBuilder}
                    onDeleteTask={deleteTask}
                    deleted={deleted}
                    onRestore={(i) => setDeleted((cur) => cur.filter((_, x) => x !== i))}
                    onCommit={commit}
                  />
                </div>
              </div>
            </div>

            <RoleFlowStrip name={effectiveName} items={builder} onChange={setBuilder} />
          </>
        )}
      </div>
      <ImpactPanel gate={gate} />
    </div>
  );
}
