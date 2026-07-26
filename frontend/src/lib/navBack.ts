import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Smart back ──────────────────────────────────────────────────────────────
// The one back behavior for the whole app (ui/BackButton, the breadcrumb
// bar's back button). Back means, in order:
//   1. Pop the deepest IN-PAGE drill level — drilled surfaces (TOC descents,
//      state-driven tables) register a handler via useBackHandler; there is
//      no per-page back pill, the header button is the way back.
//   2. History back — React Router stamps an entry index on `history.state`
//      (`idx`); idx > 0 means an in-app entry is behind us, and returning to
//      it restores its exact view state via lib/viewState.
//   3. `fallback` (default `/`) — idx 0 is a fresh deep link or refresh, and
//      plain history-back would exit the app.

type BackHandler = () => boolean; // true = consumed the back action
const backHandlers: { current: BackHandler }[] = [];

/**
 * Register an in-page back handler while mounted (and `enabled`). Handlers
 * run newest-first; return true to consume the back action (one drill level
 * popped), false to pass it on. Return false at the drill root so the header
 * button falls through to history.
 */
export function useBackHandler(handler: BackHandler, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const entry = { current: () => ref.current() };
    backHandlers.push(entry);
    return () => {
      const i = backHandlers.indexOf(entry);
      if (i >= 0) backHandlers.splice(i, 1);
    };
  }, [enabled]);
}

/** True when there is an in-app history entry to go back to. */
export function canGoBack(): boolean {
  if (typeof window === 'undefined') return false;
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

/**
 * Returns a stable callback implementing the back order above: in-page drill
 * pop → history back → `fallback`.
 */
export function useSmartBack(fallback = '/'): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    for (let i = backHandlers.length - 1; i >= 0; i--) {
      if (backHandlers[i].current()) return;
    }
    if (canGoBack()) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
