// The Forms lens comparison view — the two ACTUAL documents side by side,
// each rendered as the same specimen-styled paper as /forms/:id/document,
// with red highlights where the wording differs. Each pane shows ITS OWN
// clause stream in document order: changed words inside a paired clause
// highlight red on both sides (wordDiff), and a clause with no counterpart
// in the other document flags whole (red band). "Changed clauses only"
// collapses unchanged runs behind a ⋯ divider.
import { useMemo } from 'react';
import { sideLabel, type ComparePayload, type CompareRow } from './compareApi';
import { wordDiff, type DiffSegment } from './wordDiff';

const DIFF_MARK = { background: '#fee2e2', color: '#991b1b', borderRadius: 2 } as const;

/** ALL-CAPS heading grammar — same as the form document view's segmenter. */
const HEADING = /^(SECTION [IVXLC0-9].*|[A-Z][A-Z0-9 ,&'()\-—–./]{3,80}\.?)$/;

type Side = 'a' | 'b';

interface PaneClause {
  row: CompareRow;
  /** wordDiff segments for a changed pair; null = no inline highlighting. */
  segments: DiffSegment[] | null;
}

/** One side's document stream in ITS ordinal order, diff info attached. */
function paneClauses(payload: ComparePayload, side: Side): PaneClause[] {
  return payload.rows
    .filter((r) => r[side])
    .sort((x, y) => (x[side]?.ordinal ?? 0) - (y[side]?.ordinal ?? 0))
    .map((row) => ({
      row,
      segments:
        row.a && row.b && row.status !== 'identical' ? wordDiff(row.a.text, row.b.text) : null,
    }));
}

/** Clause text with the differing words marked red on this side. */
function ClauseText({
  clauseText,
  segments,
  side,
}: {
  clauseText: string;
  segments: DiffSegment[] | null;
  side: Side;
}) {
  const mark: DiffSegment['kind'] = side === 'a' ? 'del' : 'add';
  const skip: DiffSegment['kind'] = side === 'a' ? 'add' : 'del';
  if (!segments) return <span style={{ whiteSpace: 'pre-wrap' }}>{clauseText}</span>;
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {segments.map((s, i) =>
        s.kind === skip ? null : (
          <span key={i} style={s.kind === mark ? DIFF_MARK : undefined}>
            {s.text}
          </span>
        ),
      )}
    </span>
  );
}

function DocumentClause({
  item,
  side,
  otherName,
}: {
  item: PaneClause;
  side: Side;
  otherName: string;
}) {
  const clause = item.row[side];
  if (!clause) return null;
  const unique = item.row.status === 'unique';
  const heading = clause.heading?.trim() ?? null;
  const isTitle = clause.ordinal === 0 && !heading && clause.text.length < 120;
  // A one-side-only clause stays readable document text — a hairline red rule
  // and a small tag mark it, never a solid red block.
  return (
    <div
      style={
        unique ? { borderLeft: '2px solid #fca5a5', paddingLeft: 10, margin: '8px 0' } : undefined
      }
    >
      {unique && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            color: '#b91c1c',
            marginBottom: 2,
          }}
        >
          Not in {otherName}
        </div>
      )}
      {heading && (
        <div
          style={{
            paddingTop: 12,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.06em',
            color: '#171717',
          }}
        >
          {HEADING.test(heading) ? heading : heading.toUpperCase()}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.65,
          color: '#262626',
          marginTop: heading ? 4 : 0,
          ...(isTitle ? { textAlign: 'center' as const, fontWeight: 700, fontSize: 15 } : null),
        }}
      >
        {unique ? (
          <UniqueClauseText text={clause.text} />
        ) : (
          <ClauseText clauseText={clause.text} segments={item.segments} side={side} />
        )}
      </div>
    </div>
  );
}

/** One-side-only clause: highlight only its lead-in (the clause label / first
 *  sentence) the same way changed words highlight — never the whole block. */
function UniqueClauseText({ text }: { text: string }) {
  const lead = /^([A-Z]\.|\d{1,2}\.|\([a-z]\))?\s*[^.\n]{0,90}[.:]/.exec(text)?.[0] ?? null;
  if (!lead) return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      <span style={DIFF_MARK}>{lead}</span>
      {text.slice(lead.length)}
    </span>
  );
}

/** Collapsed run of unchanged clauses ("changed only" mode). */
function HiddenRun({ count }: { count: number }) {
  return (
    <div
      style={{
        textAlign: 'center',
        color: '#a3a3a3',
        fontSize: 11,
        letterSpacing: '.3em',
        padding: '8px 0',
      }}
      title={`${count} unchanged clause${count === 1 ? '' : 's'} hidden`}
    >
      ⋯
    </div>
  );
}

function DocumentPane({
  payload,
  side,
  hideIdentical,
}: {
  payload: ComparePayload;
  side: Side;
  hideIdentical: boolean;
}) {
  const meta = payload[side];
  const other = payload[side === 'a' ? 'b' : 'a'];
  const otherName = sideLabel(other, meta.formId);
  const clauses = useMemo(() => paneClauses(payload, side), [payload, side]);

  // "Changed only": collapse consecutive identical clauses into one ⋯ marker.
  const blocks: (PaneClause | number)[] = [];
  let hidden = 0;
  for (const item of clauses) {
    if (hideIdentical && item.row.status === 'identical') {
      hidden++;
      continue;
    }
    if (hidden > 0) {
      blocks.push(hidden);
      hidden = 0;
    }
    blocks.push(item);
  }
  if (hidden > 0) blocks.push(hidden);

  const stamp = `${meta.formNumber}${meta.editionDate ? ` (${meta.editionDate})` : ''}`;
  return (
    <div
      style={{
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(15,23,42,.06)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderBottom: '1px solid #eaeaea',
          padding: '7px 16px',
          position: 'sticky',
          top: 0,
          background: '#fafafa',
          borderRadius: '8px 8px 0 0',
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#525252' }}>
          {stamp} · v{meta.versionNo}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#a3a3a3',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta.title}
        </span>
      </div>
      <div style={{ padding: '20px 28px', fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {blocks.map((b, i) =>
          typeof b === 'number' ? (
            <HiddenRun key={`h${i}`} count={b} />
          ) : (
            <DocumentClause key={b.row[side]?.id ?? i} item={b} side={side} otherName={otherName} />
          ),
        )}
        {blocks.length === 0 && (
          <div style={{ fontSize: 12, color: '#737373', textAlign: 'center' }}>
            No changed clauses in this document.
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 'auto',
          borderTop: '1px solid #eaeaea',
          padding: '6px 16px',
          fontSize: 10.5,
          color: '#a3a3a3',
        }}
      >
        {stamp}
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
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
        gap: 14,
        alignItems: 'stretch',
      }}
    >
      <DocumentPane payload={payload} side="a" hideIdentical={hideIdentical} />
      <DocumentPane payload={payload} side="b" hideIdentical={hideIdentical} />
    </div>
  );
}
