import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import SkillViewer from '../../components/SkillViewer';
import { skillLabel } from '../../lib/skills';
import { Card, Chip, ErrorMessage, Input, LoadingState } from '../../components/ui';

// Standards area detail — drill target from the Standards tab. Shows the area's
// charter (mission/scope) and every individual standard grouped by category.
// Each standard expands to its meaning, the value streams it applies to, and the
// role accountable for meeting it.

type ValueStream = { id: string; name: string; domain: string | null };
type Responsible = { roleId: string; roleName: string; roleLevel: string | null };
// One work-plan key; generic = from the assigned pattern, else item-specific.
type PlanKey = { key: string; generic: boolean };
type Item = {
  id: string;
  category: string;
  name: string;
  description: string;
  buildRun: string | null;
  ownerRole: string | null;
  relatedRole: string | null;
  relatedCategory: string | null;
  itemsLink: string | null;
  agentSkill: string | null; // per-standard tailored skill
  categorySkill: string | null; // the category rollup skill
  sdlcGates: string | null;
  regCitation: string | null;
  testProcedure: string | null; // FB-58 — how to independently verify the rule
  evidence: string | null; // FB-58 — the evidence artifact the check leaves behind
  responsible: Responsible | null; // accountable owner
  appliers: { roleId: string; roleName: string }[]; // who executes the control
  valueStreams: ValueStream[];
  // Work Library plan keys (generic template keys + item-specific steps) —
  // values are filled in the Work Library, this view shows the structure.
  // generic distinguishes pattern keys from item-specific steps in the display.
  plan: { checklist: PlanKey[]; testing: PlanKey[] } | null;
};
// Top-level rows are groups; their decomposed child standards ride along.
type Group = Item & { subs: Item[] };
type Data = {
  area: {
    id: string;
    department: string;
    count: number;
    charterIncluded: boolean;
    owner: string | null;
    link: string | null;
    mission: string | null;
    scope: string | null;
  };
  totals: { items: number; groups: number; categories: number; withOwnerRole: number };
  items: Group[];
};

export default function StandardArea() {
  const { id } = useParams();
  const { data, error, loading } = useApi<Data>(id ? `/explorer/standards/${id}` : null);
  const [q, setQ] = useState('');
  const [viewSkill, setViewSkill] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(k)) {
        n.delete(k);
      } else {
        n.add(k);
      }
      return n;
    });

  // Filter + group standards by category (the in-area grouping).
  const groups = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const items = needle
      ? data.items.filter(
          (i) =>
            i.name.toLowerCase().includes(needle) ||
            i.description.toLowerCase().includes(needle) ||
            i.category.toLowerCase().includes(needle) ||
            (i.ownerRole ?? '').toLowerCase().includes(needle) ||
            (i.agentSkill ?? '').toLowerCase().includes(needle) ||
            (i.regCitation ?? '').toLowerCase().includes(needle) ||
            i.subs.some(
              (s) =>
                s.name.toLowerCase().includes(needle) ||
                s.description.toLowerCase().includes(needle),
            ),
        )
      : data.items;
    const byCat = new Map<string, Group[]>();
    for (const it of items) {
      if (!byCat.has(it.category)) {
        byCat.set(it.category, []);
      }
      byCat.get(it.category)!.push(it);
    }
    // All standards in a regulatory category share one enforcing skill, so
    // surface it once at the category level (not repeated per standard).
    return [...byCat.entries()].map(([category, rows]) => ({
      category,
      rows,
      skill: rows.find((r) => r.categorySkill)?.categorySkill ?? null,
    }));
  }, [data, q]);

  if (loading) return <LoadingState baseClassName="text-slate-500" message="Loading standards…" />;
  if (error) return <ErrorMessage baseClassName="text-red-600">{error}</ErrorMessage>;
  if (!data) return null;

  const a = data.area;
  const scopeBullets = a.scope ? a.scope.split('\n').filter(Boolean) : [];

  return (
    <div>
      <PageHeader
        title={a.department}
        subtitle={`${data.totals.items} standards across ${data.totals.categories} categories · ${data.totals.withOwnerRole} mapped to a role`}
        eyebrow="Standards area"
      />

      {/* Charter — mission + scope from the department standards sheet */}
      {(a.mission || scopeBullets.length > 0 || a.owner) && (
        <Card className="mb-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {a.mission && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
                  Mission
                </div>
                <p className="text-sm text-[#171717] mb-3">{a.mission}</p>
              </>
            )}
            {scopeBullets.length > 0 && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
                  Scope
                </div>
                <ul className="text-sm text-[#525252] space-y-0.5 list-disc pl-4">
                  {scopeBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
              Accountable owner
            </div>
            <p className="text-sm text-[#171717] mb-3">{a.owner ?? '—'}</p>
            <div className="flex items-center gap-2 text-xs text-[#666666]">
              <span className="tnum">{a.count} standards</span>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 mb-3">
        <Input
          className="sm:max-w-xs"
          placeholder="Search standards…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {groups.length === 0 ? (
        <Card className="text-sm text-slate-500 italic">No standards match.</Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.category}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                  {g.category}
                  {/* leaf standards in the category, matching the area totals */}
                  <span className="text-xs font-normal text-[#a3a3a3] tnum">
                    {g.rows.reduce((n, r) => n + (r.subs.length || 1), 0)}
                  </span>
                </h3>
                {g.skill && (
                  <button
                    onClick={() => setViewSkill(g.skill)}
                    className="inline-flex items-center gap-1.5 flex-shrink-0 text-xs font-medium text-[#0070AD] bg-[#eef6fb] hover:bg-[#e0f0fb] px-2.5 py-1 rounded-md transition-colors"
                    title={`Enforced by the ${g.skill} agent skill — view & download`}
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
                    <span className="text-[#0070AD]/60">Agent skill:</span>
                    {skillLabel(g.skill, a.department)}
                    <span className="text-[#0070AD]/50">· view &amp; download</span>
                  </button>
                )}
              </div>
              <Card className="overflow-hidden p-0">
                {g.rows.map((it) => {
                  const isOpen = open.has(it.id);
                  return (
                    <div key={it.id} className="border-b border-[#f5f5f5] last:border-0">
                      <div
                        className="flex items-start gap-2 px-4 py-2 hover:bg-[#fafafa] transition-colors duration-150 cursor-pointer"
                        onClick={() => toggle(it.id)}
                      >
                        <Chevron open={isOpen} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#171717]">{it.name}</div>
                          {!isOpen && (
                            <div className="text-xs text-[#a3a3a3] truncate">{it.description}</div>
                          )}
                        </div>
                        <div className="hidden sm:block w-44 flex-shrink-0 text-right text-xs text-[#525252] truncate">
                          {it.responsible ? it.responsible.roleName : (it.ownerRole ?? '—')}
                        </div>
                      </div>

                      {isOpen && (
                        <div className="bg-[#fafafa] border-t border-[#f5f5f5] px-4 py-3 pl-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* What it means — the group's higher-level summary,
                              then each of its standards as a bullet with its
                              own detail. */}
                          <div className="lg:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
                              What it means
                            </div>
                            <p className="text-sm text-[#171717]">{it.description}</p>
                            {/* Childless group = a single granular standard; show its
                                own test + evidence + appliers + skill. */}
                            {it.subs.length === 0 && (
                              <StandardMeta item={it} onViewSkill={setViewSkill} />
                            )}
                            {it.subs.length > 0 && (
                              <ul className="mt-2 space-y-2">
                                {it.subs.map((s) => (
                                  <li key={s.id} className="flex items-start gap-2">
                                    <span className="mt-[7px] w-1 h-1 rounded-full bg-[#a3a3a3] flex-shrink-0" />
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-[#171717]">
                                        {s.name}
                                      </div>
                                      <p className="text-xs text-[#525252]">{s.description}</p>
                                      <StandardMeta item={s} onViewSkill={setViewSkill} />
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {it.valueStreams.length > 0 && (
                              <div className="mt-3">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
                                  Applies to value streams
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {it.valueStreams.map((vs) => (
                                    <Chip
                                      as={Link}
                                      key={vs.id}
                                      to={`/overview?focus=${vs.id}`}
                                      className="hover:bg-[#eaeaea]"
                                      onClick={(e) => e.stopPropagation()}
                                      title={vs.domain ?? ''}
                                    >
                                      {vs.name}
                                    </Chip>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Responsible role */}
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
                              Responsible role
                            </div>
                            {it.responsible ? (
                              <div className="text-sm">
                                <Link
                                  to={`/roles/${it.responsible.roleId}`}
                                  className="text-[#171717] hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {it.responsible.roleName}
                                </Link>
                                {it.ownerRole && it.ownerRole !== it.responsible.roleName && (
                                  <span className="text-xs text-[#a3a3a3]"> ({it.ownerRole})</span>
                                )}
                                {it.responsible.roleLevel &&
                                  it.responsible.roleLevel !== 'Individual Contributor' && (
                                    <div className="text-xs text-[#a3a3a3] mt-0.5 flex items-center gap-1.5">
                                      <Chip>{it.responsible.roleLevel}</Chip>
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <div className="text-sm text-[#525252]">
                                {it.ownerRole ?? (
                                  <span className="text-[#a3a3a3] italic">Unassigned</span>
                                )}
                              </div>
                            )}
                            {it.relatedRole && it.relatedRole !== it.ownerRole && (
                              <div className="mt-2 text-xs text-[#a3a3a3]">
                                Accountable (governance): {it.relatedRole}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      {viewSkill && <SkillViewer skill={viewSkill} onClose={() => setViewSkill(null)} />}
    </div>
  );
}

// Surface a granular standard as an independently testable + applicable rule:
// the ordered verification steps, the evidence they leave, who applies it, and
// the tailored agent skill that enforces + tests it.
// Ordered plan keys split into labeled generic (pattern) and specific (this
// item) groups; numbering runs continuously across the two groups.
function PlanKeyList({ keys }: { keys: PlanKey[] }) {
  const generic = keys.filter((k) => k.generic);
  const specific = keys.filter((k) => !k.generic);
  const group = (label: string, rows: PlanKey[], start: number) =>
    rows.length > 0 && (
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8a94a0]">
          {label}
        </div>
        <ol start={start} className="text-xs text-[#525252] list-decimal pl-4 space-y-0.5">
          {rows.map((k, i) => (
            <li key={i}>{k.key}</li>
          ))}
        </ol>
      </div>
    );
  return (
    <div className="space-y-1">
      {group('Generic steps · pattern', generic, 1)}
      {group('Specific steps · this item', specific, generic.length + 1)}
    </div>
  );
}

function StandardMeta({
  item,
  onViewSkill,
}: {
  item: {
    id: string;
    plan: { checklist: PlanKey[]; testing: PlanKey[] } | null;
    agentSkill: string | null;
    appliers: { roleId: string; roleName: string }[];
  };
  onViewSkill: (skill: string) => void;
}) {
  const checklist = item.plan?.checklist ?? [];
  const testing = item.plan?.testing ?? [];
  if (!checklist.length && !testing.length && !item.appliers.length && !item.agentSkill)
    return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {checklist.length > 0 && (
        <div className="flex items-start gap-1.5">
          <span className="mt-px text-[9px] font-semibold uppercase tracking-[0.08em] text-[#047857] bg-[#ecfdf5] rounded px-1 py-px flex-shrink-0">
            Checklist
          </span>
          <PlanKeyList keys={checklist} />
        </div>
      )}
      {testing.length > 0 && (
        <div className="flex items-start gap-1.5">
          <span className="mt-px text-[9px] font-semibold uppercase tracking-[0.08em] text-[#0070AD] bg-[#eef6fb] rounded px-1 py-px flex-shrink-0">
            Testing
          </span>
          <PlanKeyList keys={testing} />
        </div>
      )}
      {(checklist.length > 0 || testing.length > 0) && (
        <Link
          to={`/work-library?type=standard&id=${item.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-block text-[11px] font-medium text-[#2563eb] hover:underline"
        >
          Fill in values in the Work library ↗
        </Link>
      )}
      {item.appliers.length > 0 && (
        <div className="flex items-start gap-1.5">
          <span className="mt-px text-[9px] font-semibold uppercase tracking-[0.08em] text-[#b45309] bg-[#fffbeb] rounded px-1 py-px flex-shrink-0">
            Applied by
          </span>
          <div className="flex flex-wrap gap-1">
            {item.appliers.map((a) => (
              <Chip
                as={Link}
                key={a.roleId}
                to={`/roles/${a.roleId}`}
                className="hover:bg-[#eaeaea]"
                onClick={(e) => e.stopPropagation()}
              >
                {a.roleName}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {item.agentSkill && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewSkill(item.agentSkill!);
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#0070AD] bg-[#eef6fb] hover:bg-[#e0f0fb] px-2 py-0.5 rounded-md transition-colors"
          title="Tailored agent skill for this standard — view & download"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" />
          </svg>
          Agent skill · view &amp; download
        </button>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        'flex-shrink-0 mt-1 text-[#a3a3a3] transition-transform duration-150 ' +
        (open ? 'rotate-90' : '')
      }
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
