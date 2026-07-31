// The forms-first section of the Products grid: one row per core form
// (aggregating its whole family while collapsed), expandable to indented child
// rows — state variations, coverage endorsements, product exceptions — all
// rendered through the shared HeatGridRow so cells/counts/progress look
// identical to the model-component rows below.

import { MATCH_META } from './spine';
import {
  FORM_LAYER_META,
  type CoreFormRow,
  type FormRowData,
  type FormsHierarchy,
} from './formsModel';
import { HeatGridRow, type Density } from './gridRow';

function countsLine(row: FormRowData) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        marginTop: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ color: MATCH_META.COMMON.fg }}>{row.common} common</span>
      <span style={{ color: '#9ca3af' }}> · </span>
      <span style={{ color: MATCH_META.PARTIAL.fg }}>{row.similar} similar</span>
      <span style={{ color: '#9ca3af' }}> · </span>
      <span style={{ color: MATCH_META.UNIQUE.fg }}>{row.unique} unique</span>
    </span>
  );
}

function noteOf(row: FormRowData): string | null {
  for (const r of row.reviewRows) if (r.decision?.comment) return r.decision.comment;
  return null;
}

export default function FormsSection({
  hierarchy,
  grid,
  density,
  notesOpen,
  open,
  onToggle,
  onOpenDrill,
}: {
  hierarchy: FormsHierarchy;
  grid: string;
  density: Density;
  notesOpen: boolean;
  /** Expanded core-form keys. */
  open: Record<string, boolean>;
  onToggle: (coreKey: string) => void;
  /** Open the review list drilled to a forms row (key from formsModel). */
  onOpenDrill: (rowKey: string) => void;
}) {
  return (
    <>
      {hierarchy.cores.map((core) => (
        <CoreRows
          key={core.key}
          core={core}
          grid={grid}
          density={density}
          notesOpen={notesOpen}
          expanded={Boolean(open[core.key])}
          onToggle={() => onToggle(core.key)}
          onOpenDrill={onOpenDrill}
        />
      ))}
    </>
  );
}

function CoreRows({
  core,
  grid,
  density,
  notesOpen,
  expanded,
  onToggle,
  onOpenDrill,
}: {
  core: CoreFormRow;
  grid: string;
  density: Density;
  notesOpen: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenDrill: (rowKey: string) => void;
}) {
  const expandable = core.children.length > 0;
  const variationCount = core.children.reduce((n, g) => n + g.rows.length, 0);
  return (
    <>
      <HeatGridRow
        rowKey={core.key}
        grid={grid}
        density={density}
        cells={core.cells}
        total={core.total}
        pending={core.need - core.decided}
        pct={core.pct}
        rag={core.rag}
        note={noteOf(core)}
        notesOpen={notesOpen}
        onOpen={() => onOpenDrill(core.key)}
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <button
              type="button"
              aria-label={expanded ? 'collapse the form family' : 'expand the form family'}
              disabled={!expandable}
              onClick={onToggle}
              style={{
                font: 'inherit',
                border: 'none',
                background: 'none',
                padding: '10px 2px 10px 8px',
                cursor: expandable ? 'pointer' : 'default',
                color: expandable ? '#525252' : '#d4d4d4',
                fontSize: 11,
                flexShrink: 0,
                width: 20,
              }}
            >
              {expandable ? (expanded ? '▾' : '▸') : '·'}
            </button>
            <button
              type="button"
              onClick={() => onOpenDrill(core.key)}
              title="open this form family's review list"
              style={{
                font: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px 10px 2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                minWidth: 0,
                flex: 1,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#171717',
                    lineHeight: 1.25,
                  }}
                >
                  {core.label}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#525252',
                    marginTop: 1,
                  }}
                >
                  {core.lobName} · core form
                  {variationCount > 0
                    ? ` · ${variationCount} variation${variationCount === 1 ? '' : 's'}`
                    : ''}
                </span>
                {countsLine(core)}
              </span>
            </button>
          </div>
        }
      />
      {expanded &&
        core.children.map((group) => (
          <div key={`${core.key}:${group.kind}`} style={{ display: 'contents' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '4px 12px 3px 40px',
                background: '#fafafa',
                borderBottom: '1px solid #f1f3f5',
                minWidth: '100%',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#374151',
                }}
              >
                {FORM_LAYER_META[group.kind].label} ({group.rows.length})
              </span>
              <span style={{ fontSize: 10.5, color: '#525252' }}>
                {FORM_LAYER_META[group.kind].hint}
              </span>
            </div>
            {group.rows.map((row) => (
              <HeatGridRow
                key={row.key}
                rowKey={row.key}
                grid={grid}
                density={density}
                cells={row.cells}
                total={row.total}
                pending={row.need - row.decided}
                pct={row.pct}
                rag={row.rag}
                note={noteOf(row)}
                notesOpen={notesOpen}
                onOpen={() => onOpenDrill(row.key)}
                background="#fcfcfd"
                left={
                  <button
                    type="button"
                    onClick={() => onOpenDrill(row.key)}
                    title="open this form's review list"
                    style={{
                      font: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px 8px 40px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minWidth: 0,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#171717',
                          lineHeight: 1.25,
                        }}
                      >
                        {row.label}
                      </span>
                      {row.sub && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: '#525252',
                            marginTop: 1,
                          }}
                        >
                          {row.sub}
                        </span>
                      )}
                    </span>
                  </button>
                }
              />
            ))}
          </div>
        ))}
    </>
  );
}
