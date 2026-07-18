import { useState } from 'react';
import { Select } from '../../components/ui';

// Compare picker for the application board — mirrors the Products lens'
// VersionPicker: one compact dropdown per picked application, a remove ×, and
// an add-dropdown. Every scanned application is one FLAT option (no board
// grouping — openIMIS, OpenMRS and the Transformation Bridge are three peers);
// the Domain and Value-stream filters narrow which applications the dropdowns
// offer. Filter options only list domains/streams that actually carry scanned
// applications.

/** One pickable scanned application (a board's legacy source app). */
export interface AppOption {
  id: string;
  name: string;
  boardId: string;
  /** The owning board's value stream + L1 domain (filter axes). */
  valueStream: string | null;
  domain: string | null;
}

const APP_SELECT_STYLE: React.CSSProperties = {
  width: 'auto',
  minWidth: 150,
  maxWidth: 280,
  height: 26,
  padding: '0 24px 0 9px',
  fontSize: 11.5,
};

const FILTER_SELECT_STYLE: React.CSSProperties = {
  width: 'auto',
  minWidth: 120,
  maxWidth: 220,
  height: 26,
  padding: '0 24px 0 9px',
  fontSize: 11.5,
};

export default function AppPicker({
  pool,
  selected,
  onReplace,
  onAdd,
  onRemove,
}: {
  pool: AppOption[];
  selected: AppOption[];
  onReplace: (oldId: string, newId: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  // The filters only narrow what the dropdowns OFFER — already-picked
  // applications stay on the board regardless.
  const [domain, setDomain] = useState('');
  const [stream, setStream] = useState('');

  const domains = [...new Set(pool.map((a) => a.domain).filter((d): d is string => !!d))].sort();
  const streams = [
    ...new Set(
      pool
        .filter((a) => !domain || a.domain === domain)
        .map((a) => a.valueStream)
        .filter((v): v is string => !!v),
    ),
  ].sort();

  const inFilter = (a: AppOption) =>
    (!domain || a.domain === domain) && (!stream || a.valueStream === stream);
  const filtered = pool.filter(inFilter);
  const selectedIds = new Set(selected.map((a) => a.id));
  const addable = filtered.filter((a) => !selectedIds.has(a.id));

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}
    >
      <Select
        aria-label="Domain filter"
        title="Domain"
        value={domain}
        onChange={(e) => {
          setDomain(e.target.value);
          setStream('');
        }}
        style={FILTER_SELECT_STYLE}
      >
        <option value="">All domains</option>
        {domains.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Value stream filter"
        title="Value stream"
        value={stream}
        onChange={(e) => setStream(e.target.value)}
        style={FILTER_SELECT_STYLE}
      >
        <option value="">All value streams</option>
        {streams.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>

      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#525252', margin: '0 2px 0 6px' }}>
        Compare
      </span>
      {selected.map((a, i) => {
        // A slot always offers its own value, plus everything in filter.
        const options = filtered.some((o) => o.id === a.id) ? filtered : [a, ...filtered];
        return (
          <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {i > 0 && <span style={{ fontSize: 11, color: '#a3a3a3', marginRight: 2 }}>vs</span>}
            <Select
              aria-label={`Application ${i + 1}`}
              value={a.id}
              onChange={(e) => e.target.value && onReplace(a.id, e.target.value)}
              style={APP_SELECT_STYLE}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={o.id !== a.id && selectedIds.has(o.id)}>
                  {o.name}
                </option>
              ))}
            </Select>
            {selected.length > 1 && (
              <button
                type="button"
                aria-label="Remove application"
                title="Remove"
                onClick={() => onRemove(a.id)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#a3a3a3',
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '0 2px',
                  font: 'inherit',
                }}
              >
                ×
              </button>
            )}
          </span>
        );
      })}
      {addable.length > 0 && (
        <Select
          aria-label="Add an application to compare"
          value=""
          onChange={(e) => e.target.value && onAdd(e.target.value)}
          style={APP_SELECT_STYLE}
        >
          <option value="">＋ Add application…</option>
          {addable.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      )}
      <span style={{ fontSize: 11, color: '#a3a3a3', marginLeft: 4 }}>
        {selected.length === 1
          ? 'one application — its own decomposition'
          : `${selected.length} side by side`}
      </span>
    </div>
  );
}
