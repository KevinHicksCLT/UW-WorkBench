import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// PreferencesProvider — per-user UI preference store (sheet column layouts,
// view toggles). The Transformation Bridge platform persists these server-side
// (PATCH /me/preferences); this standalone app keeps the identical consumer
// contract (prefs / loading / update / flush) but backs it with localStorage,
// so sheet state survives reloads without a preferences API.

const STORAGE_KEY = 'uw.preferences';

export type PreferenceValues = Record<string, unknown>;

type PreferencesContextValue = {
  prefs: PreferenceValues;
  loading: boolean;
  /** Optimistic merge + persist. A null value resets that key. */
  update: (partial: PreferenceValues) => void;
  /** No-op here (writes are synchronous); kept for contract parity. */
  flush: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function load(): PreferenceValues {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as PreferenceValues;
  } catch {
    return {};
  }
}

function save(prefs: PreferenceValues): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota/private-mode failures degrade to in-memory state — never throw.
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PreferenceValues>(load);

  const update = useCallback((partial: PreferenceValues) => {
    setPrefs((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(partial)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
      save(next);
      return next;
    });
  }, []);

  const flush = useCallback(() => {}, []);

  return (
    <PreferencesContext.Provider value={{ prefs, loading: false, update, flush }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
