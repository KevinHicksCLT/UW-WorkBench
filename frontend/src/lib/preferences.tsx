import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';

// PreferencesProvider — the client half of the per-user preference store
// (GET/PATCH /me/preferences, row-per-key). Every auto-save surface (settings
// page, dashboard drag-drop, sheet columns, work TOC grouping) writes through
// one debounced accumulator: update() merges optimistically into local state
// and queues the key for a single PATCH ~800ms after the last change, flushed
// early when the tab hides. PATCHes use invalidate:'none' so high-frequency
// saves never wipe the app's warm GET cache.

const DEBOUNCE_MS = 800;

// One-time localStorage migration: pre-store UI state parked under bridge.*
// keys moves server-side on first load (only when the server has no value yet).
const LOCAL_KEY_MIGRATIONS: Record<string, string> = {
  'bridge.work.toc.group.deliverables': 'work.toc.group.deliverables',
  'bridge.work.toc.group.tasks': 'work.toc.group.tasks',
};

export type PreferenceValues = Record<string, unknown>;

type PreferencesContextValue = {
  prefs: PreferenceValues;
  loading: boolean;
  /** Optimistic merge + debounced server save. A null value resets that key. */
  update: (partial: PreferenceValues) => void;
  /** Force any pending changes to the server now (e.g. before logout). */
  flush: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PreferenceValues>({});
  const [loading, setLoading] = useState(true);
  const pending = useRef<PreferenceValues>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const batch = pending.current;
    if (Object.keys(batch).length === 0) return;
    pending.current = {};
    // Serialize PATCHes — last-write-wins per key on the server, and chaining
    // keeps a slow save from racing a fast follow-up. Failures are dropped
    // (preference data; the optimistic state remains and a later change retries).
    inflight.current = inflight.current
      .then(() => api.patch('/me/preferences', batch, { invalidate: 'none' }))
      .then(() => undefined)
      .catch(() => undefined);
  }, []);

  const update = useCallback(
    (partial: PreferenceValues) => {
      setPrefs((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(partial)) {
          if (v === null) delete next[k];
          else next[k] = v;
        }
        return next;
      });
      pending.current = { ...pending.current, ...partial };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    api
      .get<PreferenceValues>('/me/preferences')
      .then((server) => {
        // bridge.* migration — only for keys the server doesn't know yet.
        const migrated: PreferenceValues = {};
        for (const [localKey, serverKey] of Object.entries(LOCAL_KEY_MIGRATIONS)) {
          if (server[serverKey] !== undefined) {
            localStorage.removeItem(localKey);
            continue;
          }
          const raw = localStorage.getItem(localKey);
          if (raw !== null) {
            migrated[serverKey] = raw;
            localStorage.removeItem(localKey);
          }
        }
        setPrefs({ ...server, ...migrated });
        if (Object.keys(migrated).length > 0) {
          pending.current = { ...pending.current, ...migrated };
          flush();
        }
      })
      .catch(() => {}) // fresh session with no prefs is fine; UI uses defaults
      .finally(() => setLoading(false));
  }, [flush]);

  // Don't lose trailing edits when the tab hides or closes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', flush);
    };
  }, [flush]);

  return (
    <PreferencesContext.Provider value={{ prefs, loading, update, flush }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
