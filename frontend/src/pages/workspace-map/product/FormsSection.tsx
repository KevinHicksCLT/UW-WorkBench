// The forms register of the Products grid — forms down the side, products
// across the top, broken into the three rationalization layers (core national
// / state-required / product-specific). Rows arrive SERVER-DERIVED on the
// board payload (state-required variations aggregate to one row per LOB at
// portfolio scale); what a form CONTAINS — coverages, coverage parts,
// endorsements, clauses — lives in its drill-down review list, one click away.

import { useViewState } from '../../../lib/viewState';
import { FORM_LAYER_META } from './formsModel';
import { denseCells, type BoardColumn, type BoardFormRow, type BoardForms } from './boardApi';
import { HeatGridRow, SectionBand, type Density } from './gridRow';

export default function FormsSection({
  model,
  columns,
  grid,
  density,
  notesOpen,
  onOpenDrill,
}: {
  model: BoardForms;
  /** The grid's column axis — sparse cells re-expand against it. */
  columns: BoardColumn[];
  grid: string;
  density: Density;
  notesOpen: boolean;
  /** Open the review list drilled to a forms row (key from the register). */
  onOpenDrill: (rowKey: string) => void;
}) {
  // Each register layer (countrywide / state-required / product-specific)
  // collapses behind its band, like every other band on the board.
  const [closedLayers, setClosedLayers] = useViewState<Record<string, boolean>>(
    'workspace.product.formsLayersClosed',
    {},
  );
  return (
    <>
      {model.sections.map((section) =>
        section.rows.length === 0 ? null : (
          <div key={section.layer} style={{ display: 'contents' }}>
            <SectionBand
              label={`${FORM_LAYER_META[section.layer].label} (${section.rows.length})`}
              detail={FORM_LAYER_META[section.layer].hint || undefined}
              collapsed={Boolean(closedLayers[section.layer])}
              onToggle={() =>
                setClosedLayers((c) => ({ ...c, [section.layer]: !c[section.layer] }))
              }
            />
            {!closedLayers[section.layer] &&
              section.rows.map((row) => (
                <FormRegisterRow
                  key={row.key}
                  row={row}
                  columns={columns}
                  grid={grid}
                  density={density}
                  notesOpen={notesOpen}
                  onOpenDrill={onOpenDrill}
                />
              ))}
          </div>
        ),
      )}
    </>
  );
}

function FormRegisterRow({
  row,
  columns,
  grid,
  density,
  notesOpen,
  onOpenDrill,
}: {
  row: BoardFormRow;
  columns: BoardColumn[];
  grid: string;
  density: Density;
  notesOpen: boolean;
  onOpenDrill: (rowKey: string) => void;
}) {
  return (
    <HeatGridRow
      rowKey={row.key}
      grid={grid}
      density={density}
      cells={denseCells(row.cells, columns)}
      total={row.total}
      pending={row.need - row.decided}
      pct={row.pct}
      rag={row.rag}
      note={row.note}
      notesOpen={notesOpen}
      onOpen={() => onOpenDrill(row.key)}
      left={
        <button
          type="button"
          onClick={() => onOpenDrill(row.key)}
          title="open this form's review list (the form + everything it contains)"
          style={{
            font: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
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
      }
    />
  );
}
