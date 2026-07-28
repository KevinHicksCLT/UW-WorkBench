import { useMemo } from 'react';
import { useDialogs } from '../../../lib/dialogs';
import { AMBER, GREEN } from '../types';
import type { ReconPhase, ReconRow } from './spineCompare';

// The reconciliation table's closing act: the normalized NEW PROCESS as a
// horizontal flow — every surviving step in order, its owner, its systems and
// where it came from (any of the N compared streams, merged k→1). Drop
// decisions remove steps, Keep decisions carry each stream's variant across
// separately.

export type ReconDecision = 'Merge' | 'Keep' | 'Drop';

/** Stream display tones, cycled per compared lane. */
export const STREAM_TONES = ['#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#be185d', '#0891b2'];
export const STREAM_BGS = ['#f0fdfa', '#f8f5ff', '#fffbeb', '#eff6ff', '#fdf2f8', '#ecfeff'];

export const streamTone = (i: number) => STREAM_TONES[i % STREAM_TONES.length];
export const streamBg = (i: number) => STREAM_BGS[i % STREAM_BGS.length];

export function defaultDecision(row: ReconRow): ReconDecision {
  return row.presentIn > 1 ? 'Merge' : 'Keep';
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

export function flowSteps(
  rows: ReconRow[],
  decisionOf: (row: ReconRow) => ReconDecision,
): FlowStep[] {
  const out: FlowStep[] = [];
  let n = 0;
  for (const row of rows) {
    const dec = decisionOf(row);
    if (dec === 'Drop') continue;
    const multi = row.presentIn > 1;
    const carrying = row.cells
      .map((step, laneIdx) => ({ step, laneIdx }))
      .filter(
        (c): c is { step: NonNullable<(typeof row.cells)[number]>; laneIdx: number } => !!c.step,
      );
    // Keep on a shared row carries every stream's variant separately; Merge
    // folds them into one canonical step.
    const variants = dec === 'Keep' && multi ? carrying : [carrying[0]];
    for (const v of variants) {
      if (!v) continue;
      n += 1;
      const merged = multi && dec === 'Merge';
      const sources = (merged ? carrying : [v]).map((c) => ({
        label: `S${c.laneIdx + 1} #${c.step.seq}`,
        fg: streamTone(c.laneIdx),
        bg: streamBg(c.laneIdx),
      }));
      out.push({
        key: `${row.key}:${v.laneIdx}`,
        n,
        name: merged ? row.canonName : v.step.name,
        owner:
          v.step.owner ??
          (merged ? (carrying.find((c) => c.step.owner)?.step.owner ?? null) : null),
        apps: merged ? [...new Set(carrying.flatMap((c) => c.step.apps))] : v.step.apps,
        sources,
        badge: merged
          ? row.verdict === 'order'
            ? 'resequenced'
            : `merged ${row.presentIn}→1`
          : 'carried 1→1',
        badgeFg: merged ? (row.verdict === 'order' ? AMBER : '#047857') : '#94a3b8',
        tone: merged ? (row.verdict === 'order' ? AMBER : GREEN) : streamTone(v.laneIdx),
        border: merged ? '#bbe7cf' : '#e2e8f0',
      });
    }
  }
  return out;
}

export default function VsNewProcessFlow({
  phases,
  phaseKey,
  decisionOf,
  streamNames,
}: {
  phases: ReconPhase[];
  /** Active phase, or null for all phases in sequence. */
  phaseKey: string | null;
  decisionOf: (row: ReconRow) => ReconDecision;
  streamNames: string[];
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
      ),
    [shown, decisionOf],
  );
  const rows = shown.flatMap((p) => p.rows);
  const merged = rows.filter((r) => r.presentIn > 1 && decisionOf(r) === 'Merge');
  const resequenced = merged.filter((r) => r.verdict === 'order').length;
  const carried = steps.length - merged.length;

  const promote = () =>
    dialogs.alert({
      title: 'Promote new process',
      message: `${steps.length} normalized steps across ${shown.length} phase${shown.length === 1 ? '' : 's'} — ${merged.length} merged from ${streamNames.length} streams (${resequenced} resequenced), ${carried} carried 1→1. Promotion into the live L4 spine is decision-preview only in this workspace; export the verdict table to take it forward.`,
    });

  return (
    <div style={{ padding: 12, background: '#f6faf7', borderTop: '2px solid #a7f3d0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: '#047857',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 10px',
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
          {merged.length} merged · {carried} carried 1→1 · {resequenced} resequenced · single owner
          per step
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={promote}
          style={{
            font: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
            background: '#171717',
            border: 'none',
            borderRadius: 6,
            padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          Promote new process
        </button>
      </div>

      <div style={{ overflowX: 'auto', padding: '2px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', width: 'max-content' }}>
          {steps.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <span style={{ width: 14, height: 1.5, background: '#bbe7cf', flexShrink: 0 }} />
              )}
              <div
                style={{
                  width: 224,
                  boxSizing: 'border-box',
                  background: '#fff',
                  border: `1px solid ${s.border}`,
                  borderTop: `3px solid ${s.tone}`,
                  borderRadius: 10,
                  padding: '8px 9px',
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: '#047857',
                      color: '#fff',
                      fontSize: 8.5,
                      fontWeight: 800,
                      lineHeight: '16px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
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
                      fontSize: 9,
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
                    marginTop: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {s.sources.map((src) => (
                    <span
                      key={src.label}
                      style={{
                        fontSize: 8.5,
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
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: s.badgeFg }}>
                    {s.badge}
                  </span>
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
          gap: 12,
          marginTop: 4,
          fontSize: 10,
          color: '#4d7c60',
          flexWrap: 'wrap',
        }}
      >
        <span>Green top edge = merged across streams · amber = resequenced.</span>
        {streamNames.map((name, i) => (
          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: streamTone(i) }} />S
            {i + 1} = {name}
          </span>
        ))}
      </div>
    </div>
  );
}
