import { Select } from '../../../components/ui';
import type { LobOption, VersionColumn } from './spine';

// The Products lens' single filtering system, shared by the detail and grid
// views: the spine sort chain as cascading dropdowns — 1 Segment › 2 Line of
// business › 3 Product offering › 4 Version / scope. Each level narrows the
// compared scope; "All …" leaves the level open. Child picks that fall out of
// the parent's scope are cleared by the owner (ProductBoard).

export interface SpineFilters {
  segment: string;
  lobId: string;
  offering: string;
  versionId: string;
}

export const EMPTY_FILTERS: SpineFilters = { segment: '', lobId: '', offering: '', versionId: '' };

export function scopeVersions(pool: VersionColumn[], f: SpineFilters): VersionColumn[] {
  return pool.filter(
    (v) =>
      (!f.segment || v.segmentName === f.segment) &&
      (!f.lobId || v.lobId === f.lobId) &&
      (!f.offering || v.productName === f.offering) &&
      (!f.versionId || v.id === f.versionId),
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
          (!f.offering || v.productName === f.offering) && (!f.versionId || v.id === f.versionId),
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
  fontSize: 11.5,
};

function Step({ n, label }: { n: number; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10.5,
        color: '#525252',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 13,
          height: 13,
          borderRadius: 999,
          background: '#171717',
          color: '#fff',
          fontSize: 8,
          fontWeight: 800,
          lineHeight: '13px',
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
    for (const k of clearBelow) next[k] = '';
    onChange(next);
  };

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
        onChange={(e) => set({ segment: e.target.value }, ['lobId', 'offering', 'versionId'])}
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
        onChange={(e) => set({ lobId: e.target.value }, ['offering', 'versionId'])}
        style={SELECT_STYLE}
      >
        <option value="">All lines</option>
        {lobPool.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
      <Step n={3} label="Product offering" />
      <Select
        aria-label="Product offering filter"
        value={filters.offering}
        onChange={(e) => set({ offering: e.target.value }, ['versionId'])}
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
      <Select
        aria-label="Version filter"
        value={filters.versionId}
        onChange={(e) => set({ versionId: e.target.value }, [])}
        style={SELECT_STYLE}
      >
        <option value="">All versions</option>
        {versionPool.map((v) => (
          <option key={v.id} value={v.id}>
            {v.productName} · {v.name}
          </option>
        ))}
      </Select>
      <span style={{ fontSize: 11, color: '#a3a3a3', marginLeft: 2 }}>
        {scopeCount} of {totalCount} versions in scope
      </span>
    </div>
  );
}
