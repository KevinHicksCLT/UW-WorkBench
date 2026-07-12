/**
 * Legacy-cell node for the rationalization board (WR-06/WR-10 + v3): category
 * chips colored by the classification vocabulary, in-box expansion where each
 * finding renders as a ✓ "correct here" / ✗ "needs to move" row with a
 * relocation badge, an expandable WHY THIS MOVES panel for misplaced items,
 * and matched anatomy sub-categories on product boards.
 *
 * Any change to the rendered row structure must be mirrored in the height
 * ceilings in cellGeometry.ts (estimateCellHeight) or rows can overlap.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type {
  CategoryTag,
  ClassificationMeta,
  Finding,
  Layer,
  WhyThisMoves,
} from '../../lib/rationalization';
import { BOX_W } from './cellGeometry';

// Handles are hidden in read mode and revealed via the `.board-editing` CSS
// class on the canvas when editing; connectability follows the global
// `nodesConnectable` flag, so no per-handle override is needed.
export const sideHandles = (
  <>
    <Handle id="l" type="target" position={Position.Left} className="board-handle" />
    <Handle id="r" type="source" position={Position.Right} className="board-handle" />
  </>
);

export type ToggleCategoryFn = (appId: string, layer: Layer, category: string) => void;
export type CellScreen = { url: string | null; kind: string };
export type CellAnatomyRow = { name: string; description: string };
export type CellNodeData = {
  layer: Layer;
  appId: string;
  tags: CategoryTag[];
  /** Category names currently expanded inside this cell. */
  expanded: string[];
  onToggle: ToggleCategoryFn;
  /** detail.screens by name — resolves a finding's screenRef to a link. */
  screens: Record<string, CellScreen>;
  /** Anatomy-catalog descriptions for this layer, by category name. */
  tips: Record<string, string>;
  /** Shared-service names by app id — labels shared-service relocations (WR-15). */
  sharedNames: Record<string, string>;
  /** Classification vocabulary — chip colors + stay/move (3-A). */
  classification: ClassificationMeta;
  /** Matched anatomy sub-categories per tag key (`category␟capdan`) — 3-D. */
  anatomyByTag: Record<string, CellAnatomyRow[]>;
  /** Findings UI (PM-07): edit an expanded finding / add one to this cell. */
  onEditFinding?: (findingId: string) => void;
  onAddFinding?: (appId: string, layer: Layer) => void;
};

export const tagKey = (t: Pick<CategoryTag, 'category' | 'capdan'>) => `${t.category}␟${t.capdan}`;

/** Where a misplaced finding lands, for the red relocation badge. */
function moveDestination(f: Finding, sharedNames: Record<string, string>): string {
  if (f.deadCode) return 'Dead code';
  if (f.sharedServiceId) return sharedNames[f.sharedServiceId] ?? 'a shared service';
  return f.recommendedLayer ?? f.targetLayer ?? 'another layer';
}

function WhyThisMovesPanel({ why }: { why: WhyThisMoves }) {
  const rows: [string, string | undefined][] = [
    ['Captured', why.captured],
    ['Sent', why.sent],
    ['Processed', why.processed],
    ['Validation', why.validated],
  ];
  return (
    <div className="mt-1 rounded-md border border-[#fecdd3] border-l-2 border-l-[#e11d48] bg-[#fff7f7] px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#be123c]">
        Why this moves
      </div>
      <div className="text-[11px] text-[#525252] leading-snug mt-0.5">
        {rows
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([k, v]) => (
            <span key={k}>
              <span className="text-[#a3a3a3] font-medium">{k}</span> {v} ·{' '}
            </span>
          ))}
        {why.lands && (
          <span>
            lands in <span className="font-semibold text-[#0f766e]">{why.lands}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function FindingRow({ f, tag, d }: { f: Finding; tag: CategoryTag; d: CellNodeData }) {
  // Plain language is the DEFAULT; the technical version (code location,
  // rationale, migration approach) lives on mouseover (WR feedback 2026-07-06).
  const summary = f.plainSummary ?? f.rationale ?? f.migrationApproach ?? '';
  const technical = [f.codeRef, f.rationale, f.migrationApproach]
    .filter((v): v is string => Boolean(v) && v !== summary)
    .join('  ·  ');
  const screen = f.screenRef ? d.screens[f.screenRef] : undefined;
  return (
    <div
      className="rounded-md border border-[#f0e4cf] bg-white/60 px-2 py-1"
      title={technical ? `Technical: ${technical}` : undefined}
    >
      <div className="flex items-start gap-1.5">
        <span
          aria-hidden="true"
          className={`text-[12px] font-bold leading-snug flex-shrink-0 ${
            tag.stays ? 'text-[#10b981]' : 'text-[#e11d48]'
          }`}
        >
          {tag.stays ? '✓' : '✗'}
        </span>
        <div
          className="text-[12.5px] font-semibold text-[#171717] leading-snug truncate flex-1 min-w-0"
          title={f.name}
        >
          {f.name}
        </div>
        {d.onEditFinding && (
          <button
            type="button"
            aria-label={`Edit ${f.name}`}
            onClick={(e) => {
              e.stopPropagation();
              d.onEditFinding?.(f.id);
            }}
            className="flex-shrink-0 text-[11px] text-[#a3a3a3] hover:text-[#171717] leading-snug"
            title="Edit finding"
          >
            ✎
          </button>
        )}
      </div>
      {summary && (
        <div className="text-[12px] text-[#8f8f8f] leading-snug line-clamp-2 mt-0.5">{summary}</div>
      )}
      {f.screenRef &&
        (screen?.url ? (
          <a
            href={screen.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 rounded border border-[#dbe4f0] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#1d4ed8] hover:border-[#bfdbfe]"
            title={`Open ${f.screenRef}`}
          >
            {f.screenRef} ↗
          </a>
        ) : (
          <span className="mt-1 inline-flex items-center rounded border border-[#e5e5e5] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#525252]">
            {f.screenRef}
          </span>
        ))}
      {!tag.stays && (
        <div className="mt-0.5">
          <span className="inline-flex items-center rounded border border-[#fecdd3] bg-[#fff1f2] px-1.5 py-0.5 text-[11px] font-semibold text-[#be123c]">
            → {moveDestination(f, d.sharedNames)}
          </span>
        </div>
      )}
      {!tag.stays && f.whyThisMoves && <WhyThisMovesPanel why={f.whyThisMoves} />}
    </div>
  );
}

function TagChips({ tags, d }: { tags: CategoryTag[]; d: CellNodeData }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const meta = d.classification.byToken[t.capdan];
        const cls =
          meta?.chip ??
          (t.stays
            ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
            : 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]');
        const open = d.expanded.includes(t.category);
        const tip =
          d.tips[t.category] ??
          `${t.count} ${t.category} · ${t.stays ? 'belongs here' : t.targetLayer ? `move to ${t.targetLayer}` : 'needs to move'} — click to expand`;
        const anatomy = d.anatomyByTag[tagKey(t)] ?? [];
        const chip = (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              d.onToggle(d.appId, d.layer, t.category);
            }}
            aria-expanded={open}
            className={`inline-flex items-center gap-1 rounded-md border pl-2 pr-1.5 py-0.5 text-[13px] font-medium hover:shadow-sm ${cls}`}
            title={tip}
          >
            <span className="truncate max-w-[170px]">{t.category}</span>
            {!t.stays && t.targetLayer && <span className="opacity-80">→ {t.targetLayer}</span>}
            <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] rounded-full bg-white/70 text-[12px] font-semibold px-0.5">
              {t.count}
            </span>
            <span aria-hidden="true" className="text-[12px] opacity-70 leading-none">
              {open ? '−' : '+'}
            </span>
          </button>
        );
        const key = tagKey(t);
        if (!open) return <span key={key}>{chip}</span>;
        return (
          <div key={key} className="w-full">
            {chip}
            <div className="mt-1 space-y-1">
              {t.findings.map((f) => (
                <FindingRow key={f.id} f={f} tag={t} d={d} />
              ))}
            </div>
            {anatomy.length > 0 && (
              <div className="mt-1 rounded-md border border-[#e5e5e5] bg-white/60 px-2 py-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
                  Matched anatomy
                </div>
                {anatomy.map((a) => (
                  <div
                    key={a.name}
                    className="text-[11px] text-[#525252] leading-snug truncate"
                    title={a.description}
                  >
                    · {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CellNode({ data }: NodeProps) {
  const d = data as CellNodeData;
  const green = d.tags.filter((t) => t.stays);
  const red = d.tags.filter((t) => !t.stays);
  return (
    <div
      className="rounded-lg border-2 border-[#e7d3b5] bg-[#fdf8f0] shadow-sm px-4 py-3"
      style={{ width: BOX_W }}
    >
      {sideHandles}
      {d.tags.length === 0 ? (
        <span className="text-[13px] text-[#cfcfcf]">—</span>
      ) : (
        <>
          <TagChips tags={green} d={d} />
          {red.length > 0 && (
            <>
              <div className={`flex items-center gap-2 mb-1.5 ${green.length > 0 ? 'mt-2' : ''}`}>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#cf8193]">
                  Doesn’t belong here
                </span>
                <span className="flex-1 border-t border-[#f3d5da]" />
              </div>
              <TagChips tags={red} d={d} />
            </>
          )}
        </>
      )}
      {d.onAddFinding && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              d.onAddFinding?.(d.appId, d.layer);
            }}
            className="text-[11px] font-medium text-[#a3a3a3] hover:text-[#171717]"
            title="Add a finding to this cell"
          >
            + finding
          </button>
        </div>
      )}
    </div>
  );
}
