import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

// ── Per-view navigation state ───────────────────────────────────────────────
// The single reusable mechanism behind "go back and land exactly where you
// left": views persist their state (filters, sort, search, toggles, scroll
// offset) here, keyed by a stable view key, and re-seed from it on mount. It
// is sessionStorage-backed, so it survives any way of returning to a view —
// browser Back/Forward, a breadcrumb click, or a nav-tab link — but resets
// with the browsing session (a fresh session starts clean). Storage failures
// (private mode, quota) degrade to an in-memory map, never to an exception.
//
// Consumers:
//   - Sheet.tsx persists filters/sort/search per `sheetKey` — every list tab.
//   - Layout.tsx restores the detail-page scroller per pathname+search.
//   - Pages persist view toggles (e.g. Applications TOC|List) via useViewState.

const NS = 'nav.view.';
const memory = new Map<string, string>(); // fallback when sessionStorage throws

function rawRead(key: string): string | null {
  try {
    return window.sessionStorage.getItem(NS + key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function rawWrite(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(NS + key, value);
  } catch {
    memory.set(key, value);
  }
}

function rawRemove(key: string): void {
  try {
    window.sessionStorage.removeItem(NS + key);
  } catch {
    // sessionStorage unavailable — the memory fallback below still clears.
  }
  memory.delete(key);
}

/** Read a persisted view-state value; undefined when absent or unparsable. */
export function loadViewState<T>(key: string): T | undefined {
  const raw = rawRead(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    rawRemove(key); // corrupted entry — drop it so it can't poison future reads
    return undefined;
  }
}

/** Persist a view-state value (JSON-serializable). */
export function saveViewState<T>(key: string, value: T): void {
  rawWrite(key, JSON.stringify(value));
}

/** Remove a persisted view-state value. */
export function clearViewState(key: string): void {
  rawRemove(key);
}

/**
 * `useState` that survives leaving and re-entering the view. Seeds from the
 * persisted value under `key` (falling back to `initial`) and writes every
 * subsequent change back. `key: null` disables persistence entirely (plain
 * state); `restore: false` ignores any saved value on mount (deep links that
 * must show their own state) while still recording later changes.
 */
export function useViewState<T>(
  key: string | null,
  initial: T | (() => T),
  restore = true,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (key !== null && restore) {
      const saved = loadViewState<T>(key);
      if (saved !== undefined) return saved;
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const keyRef = useRef(key);
  keyRef.current = key;
  // Save only on changes AFTER mount: the mount value is either the restored
  // value (already saved) or the initial default (saving it would clobber a
  // saved value that `restore: false` deliberately skipped).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (keyRef.current !== null) saveViewState(keyRef.current, value);
  }, [value]);
  return [value, setValue];
}

/**
 * Runs `effect` when `value` CHANGES between renders — never on mount. The
 * companion to useViewState for "a scope switch resets dependent state"
 * effects: a plain `useEffect(..., [value])` also fires on mount, which would
 * wipe state that useViewState just restored.
 *
 * `undefined` means "not settled yet" (e.g. derived from data still loading):
 * while undefined the hook is unarmed, and the FIRST defined value arms it
 * silently — so the loading→loaded transition never counts as a change and
 * never fires a reset over freshly restored state. Use `null` (not undefined)
 * when "empty" is a real value that should participate in change detection.
 */
export function useOnChange<T>(value: T | undefined, effect: () => void): void {
  const prev = useRef(value);
  const cb = useRef(effect);
  cb.current = effect;
  useEffect(() => {
    if (value === undefined) return; // unarmed while the value is unsettled
    if (prev.current === undefined) {
      prev.current = value; // first settled value arms silently
      return;
    }
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    cb.current();
  }, [value]);
}

// How long the restore loop keeps waiting for async content to grow tall
// enough to accept the saved offset before settling for a clamped best effort.
// Timer-based (not rAF): rAF stalls in backgrounded/hidden tabs, which would
// leave the restore permanently pending.
const RESTORE_TICK_MS = 16;
const RESTORE_MAX_TICKS = 150; // ~2.5s

/**
 * Persist and restore an element's vertical scroll position under `key`.
 * Restoring waits (frame by frame) for async content to reach the saved
 * offset — lists render after their fetch — and gives up after a bounded
 * number of frames with a clamped best effort. A user scroll (wheel/touch)
 * cancels a pending restore so it never yanks the scroll away. With no saved
 * offset (or `restore: false`) the element resets to the top, so a fresh page
 * never inherits the previous page's scroll. `key: null` disables the hook.
 */
export function useScrollRestore(
  ref: RefObject<HTMLElement | null>,
  key: string | null,
  restore = true,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || key === null) return;

    const target = restore ? (loadViewState<number>(key) ?? 0) : 0;

    // Record the offset synchronously on every scroll event — NOT deferred to
    // rAF (stalls in hidden tabs) and NOT saved in cleanup (by then the page's
    // DOM is gone and the browser has clamped scrollTop to 0). While a restore
    // is still pending, scroll events are IGNORED: swapping page content in
    // shrinks the scroller, and the browser's resulting clamp-to-0 scroll
    // event would overwrite the very offset being restored.
    let restoring = target > 0;
    const onScroll = () => {
      if (restoring) return;
      saveViewState(key, el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      restoring = false; // a real user gesture takes over — record it again
    };
    let restoreTimer = 0;
    if (target > 0) {
      el.addEventListener('wheel', cancel, { passive: true, once: true });
      el.addEventListener('touchstart', cancel, { passive: true, once: true });
      let ticks = 0;
      const attempt = () => {
        if (cancelled) return;
        if (el.scrollHeight - el.clientHeight >= target) {
          restoring = false;
          el.scrollTop = target;
          saveViewState(key, el.scrollTop); // scrollTop set may clamp silently
          return;
        }
        if (++ticks < RESTORE_MAX_TICKS) restoreTimer = window.setTimeout(attempt, RESTORE_TICK_MS);
        else {
          restoring = false;
          el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight); // content shrank
        }
      };
      attempt();
    } else {
      el.scrollTop = 0;
    }

    return () => {
      cancelled = true;
      if (restoreTimer) window.clearTimeout(restoreTimer);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', cancel);
      el.removeEventListener('touchstart', cancel);
    };
  }, [ref, key, restore]);
}
