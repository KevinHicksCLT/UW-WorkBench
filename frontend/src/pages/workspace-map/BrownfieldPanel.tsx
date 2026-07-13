import ScreenView from './ScreenView';
import { findingMoves, GREEN, RED } from './types';
import type { BoardScreen, Finding } from './types';

// Left column — the current state of ONE application, walked screen by screen.
// All the board's legacy sources (e.g. a frontend and a backend of the same
// product) are merged into this single panel; every screen shows its full
// vertical slice across the tech layers (see ScreenView).

interface Props {
  /** Application title — the board's application name (one app per board). */
  title: string;
  /** All findings of the application (every legacy source merged). */
  findings: Finding[];
  screens: BoardScreen[];
  screenName: string | null;
  onScreen: (name: string | null) => void;
  selectedFindingId: string | null;
  onSelectFinding: (f: Finding | null) => void;
}

export default function BrownfieldPanel(props: Props) {
  const { title, findings, screens, screenName, onScreen, selectedFindingId, onSelectFinding } =
    props;
  const stays = findings.filter((f) => !findingMoves(f)).length;
  const moves = findings.length - stays;
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
        screens={screens}
        findings={findings}
        screenName={screenName}
        onScreen={onScreen}
        selectedFindingId={selectedFindingId}
        onSelectFinding={onSelectFinding}
      />
    </div>
  );
}
