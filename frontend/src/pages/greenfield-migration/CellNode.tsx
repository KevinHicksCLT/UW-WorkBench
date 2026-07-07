/**
 * Legacy-cell node for the rationalization board (WR-06/WR-10): green
 * (Common/Different) category chips first, red (Relocate/Eliminate) chips
 * under a "Doesn't belong here" divider, and in-box expansion — clicking a
 * chip unfolds its findings inside the tan box (name, plain summary, screen
 * chip, red relocation flag) instead of opening the side drawer.
 *
 * Any change to the rendered row structure must be mirrored in the height
 * ceilings in cellGeometry.ts (estimateCellHeight) or rows can overlap.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CategoryTag, Finding, Layer } from '../../lib/rationalization';
import { BOX_W, belongsHere } from './cellGeometry';

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
};

function FindingRow({
  f,
  capdan,
  screens,
  sharedNames,
}: {
  f: Finding;
  capdan: CategoryTag['capdan'];
  screens: Record<string, CellScreen>;
  sharedNames: Record<string, string>;
}) {
  // Plain language is the DEFAULT; the technical version (code location,
  // rationale, migration approach) lives on mouseover (WR feedback 2026-07-06).
  const summary = f.plainSummary ?? f.rationale ?? f.migrationApproach ?? '';
  const technical = [f.codeRef, f.rationale, f.migrationApproach]
    .filter((v): v is string => Boolean(v) && v !== summary)
    .join('  ·  ');
  const screen = f.screenRef ? screens[f.screenRef] : undefined;
  // A relocation lands either in a shared service (WR-15) or another layer.
  const dest = f.sharedServiceId
    ? (sharedNames[f.sharedServiceId] ?? 'a shared service')
    : (f.recommendedLayer ?? f.targetLayer);
  return (
    <div
      className="rounded-md border border-[#f0e4cf] bg-white/60 px-2 py-1"
      title={technical ? `Technical: ${technical}` : undefined}
    >
      <div
        className="text-[12.5px] font-semibold text-[#171717] leading-snug truncate"
        title={f.name}
      >
        {f.name}
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
      {!belongsHere(capdan) && (
        <div className="text-[11px] font-medium text-[#be123c] mt-0.5">
          {capdan === 'Eliminate' ? 'Recommend removing' : `Belongs in ${dest ?? 'another layer'}`}
        </div>
      )}
    </div>
  );
}

function TagChips({ tags, d }: { tags: CategoryTag[]; d: CellNodeData }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const ok = belongsHere(t.capdan);
        const cls = ok
          ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
          : 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]';
        const open = d.expanded.includes(t.category);
        const tip =
          d.tips[t.category] ??
          `${t.count} ${t.category} · ${ok ? 'belongs here' : t.capdan === 'Relocate' ? `move to ${t.targetLayer}` : 'eliminate'} — click to expand`;
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
            {t.capdan === 'Relocate' && t.targetLayer && (
              <span className="opacity-80">→ {t.targetLayer}</span>
            )}
            <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] rounded-full bg-white/70 text-[12px] font-semibold px-0.5">
              {t.count}
            </span>
            <span aria-hidden="true" className="text-[12px] opacity-70 leading-none">
              {open ? '−' : '+'}
            </span>
          </button>
        );
        const key = `${t.category}-${t.capdan}`;
        if (!open) return <span key={key}>{chip}</span>;
        return (
          <div key={key} className="w-full">
            {chip}
            <div className="mt-1 space-y-1">
              {t.findings.map((f) => (
                <FindingRow
                  key={f.id}
                  f={f}
                  capdan={t.capdan}
                  screens={d.screens}
                  sharedNames={d.sharedNames}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CellNode({ data }: NodeProps) {
  const d = data as CellNodeData;
  const green = d.tags.filter((t) => belongsHere(t.capdan));
  const red = d.tags.filter((t) => !belongsHere(t.capdan));
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
    </div>
  );
}
