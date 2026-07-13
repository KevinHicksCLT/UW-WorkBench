import { useEffect, useState } from 'react';
import { MENU_TREE, type MenuNode } from '@cascade/shared';
import { Select } from '../../components/ui';
import { LAYERS, LAYER_ACCENT, findingMoves, GREEN, RED } from './types';
import type { BoardScreen, Finding, Layer } from './types';

// Per-screen decomposition of the current state: pick one screen of the
// application and see the full stack underneath it — every tech layer is
// always listed (UI, APIs/Integration, Business Service, Data,
// Infrastructure), empty ones included, so each screen reads as a complete
// vertical slice. A live preview of the page renders above (screens carry
// same-origin URLs).

interface Props {
  screens: BoardScreen[];
  findings: Finding[]; // scoped to the application
  screenName: string | null;
  onScreen: (name: string | null) => void;
  selectedFindingId: string | null;
  onSelectFinding: (f: Finding | null) => void;
}

/** What the layer means for a single screen (subtitle in each section). */
const LAYER_SUBTITLE: Record<Layer, string> = {
  UI: 'what the screen captures',
  Integration: 'APIs — how data is sent',
  'Business Service': 'processing & validations',
  Data: "what's stored",
  Infrastructure: 'security & ops',
};

/** Screens sort in the order they appear in the app nav (MENU_TREE). */
function navOrder(): Map<string, number> {
  const order = new Map<string, number>();
  let i = 0;
  const walk = (nodes: readonly MenuNode[]) => {
    for (const n of nodes) {
      if (n.path && !order.has(n.path)) order.set(n.path, i++);
      if (n.children) walk(n.children);
    }
  };
  walk(MENU_TREE);
  return order;
}

/** Every screen of the application, ordered by its position in the app nav. */
function screenOptions(screens: BoardScreen[], findings: Finding[]): string[] {
  const byName = new Map(screens.map((s) => [s.name, s]));
  const order = navOrder();
  const rank = (name: string): number => {
    const url = byName.get(name)?.url;
    if (!url) return Number.MAX_SAFE_INTEGER; // modals/drawers last
    const exact = order.get(url);
    if (exact !== undefined) return exact * 10;
    // Sub-screens (e.g. /admin › Audit Log) sort right after their parent route.
    for (const [path, idx] of order) {
      if (path !== '/' && url.startsWith(path)) return idx * 10 + 5;
    }
    return Number.MAX_SAFE_INTEGER - 1;
  };
  // Catalog screens plus any finding-only refs (a step recorded against a
  // screen the catalog doesn't list yet must still be reachable).
  const names = new Set<string>(byName.keys());
  for (const f of findings) if (f.screenRef) names.add(f.screenRef);
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function ScreenPreview({ screen }: { screen: BoardScreen }) {
  // The preview stays hidden behind a loading veil until the framed page has
  // fired load AND had a settle window for its lazy chunk + data fetches —
  // the user never sees a half-rendered page.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(false), [screen.url]);

  if (!screen.url) {
    return (
      <div
        style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed #eaeaea',
          borderRadius: 8,
          fontSize: 11.5,
          color: '#a3a3a3',
        }}
      >
        No preview URL for this {screen.kind === 'MODAL' ? 'modal' : 'screen'}
      </div>
    );
  }
  // 1280×800 page scaled to fit the panel width (~500px inner).
  const scale = 0.39;
  return (
    <div
      style={{
        border: '1px solid #eaeaea',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderBottom: '1px solid #eaeaea',
          background: '#fafafa',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: ready ? '#22c55e' : '#f59e0b',
          }}
        />
        <span style={{ fontSize: 10.5, color: '#525252', fontWeight: 600 }}>{screen.name}</span>
        <span style={{ fontSize: 10, color: '#a3a3a3', marginLeft: 'auto' }}>
          live preview · {screen.url}
        </span>
      </div>
      <div style={{ height: Math.round(800 * scale), overflow: 'hidden', position: 'relative' }}>
        <iframe
          key={screen.url}
          src={screen.url}
          title={`Preview — ${screen.name}`}
          onLoad={() => setTimeout(() => setReady(true), 900)}
          style={{
            width: 1280,
            height: 800,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            opacity: ready ? 1 : 0,
            transition: 'opacity .2s',
          }}
          tabIndex={-1}
          aria-hidden
        />
        {!ready && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fafafa',
              fontSize: 11.5,
              color: '#a3a3a3',
            }}
          >
            Loading preview…
          </div>
        )}
      </div>
    </div>
  );
}

function WhyDetail({ f }: { f: Finding }) {
  const w = f.whyThisMoves;
  const moved = findingMoves(f);
  const accent = moved ? RED : GREEN;
  return (
    <div
      style={{
        margin: '2px 8px 6px 31px',
        border: `1px solid ${moved ? '#fecaca' : '#bbf7d0'}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        background: '#fff',
        padding: '8px 12px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.08em',
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        {moved ? 'Why this moves — what happens here' : 'Why this stays'}
      </div>
      {w ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '72px 1fr',
            gap: '2px 10px',
            fontSize: 11.5,
            lineHeight: 1.45,
            marginTop: 4,
          }}
        >
          {w.captured && (
            <>
              <span style={{ color: '#a3a3a3', fontWeight: 600 }}>Captured</span>
              <span style={{ color: '#525252' }}>{w.captured}</span>
            </>
          )}
          {w.sent && (
            <>
              <span style={{ color: '#a3a3a3', fontWeight: 600 }}>Sent</span>
              <span style={{ color: '#525252' }}>{w.sent}</span>
            </>
          )}
          {w.processed && (
            <>
              <span style={{ color: '#a3a3a3', fontWeight: 600 }}>Processed</span>
              <span style={{ color: '#525252' }}>{w.processed}</span>
            </>
          )}
          {w.validation && (
            <>
              <span style={{ color: '#a3a3a3', fontWeight: 600 }}>Validation</span>
              <span style={{ color: accent, fontWeight: 500 }}>{w.validation}</span>
            </>
          )}
        </div>
      ) : (
        f.plainSummary && (
          <div style={{ fontSize: 11.5, color: '#525252', lineHeight: 1.45, marginTop: 4 }}>
            {f.plainSummary}
          </div>
        )
      )}
      {(w?.location || w?.landsIn || f.codeRef) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 5,
            fontSize: 11,
            flexWrap: 'wrap',
          }}
        >
          {(w?.location || f.codeRef) && (
            <span style={{ color: '#a3a3a3' }}>location: {w?.location ?? f.codeRef}</span>
          )}
          {w?.landsIn && (
            <>
              <span style={{ color: '#525252' }}>· lands in</span>
              <span style={{ fontWeight: 600, color: '#0d9488' }}>{w.landsIn}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScreenView(props: Props) {
  const { screens, findings, screenName, onScreen, selectedFindingId, onSelectFinding } = props;
  const options = screenOptions(screens, findings);
  const active = screenName ?? options[0] ?? null;
  const screen = screens.find((s) => s.name === active) ?? null;
  const rows = findings.filter((f) => f.screenRef === active);
  // Layers start collapsed (headers carry the counts); switching screens
  // collapses everything again.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => setExpanded({}), [active]);

  // Commit the default pick upstream so the connector counts track this screen.
  useEffect(() => {
    if (!screenName && active) onScreen(active);
  }, [screenName, active, onScreen]);

  if (options.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#a3a3a3', padding: 12 }}>
        No screen-level findings on this application.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Select
          value={active ?? ''}
          onChange={(e) => onScreen(e.target.value)}
          style={{ flex: 1 }}
          aria-label="Screen"
        >
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      {screen && <ScreenPreview screen={screen} />}

      {LAYERS.map((layer: Layer) => {
        const layerRows = rows.filter((f) => f.layer === layer);
        const accent = LAYER_ACCENT[layer];
        const stays = layerRows.filter((f) => !findingMoves(f)).length;
        const moves = layerRows.length - stays;
        const open = !!expanded[layer];
        return (
          <div
            key={layer}
            data-anchor={`bf:${layer}`}
            style={{
              border: `1px solid ${accent.border}`,
              borderRadius: 10,
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <button
              type="button"
              onClick={() => setExpanded((c) => ({ ...c, [layer]: !c[layer] }))}
              style={{
                width: '100%',
                height: 32,
                boxSizing: 'border-box',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: accent.bg,
                border: 'none',
                borderBottom: open && layerRows.length > 0 ? `1px solid ${accent.border}` : 'none',
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  color: accent.line,
                  fontSize: 10,
                  display: 'inline-block',
                  transform: open ? 'none' : 'rotate(-90deg)',
                }}
              >
                ▾
              </span>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: accent.line }} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{layer}</span>
              <span style={{ fontSize: 10, color: '#a3a3a3' }}>{LAYER_SUBTITLE[layer]}</span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: '#525252',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {layerRows.length === 0 ? (
                  '—'
                ) : (
                  <>
                    {stays > 0 && <b style={{ color: GREEN, fontWeight: 600 }}>{stays} stay</b>}
                    {stays > 0 && moves > 0 && ' · '}
                    {moves > 0 && <b style={{ color: RED, fontWeight: 600 }}>{moves} move</b>}
                  </>
                )}
              </span>
            </button>
            {open && layerRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 6px' }}>
                {layerRows.map((f) => {
                  const moved = findingMoves(f);
                  const selected = f.id === selectedFindingId;
                  return (
                    <div key={f.id}>
                      <button
                        type="button"
                        onClick={() => onSelectFinding(selected ? null : f)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '5px 8px',
                          boxSizing: 'border-box',
                          borderRadius: 6,
                          cursor: 'pointer',
                          font: 'inherit',
                          textAlign: 'left',
                          border: selected
                            ? `1.5px solid ${moved ? '#fca5a5' : '#86efac'}`
                            : '1.5px solid transparent',
                          background: selected ? (moved ? '#fef2f2' : '#f0fdf4') : 'transparent',
                        }}
                      >
                        <span
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: 999,
                            background: moved ? '#fee2e2' : '#dcfce7',
                            border: `1px solid ${moved ? '#fca5a5' : '#86efac'}`,
                            color: moved ? RED : GREEN,
                            fontSize: 9,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          {moved ? '✕' : '✓'}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
                          >
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: moved ? 700 : 600,
                                color: moved ? '#991b1b' : '#171717',
                                minWidth: 0,
                              }}
                            >
                              {f.name}
                            </span>
                            {f.category && (
                              <span
                                style={{
                                  padding: '0 5px',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 4,
                                  color: '#64748b',
                                  fontSize: 9.5,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                {f.category}
                              </span>
                            )}
                          </span>
                          {f.plainSummary && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: 11,
                                color: '#525252',
                                lineHeight: 1.4,
                                marginTop: 1,
                              }}
                            >
                              {f.plainSummary}
                            </span>
                          )}
                          {f.codeRef && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: 9.5,
                                color: '#94a3b8',
                                fontFamily: 'ui-monospace, monospace',
                                marginTop: 2,
                                wordBreak: 'break-all',
                              }}
                            >
                              {f.codeRef}
                            </span>
                          )}
                        </span>
                        {moved && (
                          <span
                            style={{
                              padding: '1px 7px',
                              borderRadius: 4,
                              background: RED,
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            →{' '}
                            {f.deadCode
                              ? 'Dead code'
                              : f.capdan === 'Eliminate'
                                ? 'Retire'
                                : (f.targetLayer ?? f.recommendedLayer ?? 'move')}
                          </span>
                        )}
                      </button>
                      {selected && (f.whyThisMoves || f.plainSummary || f.codeRef) && (
                        <WhyDetail f={f} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
