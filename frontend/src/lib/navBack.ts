import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Smart history back ──────────────────────────────────────────────────────
// The one back behavior for the whole app (ui/BackButton, the breadcrumb
// bar's back arrow). React Router stamps an entry index on `history.state`
// (`idx`); idx > 0 means there is an in-app entry behind us, so `navigate(-1)`
// returns to the previous screen — which restores its exact view state via
// lib/viewState. idx 0 (the app was entered on this page: fresh deep link or
// refresh) would back out of the app entirely, so fall back to an in-app
// destination instead.

/** True when there is an in-app history entry to go back to. */
export function canGoBack(): boolean {
  if (typeof window === 'undefined') return false;
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

/**
 * Returns a stable callback: history back when in-app history exists,
 * otherwise navigate to `fallback` (default `/`).
 */
export function useSmartBack(fallback = '/'): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (canGoBack()) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
