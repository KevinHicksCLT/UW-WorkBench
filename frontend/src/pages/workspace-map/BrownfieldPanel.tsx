import ScreenView from './ScreenView';
import { findingMoves, APP_COLORS, GREEN, RED } from './types';
import type { BoardApp, BoardScreen, Finding, LayerPads } from './types';

// Left column — the current state, walked screen by screen. A single-product
// board merges its legacy sources (e.g. a frontend and a backend) into one
// panel; a multi-application board (SCRUM-134: two real overlapping systems)
// additionally shows WHICH application each screen and step belongs to, via
// per-app colour chips (SCRUM-222).

interface Props {
  /** Application title — the board's application name. */
  title: string;
  /** The board's legacy source applications, in position order. */
  apps: BoardApp[];
  /** All findings of the application (every legacy source merged). */
  findings: Finding[];
  screens: BoardScreen[];
  screenName: string | null;
  onScreen: (name: string | null) => void;
  selectedFindingId: string | null;
  onSelectFinding: (f: Finding | null) => void;
  /** Per-layer top spacing that lines this panel's rows up with the other columns (SCRUM-222). */
  layerPads?: LayerPads;
}

export default function BrownfieldPanel(props: Props) {
  const {
    title,
    apps,
    findings,
    screens,
    screenName,
    onScreen,
    selectedFindingId,
    onSelectFinding,
    layerPads,
  } = props;
  const stays = findings.filter((f) => !findingMoves(f)).length;
  const moves = findings.length - stays;
  const screenCount = new Set(findings.map((f) => f.screenRef).filter(Boolean)).size;
  const multiApp = apps.length > 1;

  return (
    <div
      style={{
        width: 560,
        flexShrink: 0,
        background: '#fff',
        border: '1px solid #eaeaea',
        borderRadius: 14,
        boxShadow: '0 1px 4px rgba(0,0,0,.05)',
        padding: 16,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 26 }}>
        <span
          style={{
            fontSize: 17,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 11, color: '#a3a3a3', whiteSpace: 'nowrap' }}>
          {screenCount > 0 ? `${screenCount} screens · ` : ''}
          {findings.length} steps
        </span>
      </div>

      {/* SCRUM-222: which applications feed this board, colour-keyed. */}
      {multiApp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {apps.map((a, i) => {
            const count = findings.filter((f) => f.appId === a.id).length;
            const color = APP_COLORS[i % APP_COLORS.length];
            return (
              <span
                key={a.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 9px',
                  borderRadius: 999,
                  border: `1px solid ${color}44`,
                  background: `${color}0d`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
                {a.name}
                <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                  {count} steps
                </span>
              </span>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 20,
          fontSize: 12,
          color: '#525252',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>what each screen captures · sends · processes · validates</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 3, borderRadius: 99, background: GREEN }} />
          <b style={{ fontWeight: 600, color: GREEN }}>{stays} correct</b>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 3, borderRadius: 99, background: RED }} />
          <b style={{ fontWeight: 600, color: RED }}>{moves} move</b>
        </span>
      </div>

      <ScreenView
        apps={apps}
        screens={screens}
        findings={findings}
        screenName={screenName}
        onScreen={onScreen}
        selectedFindingId={selectedFindingId}
        onSelectFinding={onSelectFinding}
        layerPads={layerPads}
      />
    </div>
  );
}
