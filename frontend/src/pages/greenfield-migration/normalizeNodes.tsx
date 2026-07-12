/**
 * Normalize-column node for the v3 board: one box per axis row rendered as the
 * wireframe's 3-column comparison table — SOURCE A | SOURCE B | NORMALIZED.
 * Marquee entries carry side-by-side source cards (itemized field lines or a
 * "SOURCE DOES" narrative) with a Same:/Different: verdict strip; the rest
 * render as compact normalized rows (#N-101 · 2→1 AUTO). HELD/REVIEW entries
 * show the proposed resolution with approve/hold actions. Pill colors come
 * from the MATCH_STATUS vocabulary rows (3-A).
 *
 * Row structure changes must be mirrored in cellGeometry.estimateNormalizeHeight.
 */
import type { NodeProps } from '@xyflow/react';
import type { Layer, MatchMeta, NormalizationEntry, SourceCard } from '../../lib/rationalization';
import { NORM_W, visibleNormalizeEntries } from './cellGeometry';
import { sideHandles } from './CellNode';

export type EntryAction = 'approve' | 'hold';
export type NormalizeNodeData = {
  layer: Layer;
  name: string;
  componentId: string | null;
  destination: string | null;
  /** Raw findings feeding this box (non-dead, this layer). */
  rawCount: number;
  entries: NormalizationEntry[];
  matchMeta: MatchMeta;
  /** The two legacy sources framing the comparison columns. */
  sourceNames: [string, string] | null;
  onEntryAction?: (entryId: string, action: EntryAction) => void;
};

function MatchPill({ status, matchMeta }: { status: string; matchMeta: MatchMeta }) {
  const m = matchMeta[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
        m?.chip ?? 'bg-[#fafafa] text-[#525252] border-[#e5e5e5]'
      }`}
    >
      {m?.label ?? status}
    </span>
  );
}

function ApproveHold({ e, d }: { e: NormalizationEntry; d: NormalizeNodeData }) {
  if (!d.onEntryAction) return null;
  const held = e.matchStatus === 'HELD';
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          d.onEntryAction?.(e.id, 'approve');
        }}
        className="rounded border border-[#a7f3d0] bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-semibold text-[#047857] hover:shadow-sm"
      >
        Approve
      </button>
      {!held && (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            d.onEntryAction?.(e.id, 'hold');
          }}
          className="rounded border border-[#fecdd3] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#be123c] hover:shadow-sm"
        >
          Hold
        </button>
      )}
    </div>
  );
}

/** The NORMALIZED column cell of a comparison row. */
function NormalizedCell({ e, d }: { e: NormalizationEntry; d: NormalizeNodeData }) {
  const auto = e.matchStatus === 'AUTO';
  const held = e.matchStatus !== 'AUTO';
  const lineCount = e.sourceCards?.[0]?.lines?.length;
  return (
    <div
      className={`rounded-md border px-1.5 py-1 h-full ${
        auto
          ? 'border-[#c7d2fe] bg-[#eef2ff]'
          : e.matchStatus === 'HELD'
            ? 'border-[#fecdd3] bg-[#fff7f7]'
            : 'border-[#fde68a] bg-[#fffbeb]'
      }`}
    >
      {auto ? (
        <>
          <span className="inline-flex items-center rounded bg-white/80 border border-[#c7d2fe] px-1 text-[9px] font-bold text-[#4338ca]">
            #{e.notation}
          </span>
          <div className="text-[11px] font-bold text-[#171717] leading-tight mt-0.5">{e.name}</div>
          <div className="text-[10px] text-[#525252] mt-0.5">
            {lineCount ? `${lineCount}+ fields · ` : ''}1 capability
          </div>
          <div className="mt-1 inline-flex items-center rounded border border-[#a7f3d0] bg-[#ecfdf5] px-1 py-px text-[9px] font-bold text-[#047857]">
            {Math.max(e.findingIds.length, 1)}→1 · AUTO
          </div>
        </>
      ) : (
        <>
          <div className="text-[11px] font-bold text-[#171717] leading-tight">
            {e.findingIds.length || 2} {e.matchStatus}
          </div>
          {e.proposedResolution && (
            <div className="text-[10px] text-[#525252] leading-snug mt-0.5">
              proposed: <span className="font-medium text-[#171717]">{e.proposedResolution}</span>
            </div>
          )}
          <div className="mt-1">
            <MatchPill status={e.matchStatus} matchMeta={d.matchMeta} />
          </div>
          {held && <ApproveHold e={e} d={d} />}
        </>
      )}
    </div>
  );
}

/** One source's card: title + field lines (with ✓) or a "DOES" narrative. */
function SourceCardCell({ card, source }: { card: SourceCard | undefined; source: string }) {
  if (!card)
    return <div className="rounded-md border border-dashed border-[#e5e5e5] bg-white/40 h-full" />;
  return (
    <div className="rounded-md border border-[#f0e4cf] bg-white/80 px-1.5 py-1 h-full">
      {card.does && (
        <div className="text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#b45309]">
          {source} does
        </div>
      )}
      <div className="text-[11px] font-bold text-[#171717] leading-tight">{card.title}</div>
      {card.lines && (
        <div className="mt-0.5">
          {card.lines.map((line) => (
            <div key={line} className="flex items-center gap-1 text-[10px] leading-[15px]">
              <span className="text-[#525252] truncate flex-1">{line}</span>
              <span aria-hidden="true" className="text-[#10b981] text-[9px] flex-shrink-0">
                ✓
              </span>
            </div>
          ))}
        </div>
      )}
      {card.does && (
        <div className="text-[10px] text-[#525252] leading-snug mt-0.5">{card.does}</div>
      )}
      {card.moreNote && (
        <div className="text-[9.5px] text-[#8f8f8f] italic mt-0.5">{card.moreNote}</div>
      )}
    </div>
  );
}

/** A marquee comparison row: source A card | source B card | normalized cell. */
function ComparisonRow({ e, d }: { e: NormalizationEntry; d: NormalizeNodeData }) {
  const cards = e.sourceCards ?? [];
  const same = e.matchStatus === 'AUTO';
  return (
    <div className="rounded-md border border-[#eceadf] bg-[#fbfaf5] p-1">
      <div className="grid grid-cols-3 gap-1 items-stretch">
        <SourceCardCell card={cards[0]} source={cards[0]?.source ?? d.sourceNames?.[0] ?? ''} />
        <SourceCardCell card={cards[1]} source={cards[1]?.source ?? d.sourceNames?.[1] ?? ''} />
        <NormalizedCell e={e} d={d} />
      </div>
      {(e.matchBasis || e.differenceNote) && (
        <div
          className={`mt-1 rounded px-1.5 py-0.5 text-[10px] leading-snug ${
            same ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-[#fff1f2] text-[#be123c]'
          }`}
        >
          <span className="font-bold">{same ? 'Same:' : 'Different:'}</span>{' '}
          {same ? e.matchBasis : e.differenceNote}
        </div>
      )}
    </div>
  );
}

/** A compact normalized row (no cards): #N-101 name · 2→1 AUTO. */
function CompactRow({ e, d }: { e: NormalizationEntry; d: NormalizeNodeData }) {
  const auto = e.matchStatus === 'AUTO';
  return (
    <div
      className={`rounded-md border px-2 py-1 ${
        auto
          ? 'border-[#e3e6f5] bg-white/70'
          : e.matchStatus === 'HELD'
            ? 'border-[#fecdd3] bg-[#fff7f7]'
            : 'border-[#fde68a] bg-[#fffbeb]'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <span className="inline-flex items-center rounded bg-[#eef2ff] border border-[#c7d2fe] px-1 text-[9px] font-bold text-[#4338ca] flex-shrink-0 mt-px">
          #{e.notation}
        </span>
        <span
          className="text-[11.5px] font-semibold text-[#171717] leading-snug truncate flex-1 min-w-0"
          title={e.name}
        >
          {e.name}
        </span>
        {auto ? (
          <span className="text-[9.5px] font-bold text-[#047857] tnum flex-shrink-0 mt-px">
            {Math.max(e.findingIds.length, 1)}→1 · AUTO
          </span>
        ) : (
          <MatchPill status={e.matchStatus} matchMeta={d.matchMeta} />
        )}
      </div>
      {!auto && e.differenceNote && (
        <div className="text-[10px] text-[#b45309] leading-snug mt-0.5">
          Different: {e.differenceNote}
        </div>
      )}
      {!auto && e.proposedResolution && (
        <div className="text-[10px] text-[#525252] leading-snug mt-0.5">
          proposed: <span className="font-medium text-[#171717]">{e.proposedResolution}</span>
        </div>
      )}
      {!auto && <ApproveHold e={e} d={d} />}
    </div>
  );
}

/** The Normalize box for one axis row — the v3 comparison table. */
export function NormalizeNode({ data }: NodeProps) {
  const d = data as NormalizeNodeData;
  const { shown, hidden } = visibleNormalizeEntries(d.entries);
  const hasCards = shown.some((e) => (e.sourceCards ?? []).length > 0);
  return (
    <div
      className="rounded-lg border-2 border-[#c7d2fe] bg-[#f5f7ff] shadow-sm px-2.5 py-2 cursor-pointer hover:border-[#a5b4fc]"
      style={{ width: NORM_W }}
      title="Click for the normalized findings"
    >
      {sideHandles}
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14px] font-bold text-[#171717] leading-tight">{d.name}</div>
        <div className="text-[11px] text-[#4338ca] tnum flex-shrink-0 mt-0.5 font-semibold">
          {d.rawCount} raw → {d.entries.length}
        </div>
      </div>
      {d.destination && <div className="text-[11px] text-[#0f766e] mt-0.5">→ {d.destination}</div>}
      {/* 3-column header band — SOURCE A | SOURCE B | NORMALIZED */}
      {hasCards && d.sourceNames && (
        <div className="grid grid-cols-3 gap-1 mt-1.5 border-b border-[#dfe3f5] pb-0.5">
          {[d.sourceNames[0], d.sourceNames[1], 'Normalized'].map((h, i) => (
            <div
              key={h}
              className={`text-[9px] font-bold uppercase tracking-[0.07em] truncate ${
                i === 2 ? 'text-[#4338ca]' : 'text-[#8f8f8f]'
              }`}
            >
              {h}
            </div>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {shown.map((e) =>
            (e.sourceCards ?? []).length > 0 ? (
              <ComparisonRow key={e.id} e={e} d={d} />
            ) : (
              <CompactRow key={e.id} e={e} d={d} />
            ),
          )}
        </div>
      )}
      {hidden > 0 && (
        <div className="mt-1 text-[10px] text-[#8f8f8f] italic">
          + {hidden} more normalized — click the box for the full list
        </div>
      )}
    </div>
  );
}
