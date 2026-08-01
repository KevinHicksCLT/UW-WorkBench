// The Products lens' single filtering system, shared by the detail and grid
// views: the spine sort chain as cascading MULTI-select dropdowns —
// 1 Segment › 2 Line of business › 3 Product offering › 4 State / Jurisdiction
// › 5 Version › 6 Product. Every level accepts all, a few or one (empty
// selection = everything the levels above allow); each level's option pool is
// narrowed by the levels above it, and changing a level clears the levels
// below so the cascade stays coherent.

import { useEffect, useRef, useState } from 'react';
import type { VersionColumn, LobOption } from './spine';

export interface SpineFilters {
  /** Every field is a multi-select; empty array = level left open. */
  segments: string[];
  lobIds: string[];
  offerings: string[];
  /** Jurisdiction codes parsed from the version name (NO_STATE = countrywide). */
  states: string[];
  /** Version/edition tokens parsed from the version name (v9, 2026, …). */
  versionTokens: string[];
  /** Concrete product columns (version ids). */
  versionIds: string[];
}

export const EMPTY_FILTERS: SpineFilters = {
  segments: [],
  lobIds: [],
  offerings: [],
  states: [],
  versionTokens: [],
  versionIds: [],
};

/** The bucket for versions whose name carries no jurisdiction token. */
export const NO_STATE = '__none__';

/** Jurisdiction code from a version name ("v9 — US-CA" → CA). */
export function stateOf(v: VersionColumn): string {
  return /US-([A-Z]{2})\b/.exec(v.name)?.[1] ?? NO_STATE;
}

/** Every jurisdiction the version COVERS — a countrywide version lists the
 *  states its filings make it live in, a state-form version its one state.
 *  Picking CA keeps every product written in CA, not only the products whose
 *  CA regulation forces its own policy form. */
export function coveredStates(v: VersionColumn): string[] {
  if (v.states && v.states.length > 0) return v.states;
  const parsed = stateOf(v);
  return parsed === NO_STATE ? [] : [parsed];
}

/** Version/edition token from a version name ("v9 — US-CA" → v9; "2026" → 2026). */
export function versionTokenOf(v: VersionColumn): string {
  return v.name.split(/[\s—–]+/).filter(Boolean)[0] ?? v.name;
}

/** Older sessions persisted single-value levels (segment/lobId/offering) or a
 *  bare versionId — normalize defensively so restored state keeps working. */
export function normalizeFilters(
  raw: Partial<SpineFilters> & {
    segment?: string;
    lobId?: string;
    offering?: string;
    versionId?: string;
  },
): SpineFilters {
  const arr = (multi: string[] | undefined, single: string | undefined) =>
    multi ?? (single ? [single] : []);
  return {
    segments: arr(raw.segments, raw.segment),
    lobIds: arr(raw.lobIds, raw.lobId),
    offerings: arr(raw.offerings, raw.offering),
    states: raw.states ?? [],
    versionTokens: raw.versionTokens ?? [],
    versionIds: raw.versionIds ?? (raw.versionId ? [raw.versionId] : []),
  };
}

const pass = (picked: string[], value: string) => picked.length === 0 || picked.includes(value);

function coversState(v: VersionColumn, picked: string[]): boolean {
  if (picked.length === 0) return true;
  return picked.some((s) =>
    s === NO_STATE ? stateOf(v) === NO_STATE : coveredStates(v).includes(s),
  );
}

function versionInScope(v: VersionColumn, f: SpineFilters): boolean {
  return (
    pass(f.segments, v.segmentName) &&
    pass(f.lobIds, v.lobId) &&
    pass(f.offerings, v.productName) &&
    coversState(v, f.states) &&
    pass(f.versionTokens, versionTokenOf(v)) &&
    pass(f.versionIds, v.id)
  );
}

export function scopeVersions(pool: VersionColumn[], f: SpineFilters): VersionColumn[] {
  return pool.filter((v) => versionInScope(v, f));
}

/** The lobs structure narrowed to the filtered scope (empty LOBs dropped). */
export function scopeLobs(lobs: LobOption[], f: SpineFilters): LobOption[] {
  return lobs
    .map((l) => ({ ...l, versions: l.versions.filter((v) => versionInScope(v, f)) }))
    .filter((l) => l.versions.length > 0);
}

// ── UI ──────────────────────────────────────────────────────────────────────

function Step({ n, label }: { n: number; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: '#404040',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          background: '#171717',
          color: '#fff',
          fontSize: 8.5,
          fontWeight: 800,
          lineHeight: '14px',
          textAlign: 'center',
        }}
      >
        {n}
      </span>
      {label}
    </span>
  );
}

interface Option {
  value: string;
  label: string;
  /** Optional group header the option sits under (e.g. segment for LOBs). */
  group?: string;
}

/** One multi-select level: a summary button opening a checkbox popover.
 *  Empty selection = "All …"; any selection = "n of m". */
function MultiPick({
  ariaLabel,
  allLabel,
  options,
  picked,
  onChange,
  openKey,
  openState,
}: {
  ariaLabel: string;
  allLabel: string;
  options: Option[];
  picked: string[];
  onChange: (next: string[]) => void;
  openKey: string;
  openState: [string | null, (k: string | null) => void];
}) {
  const [openPick, setOpenPick] = openState;
  const open = openPick === openKey;
  const ref = useRef<HTMLDivElement>(null);
  // The bar scrolls horizontally (single line), so the popover is FIXED and
  // anchored to the button's rect at open time — absolute positioning would be
  // clipped by the bar's overflow.
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  // Click-away closes the popover (one popover open at a time); any outside
  // scroll closes it too, since a fixed popover can't follow its button.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenPick(null);
    };
    const onScroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      setOpenPick(null);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, setOpenPick]);

  // Stale picks (removed by an upstream change) don't count toward the label.
  const valid = new Set(options.map((o) => o.value));
  const active = picked.filter((p) => valid.has(p));
  const label =
    active.length === 0
      ? `${allLabel} · ${options.length}`
      : `${active.length} of ${options.length} selected`;

  const toggle = (value: string) =>
    onChange(picked.includes(value) ? picked.filter((x) => x !== value) : [...picked, value]);

  const groups = [...new Set(options.map((o) => o.group).filter((g): g is string => Boolean(g)))];

  const item = (o: Option) => (
    <label
      key={o.value}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12,
        color: '#171717',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <input type="checkbox" checked={picked.includes(o.value)} onChange={() => toggle(o.value)} />
      {o.label}
    </label>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          if (!open) {
            const r = ref.current?.getBoundingClientRect();
            setAnchor(
              r ? { top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 264) } : null,
            );
          }
          setOpenPick(open ? null : openKey);
        }}
        style={{
          font: 'inherit',
          height: 26,
          padding: '0 10px',
          fontSize: 12,
          cursor: 'pointer',
          border: '1px solid #d4d4d4',
          borderRadius: 6,
          background: open ? '#171717' : '#fff',
          color: open ? '#fff' : active.length ? '#171717' : '#404040',
          fontWeight: active.length ? 600 : 400,
          whiteSpace: 'nowrap',
          maxWidth: 210,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label} ▾
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            top: anchor?.top ?? 30,
            left: anchor?.left ?? 0,
            zIndex: 30,
            background: '#fff',
            border: '1px solid #d4d4d4',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(15,23,42,.16)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 240,
            maxHeight: 320,
            overflow: 'auto',
          }}
        >
          {groups.length > 0
            ? groups.map((g) => (
                <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#525252',
                      marginTop: 2,
                    }}
                  >
                    {g}
                  </span>
                  {options.filter((o) => o.group === g).map(item)}
                </div>
              ))
            : options.map(item)}
          {options.length === 0 && (
            <span style={{ fontSize: 11.5, color: '#737373' }}>
              Nothing under the current filters.
            </span>
          )}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4, borderTop: '1px solid #f0f0f0' }}>
            <button
              type="button"
              onClick={() => onChange([])}
              style={{
                font: 'inherit',
                fontSize: 11.5,
                color: '#0070AD',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {allLabel}
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => setOpenPick(null)}
              style={{
                font: 'inherit',
                fontSize: 11.5,
                color: '#404040',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SpineFilterBar({
  lobs,
  filters,
  onChange,
  search,
  onSearch,
}: {
  lobs: LobOption[];
  filters: SpineFilters;
  onChange: (f: SpineFilters) => void;
  /** Free-text search over the board's forms/coverages (right end of the bar). */
  search: string;
  onSearch: (s: string) => void;
}) {
  const openState = useState<string | null>(null);
  const all = lobs.flatMap((l) => l.versions);

  // Each level's option pool honors the levels ABOVE it only.
  const above = (upto: keyof SpineFilters): SpineFilters => {
    const order: (keyof SpineFilters)[] = [
      'segments',
      'lobIds',
      'offerings',
      'states',
      'versionTokens',
      'versionIds',
    ];
    const f: SpineFilters = { ...EMPTY_FILTERS };
    for (const k of order) {
      if (k === upto) break;
      f[k] = filters[k];
    }
    return f;
  };
  const poolFor = (upto: keyof SpineFilters) => scopeVersions(all, above(upto));

  const segments = [...new Set(all.map((v) => v.segmentName))];
  const lobPool = [
    ...new Map(
      poolFor('lobIds').map((v) => [
        v.lobId,
        { value: v.lobId, label: v.lobName, group: v.segmentName },
      ]),
    ).values(),
  ];
  const offeringPool = [...new Set(poolFor('offerings').map((v) => v.productName))];
  const statePool = [
    ...new Set(poolFor('states').flatMap((v) => [...coveredStates(v), stateOf(v)])),
  ].sort((a, b) => (a === NO_STATE ? 1 : b === NO_STATE ? -1 : a.localeCompare(b)));
  const tokenPool = [...new Set(poolFor('versionTokens').map(versionTokenOf))].sort();
  const productPool = poolFor('versionIds');

  // Changing a level clears every level below it — the cascade stays coherent.
  const ORDER: (keyof SpineFilters)[] = [
    'segments',
    'lobIds',
    'offerings',
    'states',
    'versionTokens',
    'versionIds',
  ];
  const set = (level: keyof SpineFilters, value: string[]) => {
    const next = { ...filters, [level]: value };
    for (const k of ORDER.slice(ORDER.indexOf(level) + 1)) next[k] = [];
    onChange(next);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        // ONE line always: the bar never wraps — on narrow viewports it
        // scrolls horizontally instead (popovers are fixed, so no clipping).
        flexWrap: 'nowrap',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        flex: 1,
        minWidth: 0,
        marginBottom: 8,
      }}
    >
      <Step n={1} label="Segment" />
      <MultiPick
        ariaLabel="Segment filter"
        allLabel="All segments"
        options={segments.map((s) => ({ value: s, label: s }))}
        picked={filters.segments}
        onChange={(v) => set('segments', v)}
        openKey="segments"
        openState={openState}
      />
      <Step n={2} label="Line of business" />
      <MultiPick
        ariaLabel="Line of business filter"
        allLabel="All lines"
        options={lobPool}
        picked={filters.lobIds}
        onChange={(v) => set('lobIds', v)}
        openKey="lobs"
        openState={openState}
      />
      <Step n={3} label="Product offering" />
      <MultiPick
        ariaLabel="Product offering filter"
        allLabel="All offerings"
        options={offeringPool.map((o) => ({ value: o, label: o }))}
        picked={filters.offerings}
        onChange={(v) => set('offerings', v)}
        openKey="offerings"
        openState={openState}
      />
      <Step n={4} label="State / Jurisdiction" />
      <MultiPick
        ariaLabel="State or jurisdiction filter"
        allLabel="All states"
        options={statePool.map((s) => ({
          value: s,
          label: s === NO_STATE ? 'Countrywide / no state' : /^[A-Z]{2}$/.test(s) ? `US-${s}` : s,
        }))}
        picked={filters.states}
        onChange={(v) => set('states', v)}
        openKey="states"
        openState={openState}
      />
      <Step n={5} label="Version" />
      <MultiPick
        ariaLabel="Version filter"
        allLabel="All versions"
        options={tokenPool.map((t) => ({ value: t, label: t }))}
        picked={filters.versionTokens}
        onChange={(v) => set('versionTokens', v)}
        openKey="tokens"
        openState={openState}
      />
      <Step n={6} label="Product" />
      <MultiPick
        ariaLabel="Product filter"
        allLabel="All products"
        options={productPool.map((v) => ({
          value: v.id,
          label: `${v.productName} · ${v.name}`,
          group: v.lobName,
        }))}
        picked={filters.versionIds}
        onChange={(v) => set('versionIds', v)}
        openKey="products"
        openState={openState}
      />
      <input
        type="search"
        aria-label="Search the board"
        placeholder="Search…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        style={{
          font: 'inherit',
          fontSize: 12,
          border: '1px solid #d4d4d4',
          borderRadius: 8,
          padding: '4px 10px',
          width: 160,
          minWidth: 110,
          flexShrink: 1,
          marginLeft: 2,
        }}
      />
    </div>
  );
}
