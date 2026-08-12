import type { ReactNode } from 'react';
import { Select } from '../../components/ui';
import type { Lens } from './useBoard';

// The Workspace toolbar shared by every lens: the structure switch
// (Applications / Value streams / Roles / Products), the board select for the
// active lens, and a lens-specific legend pinned right.

/** The rationalizable structures. The first three share the application
 *  board API; Products renders its own comparison board, and Form Comparison
 *  is the two-pane verbiage diff over the PolicyForm library. */
export type WorkspaceLens = Lens | 'products' | 'form-compare';

const LENSES: { key: WorkspaceLens; label: string }[] = [
  { key: 'applications', label: 'Applications' },
  { key: 'value-streams', label: 'Value streams' },
  { key: 'roles', label: 'Roles' },
  { key: 'products', label: 'Products' },
  { key: 'form-compare', label: 'Form Comparison' },
];

export default function LensBar({
  lens,
  onLens,
  boards,
  boardId,
  onBoard,
  legend,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
  boards: { id: string; name: string }[];
  boardId: string | null;
  onBoard: (id: string) => void;
  legend?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        flexWrap: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: 30,
          border: '1px solid #eaeaea',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {LENSES.map((l, i) => (
          <button
            key={l.key}
            type="button"
            onClick={() => onLens(l.key)}
            style={{
              padding: '0 12px',
              fontSize: 12.5,
              fontWeight: 500,
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid #eaeaea',
              cursor: 'pointer',
              background: lens === l.key ? '#171717' : '#fff',
              color: lens === l.key ? '#fff' : '#525252',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
      {boards.length > 0 && (
        <Select
          aria-label="Board"
          title="Board"
          value={boardId ?? ''}
          onChange={(e) => onBoard(e.target.value)}
          style={{
            width: 'auto',
            minWidth: 220,
            maxWidth: 340,
            height: 30,
            padding: '0 28px 0 10px',
            fontSize: 12.5,
            flexShrink: 0,
          }}
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      )}
      <div style={{ flex: 1 }} />
      {legend && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 30,
            padding: '0 12px',
            border: '1px solid #eaeaea',
            borderRadius: 6,
            background: '#fff',
          }}
        >
          {legend}
        </div>
      )}
    </div>
  );
}

/** One legend swatch: a colored dash + its meaning. */
export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        color: '#525252',
      }}
    >
      <span style={{ width: 16, height: 3, borderRadius: 99, background: color }} />
      {label}
    </span>
  );
}
