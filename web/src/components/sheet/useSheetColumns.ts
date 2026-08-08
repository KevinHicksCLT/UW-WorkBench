import { useCallback, useMemo, useState } from 'react';

// useSheetColumns — per-user column personalization for the Sheet component,
// localStorage-backed (this standalone app has no server-side preference
// store). With a sheetKey, hidden-column choices persist across sessions under
// `uw.sheet.columns.<sheetKey>`; without one the declared columns pass through
// untouched.

/** Minimal column shape the merge needs — SheetCol<R> satisfies it. */
export type ColumnSpec = {
  key: string;
  width: string; // CSS grid track, e.g. '170px' or 'minmax(0,1fr)'
  hideable?: boolean; // default true
};

type SheetColumnsPref = { hidden?: string[] };

const STORAGE_NS = 'uw.sheet.columns.';

function readPref(sheetKey: string): SheetColumnsPref {
  try {
    const raw = window.localStorage.getItem(STORAGE_NS + sheetKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const hidden = (parsed as { hidden?: unknown }).hidden;
    return {
      hidden: Array.isArray(hidden) ? hidden.filter((k): k is string => typeof k === 'string') : undefined,
    };
  } catch {
    return {};
  }
}

function writePref(sheetKey: string, pref: SheetColumnsPref | null): void {
  try {
    if (pref === null) window.localStorage.removeItem(STORAGE_NS + sheetKey);
    else window.localStorage.setItem(STORAGE_NS + sheetKey, JSON.stringify(pref));
  } catch {
    // Storage unavailable (private mode, quota) — personalization is best-effort.
  }
}

export type SheetColumnsState<C extends ColumnSpec> = {
  enabled: boolean;
  /** Visible columns in declared order — render these. */
  cols: C[];
  /** Every known column — for the picker checklist. */
  allCols: C[];
  hiddenKeys: string[];
  template: string;
  /** Changes whenever visibility changes — wire to the row-height cache. */
  signature: string;
  setHidden: (key: string, hide: boolean) => void;
  reset: () => void;
};

export function useSheetColumns<C extends ColumnSpec>(
  sheetKey: string | undefined,
  declared: C[],
): SheetColumnsState<C> {
  const [pref, setPref] = useState<SheetColumnsPref>(() => (sheetKey ? readPref(sheetKey) : {}));

  // Hidden set — protect hideable:false columns, drop unknown keys, and never
  // allow a pref that would hide every column (fail-safe).
  const { visible, hiddenKeys } = useMemo(() => {
    const known = new Map(declared.map((c) => [c.key, c]));
    const hiddenSet = new Set(
      (pref.hidden ?? []).filter((k) => known.has(k) && known.get(k)?.hideable !== false),
    );
    let vis = declared.filter((c) => !hiddenSet.has(c.key));
    if (vis.length === 0) {
      hiddenSet.clear();
      vis = [...declared];
    }
    return { visible: vis, hiddenKeys: [...hiddenSet] };
  }, [declared, pref]);

  const template = useMemo(() => visible.map((c) => c.width).join(' '), [visible]);

  const setHidden = useCallback(
    (key: string, hide: boolean) => {
      if (!sheetKey) return;
      const col = declared.find((c) => c.key === key);
      if (!col || (hide && col.hideable === false)) return;
      // Never allow hiding the last visible column.
      if (hide && visible.length === 1 && visible[0].key === key) return;
      const next = new Set(hiddenKeys);
      if (hide) next.add(key);
      else next.delete(key);
      const nextPref = { hidden: [...next] };
      setPref(nextPref);
      writePref(sheetKey, nextPref);
    },
    [sheetKey, declared, visible, hiddenKeys],
  );

  const reset = useCallback(() => {
    if (!sheetKey) return;
    setPref({});
    writePref(sheetKey, null);
  }, [sheetKey]);

  return {
    enabled: !!sheetKey,
    cols: visible,
    allCols: declared,
    hiddenKeys,
    template,
    signature: visible.map((c) => c.key).join('|') + '::' + template,
    setHidden,
    reset,
  };
}
