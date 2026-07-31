// FR-3.1 — State × Product Requirement Matrix. Rows = requirements, columns =
// products; cells Same / Variant A / Variant B / Different in the standard
// status language. The summary band is COMPUTED from the cell kinds (never
// hardcoded). A cell click opens the underlying forms side-by-side (the
// FR-4.2 diff surface, hosted by FormsBoard).

import { useMemo } from 'react';
import { EmptyState, Select } from '../../../components/ui';
import { PRODUCT_NAME, type MatrixCell } from './mockData';
import { MATRIX_STATES, matrixFor, matrixSummary } from './model';
import { STATE_NAME } from './types';
import { SectionTitle } from './chrome';

const CELL_META: Record<MatrixCell['label'], { fg: string; bg: string; border: string }> = {
  Same: { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  'Variant A': { fg: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  'Variant B': { fg: '#9a3412', bg: '#ffedd5', border: '#fed7aa' },
  Different: { fg: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
};

export default function FormsMatrix({
  state,
  onState,
  onCompare,
}: {
  state: string | null;
  onState: (s: string) => void;
  onCompare: (formIds: string[]) => void;
}) {
  const active = state && MATRIX_STATES.includes(state) ? state : MATRIX_STATES[0];
  const rows = useMemo(() => matrixFor(active), [active]);
  if (!rows) return <EmptyState message="No requirement matrix authored for this state yet." />;
  const summary = matrixSummary(rows);
  const products = rows[0]?.cells.map((c) => c.productId) ?? [];
  const th = {
    textAlign: 'left' as const,
    padding: '8px 10px',
    borderBottom: '1px solid #eaeaea',
    color: '#404040',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    position: 'sticky' as const,
    top: 0,
    background: '#fff',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Select
          aria-label="State"
          value={active}
          onChange={(e) => onState(e.target.value)}
          style={{
            width: 'auto',
            minWidth: 170,
            height: 28,
            fontSize: 12,
            padding: '0 28px 0 8px',
          }}
        >
          {MATRIX_STATES.map((s) => (
            <option key={s} value={s}>
              {STATE_NAME[s] ?? s}
            </option>
          ))}
        </Select>
        {/* Summary band — computed from the cell kinds. */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {(
            [
              [`${summary.common}% Common`, CELL_META.Same],
              [`${summary.state}% State Required`, CELL_META['Variant A']],
              [`${summary.product}% Product Specific`, CELL_META.Different],
            ] as const
          ).map(([label, m]) => (
            <span
              key={label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 11px',
                borderRadius: 999,
                background: m.bg,
                border: `1px solid ${m.border}`,
                color: m.fg,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <SectionTitle>{STATE_NAME[active] ?? active} — requirements × products</SectionTitle>
      <div
        style={{
          border: '1px solid #eaeaea',
          borderRadius: 12,
          background: '#fff',
          overflow: 'auto',
          maxHeight: '60vh',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={th}>Requirement</th>
              {products.map((p) => (
                <th key={p} style={th}>
                  {PRODUCT_NAME[p] ?? p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.requirement}>
                <td
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #f5f5f5',
                    fontWeight: 700,
                    color: '#171717',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.requirement}
                </td>
                {row.cells.map((cell) => {
                  const m = CELL_META[cell.label];
                  return (
                    <td
                      key={cell.productId}
                      style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f5' }}
                    >
                      <button
                        type="button"
                        onClick={() => onCompare(cell.formIds)}
                        title={`Open ${cell.formIds.join(' vs ')}`}
                        style={{
                          font: 'inherit',
                          width: '100%',
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: m.bg,
                          border: `1px solid ${m.border}`,
                          color: m.fg,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {cell.label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
