import { AMBER, GREEN, INDIGO } from '../types';
import { streamTone } from './VsNewProcessFlow';

// The Value-streams lens' upper drill levels — PHASES (aligned L3 slots) and
// SUB-PROCESSES (aligned L4 slots) as row tables, one cell per compared
// stream, with the bottom-up decision roll-up so progress made at step level
// reads at a glance from above.

export interface LaneStageView {
  name: string | null;
  meta: string;
}

export interface PhaseRowView {
  key: string;
  label: string;
  units: number;
  shared: number;
  only: number;
  /** Bottom-up roll-up: how many of this phase's units carry a hand decision. */
  decided: number;
  perLane: LaneStageView[];
}

export interface SubRowView {
  key: string;
  label: string;
  perLane: LaneStageView[];
  presentIn: number;
}

export function levelGrid(laneCount: number): string {
  return `30px minmax(190px,1fr) repeat(${laneCount}, 225px) 205px 70px`;
}

export function LevelHeader({
  grid,
  names,
  lastCols,
}: {
  grid: string;
  names: string[];
  lastCols: string[];
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: grid,
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
          style={{ padding: '6px 10px', borderLeft: '1px solid #eaeaea', color: streamTone(i) }}
        >
          {n}
        </div>
      ))}
      {lastCols.map((c) => (
        <div key={c || 'x'} style={{ padding: '6px 10px', borderLeft: '1px solid #eaeaea' }}>
          {c}
        </div>
      ))}
    </div>
  );
}

export function VerdictPill({
  fg,
  bg,
  border,
  label,
  note,
}: {
  fg: string;
  bg: string;
  border: string;
  label: string;
  note?: string;
}) {
  return (
    <div>
      <span
        style={{
          display: 'inline-block',
          fontSize: 9.5,
          fontWeight: 700,
          color: fg,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 6,
          padding: '2px 7px',
        }}
      >
        {label}
      </span>
      {note && <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function LaneCell({ view, tone }: { view: LaneStageView; tone: string }) {
  if (!view.name)
    return <span style={{ fontSize: 10.5, color: '#cbd5e1' }}>— not in this stream</span>;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, color: '#171717' }}>
        <span style={{ color: tone }}>●</span> {view.name}
      </div>
      <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{view.meta}</div>
    </div>
  );
}

function coverageMeta(presentIn: number, laneCount: number) {
  if (presentIn === laneCount)
    return { fg: INDIGO, bg: '#eef2ff', border: '#d6dcff', label: 'IN EVERY STREAM' };
  if (presentIn > 1)
    return {
      fg: AMBER,
      bg: '#fffbeb',
      border: '#fde68a',
      label: `IN ${presentIn} OF ${laneCount}`,
    };
  return { fg: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'ONLY ONE STREAM' };
}

function levelRowStyle(grid: string): React.CSSProperties {
  return {
    font: 'inherit',
    display: 'grid',
    gridTemplateColumns: grid,
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid #f1f3f5',
    background: '#fff',
    cursor: 'pointer',
    padding: 0,
  };
}

const numCell: React.CSSProperties = {
  padding: '6px 6px',
  textAlign: 'center',
  fontSize: 11,
  fontFamily: 'ui-monospace, monospace',
  color: '#a3a3a3',
};

export function PhasesTable({
  rows,
  names,
  onDrill,
}: {
  rows: PhaseRowView[];
  names: string[];
  onDrill: (phaseKey: string) => void;
}) {
  const grid = levelGrid(names.length);
  return (
    <>
      <LevelHeader grid={grid} names={names} lastCols={['Coverage · progress', '']} />
      {rows.map((p, i) => {
        const present = p.perLane.filter((l) => l.name).length;
        const meta = coverageMeta(present, names.length);
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onDrill(p.key)}
            style={levelRowStyle(grid)}
          >
            <div style={numCell}>{i + 1}</div>
            <div style={{ padding: '6px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#171717' }}>{p.label}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
                {p.units} units of work · {p.shared} shared · {p.only} in one stream
              </div>
            </div>
            {p.perLane.map((l, li) => (
              <div
                key={`${p.key}:${li}`}
                style={{ padding: '6px 10px', borderLeft: '1px solid #f1f3f5' }}
              >
                <LaneCell view={l} tone={streamTone(li)} />
              </div>
            ))}
            <div style={{ padding: '6px 10px', borderLeft: '1px solid #f1f3f5' }}>
              <VerdictPill
                {...meta}
                note={
                  p.decided > 0
                    ? `${p.decided} of ${p.units} decided by hand`
                    : 'no step decisions yet'
                }
              />
              {p.decided > 0 && (
                <div
                  style={{
                    height: 3,
                    background: '#e2e8f0',
                    borderRadius: 9,
                    marginTop: 4,
                    overflow: 'hidden',
                    maxWidth: 150,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: 3,
                      width: `${Math.round((p.decided / Math.max(1, p.units)) * 100)}%`,
                      background: GREEN,
                    }}
                  />
                </div>
              )}
            </div>
            <div
              style={{
                padding: '6px 10px',
                borderLeft: '1px solid #f1f3f5',
                fontSize: 11,
                color: '#0070AD',
                alignSelf: 'center',
              }}
            >
              Drill ›
            </div>
          </button>
        );
      })}
    </>
  );
}

export function SubsTable({
  rows,
  names,
  onDrill,
}: {
  rows: SubRowView[];
  names: string[];
  onDrill: (subKey: string) => void;
}) {
  const grid = levelGrid(names.length);
  return (
    <>
      <LevelHeader grid={grid} names={names} lastCols={['Coverage', '']} />
      {rows.map((s, i) => {
        const meta = coverageMeta(s.presentIn, names.length);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onDrill(s.key)}
            style={levelRowStyle(grid)}
          >
            <div style={numCell}>{i + 1}</div>
            <div style={{ padding: '6px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#171717' }}>{s.label}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>sub-process</div>
            </div>
            {s.perLane.map((l, li) => (
              <div
                key={`${s.key}:${li}`}
                style={{ padding: '6px 10px', borderLeft: '1px solid #f1f3f5' }}
              >
                <LaneCell view={l} tone={streamTone(li)} />
              </div>
            ))}
            <div style={{ padding: '6px 10px', borderLeft: '1px solid #f1f3f5' }}>
              <VerdictPill {...meta} />
            </div>
            <div
              style={{
                padding: '6px 10px',
                borderLeft: '1px solid #f1f3f5',
                fontSize: 11,
                color: '#0070AD',
                alignSelf: 'center',
              }}
            >
              Drill ›
            </div>
          </button>
        );
      })}
    </>
  );
}
