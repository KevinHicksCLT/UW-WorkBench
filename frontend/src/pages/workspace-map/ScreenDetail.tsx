import { useEffect, useState } from 'react';
import { findingMoves, GREEN, RED } from './types';
import type { BoardScreen, Finding } from './types';

// ScreenView's detail pieces: the live iframe preview of a screen and the
// per-finding "WHY THIS MOVES / STAYS" panel. Extracted so ScreenView stays
// under the 500-line structure rule.

/** True when the preview URL would embed THIS page (the Workspace board)
 *  inside itself — an infinite board-in-board recursion that melts layout. */
function wouldRecurse(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname === window.location.pathname;
  } catch {
    return false;
  }
}

export function ScreenPreview({ screen }: { screen: BoardScreen }) {
  // The preview stays hidden behind a loading veil until the framed page has
  // fired load AND had a settle window for its lazy chunk + data fetches —
  // the user never sees a half-rendered page.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(false), [screen.url]);

  if (screen.url && wouldRecurse(screen.url)) {
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
          textAlign: 'center',
          padding: '0 16px',
        }}
      >
        This screen is the Workspace itself — no live preview (it would nest the board inside
        itself).
      </div>
    );
  }

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

export function WhyDetail({ f }: { f: Finding }) {
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
