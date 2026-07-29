import { AMBER, GREEN, INDIGO } from '../types';
import { setDragPayload, type DragPayload } from './processBuilder';
import {
  AGENT_LABELS,
  isAgentable,
  isAgentAssisted,
  stepFate,
  type KeyOf,
  type RoleColumnInput,
  type RoleFacts,
  type RoleRec,
  type RoleTask,
  type StepFate,
} from './roleConsolidation';
import type { TaskStep } from './useSpineData';

// The Roles lens' task board — one column per compared role, its tasks as
// HIGH-LEVEL cards in the order they happen (grouped by value stream, the
// stream order = how the role's work flows). Every card expands to its
// Process level 6 steps (the task's Work Library plan), carries its
// agent-automatability chip, and drags into the right-hand rail: New role
// box, Agent box, or Delete. Dense on purpose — the page is an editor, not a
// dashboard.

export const ROLE_COL_W = 280;

/** Column accent per compared role — same cycle the decision cards use. */
const ROLE_TONES = ['#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#64748b', '#0891b2'];

export type TaskFilter = 'all' | 'agent' | 'multi' | 'single';

const FATE_STYLE: Record<StepFate['kind'], { fg: string; bg: string; edge: string }> = {
  stays: { fg: '#047857', bg: '#f0fdf6', edge: GREEN },
  covered: { fg: INDIGO, bg: '#eef2ff', edge: INDIGO },
  merges: { fg: INDIGO, bg: '#eef2ff', edge: INDIGO },
  moves: { fg: AMBER, bg: '#fffbeb', edge: AMBER },
};

/** Agent-automatability chip: green = agent runs it, indigo = agent helps,
 *  muted = human only / unscored. */
export function AgentChip({ score, size = 8 }: { score: number | null; size?: number }) {
  const style = isAgentable(score)
    ? { fg: '#047857', bg: '#ecfdf5', label: 'AGENT' }
    : isAgentAssisted(score)
      ? { fg: '#4338ca', bg: '#eef2ff', label: 'CO-PILOT' }
      : { fg: '#737373', bg: '#f5f5f5', label: 'HUMAN' };
  return (
    <span
      title={score ? `${AGENT_LABELS[score]} (automatability ${score}/5)` : 'Not yet scored'}
      style={{
        fontSize: size,
        fontWeight: 700,
        color: style.fg,
        background: style.bg,
        borderRadius: 4,
        padding: '0 4px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {style.label}
    </span>
  );
}

function TaskCard({
  task,
  role,
  fate,
  open,
  steps,
  onToggle,
}: {
  task: RoleTask;
  role: string;
  fate: StepFate;
  open: boolean;
  steps: TaskStep[] | undefined;
  onToggle: () => void;
}) {
  const style = FATE_STYLE[fate.kind];
  return (
    <div
      draggable
      onDragStart={(e) =>
        setDragPayload(e, {
          name: task.name,
          level: '5',
          source: role,
          nodeIds: [task.id],
          agentScore: task.agent,
        })
      }
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderLeft: `3px solid ${style.edge}`,
        borderRadius: 6,
        cursor: 'grab',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        title={`${task.involvement}${task.l4 ? ` · ${task.l4}` : ''} — expand to Process level 6 steps`}
        style={{
          font: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
          background: 'none',
          border: 'none',
          padding: '4px 7px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: 1.3, color: '#171717' }}>
            {task.name}
          </span>
          <span style={{ flexShrink: 0, fontSize: 9, color: '#94a3b8' }}>{open ? '▴' : '▾'}</span>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}
        >
          <AgentChip score={task.agent} />
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: style.fg,
              background: style.bg,
              borderRadius: 4,
              padding: '0 4px',
              whiteSpace: 'nowrap',
            }}
          >
            {fate.label}
          </span>
          {fate.also.length > 0 && (
            <span style={{ fontSize: 8, color: '#94a3b8' }}>also {fate.also.join(', ')}</span>
          )}
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 7px 5px 12px' }}>
          {steps === undefined ? (
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>Loading level-6 steps…</div>
          ) : steps.length === 0 ? (
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>
              No task-specific steps on this task yet.
            </div>
          ) : (
            steps.map((s) => (
              <div
                key={s.seq}
                title={s.detail ?? undefined}
                style={{
                  display: 'flex',
                  gap: 4,
                  fontSize: 8.5,
                  lineHeight: 1.35,
                  color: '#475569',
                }}
              >
                <span style={{ color: '#a3b2c2', fontVariantNumeric: 'tabular-nums' }}>
                  {s.seq}.
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{s.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** One column per compared role, HEADED by the role's own card (name, rec
 *  badge, stats) — no repeated labels anywhere; the tasks fall beneath,
 *  stream-grouped, sequential, expandable. */
export function RoleColumns({
  columns,
  facts,
  recs,
  keySets,
  keyOf,
  going,
  targetIdx,
  filter,
  openTasks,
  onToggleTask,
  stepsOf,
}: {
  columns: RoleColumnInput[];
  facts: RoleFacts[];
  recs: RoleRec[];
  keySets: Set<string>[];
  keyOf: KeyOf;
  going: boolean[];
  targetIdx: number;
  filter: TaskFilter;
  openTasks: string[];
  onToggleTask: (taskId: string) => void;
  stepsOf: (taskId: string) => TaskStep[] | undefined;
}) {
  const openSet = new Set(openTasks);
  const visible = (t: RoleTask, ci: number): boolean => {
    if (filter === 'agent') return isAgentable(t.agent);
    if (filter === 'all') return true;
    const k = keyOf(t.name);
    const elsewhere = keySets.some((s, i) => i !== ci && s.has(k));
    return filter === 'multi' ? elsewhere : !elsewhere;
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {columns.map((col, ci) => {
        const tone = ROLE_TONES[ci % ROLE_TONES.length];
        const tasks = col.tasks.filter((t) => visible(t, ci));
        // Stream groups in the role's own volume order — the sequence the
        // role's work actually flows through.
        const groups: { stream: string; tasks: RoleTask[] }[] = [];
        for (const t of tasks) {
          const vs = t.valueStream ?? 'Unmapped';
          let g = groups.find((x) => x.stream === vs);
          if (!g) {
            g = { stream: vs, tasks: [] };
            groups.push(g);
          }
          g.tasks.push(t);
        }
        return (
          <div
            key={col.id}
            style={{
              width: ROLE_COL_W,
              flexShrink: 0,
              boxSizing: 'border-box',
              border: '1px solid #eaeaea',
              borderTop: `3px solid ${tone}`,
              borderRadius: 8,
              background: '#fff',
              padding: 6,
            }}
          >
            {/* The role's card IS the column header — name, recommendation
                and stats once, everything below is ITS work, sectioned by
                value stream. */}
            {(() => {
              const rec = recs[ci];
              const isTarget = ci === targetIdx;
              const recStyle = isTarget
                ? { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0', label: 'TARGET' }
                : rec?.rec === 'CONSOLIDATE'
                  ? { fg: INDIGO, bg: '#eef2ff', border: '#d6dcff', label: 'CONSOLIDATE' }
                  : { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0', label: 'KEEP' };
              const f = facts[ci];
              return (
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    background: '#fff',
                    borderBottom: `1px solid ${tone}33`,
                    padding: '2px 2px 5px',
                    marginBottom: 6,
                  }}
                  title={rec?.reason}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: tone,
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {col.name}
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
                        flexShrink: 0,
                      }}
                    >
                      {recStyle.label}
                    </span>
                  </div>
                  {f && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 3,
                        fontSize: 9.5,
                        color: '#525252',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>
                        <b style={{ color: '#171717' }}>{f.steps}</b> steps
                      </span>
                      <span>
                        <b style={{ color: '#047857' }}>{f.agentable}</b> agent-runnable
                      </span>
                      <span>
                        <b style={{ color: INDIGO }}>{f.dup}</b> shared
                      </span>
                      <span>
                        <b style={{ color: '#b45309' }}>{f.only}</b> only here
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
            {groups.map((g) => (
              <div key={g.stream} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#f5f7fa',
                    border: '1px solid #e8edf3',
                    borderRadius: 5,
                    padding: '2px 6px',
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 7,
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      color: '#64748b',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 4,
                      padding: '0 4px',
                      flexShrink: 0,
                    }}
                    title={`Where ${col.name} performs these tasks`}
                  >
                    VALUE STREAM
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#1e3a5f',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.stream}
                  </span>
                  <span style={{ fontSize: 8.5, color: '#94a3b8', flexShrink: 0 }}>
                    {g.tasks.length} tasks
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {g.tasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      role={col.name}
                      fate={stepFate(t, ci, columns, keySets, going, targetIdx, keyOf)}
                      open={openSet.has(t.id)}
                      steps={stepsOf(t.id)}
                      onToggle={() => onToggleTask(t.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div style={{ fontSize: 10, color: '#94a3b8', padding: 6 }}>
                Nothing matches this filter.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { DragPayload };
