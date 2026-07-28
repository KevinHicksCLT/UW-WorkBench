import { GREEN, INDIGO } from '../types';
import VsNewProcessFlow, { streamBg, streamTone, type ReconDecision } from './VsNewProcessFlow';
import type { ReconPhase, ReconRow } from './spineCompare';

// The Value-streams lens' DETAIL view — the comparison grid the map hands off
// to: sub-process rail on the left, canonical L5 tasks as rows (each task
// appears ONCE) with one column per compared stream. A cell is the stream's
// own sequence number for that task, or — when the stream doesn't do it.
// Decisions live on the row; the normalized new-process flow closes the view.

export interface RailEntry {
  key: string;
  label: string;
  count: number;
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
    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
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

export default function VsCompareGrid({
  phase,
  phases,
  onPhase,
  rail,
  railKey,
  onRail,
  rows,
  names,
  decisions,
  decisionOf,
  onDecide,
  onBackToMap,
}: {
  phase: ReconPhase;
  phases: ReconPhase[];
  onPhase: (key: string) => void;
  rail: RailEntry[];
  railKey: string | null;
  onRail: (key: string | null) => void;
  rows: ReconRow[];
  names: string[];
  decisions: Record<string, ReconDecision>;
  decisionOf: (row: ReconRow) => ReconDecision;
  onDecide: (rowKey: string, d: ReconDecision) => void;
  onBackToMap: () => void;
}) {
  const grid = `minmax(280px,1fr) repeat(${names.length}, 108px) 170px`;
  const decidedCount = rows.filter((r) => decisions[r.key]).length;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fafafa' }}>
      <div style={{ padding: '12px 16px 20px', minWidth: 700 + names.length * 110 }}>
        {/* Phase pill row — every phase, the open one dark (design 2b's stream pills). */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            paddingBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={onBackToMap}
            style={{
              font: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 9999,
              padding: '4px 11px',
              fontSize: 11.5,
              fontWeight: 600,
              background: '#fff',
              color: '#171717',
              border: '1px solid #d4d4d4',
              cursor: 'pointer',
            }}
          >
            ‹ Map
          </button>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#737373',
              margin: '0 2px',
            }}
          >
            Phase
          </span>
          {phases.map((p) => {
            const on = p.key === phase.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onPhase(p.key)}
                style={{
                  font: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 9999,
                  padding: '4px 11px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  background: on ? '#171717' : '#fff',
                  color: on ? '#fff' : '#525252',
                  border: on ? '1px solid #171717' : '1px solid #eaeaea',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Sub-process rail */}
          <div
            style={{
              width: 250,
              flexShrink: 0,
              border: '1px solid #eaeaea',
              borderRadius: 12,
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              padding: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#737373',
                padding: '2px 10px 8px',
              }}
            >
              Sub-processes (L4)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                onClick={() => onRail(null)}
                style={{
                  font: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 11.5,
                  fontWeight: railKey === null ? 600 : 500,
                  background: railKey === null ? '#171717' : 'transparent',
                  color: railKey === null ? '#fff' : '#404040',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>All sub-processes</span>
                <span style={{ fontSize: 10, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                  {phase.rows.length}
                </span>
              </button>
              {rail.map((s) => {
                const on = railKey === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onRail(s.key)}
                    style={{
                      font: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: 11.5,
                      fontWeight: on ? 600 : 500,
                      background: on ? '#171717' : 'transparent',
                      color: on ? '#fff' : '#404040',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>{s.label}</span>
                    <span
                      style={{ fontSize: 10, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {s.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task × stream matrix */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              border: '1px solid #eaeaea',
              borderRadius: 12,
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                borderBottom: '1px solid #eaeaea',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#171717' }}>
                {phase.label}
                {railKey && rail.find((r) => r.key === railKey)
                  ? ` › ${rail.find((r) => r.key === railKey)?.label}`
                  : ''}
              </span>
              <span style={{ fontSize: 11, color: '#525252' }}>
                {rows.length} canonical tasks — each appears once ·{' '}
                <b style={{ color: '#171717' }}>{decidedCount}</b> decided by hand
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: grid,
                alignItems: 'center',
                padding: '6px 14px',
                borderBottom: '1px solid #eaeaea',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#737373',
              }}
            >
              <span>Canonical task</span>
              {names.map((n, i) => (
                <span key={n} style={{ textAlign: 'center', color: streamTone(i) }} title={n}>
                  {n.length > 12 ? `${n.slice(0, 11)}…` : n}
                </span>
              ))}
              <span style={{ textAlign: 'right' }}>Decision</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: grid,
                  alignItems: 'center',
                  padding: '5px 14px',
                  borderBottom: '1px solid #f4f6f8',
                  background: r.verdict === 'order' ? '#fffdf5' : i % 2 ? '#fcfcfd' : '#fff',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    paddingRight: 12,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: r.presentIn > 1 ? INDIGO : '#64748b',
                      color: '#fff',
                      fontSize: 8.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{ fontSize: 12, fontWeight: 500, color: '#171717', lineHeight: 1.3 }}
                  >
                    {r.canonName}
                    {r.verdict === 'order' && (
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: '#b45309' }}>
                        {' '}
                        · order differs
                      </span>
                    )}
                  </span>
                </span>
                {r.cells.map((c, ci) => (
                  <span
                    key={`${r.key}:${ci}`}
                    title={
                      c
                        ? `${c.name} — step #${c.seq}${c.owner ? ` · ${c.owner}` : ''}`
                        : 'not in this stream'
                    }
                    style={{
                      justifySelf: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      ...(c
                        ? {
                            background: streamBg(ci),
                            color: streamTone(ci),
                            border: `1px solid ${streamTone(ci)}33`,
                          }
                        : { background: '#fff', color: '#a3a3a3', border: '1px dashed #d4d4d4' }),
                    }}
                  >
                    {c ? `#${c.seq}` : '—'}
                  </span>
                ))}
                <DecisionButtons chosen={decisionOf(r)} onPick={(d) => onDecide(r.key, d)} />
              </div>
            ))}
            {rows.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: '#737373' }}>
                No steps in this sub-process.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            border: '1px solid #eaeaea',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <VsNewProcessFlow
            phases={[{ ...phase, rows }]}
            phaseKey={phase.key}
            decisionOf={decisionOf}
            streamNames={names}
          />
        </div>
      </div>
    </div>
  );
}
