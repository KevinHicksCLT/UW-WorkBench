// The two-pane clause diff — the Beyond-Compare face of the Form Comparison
// lens. One grid row per aligned clause pair: a status gutter, the A pane and
// the B pane. Divergent/near pairs highlight word-level edits (wordDiff);
// clauses present on one side only render an empty slot opposite.
import { useMemo } from 'react';
import { STATUS_META, type ComparePayload, type CompareRow } from './compareApi';
import { wordDiff, type DiffSegment } from './wordDiff';

const DEL_STYLE = { background: '#fee2e2', color: '#991b1b', borderRadius: 2 } as const;
const ADD_STYLE = { background: '#dcfce7', color: '#166534', borderRadius: 2 } as const;

function PaneText({ segments, side }: { segments: DiffSegment[]; side: 'a' | 'b' }) {
  const keep: DiffSegment['kind'] = side === 'a' ? 'del' : 'add';
  const skip: DiffSegment['kind'] = side === 'a' ? 'add' : 'del';
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {segments.map((s, i) =>
        s.kind === skip ? null : (
          <span
            key={i}
            style={s.kind === keep ? (keep === 'del' ? DEL_STYLE : ADD_STYLE) : undefined}
          >
            {s.text}
          </span>
        ),
      )}
    </span>
  );
}

function ClauseCell({
  row,
  side,
  segments,
}: {
  row: CompareRow;
  side: 'a' | 'b';
  segments: DiffSegment[] | null;
}) {
  const clause = row[side];
  const meta = STATUS_META[row.status];
  if (!clause)
    return (
      <div
        style={{
          padding: '8px 12px',
          fontSize: 11.5,
          fontStyle: 'italic',
          color: '#a3a3a3',
          background:
            'repeating-linear-gradient(-45deg, #fafafa, #fafafa 6px, #f5f5f5 6px, #f5f5f5 12px)',
        }}
      >
        not present in this form
      </div>
    );
  return (
    <div style={{ padding: '8px 12px', minWidth: 0 }}>
      {clause.heading && (
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: row.status === 'identical' ? '#737373' : meta.fg,
            marginBottom: 3,
          }}
        >
          {clause.heading}
        </div>
      )}
      <div style={{ fontSize: 12, lineHeight: 1.55, color: '#262626' }}>
        {segments ? <PaneText segments={segments} side={side} /> : clause.text}
      </div>
    </div>
  );
}

function DiffRow({ row }: { row: CompareRow }) {
  const meta = STATUS_META[row.status];
  // Word-level highlighting only where both sides exist and differ.
  const segments = useMemo(
    () => (row.a && row.b && row.status !== 'identical' ? wordDiff(row.a.text, row.b.text) : null),
    [row],
  );
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'subgrid',
        gridColumn: '1 / -1',
        borderBottom: '1px solid #f0f0f0',
        background: row.status === 'identical' ? '#fff' : meta.bg,
      }}
    >
      <div
        title={`${meta.label}${row.status !== 'unique' ? ` · ${Math.round(row.similarity * 100)}% similar` : ''}`}
        style={{ width: 4, background: meta.fg, opacity: row.status === 'identical' ? 0.25 : 0.9 }}
      />
      <ClauseCell row={row} side="a" segments={segments} />
      <div style={{ borderLeft: '1px solid #eaeaea' }} />
      <ClauseCell row={row} side="b" segments={segments} />
    </div>
  );
}

function PaneHeader({ side }: { side: ComparePayload['a'] }) {
  return (
    <div style={{ padding: '8px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#171717' }}>
        {side.formNumber}
        {side.editionDate ? ` (${side.editionDate})` : ''}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: '#525252',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {side.title} · v{side.versionNo} · {side.clauseCount} clauses
      </div>
    </div>
  );
}

export default function FormDiffView({
  payload,
  hideIdentical,
}: {
  payload: ComparePayload;
  hideIdentical: boolean;
}) {
  const rows = hideIdentical ? payload.rows.filter((r) => r.status !== 'identical') : payload.rows;
  return (
    <div
      style={{
        border: '1px solid #eaeaea',
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '4px minmax(0,1fr) 1px minmax(0,1fr)',
        }}
      >
        {/* Sticky pane headers — which form is which never scrolls away. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'subgrid',
            gridColumn: '1 / -1',
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: '#fafafa',
            borderBottom: '1px solid #eaeaea',
          }}
        >
          <div />
          <PaneHeader side={payload.a} />
          <div style={{ borderLeft: '1px solid #eaeaea' }} />
          <PaneHeader side={payload.b} />
        </div>
        {rows.map((row, i) => (
          <DiffRow key={row.a?.id ?? row.b?.id ?? i} row={row} />
        ))}
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '18px 12px', fontSize: 12, color: '#737373', textAlign: 'center' }}>
          Every clause is identical between these two forms.
        </div>
      )}
    </div>
  );
}
