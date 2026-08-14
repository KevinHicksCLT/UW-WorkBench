// The "what's actually different" card under the two documents: headline
// similarity with a proportional composition bar, count chips per status, and
// a plain-language line per non-identical clause laid out in a responsive
// two-column list.
import { STATUS_META, sideLabel, type ComparePayload, type CompareRow } from './compareApi';

const BUCKETS = [
  { key: 'identical' as const, label: 'Identical' },
  { key: 'near' as const, label: 'Near-identical' },
  { key: 'divergent' as const, label: 'Divergent' },
];

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

function CountChip({
  label,
  value,
  fg,
  bg,
}: {
  label: string;
  value: number;
  fg: string;
  bg: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11.5,
        fontWeight: 600,
        color: '#404040',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          minWidth: 22,
          textAlign: 'center',
          padding: '1px 6px',
          borderRadius: 999,
          fontWeight: 700,
          color: fg,
          background: bg,
          border: `1px solid ${fg}22`,
        }}
      >
        {value}
      </span>
      {label}
    </span>
  );
}

export default function DiffSummary({ payload }: { payload: ComparePayload }) {
  const { summary } = payload;
  const changed = payload.rows.filter((r) => r.status !== 'identical');
  const uniqueTotal = summary.uniqueA + summary.uniqueB;
  const segments = [
    { value: summary.identical, color: STATUS_META.identical.fg },
    { value: summary.near, color: STATUS_META.near.fg },
    { value: summary.divergent, color: STATUS_META.divergent.fg },
    { value: uniqueTotal, color: STATUS_META.unique.fg },
  ].filter((s) => s.value > 0);

  return (
    <div
      style={{
        marginTop: 14,
        border: '1px solid #eaeaea',
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderBottom: changed.length > 0 ? '1px solid #f0f0f0' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#171717' }}>
            {Math.round(summary.overallSimilarity * 100)}%
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: '#737373',
            }}
          >
            Similar
          </span>
        </div>
        {/* Proportional composition of the merged clause rows. */}
        <div
          style={{
            flex: 1,
            minWidth: 160,
            height: 8,
            display: 'flex',
            borderRadius: 99,
            overflow: 'hidden',
            background: '#f5f5f5',
          }}
          title={`${summary.total} aligned clause rows`}
        >
          {segments.map((s, i) => (
            <span
              key={i}
              style={{ width: `${(s.value / summary.total) * 100}%`, background: s.color }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {BUCKETS.map((b) => (
            <CountChip
              key={b.key}
              label={b.label}
              value={summary[b.key]}
              fg={STATUS_META[b.key].fg}
              bg={STATUS_META[b.key].bg}
            />
          ))}
          <CountChip
            label={`Only in ${sideLabel(payload.a, payload.b.formId)}`}
            value={summary.uniqueA}
            fg={STATUS_META.unique.fg}
            bg={STATUS_META.unique.bg}
          />
          <CountChip
            label={`Only in ${sideLabel(payload.b, payload.a.formId)}`}
            value={summary.uniqueB}
            fg={STATUS_META.unique.fg}
            bg={STATUS_META.unique.bg}
          />
        </div>
      </div>
      {changed.length > 0 ? (
        <ul
          style={{
            margin: 0,
            padding: '10px 16px 12px',
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            columnGap: 24,
            rowGap: 7,
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
                    width: 96,
                    textAlign: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    color: meta.fg,
                    background: meta.bg,
                    border: `1px solid ${meta.fg}33`,
                    borderRadius: 999,
                    padding: '2px 0',
                  }}
                >
                  {meta.label}
                </span>
                <span style={{ color: '#404040', lineHeight: 1.45, minWidth: 0 }}>
                  {differenceLine(row, payload)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div style={{ padding: '10px 16px 12px', fontSize: 12, color: '#15803d', fontWeight: 600 }}>
          The two documents carry identical wording clause for clause.
        </div>
      )}
    </div>
  );
}
