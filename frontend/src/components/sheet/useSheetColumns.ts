import { useCallback, useMemo, useState } from 'react';
import { usePreferences } from '../../lib/preferences';

// useSheetColumns — per-user column personalization for the Sheet component.
// Merges the DECLARED column list (source of truth for labels, widths, render)
// with the user's persisted `sheet.columns.<sheetKey>` preference
// ({ order, hidden, widths }) into the EFFECTIVE columns the sheet renders.
// The merge is a pure function (exported for unit tests); the hook adds the
// preference-store read/write plumbing plus transient width previews so a
// resize drag updates live and commits once on pointerup.

/** Minimal column shape the merge needs — SheetCol<R> satisfies it. */
export type ColumnSpec = {
  key: string;
  width: string; // CSS grid track, e.g. '170px' or 'minmax(0,1fr)'
  hideable?: boolean; // default true
  minPx?: number; // resize floor, default 60
};

/** Mirror of shared/src/entitlements.ts `sheetColumnsPreferenceSchema`. */
export type SheetColumnsPref = {
  order?: string[];
  hidden?: string[];
  widths?: Record<string, number>;
};

export const DEFAULT_MIN_PX = 60;
const SCHEMA_MIN_PX = 24; // floor enforced by the server-side zod schema
const SCHEMA_MAX_PX = 2000;
const MAX_WIDTH_ENTRIES = 64;

const FIXED_PX = /^\d+(?:\.\d+)?px$/;

/** A track that isn't a plain fixed px value stretches (minmax/fr/auto/%). */
export function isFluidTrack(width: string): boolean {
  return !FIXED_PX.test(width.trim());
}

function clampPx(col: ColumnSpec, px: number): number {
  const floor = Math.max(SCHEMA_MIN_PX, col.minPx ?? DEFAULT_MIN_PX);
  return Math.min(SCHEMA_MAX_PX, Math.max(floor, Math.round(px)));
}

export type MergedColumns<C extends ColumnSpec> = {
  /** Every known column in effective order (hidden included) — feeds the picker. */
  ordered: C[];
  /** Visible columns in effective order — what the sheet renders. */
  visible: C[];
  /** CSS grid track per visible column, width overrides applied. */
  tracks: string[];
  /** Append a phantom `1fr` filler track (every fluid column has been pinned). */
  filler: boolean;
  /** Full grid-template-columns string (tracks + filler when present). */
  template: string;
  /** Effectively-hidden keys (unknown / hideable:false entries dropped). */
  hiddenKeys: string[];
};

/**
 * Pure merge of declared columns with a persisted preference.
 * - order: applies to KNOWN keys only; a column the pref doesn't mention
 *   (added by devs after the pref was saved) slots in at its declared index;
 *   unknown persisted keys are ignored.
 * - hidden: unknown keys and `hideable: false` columns are never hidden; a
 *   pref that would hide every column is ignored entirely (fail-safe).
 * - widths: clamped to [max(24, minPx), 2000]; a fixed-px column renders
 *   `${px}px`, a fluid column renders `minmax(${px}px,1fr)`. When EVERY fluid
 *   column carries an override, a phantom `1fr` filler track is appended so
 *   rows never underflow the card.
 */
export function mergeSheetColumns<C extends ColumnSpec>(
  declared: C[],
  pref: SheetColumnsPref | undefined,
): MergedColumns<C> {
  const known = new Map(declared.map((c) => [c.key, c]));

  // Effective order: persisted order restricted to known keys, then every
  // column the pref doesn't mention inserted at its declared index.
  const persisted = (pref?.order ?? []).filter((k) => known.has(k));
  const seen = new Set(persisted);
  const ordered: C[] = persisted.map((k) => known.get(k) as C);
  declared.forEach((c, i) => {
    if (seen.has(c.key)) return;
    ordered.splice(Math.min(i, ordered.length), 0, c);
  });

  // Hidden set — protect hideable:false columns, drop unknown keys.
  const hiddenSet = new Set(
    (pref?.hidden ?? []).filter(
      (k) => known.get(k) !== undefined && known.get(k)?.hideable !== false,
    ),
  );
  let visible = ordered.filter((c) => !hiddenSet.has(c.key));
  if (visible.length === 0) {
    hiddenSet.clear();
    visible = [...ordered];
  }

  // Width overrides → grid tracks.
  const widths = pref?.widths ?? {};
  const pxFor = (c: C): number | undefined => {
    const w = widths[c.key];
    return typeof w === 'number' && Number.isFinite(w) ? clampPx(c, w) : undefined;
  };
  const tracks = visible.map((c) => {
    const px = pxFor(c);
    if (px === undefined) return c.width;
    return isFluidTrack(c.width) ? `minmax(${px}px,1fr)` : `${px}px`;
  });
  const fluid = visible.filter((c) => isFluidTrack(c.width));
  const filler = fluid.length > 0 && fluid.every((c) => pxFor(c) !== undefined);

  return {
    ordered,
    visible,
    tracks,
    filler,
    template: (filler ? [...tracks, '1fr'] : tracks).join(' '),
    hiddenKeys: [...hiddenSet],
  };
}

/** Defensive parse of the raw (unknown-shaped) preference value. */
export function readSheetColumnsPref(value: unknown): SheetColumnsPref | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  const strings = (x: unknown): string[] | undefined =>
    Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : undefined;
  let widths: Record<string, number> | undefined;
  if (typeof v.widths === 'object' && v.widths !== null) {
    widths = {};
    for (const [k, w] of Object.entries(v.widths as Record<string, unknown>)) {
      if (typeof w === 'number' && Number.isFinite(w)) widths[k] = w;
    }
  }
  return { order: strings(v.order), hidden: strings(v.hidden), widths };
}

export type SheetColumnsState<C extends ColumnSpec> = {
  enabled: boolean;
  /** Visible columns in effective order — render these. */
  cols: C[];
  /** Every known column in effective order — for the picker checklist. */
  allCols: C[];
  hiddenKeys: string[];
  template: string;
  filler: boolean;
  /** Changes whenever order/hidden/widths change — wire to the height cache. */
  signature: string;
  reorder: (activeKey: string, overKey: string) => void;
  setHidden: (key: string, hide: boolean) => void;
  previewWidth: (key: string, px: number) => void;
  commitWidth: (key: string, px: number) => void;
  cancelWidth: () => void;
  reset: () => void;
};

export function useSheetColumns<C extends ColumnSpec>(
  sheetKey: string | undefined,
  declared: C[],
): SheetColumnsState<C> {
  const { prefs, update } = usePreferences();
  const prefKey = sheetKey ? `sheet.columns.${sheetKey}` : undefined;
  const raw = prefKey ? prefs[prefKey] : undefined;
  const stored = useMemo(() => readSheetColumnsPref(raw), [raw]);

  // Transient widths while a resize drag is in flight (committed on pointerup).
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const effective = useMemo<SheetColumnsPref | undefined>(() => {
    if (!preview) return stored;
    return { ...stored, widths: { ...stored?.widths, ...preview } };
  }, [stored, preview]);

  const merged = useMemo(() => mergeSheetColumns(declared, effective), [declared, effective]);

  const save = useCallback(
    (next: SheetColumnsPref) => {
      if (!prefKey) return;
      // Prune unknown width keys so the record stays inside the schema cap.
      const knownKeys = new Set(declared.map((c) => c.key));
      const widths = Object.fromEntries(
        Object.entries(next.widths ?? {})
          .filter(([k]) => knownKeys.has(k))
          .slice(0, MAX_WIDTH_ENTRIES),
      );
      update({ [prefKey]: { ...next, widths } });
    },
    [prefKey, declared, update],
  );

  const reorder = useCallback(
    (activeKey: string, overKey: string) => {
      if (!prefKey) return;
      const vis = merged.visible.map((c) => c.key);
      const from = vis.indexOf(activeKey);
      const to = vis.indexOf(overKey);
      if (from < 0 || to < 0 || from === to) return;
      const nextVis = [...vis];
      nextVis.splice(to, 0, ...nextVis.splice(from, 1));
      // Rebuild the FULL order (hidden columns keep their slots).
      const hidden = new Set(merged.hiddenKeys);
      let vi = 0;
      const full = merged.ordered.map((c) => (hidden.has(c.key) ? c.key : nextVis[vi++]));
      save({ ...stored, order: full });
    },
    [prefKey, merged, stored, save],
  );

  const setHidden = useCallback(
    (key: string, hide: boolean) => {
      if (!prefKey) return;
      const col = declared.find((c) => c.key === key);
      if (!col || (hide && col.hideable === false)) return;
      // Never allow hiding the last visible column.
      if (hide && merged.visible.length === 1 && merged.visible[0].key === key) return;
      const next = new Set(merged.hiddenKeys);
      if (hide) next.add(key);
      else next.delete(key);
      save({ ...stored, hidden: [...next] });
    },
    [prefKey, declared, merged, stored, save],
  );

  const previewWidth = useCallback((key: string, px: number) => {
    setPreview((p) => ({ ...p, [key]: px }));
  }, []);

  const cancelWidth = useCallback(() => setPreview(null), []);

  const commitWidth = useCallback(
    (key: string, px: number) => {
      setPreview(null);
      if (!prefKey) return;
      const col = declared.find((c) => c.key === key);
      if (!col) return;
      save({ ...stored, widths: { ...stored?.widths, [key]: clampPx(col, px) } });
    },
    [prefKey, declared, stored, save],
  );

  const reset = useCallback(() => {
    setPreview(null);
    if (prefKey) update({ [prefKey]: null });
  }, [prefKey, update]);

  return {
    enabled: !!sheetKey,
    cols: merged.visible,
    allCols: merged.ordered,
    hiddenKeys: merged.hiddenKeys,
    template: merged.template,
    filler: merged.filler,
    signature: merged.visible.map((c) => c.key).join('|') + '::' + merged.template,
    reorder,
    setHidden,
    previewWidth,
    commitWidth,
    cancelWidth,
    reset,
  };
}
