import { createPortal } from 'react-dom';
import { AMBER, GREEN, INDIGO } from '../types';
import { spineKey } from './spineCompare';
import {
  stepFate,
  roleShort,
  type RoleColumnInput,
  type RoleTask,
  type StepDecision,
  type StepFate,
  type TargetStep,
} from './roleConsolidation';

// The Roles lens' lower half — every task GROUPED BY VALUE STREAM, aligned
// across the compared roles by semantic name match (spineKey): tasks that are
// the same work sit on the same row, one cell per role; each role's own work
// stacks below inside the stream section. Every card opens a detail modal.
// The green target column builds the resulting role, grouped the same way.

export const ROLE_COL_W = 270;

const FATE_STYLE: Record<StepFateKindKey, { fg: string; bg: string; edge: string }> = {
  stays: { fg: '#047857', bg: '#f0fdf6', edge: GREEN },
  covered: { fg: INDIGO, bg: '#eef2ff', edge: INDIGO },
  merges: { fg: INDIGO, bg: '#eef2ff', edge: INDIGO },
  moves: { fg: AMBER, bg: '#fffbeb', edge: AMBER },
};
type StepFateKindKey = StepFate['kind'];

export interface OpenTask {
  colIdx: number;
  task: RoleTask;
}

/** Compact clickable task card — the depth lives in the modal. */
function TaskCardCompact({
  task,
  fate,
  onOpen,
}: {
  task: RoleTask;
  fate: StepFate;
  onOpen: () => void;
}) {
  const style = FATE_STYLE[fate.kind];
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        font: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderLeft: `3px solid ${style.edge}`,
        borderRadius: 7,
        padding: '5px 8px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ fontSize: 10.5, lineHeight: 1.3, color: '#171717' }}>{task.name}</div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}
      >
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            color: style.fg,
            background: style.bg,
            borderRadius: 4,
            padding: '1px 5px',
            whiteSpace: 'nowrap',
          }}
        >
          {fate.label}
        </span>
        {fate.also.length > 0 && (
          <span style={{ fontSize: 8.5, color: '#94a3b8' }}>also {fate.also.join(', ')}</span>
        )}
      </div>
    </button>
  );
}

function GapCell() {
  return (
    <div
      style={{
        border: '1px dashed #e5e9f0',
        borderRadius: 7,
        padding: '5px 8px',
        fontSize: 9,
        color: '#c3cedb',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      not in this role
    </div>
  );
}

/** The stream-grouped, semantically aligned task grid (role columns only —
 *  the target column renders separately so the two stay side by side). */
export function AlignedTaskGrid({
  columns,
  keySets,
  going,
  targetIdx,
  filter,
  onOpenTask,
}: {
  columns: RoleColumnInput[];
  keySets: Set<string>[];
  going: boolean[];
  targetIdx: number;
  filter: 'all' | 'multi' | 'single';
  onOpenTask: (open: OpenTask) => void;
}) {
  // Streams ordered by total volume across the compared roles.
  const streamOrder = new Map<string, number>();
  for (const c of columns)
    for (const t of c.tasks) {
      const vs = t.valueStream ?? 'Unmapped';
      streamOrder.set(vs, (streamOrder.get(vs) ?? 0) + 1);
    }
  const streams = [...streamOrder.entries()].sort((x, y) => y[1] - x[1]).map(([name]) => name);

  const gridCols = `repeat(${columns.length}, ${ROLE_COL_W}px)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {streams.map((stream) => {
        // Per column: this stream's tasks keyed by spineKey.
        const perCol = columns.map((c) =>
          c.tasks.filter((t) => (t.valueStream ?? 'Unmapped') === stream),
        );
        // Aligned rows: keys carried by 2+ roles, in first-seen order.
        const seen = new Set<string>();
        const alignedKeys: string[] = [];
        perCol.forEach((tasks) => {
          for (const t of tasks) {
            const k = spineKey(t.name);
            if (seen.has(k)) continue;
            seen.add(k);
            const carriers = perCol.filter((list) => list.some((x) => spineKey(x.name) === k));
            if (carriers.length > 1) alignedKeys.push(k);
          }
        });
        const singles = perCol.map((tasks) =>
          tasks.filter((t) => !alignedKeys.includes(spineKey(t.name))),
        );
        const total = perCol.reduce((n, l) => n + l.length, 0);
        if (total === 0) return null;

        const showAligned = filter !== 'single';
        const showSingles = filter !== 'multi';

        return (
          <div key={stream}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '5px 2px 4px',
                borderBottom: '1px solid #eef1f4',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#1e3a5f',
                }}
              >
                {stream}
              </span>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>
                {total} tasks · {alignedKeys.length} same work across roles
              </span>
            </div>

            {showAligned && alignedKeys.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {alignedKeys.map((k) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8 }}>
                    {columns.map((c, ci) => {
                      const t = perCol[ci].find((x) => spineKey(x.name) === k);
                      return t ? (
                        <TaskCardCompact
                          key={c.id}
                          task={t}
                          fate={stepFate(t, ci, columns, keySets, going, targetIdx)}
                          onOpen={() => onOpenTask({ colIdx: ci, task: t })}
                        />
                      ) : (
                        <GapCell key={c.id} />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {showSingles && singles.some((l) => l.length > 0) && (
              <div
                style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, marginBottom: 4 }}
              >
                {columns.map((c, ci) => (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {singles[ci].map((t) => (
                      <TaskCardCompact
                        key={t.id}
                        task={t}
                        fate={stepFate(t, ci, columns, keySets, going, targetIdx)}
                        onOpen={() => onOpenTask({ colIdx: ci, task: t })}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TargetColumn({ steps }: { steps: TargetStep[] }) {
  const groups: { name: string; steps: (TargetStep & { n: number })[] }[] = [];
  let n = 0;
  for (const s of steps) {
    n += 1;
    let g = groups.find((x) => x.name === s.stream);
    if (!g) {
      g = { name: s.stream, steps: [] };
      groups.push(g);
    }
    g.steps.push({ ...s, n });
  }
  return (
    <div
      style={{
        minWidth: 0,
        width: ROLE_COL_W + 14,
        background: '#f6faf7',
        border: '2px solid #a7f3d0',
        borderRadius: 10,
        padding: 9,
        boxSizing: 'border-box',
      }}
    >
      {groups.map((g) => (
        <div key={g.name} style={{ marginBottom: 9 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 2px 5px' }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#4d7c60',
              }}
            >
              {g.name}
            </span>
            <span style={{ fontSize: 9, color: '#8fb8a0' }}>
              {g.steps.length} {g.steps.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {g.steps.map((s) => (
              <div
                key={s.key}
                style={{
                  background: '#fff',
                  border: '1px solid #bbe7cf',
                  borderRadius: 7,
                  padding: '5px 8px',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: '#047857',
                      color: '#fff',
                      fontSize: 8,
                      fontWeight: 800,
                      lineHeight: '14px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </span>
                  <span style={{ fontSize: 10.5, lineHeight: 1.3, color: '#14532d', flex: 1 }}>
                    {s.name}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  {s.sources.map((src) => (
                    <span
                      key={src.id}
                      style={{
                        fontSize: 8.5,
                        fontWeight: 600,
                        color: INDIGO,
                        background: '#f6f7fb',
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      {src.short}
                    </span>
                  ))}
                  <div style={{ flex: 1 }} />
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color:
                        s.badge === 'merged' ? '#047857' : s.badge === 'moved' ? AMBER : '#94a3b8',
                    }}
                  >
                    {s.badge === 'merged'
                      ? 'merged 2→1'
                      : s.badge === 'moved'
                        ? 'moved in'
                        : 'unchanged'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {steps.length === 0 && (
        <div style={{ fontSize: 10.5, color: '#4d7c60', padding: 6 }}>
          Nothing is consolidating — pick Consolidate or Deprecate on a card and the resulting role
          builds here.
        </div>
      )}
    </div>
  );
}

/** In-depth task detail — everything the compact card doesn't show. */
export function RoleTaskModal({
  open,
  columns,
  keySets,
  going,
  targetIdx,
  stepDecisions,
  onStepDecision,
  onClose,
}: {
  open: OpenTask;
  columns: RoleColumnInput[];
  keySets: Set<string>[];
  going: boolean[];
  targetIdx: number;
  stepDecisions: Record<string, StepDecision>;
  onStepDecision: (key: string, d: StepDecision) => void;
  onClose: () => void;
}) {
  const col = columns[open.colIdx];
  const task = open.task;
  const fate = stepFate(task, open.colIdx, columns, keySets, going, targetIdx);
  const style = FATE_STYLE[fate.kind];
  const k = spineKey(task.name);
  const carriers = columns
    .map((c, ci) => ({ c, ci, t: c.tasks.find((x) => spineKey(x.name) === k) }))
    .filter((x): x is { c: RoleColumnInput; ci: number; t: RoleTask } => !!x.t);
  const decKey = `${col.id}:${task.id}`;
  const chosen = stepDecisions[decKey] ?? (going[open.colIdx] ? 'Move' : 'Keep');

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.34)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 110,
      }}
    >
      <div
        role="dialog"
        aria-label={task.name}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: 'calc(100% - 60px)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '13px 16px',
            borderBottom: '1px solid #eaeaea',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '.07em',
                textTransform: 'uppercase',
                color: style.fg,
              }}
            >
              {col.name} · {task.involvement}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#171717', marginTop: 3 }}>
              {task.name}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
              {[task.valueStream ?? 'Unmapped', task.l3, task.l4].filter(Boolean).join(' › ')}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              font: 'inherit',
              fontSize: 14,
              color: '#a3a3a3',
              background: 'none',
              border: 'none',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: style.fg,
                background: style.bg,
                borderRadius: 5,
                padding: '2px 8px',
              }}
            >
              {fate.label}
            </span>
            {going[open.colIdx] && (
              <span style={{ fontSize: 11, color: '#525252' }}>
                target: <b>{columns[targetIdx].name}</b>
              </span>
            )}
          </div>

          <div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#a3a3a3',
                marginBottom: 4,
              }}
            >
              Who does this work
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {carriers.map(({ c, t }) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #f1f3f5',
                    borderRadius: 7,
                    padding: '5px 9px',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f' }}>
                    {roleShort(c.name)}
                  </span>
                  <span style={{ fontSize: 11.5, color: '#171717', flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 10.5, color: '#64748b' }}>{t.involvement}</span>
                </div>
              ))}
              {carriers.length === 1 && (
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                  No other compared role does this work.
                </div>
              )}
            </div>
          </div>

          {task.apps.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#a3a3a3',
                  marginBottom: 4,
                }}
              >
                Applications
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {task.apps.map((app) => (
                  <span
                    key={app}
                    style={{
                      fontSize: 10.5,
                      color: '#334155',
                      background: '#f5f7fa',
                      border: '1px solid #e5e7eb',
                      borderRadius: 5,
                      padding: '2px 8px',
                    }}
                  >
                    {app}
                  </span>
                ))}
              </div>
            </div>
          )}

          {going[open.colIdx] && (
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: '#a3a3a3',
                  marginBottom: 4,
                }}
              >
                Decision for this task
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {(
                  [
                    ['Move', '→ target'],
                    ['Keep', 'keep here'],
                    ['Drop', 'drop'],
                  ] as [StepDecision, string][]
                ).map(([key, label]) => {
                  const on = chosen === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onStepDecision(decKey, key)}
                      style={{
                        font: 'inherit',
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: 6,
                        padding: '4px 10px',
                        color: on ? '#fff' : '#525252',
                        background: on
                          ? key === 'Drop'
                            ? '#dc2626'
                            : key === 'Move'
                              ? INDIGO
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
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
