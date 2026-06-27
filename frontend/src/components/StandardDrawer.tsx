import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import SkillViewer from './SkillViewer';
import { skillLabel } from '../lib/skills';

// StandardDrawer — one standard's full detail (description, enforcing agent
// skill, SDLC gates, regulatory citation, responsible role, value streams),
// rendered as a slide-over from the Standards tab's list view. Backed by the
// same GET /explorer/standards/:areaId payload the area page consumes — the
// drawer picks the clicked item out of the area's items.

type ValueStream = { id: string; name: string; domain: string | null };
type Responsible = { roleId: string; roleName: string; roleLevel: string | null };
type Item = {
  id: string;
  category: string;
  name: string;
  description: string;
  ownerRole: string | null;
  relatedRole: string | null;
  relatedCategory: string | null;
  agentSkill: string | null;
  sdlcGates: string | null;
  regCitation: string | null;
  responsible: Responsible | null;
  valueStreams: ValueStream[];
};
// Top-level rows are groups: each carries its decomposed child standards.
type Group = Item & { subs: Item[] };
type AreaData = {
  area: { id: string; department: string };
  items: Group[];
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">{children}</div>
);

export default function StandardDrawer({ areaId, itemId, onClose }: { areaId: string; itemId: string; onClose: () => void }) {
  const [data, setData] = useState<AreaData | null>(null);
  const [error, setError] = useState('');
  const [viewSkill, setViewSkill] = useState<string | null>(null);
  // The drawer can hop between sibling standards of the same group without
  // closing — activeId tracks the standard currently shown.
  const [activeId, setActiveId] = useState(itemId);

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/explorer/standards/${areaId}`).then(setData).catch((e: Error) => setError(e.message));
  }, [areaId]);

  useEffect(() => setActiveId(itemId), [itemId]);

  // The clicked row is a leaf standard: either a group's child or a group
  // without children. `group` provides the higher-level context when present.
  const group = data?.items.find((g) => g.id === activeId || g.subs.some((s) => s.id === activeId)) ?? null;
  const item = group ? (group.id === activeId ? group : group.subs.find((s) => s.id === activeId)!) : null;
  const isSub = !!group && !!item && group.id !== item.id;
  const gates = item?.sdlcGates ? item.sdlcGates.split(/;\s*/).filter(Boolean) : [];

  return (
    <div className="absolute inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop dims the sheet; click to dismiss. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <aside className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col" style={{ width: 560, maxWidth: '92vw' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">Standard</div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug">{item?.name ?? (error ? '—' : 'Loading…')}</div>
            {item && (
              <div className="text-[11px] text-[#a3a3a3] mt-0.5">
                <Link to={`/standards/${areaId}`} className="hover:underline hover:text-[#525252]">{data!.area.department}</Link>
                {' · '}{item.category}
                {isSub && <>{' · '}{group!.name}</>}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="text-sm text-[#be123c]">{error}</div>
          ) : !data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton rounded-md" style={{ height: 48 }} />)}
            </div>
          ) : !item ? (
            <div className="text-sm text-[#a3a3a3] italic">Standard not found in this area.</div>
          ) : (
            <div className="space-y-5">
              {/* What it means */}
              <div>
                <SectionLabel>What it means</SectionLabel>
                <p className="text-sm text-[#171717] leading-relaxed">{item.description}</p>
              </div>

              {/* Group context — the higher-level standard this one belongs to,
                  with its sibling standards as bullets (click to hop). */}
              {isSub && (
                <div className="rounded-lg border border-[#eaeaea] bg-[#fafafa] p-3">
                  <SectionLabel>Part of · {group!.name}</SectionLabel>
                  <p className="text-xs text-[#525252] leading-relaxed mb-2">{group!.description}</p>
                  <ul className="space-y-1">
                    {group!.subs.map((s) => (
                      <li key={s.id} className="flex items-start gap-1.5 text-xs">
                        <span className="mt-[5px] w-1 h-1 rounded-full bg-[#a3a3a3] flex-shrink-0" />
                        {s.id === item.id ? (
                          <span className="font-semibold text-[#171717]">{s.name}</span>
                        ) : (
                          <button onClick={() => setActiveId(s.id)} className="text-left text-[#525252] hover:text-[#171717] hover:underline">
                            {s.name}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Enforcing agent skill — view & download the skill pack */}
              {item.agentSkill && (
                <div>
                  <SectionLabel>Agent skill</SectionLabel>
                  <button
                    onClick={() => setViewSkill(item.agentSkill)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0070AD] bg-[#eef6fb] hover:bg-[#e0f0fb] px-2.5 py-1 rounded-md transition-colors"
                    title={`Enforced by the ${item.agentSkill} agent skill — view & download`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" /></svg>
                    {skillLabel(item.agentSkill)}
                    <span className="text-[#0070AD]/50">· view &amp; download</span>
                  </button>
                </div>
              )}

              {/* SDLC gates + regulatory citation */}
              {gates.length > 0 && (
                <div>
                  <SectionLabel>SDLC gates</SectionLabel>
                  <div className="flex flex-wrap gap-1">
                    {gates.map((g) => <span key={g} className="chip-soft">{g}</span>)}
                  </div>
                </div>
              )}
              {item.regCitation && (
                <div>
                  <SectionLabel>Regulatory citation</SectionLabel>
                  <p className="text-sm text-[#525252]">{item.regCitation}</p>
                </div>
              )}

              {/* Responsible role */}
              <div>
                <SectionLabel>Responsible role</SectionLabel>
                {item.responsible ? (
                  <div className="text-sm">
                    <Link to={`/roles/${item.responsible.roleId}`} className="text-[#171717] hover:underline">
                      {item.responsible.roleName}
                    </Link>
                    {item.ownerRole && item.ownerRole !== item.responsible.roleName && (
                      <span className="text-xs text-[#a3a3a3]"> ({item.ownerRole})</span>
                    )}
                    {item.responsible.roleLevel && item.responsible.roleLevel !== 'Individual Contributor' && (
                      <div className="text-xs text-[#a3a3a3] mt-0.5 flex items-center gap-1.5">
                        <span className="chip-soft">{item.responsible.roleLevel}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[#525252]">
                    {item.ownerRole ?? <span className="text-[#a3a3a3] italic">Unassigned</span>}
                  </div>
                )}
                {item.relatedRole && item.relatedRole !== item.ownerRole && (
                  <div className="mt-2 text-xs text-[#a3a3a3]">Accountable (governance): {item.relatedRole}</div>
                )}
              </div>

              {/* Applies to value streams */}
              {item.valueStreams.length > 0 && (
                <div>
                  <SectionLabel>Applies to value streams</SectionLabel>
                  <div className="flex flex-wrap gap-1">
                    {item.valueStreams.map((vs) => (
                      <Link key={vs.id} to={`/overview?focus=${vs.id}`} className="chip-soft hover:bg-[#eaeaea]" title={vs.domain ?? ''}>
                        {vs.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <Link to={`/standards/${areaId}`} className="inline-block text-xs text-[#666666] hover:text-[#171717] underline decoration-[#d4d4d4]">
                View standards area →
              </Link>
            </div>
          )}
        </div>
      </aside>

      {viewSkill && <SkillViewer skill={viewSkill} onClose={() => setViewSkill(null)} />}
    </div>
  );
}
