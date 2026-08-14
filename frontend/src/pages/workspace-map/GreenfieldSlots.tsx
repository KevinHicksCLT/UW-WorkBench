import { GREEN, STATUS_WEIGHT, formatTargetDate } from './types';
import { floorLanding } from './stats';
import type { BoardComponent, Finding, Layer, NormalizationEntry } from './types';

// One expandable layer slot — the "floor" of a greenfield target build.
// Extracted from GreenfieldColumn (500-line rule): the column owns the service
// cards; this module owns a single floor's header, progress and landed rows.

function slotStatusChip(status: string) {
  const done = STATUS_WEIGHT[status] === 1;
  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        background: done ? '#dcfce7' : '#fff',
        border: `1px solid ${done ? '#86efac' : '#d1d5db'}`,
        color: done ? '#15803d' : '#525252',
      }}
    >
      {status}
    </span>
  );
}

/** One expandable layer slot — the floor of the new build. */
export function LayerSlot({
  layer,
  comp,
  lives,
  landed,
  anchor,
  padTop,
  rowPads,
  rowOrder,
  open,
  onToggle,
}: {
  layer: Layer;
  comp: BoardComponent;
  /** Authored normalization entries landing on this floor (multi-source boards). */
  lives: NormalizationEntry[];
  /** The findings that carry into this floor (pass-through boards list these). */
  landed: Finding[];
  anchor: string;
  /** Alignment spacing that levels THIS floor with its layer band — applied per
   *  floor (not per card) so several floors inside one card can spread apart. */
  padTop?: number;
  /** Per-row spacing keyed by the row's connector anchor (SCRUM-259). */
  rowPads?: Record<string, number>;
  /** Render order matching the Normalize column's cards. */
  rowOrder?: Record<string, number>;
  open: boolean;
  onToggle: () => void;
}) {
  const pct = Math.round((STATUS_WEIGHT[comp.migrationStatus] ?? 0) * 100);
  const targetLabel = formatTargetDate(comp.targetDate);
  // What actually landed here: normalization entries (authored or computed)
  // PLUS the findings no entry covers — those carry 1→1 into the model, so a
  // partially-matched comparison never undercounts its floor.
  const { passThrough, inCount } = floorLanding(lives, landed);
  // One merged list, in the Normalize column's order, so the per-row
  // connectors from Normalize land here without crossing (SCRUM-259).
  const floorRows: { key: string; e?: NormalizationEntry; f?: Finding }[] = [
    ...lives.map((e) => ({ key: `e:${e.id}`, e })),
    ...passThrough.map((f) => ({ key: `f:${f.id}`, f })),
  ].sort(
    (a, b) =>
      (rowOrder?.[a.key] ?? Number.MAX_SAFE_INTEGER) -
      (rowOrder?.[b.key] ?? Number.MAX_SAFE_INTEGER),
  );
  return (
    <div
      data-anchor={anchor}
      style={{
        border: '1px solid #d1fae5',
        borderRadius: 8,
        background: '#f8fffb',
        overflow: 'hidden',
        marginTop: padTop || undefined,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            color: '#059669',
            fontSize: 9,
            display: 'inline-block',
            transform: open ? 'none' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
        <span
          style={{ width: 8, height: 8, borderRadius: 999, background: GREEN, flexShrink: 0 }}
        />
        <span
          style={{
            minWidth: 0,
            flex: 1,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            overflow: 'hidden',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{layer}</span>
          <span
            style={{
              fontSize: 10.5,
              color: '#525252',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {comp.name}
          </span>
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: '#047857',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {inCount} in
        </span>
        {slotStatusChip(comp.migrationStatus)}
      </button>

      {open && (
        <div style={{ padding: '0 10px 7px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                background: '#d1fae5',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: GREEN }} />
            </div>
            <span
              style={{
                fontSize: 9.5,
                color: '#047857',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {pct}%
            </span>
          </div>
          {targetLabel && (
            <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 3 }}>
              Target · {targetLabel}
            </div>
          )}
        </div>
      )}

      {open && (
        <div
          style={{
            borderTop: '1px solid #d1fae5',
            background: '#fff',
            // Left padding kept small so each floor row's connector anchor sits
            // at the card edge — the per-row arrowhead then stops in the gutter
            // at the box, matching the Products board, instead of running into
            // the row text. The visual indent lives on the rows (paddingLeft).
            padding: '6px 10px 8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {inCount === 0 && (
            <span style={{ fontSize: 10.5, color: '#a3a3a3', paddingLeft: 16 }}>
              Nothing lands on this floor.
            </span>
          )}
          {floorRows.map(({ key, e, f }) =>
            e ? (
              <div
                key={key}
                data-anchor={`${anchor}:${key}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  paddingLeft: 16,
                  marginTop: rowPads?.[`${anchor}:${key}`] || undefined,
                }}
              >
                {e.notation && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#4f46e5',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.notation}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#1e1b4b', fontWeight: 600 }}>{e.name}</span>
                <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {e.findingIds.length}→1
                </span>
              </div>
            ) : (
              <div
                key={key}
                data-anchor={`${anchor}:${key}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  paddingLeft: 16,
                  marginTop: rowPads?.[`${anchor}:${key}`] || undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>{f!.name}</span>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>1→1</span>
                </div>
                {f!.plainSummary && (
                  <span style={{ fontSize: 10, color: '#525252', lineHeight: 1.35 }}>
                    {f!.plainSummary}
                  </span>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
