// The forms register of the Products grid — forms down the side, products
// across the top, broken into the three rationalization layers (core national
// / state-required / product-specific). Expanding a form reveals what it
// CONTAINS — coverages, coverage parts, endorsements, clauses — every row
// rendered through the shared HeatGridRow so cells/counts/progress look
// identical to the model-component rows below.

import {
  CONTENT_KIND_ORDER,
  CONTENT_META,
  FORM_LAYER_META,
  type FormRow,
  type FormRowData,
  type FormsModel,
} from './formsModel';
import { HeatGridRow, SectionBand, type Density } from './gridRow';

function noteOf(row: FormRowData): string | null {
  for (const r of row.reviewRows) if (r.decision?.comment) return r.decision.comment;
  return null;
}

export default function FormsSection({
  model,
  grid,
  density,
  notesOpen,
  open,
  onToggle,
  onOpenDrill,
}: {
  model: FormsModel;
  grid: string;
  density: Density;
  notesOpen: boolean;
  /** Expanded form keys. */
  open: Record<string, boolean>;
  onToggle: (formKey: string) => void;
  /** Open the review list drilled to a forms row (key from formsModel). */
  onOpenDrill: (rowKey: string) => void;
}) {
  return (
    <>
      {model.sections.map((section) =>
        section.rows.length === 0 ? null : (
          <div key={section.layer} style={{ display: 'contents' }}>
            <SectionBand
              label={`${FORM_LAYER_META[section.layer].label} (${section.rows.length})`}
              detail={FORM_LAYER_META[section.layer].hint || undefined}
            />
            {section.rows.map((row) => (
              <FormRows
                key={row.key}
                row={row}
                grid={grid}
                density={density}
                notesOpen={notesOpen}
                expanded={Boolean(open[row.key])}
                onToggle={() => onToggle(row.key)}
                onOpenDrill={onOpenDrill}
              />
            ))}
          </div>
        ),
      )}
    </>
  );
}

function FormRows({
  row,
  grid,
  density,
  notesOpen,
  expanded,
  onToggle,
  onOpenDrill,
}: {
  row: FormRow;
  grid: string;
  density: Density;
  notesOpen: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenDrill: (rowKey: string) => void;
}) {
  const expandable = row.contents.length > 0;
  return (
    <>
      <HeatGridRow
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
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <button
              type="button"
              aria-label={expanded ? 'collapse the form contents' : 'show what this form contains'}
              disabled={!expandable}
              onClick={onToggle}
              title={
                expandable
                  ? 'show the coverages, coverage parts, endorsements and clauses this form contains'
                  : undefined
              }
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
              onClick={() => onOpenDrill(row.key)}
              title="open this form's review list (the form + everything it contains)"
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
                    fontWeight: row.isBase ? 700 : 600,
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
          </div>
        }
      />
      {expanded &&
        CONTENT_KIND_ORDER.map((kind) => {
          const group = row.contents.find((g) => g.kind === kind);
          return (
            <div key={`${row.key}:${kind}`} style={{ display: 'contents' }}>
              {/* All four content categories always show while expanded, so
                  an empty one reads "none recorded" instead of vanishing. */}
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
                  {CONTENT_META[kind].label} ({group?.rows.length ?? 0})
                </span>
                <span style={{ fontSize: 10.5, color: '#525252' }}>
                  {group ? CONTENT_META[kind].hint : 'none recorded'}
                </span>
              </div>
              {group?.rows.map((content) => (
                <HeatGridRow
                  key={`${row.key}>${content.key}`}
                  rowKey={`${row.key}>${content.key}`}
                  grid={grid}
                  density={density}
                  cells={content.cells}
                  total={content.total}
                  pending={content.need - content.decided}
                  pct={content.pct}
                  rag={content.rag}
                  note={noteOf(content)}
                  notesOpen={notesOpen}
                  onOpen={() => onOpenDrill(content.key)}
                  background="#fcfcfd"
                  left={
                    <button
                      type="button"
                      onClick={() => onOpenDrill(content.key)}
                      title="open this item's review list"
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
                          {content.label}
                        </span>
                        {content.sub && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: '#525252',
                              marginTop: 1,
                            }}
                          >
                            {content.sub}
                          </span>
                        )}
                      </span>
                    </button>
                  }
                />
              ))}
            </div>
          );
        })}
    </>
  );
}
