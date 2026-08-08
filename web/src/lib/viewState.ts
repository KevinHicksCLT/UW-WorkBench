import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

// ── Per-view navigation state ───────────────────────────────────────────────
// Views persist their state (filters, sort, search, toggles) here, keyed by a
// stable view key, and re-seed from it on mount. sessionStorage-backed, so it
// survives any way of returning to a view but resets with the browsing
// session. Storage failures (private mode, quota) degrade to an in-memory map.

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
