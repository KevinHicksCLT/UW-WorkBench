// The "what's actually different" band under the two-pane diff: headline
// similarity, one tile per status bucket, then a plain-language line per
// non-identical clause so a reviewer can read the delta without scanning
// the panes.
import { STATUS_META, sideLabel, type ComparePayload, type CompareRow } from './compareApi';

function Tile({ label, value, fg }: { label: string; value: string; fg: string }) {
  return (
    <div
      style={{
        padding: '8px 14px',
        border: '1px solid #eaeaea',
        borderRadius: 8,
        background: '#fff',
        minWidth: 96,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700, color: fg }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#525252' }}>{label}</div>
    </div>
  );
}

/** Short human line for one non-identical row. */
function differenceLine(row: CompareRow, payload: ComparePayload): string {
  const name = row.a?.heading ?? row.b?.heading ?? (row.a ?? row.b)?.text.slice(0, 60) ?? '';
  const nameA = sideLabel(payload.a, payload.b.formId);
  const nameB = sideLabel(payload.b, payload.a.formId);
  if (row.status === 'unique') {
    const [carrier, missing] = row.a ? [nameA, nameB] : [nameB, nameA];
    return `“${name}” appears only in ${carrier} — ${missing} has no matching clause.`;
  }
  return `“${name}” is worded differently (${Math.round(row.similarity * 100)}% similar).`;
}

export default function DiffSummary({ payload }: { payload: ComparePayload }) {
  const { summary } = payload;
  const changed = payload.rows.filter((r) => r.status !== 'identical');
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: '#525252',
          marginBottom: 8,
        }}
      >
        Difference summary
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tile
          label="Overall similarity"
          value={`${Math.round(summary.overallSimilarity * 100)}%`}
          fg="#171717"
        />
        <Tile label="Identical" value={String(summary.identical)} fg={STATUS_META.identical.fg} />
        <Tile label="Near-identical" value={String(summary.near)} fg={STATUS_META.near.fg} />
        <Tile label="Divergent" value={String(summary.divergent)} fg={STATUS_META.divergent.fg} />
        <Tile
          label={`Only in ${sideLabel(payload.a, payload.b.formId)}`}
          value={String(summary.uniqueA)}
          fg={STATUS_META.unique.fg}
        />
        <Tile
          label={`Only in ${sideLabel(payload.b, payload.a.formId)}`}
          value={String(summary.uniqueB)}
          fg={STATUS_META.unique.fg}
        />
      </div>
      {changed.length > 0 && (
        <ul
          style={{
            margin: '12px 0 0',
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {changed.map((row, i) => {
            const meta = STATUS_META[row.status];
            return (
              <li
                key={row.a?.id ?? row.b?.id ?? i}
                style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    color: meta.fg,
                    background: meta.bg,
                    border: `1px solid ${meta.fg}33`,
                    borderRadius: 99,
                    padding: '1px 8px',
                  }}
                >
                  {meta.label}
                </span>
                <span style={{ color: '#404040', lineHeight: 1.45 }}>
                  {differenceLine(row, payload)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {changed.length === 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#15803d', fontWeight: 600 }}>
          The two forms carry identical wording clause for clause.
        </div>
      )}
    </div>
  );
}
