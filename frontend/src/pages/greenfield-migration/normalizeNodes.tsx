/**
 * Normalize-column node for the v3 board: one box per axis row showing its
 * normalized entries with stable notation chips (#N-101), raw→normalized
 * counts, AUTO badges, and HELD/REVIEW cards (difference note + proposed
 * resolution + status pill) with approve/hold actions. Pill colors come from
 * the MATCH_STATUS vocabulary rows (3-A).
 *
 * Row structure changes must be mirrored in cellGeometry.estimateNormalizeHeight.
 */
import type { NodeProps } from '@xyflow/react';
import type { Layer, MatchMeta, NormalizationEntry } from '../../lib/rationalization';
import { BOX_W } from './cellGeometry';
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
  /** Which two sources the comparison verdicts frame (>2 legacy columns). */
  pairLabel: string | null;
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

function AutoEntryRow({ e, d }: { e: NormalizationEntry; d: NormalizeNodeData }) {
  return (
    <div className="rounded-md border border-[#c7d2fe] bg-white/70 px-2 py-1">
      <div className="flex items-start gap-1.5">
        <span className="inline-flex items-center rounded bg-[#eef2ff] border border-[#c7d2fe] px-1 text-[10px] font-bold text-[#4338ca] flex-shrink-0 mt-px">
          #{e.notation}
        </span>
        <span
          className="text-[12.5px] font-semibold text-[#171717] leading-snug truncate flex-1 min-w-0"
          title={e.name}
        >
          {e.name}
        </span>
        <span className="text-[10px] font-semibold text-[#047857] tnum flex-shrink-0 mt-px">
          {e.findingIds.length}→1 · {d.matchMeta[e.matchStatus]?.label ?? e.matchStatus}
        </span>
      </div>
      {e.matchBasis && (
        <div className="text-[11px] text-[#047857] leading-snug mt-0.5 line-clamp-2">
          Same: {e.matchBasis}
        </div>
      )}
    </div>
  );
}

function HeldEntryCard({ e, d }: { e: NormalizationEntry; d: NormalizeNodeData }) {
  const held = e.matchStatus === 'HELD';
  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${
        held ? 'border-[#fecdd3] bg-[#fff7f7]' : 'border-[#fde68a] bg-[#fffbeb]'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <span className="inline-flex items-center rounded bg-white/80 border border-[#e5e5e5] px-1 text-[10px] font-bold text-[#525252] flex-shrink-0 mt-px">
          #{e.notation}
        </span>
        <span
          className="text-[12.5px] font-semibold text-[#171717] leading-snug truncate flex-1 min-w-0"
          title={e.name}
        >
          {e.name}
        </span>
        <MatchPill status={e.matchStatus} matchMeta={d.matchMeta} />
      </div>
      {e.differenceNote && (
        <div className="text-[11px] text-[#b45309] leading-snug mt-1 line-clamp-2">
          Different: {e.differenceNote}
        </div>
      )}
      {e.proposedResolution && (
        <div className="text-[11px] text-[#525252] leading-snug mt-0.5 line-clamp-2">
          proposed: <span className="font-medium text-[#171717]">{e.proposedResolution}</span>
        </div>
      )}
      {d.onEntryAction && (
        <div className="flex items-center gap-1.5 mt-1.5">
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
      )}
    </div>
  );
}

/** The Normalize box for one axis row — replaces the pre-v3 CapdanNode. */
export function NormalizeNode({ data }: NodeProps) {
  const d = data as NormalizeNodeData;
  return (
    <div
      className="rounded-lg border-2 border-[#c7d2fe] bg-[#f5f7ff] shadow-sm px-3 py-2.5 cursor-pointer hover:border-[#a5b4fc]"
      style={{ width: BOX_W }}
      title="Click for the normalized findings"
    >
      {sideHandles}
      <div className="flex items-start justify-between gap-2">
        <div className="text-[15px] font-bold text-[#171717] leading-tight">{d.name}</div>
        <div className="text-[11px] text-[#4338ca] tnum flex-shrink-0 mt-0.5 font-semibold">
          {d.rawCount} raw → {d.entries.length}
        </div>
      </div>
      {d.destination && <div className="text-[12px] text-[#0f766e] mt-0.5">→ {d.destination}</div>}
      {d.pairLabel && (
        <div className="text-[10px] text-[#a3a3a3] mt-0.5 truncate" title={d.pairLabel}>
          comparing {d.pairLabel}
        </div>
      )}
      {d.entries.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {d.entries.map((e) =>
            e.matchStatus === 'AUTO' ? (
              <AutoEntryRow key={e.id} e={e} d={d} />
            ) : (
              <HeldEntryCard key={e.id} e={e} d={d} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
