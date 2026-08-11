import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useOpenRole } from '../lib/roleDrawer';
import SkillViewer from './SkillViewer';
import { skillLabel } from '../lib/skills';
import { Chip, DrawerShell, EmptyState, ErrorMessage, SkeletonLoader } from './ui';

// StandardDrawer — one standard's full detail (description, enforcing agent
// skill, SDLC gates, regulatory citation, responsible role, value streams),
// rendered as a slide-over from the Standards tab's list view. Backed by the
// same GET /explorer/standards/:areaId payload the area page consumes — the
// drawer picks the clicked item out of the area's items.

type ValueStream = { id: string; name: string; domain: string | null };
type Responsible = { roleId: string; roleName: string; roleLevel: string | null };
// One work-plan key; generic = from the assigned pattern, else item-specific.
type PlanKey = { key: string; generic: boolean };
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
  testProcedure: string | null;
  evidence: string | null;
  plan: { checklist: PlanKey[]; testing: PlanKey[] } | null; // Work Library plan keys
  responsible: Responsible | null;
  appliers: { roleId: string; roleName: string }[];
  valueStreams: ValueStream[];
};
// Top-level rows are groups: each carries its decomposed child standards.
type Group = Item & { subs: Item[] };
type AreaData = {
  area: { id: string; department: string };
  items: Group[];
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
    {children}
  </div>
);

// Ordered plan keys — item-specific steps only; generic pattern keys are not
// surfaced to users.
const PlanKeyList = ({ keys, className }: { keys: PlanKey[]; className?: string }) => (
  <ol
    className={
      'text-sm text-[#171717] leading-relaxed list-decimal pl-5 space-y-1' +
      (className ? ` ${className}` : '')
    }
  >
    {keys.map((k, i) => (
      <li key={i}>{k.key}</li>
    ))}
  </ol>
);

export default function StandardDrawer({
  areaId,
  itemId,
  onClose,
}: {
  areaId: string;
  itemId: string;
  onClose: () => void;
}) {
  const openRole = useOpenRole();
  const [data, setData] = useState<AreaData | null>(null);
  const [error, setError] = useState('');
  const [viewSkill, setViewSkill] = useState<string | null>(null);
  // The drawer can hop between sibling standards of the same group without
  // closing — activeId tracks the standard currently shown.
  const [activeId, setActiveId] = useState(itemId);

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get<AreaData>(`/explorer/standards/${areaId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [areaId]);

  useEffect(() => setActiveId(itemId), [itemId]);

  // The clicked row is a leaf standard: either a group's child or a group
  // without children. `group` provides the higher-level context when present.
  const group =
    data?.items.find((g) => g.id === activeId || g.subs.some((s) => s.id === activeId)) ?? null;
  const item = group
    ? group.id === activeId
      ? group
      : group.subs.find((s) => s.id === activeId)!
    : null;
  const isSub = !!group && !!item && group.id !== item.id;
  const gates = item?.sdlcGates ? item.sdlcGates.split(/;\s*/).filter(Boolean) : [];
  // Only item-specific plan steps surface here — generic pattern keys are not
  // displayed to users. Checklist and testing keys are combined into one
  // "Actions" list rather than shown as separate groups.
  const planActions = [
    ...(item?.plan?.checklist.filter((k) => !k.generic) ?? []),
    ...(item?.plan?.testing.filter((k) => !k.generic) ?? []),
  ];

  return (
    <DrawerShell
      onClose={onClose}
      width={560}
      maxWidth="92vw"
      header={
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
            Standard
          </div>
          <div className="text-[15px] font-bold text-[#171717] leading-snug">
            {item?.name ?? (error ? '—' : 'Loading…')}
          </div>
          {item && (
            <div className="text-[11px] text-[#a3a3a3] mt-0.5">
              <Link to={`/standards/${areaId}`} className="hover:underline hover:text-[#525252]">
                {data!.area.department}
              </Link>
              {' · '}
              {item.category}
              {isSub && (
                <>
                  {' · '}
                  {group!.name}
                </>
              )}
            </div>
          )}
        </div>
      }
      after={viewSkill && <SkillViewer skill={viewSkill} onClose={() => setViewSkill(null)} />}
    >
      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : !data ? (
        <SkeletonLoader count={4} height={48} className="space-y-2" />
      ) : !item ? (
        <EmptyState
          baseClassName="text-sm text-[#a3a3a3] italic"
          message="Standard not found in this area."
        />
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
                      <button
                        onClick={() => setActiveId(s.id)}
                        className="text-left text-[#525252] hover:text-[#171717] hover:underline"
                      >
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
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" />
                </svg>
                {skillLabel(item.agentSkill, data?.area.department)}
                <span className="text-[#0070AD]/50">· view &amp; download</span>
              </button>
            </div>
          )}

          {/* SDLC gates + regulatory citation */}
          {gates.length > 0 && (
            <div>
              <SectionLabel>SDLC gates</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {gates.map((g) => (
                  <Chip key={g}>{g}</Chip>
                ))}
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
                <button
                  type="button"
                  onClick={() => openRole(item.responsible!.roleId)}
                  className="text-[#171717] hover:underline"
                >
                  {item.responsible.roleName}
                </button>
                {item.ownerRole && item.ownerRole !== item.responsible.roleName && (
                  <span className="text-xs text-[#a3a3a3]"> ({item.ownerRole})</span>
                )}
                {item.responsible.roleLevel &&
                  item.responsible.roleLevel !== 'Individual Contributor' && (
                    <div className="text-xs text-[#a3a3a3] mt-0.5 flex items-center gap-1.5">
                      <Chip>{item.responsible.roleLevel}</Chip>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-sm text-[#525252]">
                {item.ownerRole ?? <span className="text-[#a3a3a3] italic">Unassigned</span>}
              </div>
            )}
            {item.relatedRole && item.relatedRole !== item.ownerRole && (
              <div className="mt-2 text-xs text-[#a3a3a3]">
                Accountable (governance): {item.relatedRole}
              </div>
            )}
          </div>

          {/* Applied by — the roles that execute the control day-to-day */}
          {item.appliers.length > 0 && (
            <div>
              <SectionLabel>Applied by</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {item.appliers.map((a) => (
                  <Chip
                    as="button"
                    key={a.roleId}
                    type="button"
                    className="hover:bg-[#eaeaea]"
                    onClick={() => openRole(a.roleId)}
                  >
                    {a.roleName}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Work Library plan — checklist + testing keys combined into one
                  Actions list (values filled there), item-specific steps only */}
          {planActions.length > 0 && (
            <div>
              <SectionLabel>Actions</SectionLabel>
              <PlanKeyList keys={planActions} />
            </div>
          )}

          {/* Applies to value streams */}
          {item.valueStreams.length > 0 && (
            <div>
              <SectionLabel>Applies to value streams</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {item.valueStreams.map((vs) => (
                  <Chip
                    as={Link}
                    key={vs.id}
                    to={`/overview?focus=${vs.id}`}
                    className="hover:bg-[#eaeaea]"
                    title={vs.domain ?? ''}
                  >
                    {vs.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <Link
            to={`/work-library?type=standard&id=${itemId}`}
            className="inline-block w-full text-center rounded-md border border-[#9fb6e8] px-3 py-1.5 text-xs font-semibold text-[#2563eb] hover:bg-[#f0f6ff]"
          >
            Actions plan in Work library ↗
          </Link>
          <Link
            to={`/standards/${areaId}`}
            className="inline-block text-xs text-[#666666] hover:text-[#171717] underline decoration-[#d4d4d4]"
          >
            View standards area →
          </Link>
        </div>
      )}
    </DrawerShell>
  );
}
