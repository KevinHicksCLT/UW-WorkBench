import ScreenView from './ScreenView';
import { clientColumnStat, columnStatSummary, columnDeadLabel } from './stats';
import { APP_COLORS, RED } from './types';
import type {
  BoardApp,
  BoardScreen,
  ColumnStat,
  Finding,
  Layer,
  LayerExpansion,
  LayerPads,
} from './types';

// Left column — the current state of ONE application of the comparison at a
// time, walked screen by screen. When several applications are being compared,
// a toggle strip switches which brownfield state the panel is showing —
// Normalize and Greenfield keep aggregating the whole comparison regardless.
// The layer decomposition leads; the live screen preview sits below it so the
// layers and the Normalize column share the top of the viewport.

interface Props {
  /** Panel title — the active application's name. */
  title: string;
  /** Every application in the comparison (the toggle strip). */
  apps: BoardApp[];
  /** Which application's brownfield state the panel is walking. */
  activeAppId: string;
  onActiveApp: (id: string) => void;
  /** Findings of the ACTIVE application only. */
  findings: Finding[];
  /** The server's column roll-up for the active application
   *  (BoardDetail.columnStats) — client-computed fallback when absent. */
  columnStat?: ColumnStat | null;
  /** Screens of EVERY compared application — the picker lists the whole
   *  comparison (identical dropdown on every app toggle); picking another
   *  application's screen switches the walk to that application. */
  screens: BoardScreen[];
  screenName: string | null;
  onScreen: (name: string | null) => void;
  selectedFindingId: string | null;
  onSelectFinding: (f: Finding | null) => void;
  /** Per-layer top spacing that lines this panel's rows up with the other columns (SCRUM-222). */
  layerPads?: LayerPads;
  /** Per-step top spacing (by finding id) that levels each expanded row with its normalize card (SCRUM-259). */
  rowPads?: Record<string, number>;
  /** Render order (by finding id) matching the Normalize column's card order. */
  rowOrder?: Record<string, number>;
  /** Shared per-layer expansion — one toggle opens the layer in every column. */
  expandedLayers: LayerExpansion;
  onToggleLayer: (layer: Layer) => void;
}

/** Toggle strip: one chip per compared application, the active one filled. */
function AppToggle({
  apps,
  activeAppId,
  onActiveApp,
}: {
  apps: BoardApp[];
  activeAppId: string;
  onActiveApp: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {apps.map((a, i) => {
        const active = a.id === activeAppId;
        const color = APP_COLORS[i % APP_COLORS.length];
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onActiveApp(a.id)}
            aria-pressed={active}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 999,
              border: `1px solid ${active ? '#171717' : '#e5e5e5'}`,
              background: active ? '#171717' : '#fff',
              color: active ? '#fff' : '#525252',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              font: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: color,
                flexShrink: 0,
              }}
            />
            {a.name}
          </button>
        );
      })}
    </div>
  );
}

export default function BrownfieldPanel(props: Props) {
  const {
    title,
    apps,
    activeAppId,
    onActiveApp,
    findings,
    columnStat,
    screens,
    screenName,
    onScreen,
    selectedFindingId,
    onSelectFinding,
    layerPads,
    rowPads,
    rowOrder,
    expandedLayers,
    onToggleLayer,
  } = props;
  const activeApp = apps.find((a) => a.id === activeAppId) ?? null;
  const screenCount = new Set(findings.map((f) => f.screenRef).filter(Boolean)).size;
  // v3 column-header roll-up — server columnStats first, client fallback.
  const stat = columnStat ?? clientColumnStat(activeAppId, findings);
  const deadLabel = columnDeadLabel(stat);

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
          {columnStatSummary(stat)}
          {deadLabel && (
            <b style={{ color: RED, fontWeight: 600 }}>
              {' · '}
              {deadLabel}
            </b>
          )}
        </span>
      </div>

      {apps.length > 1 && (
        <AppToggle apps={apps} activeAppId={activeAppId} onActiveApp={onActiveApp} />
      )}

      <ScreenView
        apps={apps}
        activeAppId={activeApp?.id ?? null}
        screens={screens}
        findings={findings}
        screenName={screenName}
        onScreen={onScreen}
        selectedFindingId={selectedFindingId}
        onSelectFinding={onSelectFinding}
        layerPads={layerPads}
        rowPads={rowPads}
        rowOrder={rowOrder}
        expandedLayers={expandedLayers}
        onToggleLayer={onToggleLayer}
      />
    </div>
  );
}
