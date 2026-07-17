import ScreenView from './ScreenView';
import type { BoardApp, BoardScreen, Finding, LayerPads } from './types';

// Left column — the current state, walked screen by screen. A single-product
// board merges its legacy sources (e.g. a frontend and a backend) into one
// panel; a multi-application board (SCRUM-134: two real overlapping systems)
// shows WHICH application owns the active screen via the picker's owner chip.
// The layer decomposition leads; the live screen preview sits below it so the
// layers and the Normalize column share the top of the viewport.

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
  const screenCount = new Set(findings.map((f) => f.screenRef).filter(Boolean)).size;

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
