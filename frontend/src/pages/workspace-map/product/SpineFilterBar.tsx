import { useState } from 'react';
import { Select } from '../../../components/ui';
import type { LobOption, VersionColumn } from './spine';

// The Products lens' single filtering system, shared by the detail and grid
// views: the spine sort chain as cascading dropdowns — 1 Segment › 2 Line of
// business › 3 Product offering › 4 Version / scope. Each level narrows the
// compared scope; "All …" leaves the level open. Versions are a MULTI-select:
// pick any set of versions to normalize together (empty = all in scope).

export interface SpineFilters {
  segment: string;
  lobId: string;
  offering: string;
  /** Picked version ids — empty means every version the upper levels allow. */
  versionIds: string[];
}

export const EMPTY_FILTERS: SpineFilters = { segment: '', lobId: '', offering: '', versionIds: [] };

/** Older sessions persisted a single `versionId` — normalize defensively. */
export function normalizeFilters(
  raw: Partial<SpineFilters> & { versionId?: string },
): SpineFilters {
  return {
    segment: raw.segment ?? '',
    lobId: raw.lobId ?? '',
    offering: raw.offering ?? '',
    versionIds: raw.versionIds ?? (raw.versionId ? [raw.versionId] : []),
  };
}

export function scopeVersions(pool: VersionColumn[], f: SpineFilters): VersionColumn[] {
  return pool.filter(
    (v) =>
      (!f.segment || v.segmentName === f.segment) &&
      (!f.lobId || v.lobId === f.lobId) &&
      (!f.offering || v.productName === f.offering) &&
      (f.versionIds.length === 0 || f.versionIds.includes(v.id)),
  );
}

/** The lobs structure narrowed to the filtered scope (empty LOBs dropped). */
export function scopeLobs(lobs: LobOption[], f: SpineFilters): LobOption[] {
  return lobs
    .filter((l) => (!f.segment || l.segmentName === f.segment) && (!f.lobId || l.id === f.lobId))
    .map((l) => ({
      ...l,
      versions: l.versions.filter(
        (v) =>
          (!f.offering || v.productName === f.offering) &&
          (f.versionIds.length === 0 || f.versionIds.includes(v.id)),
      ),
    }))
    .filter((l) => l.versions.length > 0);
}

const SELECT_STYLE: React.CSSProperties = {
  width: 'auto',
  minWidth: 120,
  maxWidth: 230,
  height: 26,
  padding: '0 24px 0 8px',
  fontSize: 12,
};

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

export default function SpineFilterBar({
  lobs,
  filters,
  onChange,
  scopeCount,
  totalCount,
}: {
  lobs: LobOption[];
  filters: SpineFilters;
  onChange: (f: SpineFilters) => void;
  scopeCount: number;
  totalCount: number;
}) {
  const [versionsOpen, setVersionsOpen] = useState(false);
  const segments = [...new Set(lobs.map((l) => l.segmentName))];
  const lobPool = lobs.filter((l) => !filters.segment || l.segmentName === filters.segment);
  const offeringPool = [
    ...new Set(
      lobPool
        .filter((l) => !filters.lobId || l.id === filters.lobId)
        .flatMap((l) => l.versions.map((v) => v.productName)),
    ),
  ];
  const versionPool = lobPool
    .filter((l) => !filters.lobId || l.id === filters.lobId)
    .flatMap((l) => l.versions)
    .filter((v) => !filters.offering || v.productName === filters.offering);

  // Changing a level clears everything below it — the cascade stays coherent.
  const set = (patch: Partial<SpineFilters>, clearBelow: (keyof SpineFilters)[]) => {
    const next = { ...filters, ...patch };
    for (const k of clearBelow) {
      if (k === 'versionIds') next.versionIds = [];
      else next[k] = '';
    }
    onChange(next);
  };

  const toggleVersion = (id: string) => {
    const cur = filters.versionIds;
    onChange({
      ...filters,
      versionIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    });
  };

  const versionLabel =
    filters.versionIds.length === 0
      ? `All versions · ${versionPool.length}`
      : `${filters.versionIds.length} of ${versionPool.length} selected`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexWrap: 'wrap',
        marginBottom: 8,
      }}
    >
      <Step n={1} label="Segment" />
      <Select
        aria-label="Segment filter"
        value={filters.segment}
        onChange={(e) => set({ segment: e.target.value }, ['lobId', 'offering', 'versionIds'])}
        style={SELECT_STYLE}
      >
        <option value="">All segments</option>
        {segments.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Step n={2} label="Line of business" />
      <Select
        aria-label="Line of business filter"
        value={filters.lobId}
        onChange={(e) => set({ lobId: e.target.value }, ['offering', 'versionIds'])}
        style={SELECT_STYLE}
      >
        <option value="">All lines</option>
        {/* The same LOB name exists under several segments (Auto / Motor in
            Personal Lines, SMB, Commercial…) — group by segment so the list
            reads as a hierarchy instead of duplicates. */}
        {filters.segment
          ? lobPool.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))
          : segments.map((s) => (
              <optgroup key={s} label={s}>
                {lobPool
                  .filter((l) => l.segmentName === s)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </optgroup>
            ))}
      </Select>
      <Step n={3} label="Product offering" />
      <Select
        aria-label="Product offering filter"
        value={filters.offering}
        onChange={(e) => set({ offering: e.target.value }, ['versionIds'])}
        style={SELECT_STYLE}
      >
        <option value="">All offerings</option>
        {offeringPool.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      <Step n={4} label="Version / scope" />
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="Version filter"
          onClick={() => setVersionsOpen((o) => !o)}
          style={{
            font: 'inherit',
            height: 26,
            padding: '0 10px',
            fontSize: 12,
            cursor: 'pointer',
            border: '1px solid #d4d4d4',
            borderRadius: 6,
            background: versionsOpen ? '#171717' : '#fff',
            color: versionsOpen ? '#fff' : filters.versionIds.length ? '#171717' : '#404040',
            fontWeight: filters.versionIds.length ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {versionLabel} ▾
        </button>
        {versionsOpen && (
          <div
            style={{
              position: 'absolute',
              top: 30,
              left: 0,
              zIndex: 30,
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(15,23,42,.16)',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 300,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {versionPool.map((v) => (
              <label
                key={v.id}
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
                <input
                  type="checkbox"
                  checked={filters.versionIds.includes(v.id)}
                  onChange={() => toggleVersion(v.id)}
                />
                {v.productName} · {v.name}
              </label>
            ))}
            {versionPool.length === 0 && (
              <span style={{ fontSize: 11.5, color: '#737373' }}>
                No versions under the current filters.
              </span>
            )}
            <div
              style={{ display: 'flex', gap: 10, paddingTop: 4, borderTop: '1px solid #f0f0f0' }}
            >
              <button
                type="button"
                onClick={() => set({ versionIds: [] }, [])}
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
                All versions
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setVersionsOpen(false)}
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
      <span style={{ fontSize: 11.5, color: '#525252', marginLeft: 2 }}>
        {scopeCount} of {totalCount} versions in scope
      </span>
    </div>
  );
}
