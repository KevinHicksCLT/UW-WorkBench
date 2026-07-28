import { AMBER, GREEN, INDIGO } from '../types';
import {
  stepFate,
  type RoleColumnInput,
  type StepDecision,
  type TargetStep,
} from './roleConsolidation';

// The Roles lens' lower half — "every task, column by column": one column per
// compared role, its steps grouped under their own L3 › L4 sub-process, each
// carrying its computed fate and a per-step decision; the green target column
// builds the resulting role from every surviving step.

export const ROLE_COL_W = 280;

const FATE_STYLE: Record<string, { fg: string; bg: string }> = {
  stays: { fg: '#047857', bg: '#f0fdf6' },
  covered: { fg: INDIGO, bg: '#eef2ff' },
  merges: { fg: INDIGO, bg: '#eef2ff' },
  moves: { fg: AMBER, bg: '#fffbeb' },
};

function StepDecisionButtons({
  chosen,
  onPick,
}: {
  chosen: StepDecision;
  onPick: (d: StepDecision) => void;
}) {
  const options: [StepDecision, string][] = [
    ['Move', '→ target'],
    ['Keep', 'keep here'],
    ['Drop', 'drop'],
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        marginTop: 7,
        borderTop: '1px solid #f4f6f8',
        paddingTop: 6,
      }}
    >
      {options.map(([key, label]) => {
        const on = chosen === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            style={{
              font: 'inherit',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 5,
              padding: '2px 7px',
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
  );
}

export function RoleColumn({
  col,
  colIdx,
  columns,
  keySets,
  going,
  targetIdx,
  filter,
  stepDecisions,
  onStepDecision,
}: {
  col: RoleColumnInput;
  colIdx: number;
  columns: RoleColumnInput[];
  keySets: Set<string>[];
  going: boolean[];
  targetIdx: number;
  filter: 'all' | 'multi' | 'single';
  stepDecisions: Record<string, StepDecision>;
  onStepDecision: (key: string, d: StepDecision) => void;
}) {
  interface Group {
    name: string;
    steps: { task: RoleColumnInput['tasks'][number]; n: number }[];
  }
  const groups: Group[] = [];
  for (const t of col.tasks) {
    const fate = stepFate(t, colIdx, columns, keySets, going, targetIdx);
    if (filter === 'multi' && fate.also.length === 0) continue;
    if (filter === 'single' && fate.also.length > 0) continue;
    const gName = [t.l3, t.l4].filter(Boolean).join(' › ') || (t.valueStream ?? 'Unmapped');
    let g = groups.find((x) => x.name === gName);
    if (!g) {
      g = { name: gName, steps: [] };
      groups.push(g);
    }
    g.steps.push({ task: t, n: g.steps.length + 1 });
  }

  return (
    <div style={{ minWidth: 0, width: ROLE_COL_W }}>
      {groups.map((g) => (
        <div key={g.name} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 2px 6px' }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#64748b',
              }}
            >
              {g.name}
            </span>
            <span style={{ fontSize: 9, color: '#b6c2d1' }}>
              {g.steps.length} {g.steps.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.steps.map(({ task, n }) => {
              const fate = stepFate(task, colIdx, columns, keySets, going, targetIdx);
              const style = FATE_STYLE[fate.kind];
              const decKey = `${col.id}:${task.id}`;
              const chosen = stepDecisions[decKey] ?? (going[colIdx] ? 'Move' : 'Keep');
              return (
                <div
                  key={task.id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${fate.kind === 'moves' ? '#fde68a' : '#e2e8f0'}`,
                    borderLeft: `3px solid ${fate.kind === 'moves' ? AMBER : fate.kind === 'stays' ? GREEN : INDIGO}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontFamily: 'ui-monospace, monospace',
                        color: '#cbd5e1',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {n}
                    </span>
                    <span style={{ fontSize: 10.5, lineHeight: 1.35, color: '#171717', flex: 1 }}>
                      {task.name}
                    </span>
                  </div>
                  {task.apps.length > 0 && (
                    <div
                      style={{
                        fontSize: 9,
                        fontFamily: 'ui-monospace, monospace',
                        color: '#a3a3a3',
                        marginTop: 3,
                      }}
                    >
                      {task.apps.join(' · ')}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: style.fg,
                        background: style.bg,
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      {fate.label}
                    </span>
                    <span style={{ fontSize: 9, color: '#b6c2d1' }}>
                      {fate.also.length
                        ? `also done by ${fate.also.join(', ')}`
                        : 'no other compared role'}
                    </span>
                  </div>
                  {going[colIdx] && (
                    <StepDecisionButtons
                      chosen={chosen}
                      onPick={(d) => onStepDecision(decKey, d)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <div style={{ fontSize: 10, color: '#a3a3a3', padding: 6 }}>
          No steps match this filter.
        </div>
      )}
    </div>
  );
}

export function TargetColumn({ steps }: { steps: TargetStep[] }) {
  const groups: { name: string; steps: (TargetStep & { n: number })[] }[] = [];
  let n = 0;
  for (const s of steps) {
    n += 1;
    let g = groups.find((x) => x.name === s.group);
    if (!g) {
      g = { name: s.group, steps: [] };
      groups.push(g);
    }
    g.steps.push({ ...s, n });
  }
  return (
    <div
      style={{
        minWidth: 0,
        width: ROLE_COL_W + 20,
        background: '#f6faf7',
        border: '2px solid #a7f3d0',
        borderRadius: 10,
        padding: 11,
        boxSizing: 'border-box',
      }}
    >
      {groups.map((g) => (
        <div key={g.name} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 2px 6px' }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.steps.map((s) => (
              <div
                key={s.key}
                style={{
                  background: '#fff',
                  border: '1px solid #bbe7cf',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 999,
                      background: '#047857',
                      color: '#fff',
                      fontSize: 8,
                      fontWeight: 800,
                      lineHeight: '15px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </span>
                  <span style={{ fontSize: 10.5, lineHeight: 1.35, color: '#14532d', flex: 1 }}>
                    {s.name}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {s.sources.map((src) => (
                    <span
                      key={src.id}
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: INDIGO,
                        background: '#f6f7fb',
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      {src.short} step
                    </span>
                  ))}
                  <div style={{ flex: 1 }} />
                  <span
                    style={{
                      fontSize: 9,
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
