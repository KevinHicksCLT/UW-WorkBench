import { useMemo } from 'react';
import { useDialogs } from '../../../lib/dialogs';
import { AMBER, GREEN } from '../types';
import type { ReconPhase, ReconRow } from './spineCompare';

// The reconciliation table's closing act: the normalized NEW PROCESS as a
// horizontal flow — every surviving step in order, its owner, its systems and
// where it came from (stream A, stream B, or both merged 2→1). Phase tabs
// switch the slice; Drop decisions remove steps, Keep decisions carry both
// stream variants across separately.

export type ReconDecision = 'Merge' | 'Keep' | 'Drop';

/** Stream display tones — A teal, B violet (mirrors the compare chips). */
export const STREAM_TONES: [string, string] = ['#0f766e', '#7c3aed'];
export const STREAM_BGS: [string, string] = ['#f0fdfa', '#f8f5ff'];

export function defaultDecision(row: ReconRow): ReconDecision {
  return row.a && row.b ? 'Merge' : 'Keep';
}

interface FlowStep {
  key: string;
  n: number;
  name: string;
  owner: string | null;
  apps: string[];
  sources: { label: string; fg: string; bg: string }[];
  badge: string;
  badgeFg: string;
  tone: string;
  border: string;
}

function flowSteps(
  rows: ReconRow[],
  decisionOf: (row: ReconRow) => ReconDecision,
  tones: [string, string],
  bgs: [string, string],
): FlowStep[] {
  const out: FlowStep[] = [];
  let n = 0;
  for (const row of rows) {
    const dec = decisionOf(row);
    if (dec === 'Drop') continue;
    const both = !!(row.a && row.b);
    const variants =
      dec === 'Keep' && both
        ? [
            { step: row.a, which: 0 as const },
            { step: row.b, which: 1 as const },
          ]
        : [{ step: row.a ?? row.b, which: row.a ? (0 as const) : (1 as const) }];
    for (const v of variants) {
      if (!v.step) continue;
      n += 1;
      const merged = both && dec === 'Merge';
      const sources = [
        row.a && (merged || v.which === 0)
          ? { label: `A #${row.a.seq}`, fg: tones[0], bg: bgs[0] }
          : null,
        row.b && (merged || v.which === 1)
          ? { label: `B #${row.b.seq}`, fg: tones[1], bg: bgs[1] }
          : null,
      ].filter((s): s is NonNullable<typeof s> => s !== null);
      out.push({
        key: `${row.key}:${v.which}`,
        n,
        name: merged ? row.canonName : v.step.name,
        owner: v.step.owner ?? (merged ? (row.a?.owner ?? row.b?.owner ?? null) : null),
        apps: merged ? [...new Set([...(row.a?.apps ?? []), ...(row.b?.apps ?? [])])] : v.step.apps,
        sources,
        badge: merged ? (row.verdict === 'order' ? 'resequenced' : 'merged 2→1') : 'carried 1→1',
        badgeFg: merged ? (row.verdict === 'order' ? AMBER : '#047857') : '#94a3b8',
        tone: merged
          ? row.verdict === 'order'
            ? AMBER
            : GREEN
          : v.which === 0
            ? tones[0]
            : tones[1],
        border: merged ? '#bbe7cf' : '#e2e8f0',
      });
    }
  }
  return out;
}

export default function VsNewProcessFlow({
  phases,
  phaseKey,
  onPhase,
  decisionOf,
  streamNames,
}: {
  phases: ReconPhase[];
  /** Active phase, or null for all phases in sequence. */
  phaseKey: string | null;
  onPhase: (key: string | null) => void;
  decisionOf: (row: ReconRow) => ReconDecision;
  streamNames: [string, string];
}) {
  const dialogs = useDialogs();
  const shown = useMemo(
    () => (phaseKey ? phases.filter((p) => p.key === phaseKey) : phases),
    [phases, phaseKey],
  );
  const steps = useMemo(
    () =>
      flowSteps(
        shown.flatMap((p) => p.rows),
        decisionOf,
        STREAM_TONES,
        STREAM_BGS,
      ),
    [shown, decisionOf],
  );
  const rows = shown.flatMap((p) => p.rows);
  const merged = rows.filter((r) => r.a && r.b && decisionOf(r) === 'Merge');
  const resequenced = merged.filter((r) => r.verdict === 'order').length;
  const carried = steps.length - merged.length;

  const promote = () =>
    dialogs.alert({
      title: 'Promote new process',
      message: `${steps.length} normalized steps across ${shown.length} phase${shown.length === 1 ? '' : 's'} — ${merged.length} merged 2→1 (${resequenced} resequenced), ${carried} carried 1→1. Promotion into the live L4 spine is decision-preview only in this workspace; export the verdict table to take it forward.`,
    });

  return (
    <div style={{ padding: 14, background: '#f6faf7', borderTop: '2px solid #a7f3d0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: '#047857',
            color: '#fff',
            borderRadius: 8,
            padding: '7px 11px',
            fontSize: 11.5,
            fontWeight: 700,
            boxShadow: '0 2px 6px rgba(0,0,0,.18)',
          }}
        >
          New process
        </span>
        <span style={{ fontSize: 11.5, color: '#14532d', fontWeight: 600 }}>
          {phaseKey
            ? `${shown[0]?.label ?? ''} — ${steps.length} normalized steps`
            : `All phases — ${steps.length} normalized steps`}
        </span>
        <span style={{ fontSize: 11, color: '#4d7c60' }}>
          {merged.length} merged 2→1 · {carried} carried 1→1 · {resequenced} resequenced · single
          owner per step
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => onPhase(null)}
          style={{
            font: 'inherit',
            fontSize: 10,
            color: phaseKey === null ? '#fff' : '#4d7c60',
            background: phaseKey === null ? '#047857' : '#e8f7ee',
            border: `1px solid ${phaseKey === null ? '#047857' : '#bbe7cf'}`,
            borderRadius: 6,
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          All phases
        </button>
        {phases.map((p) => {
          const on = phaseKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPhase(p.key)}
              style={{
                font: 'inherit',
                fontSize: 10,
                color: on ? '#fff' : '#4d7c60',
                background: on ? '#047857' : '#e8f7ee',
                border: `1px solid ${on ? '#047857' : '#bbe7cf'}`,
                borderRadius: 6,
                padding: '2px 8px',
                cursor: 'pointer',
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {p.label} <b>{p.rows.length}</b>
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto', padding: '2px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', width: 'max-content' }}>
          {steps.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <span style={{ width: 16, height: 1.5, background: '#bbe7cf', flexShrink: 0 }} />
              )}
              <div
                style={{
                  width: 236,
                  boxSizing: 'border-box',
                  background: '#fff',
                  border: `1px solid ${s.border}`,
                  borderTop: `3px solid ${s.tone}`,
                  borderRadius: 10,
                  padding: '9px 10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 999,
                      background: '#047857',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 800,
                      lineHeight: '17px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: '#14532d',
                      flex: 1,
                    }}
                  >
                    {s.name}
                  </span>
                </div>
                {s.owner && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: '#fff',
                        background: '#0f766e',
                        borderRadius: 5,
                        padding: '1px 6px',
                      }}
                    >
                      Owner
                    </span>
                    <span style={{ fontSize: 9.5, color: '#334155' }}>{s.owner}</span>
                  </div>
                )}
                {s.apps.length > 0 && (
                  <div
                    style={{
                      fontSize: 9.5,
                      fontFamily: 'ui-monospace, monospace',
                      color: '#94a3b8',
                      marginTop: 4,
                    }}
                  >
                    {s.apps.join(' · ')}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    marginTop: 7,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {s.sources.map((src) => (
                    <span
                      key={src.label}
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: src.fg,
                        background: src.bg,
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      {src.label}
                    </span>
                  ))}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: s.badgeFg }}>{s.badge}</span>
                </div>
              </div>
            </div>
          ))}
          {steps.length === 0 && (
            <div style={{ fontSize: 11, color: '#4d7c60', padding: 8 }}>
              Every step in this phase is dropped — nothing to promote.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 6,
          fontSize: 10.5,
          color: '#4d7c60',
          flexWrap: 'wrap',
        }}
      >
        <span>
          Green top edge = merged from both streams · <b style={{ color: STREAM_TONES[0] }}>teal</b>{' '}
          = only {streamNames[0]} · <b style={{ color: STREAM_TONES[1] }}>violet</b> = only{' '}
          {streamNames[1]} · <b style={{ color: AMBER }}>amber</b> = resequenced.
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={promote}
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
          Promote new process
        </button>
      </div>
    </div>
  );
}

export { flowSteps };
