import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_HEX } from '../viz/model';
import { api } from '../lib/api';
import MetricsSidebar, { MetricsDrawer, type Dashboard, type MetricSection } from './MetricsSidebar';

// Org List view — the WHOLE organization as a fully-exploded outline, the mirror
// image of the Value Streams list (ListExplorer) but on the ORG spine:
//   Company › Segment › Division › Department › Role › Person
// The tree arrives pre-built from GET /explorer/org-table (one request); people
// are the only lazy part — they load per role the first time it's expanded.
// Clicking any node pops the SAME right-hand MetricsSidebar the map/value-stream
// list use. The Table view (OrgTable) is untouched.

// ── Tree shape (from GET /explorer/org-table) ─────────────────────────────────
type Part = { valueStreamId: string; valueStreamName: string; domain: string | null; participationType: string; l3: string | null; l4: string | null };
type RoleNode = { id: string; name: string; roleLevel: string | null; roleFamily: string | null; peopleCount: number; valueStreamCount: number; participations: Part[] };
type DeptNode = { id: string; name: string; roles: RoleNode[]; roleCount: number; peopleCount: number };
type DivNode = { id: string; name: string; segment: string; departments: DeptNode[]; looseRoles: RoleNode[]; roleCount: number; peopleCount: number };
type SegNode = { name: string; divisions: DivNode[]; divisionCount: number; roleCount: number; peopleCount: number };
type OrgData = {
  company: { id: string; name: string };
  totals: { segments: number; divisions: number; departments: number; roles: number; people: number };
  segments: SegNode[];
};

// A person under a role (from GET /explorer/role/:id/people).
type PersonLite = { id: string; name: string; title: string | null; region: string | null; employmentType: string; vendor: string | null; allocationPct: number; isPrimary: boolean };

// Context lets any node open the right-hand metrics panel without prop-drilling.
type MetricsCtxValue = { open: (level: string, id: string) => void; activeKey: string | null };
const MetricsCtx = createContext<MetricsCtxValue>({ open: () => {}, activeKey: null });
const useMetrics = () => useContext(MetricsCtx);

// ── Row chrome (shared by every node) ─────────────────────────────────────────
const Caret = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} className="text-[#a3a3a3]" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const Meta = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">{children}</span>
);

function Row({
  depth, leaf, open, onClick, accent, num, label, meta, muted, strong, selected,
}: {
  depth: number; leaf?: boolean; open?: boolean; onClick?: () => void;
  accent?: string; num?: number; label: string; meta?: React.ReactNode; muted?: boolean; strong?: boolean; selected?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{ paddingLeft: depth * 18 + 10 }}
      className={'flex items-center gap-2 py-2 pr-3 border-b border-[#f5f5f5] last:border-0 transition-colors duration-150 '
        + (selected ? 'bg-[#f5f8ff] ' : '') + (clickable ? 'cursor-pointer hover:bg-[#fafafa]' : '')}
    >
      <span className="w-3.5 flex-shrink-0 flex items-center">{!leaf && <Caret open={!!open} />}</span>
      {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />}
      {num != null && <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#f5f5f5] text-[10px] font-semibold text-[#525252] tnum flex-shrink-0">{num}</span>}
      <span className={'truncate flex-1 ' + (strong ? 'text-sm font-semibold text-[#171717]' : muted ? 'text-[13px] text-[#525252]' : 'text-sm text-[#171717]')}>{label}</span>
      {meta}
    </div>
  );
}
const InfoRow = ({ depth, text }: { depth: number; text: string }) => (
  <div style={{ paddingLeft: depth * 18 + 32 }} className="py-2 pr-3 text-[12px] text-[#a3a3a3] italic border-b border-[#f5f5f5]">{text}</div>
);

// ── Nodes ─────────────────────────────────────────────────────────────────────
// A single role: clicking opens its dashboard AND expands to the people in it.
// People are fetched lazily the first time the role opens.
function RoleNodeC({ role, depth }: { role: RoleNode; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<PersonLite[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || people !== null || role.peopleCount === 0) return;
    let cancelled = false; setLoading(true);
    api.get(`/explorer/role/${role.id}/people`)
      .then((d: { people: PersonLite[] }) => { if (!cancelled) setPeople(d.people ?? []); })
      .catch(() => { if (!cancelled) setPeople([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, people, role.id, role.peopleCount]);

  const levelTag = role.roleLevel && role.roleLevel !== 'Individual Contributor' ? role.roleLevel : null;
  return (
    <>
      <Row depth={depth} leaf={role.peopleCount === 0} open={open} muted selected={activeKey === `role:${role.id}`}
        onClick={() => { if (role.peopleCount) setOpen((o) => !o); openMetrics('role', role.id); }}
        label={role.name}
        meta={<Meta>{levelTag ? `${levelTag} · ` : ''}{role.peopleCount} {role.peopleCount === 1 ? 'person' : 'people'}</Meta>} />
      {open && (
        loading ? <InfoRow depth={depth + 1} text="Loading people…" />
        : (people && people.length > 0)
          ? people.map((p) => <PersonRow key={p.id} person={p} depth={depth + 1} />)
          : <InfoRow depth={depth + 1} text="No people assigned." />
      )}
    </>
  );
}

function PersonRow({ person, depth }: { person: PersonLite; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const employment = person.employmentType === 'badged' ? null : (person.vendor ?? person.employmentType);
  return (
    <Row depth={depth} leaf selected={activeKey === `person:${person.id}`}
      onClick={() => openMetrics('person', person.id)}
      label={person.name}
      meta={<Meta>{[person.title, employment, person.region].filter(Boolean).join(' · ')}</Meta>} />
  );
}

function DeptNodeC({ dept, depth }: { dept: DeptNode; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(true);
  return (
    <>
      <Row depth={depth} leaf={dept.roles.length === 0} open={open} selected={activeKey === `department:${dept.id}`}
        onClick={() => { if (dept.roles.length) setOpen((o) => !o); openMetrics('department', dept.id); }}
        label={dept.name} meta={<Meta>{dept.roleCount} roles · {dept.peopleCount} people</Meta>} />
      {open && (dept.roles.length > 0
        ? dept.roles.map((r) => <RoleNodeC key={r.id} role={r} depth={depth + 1} />)
        : <InfoRow depth={depth + 1} text="No roles in this team." />)}
    </>
  );
}

function DivNodeC({ div, depth, accent }: { div: DivNode; depth: number; accent: string }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(true);
  const hasChildren = div.departments.length > 0 || div.looseRoles.length > 0;
  return (
    <>
      <Row depth={depth} leaf={!hasChildren} open={open} accent={accent} selected={activeKey === `division:${div.id}`}
        onClick={() => { if (hasChildren) setOpen((o) => !o); openMetrics('division', div.id); }}
        label={div.name} meta={<Meta>{div.departments.length} teams · {div.roleCount} roles · {div.peopleCount} people</Meta>} />
      {open && (
        <>
          {div.departments.map((d) => <DeptNodeC key={d.id} dept={d} depth={depth + 1} />)}
          {div.looseRoles.length > 0 && (
            <DeptNodeC
              key={`__loose:${div.id}`}
              dept={{ id: `__loose:${div.id}`, name: 'Direct to division', roles: div.looseRoles, roleCount: div.looseRoles.length, peopleCount: div.looseRoles.reduce((a, r) => a + r.peopleCount, 0) }}
              depth={depth + 1}
            />
          )}
          {!hasChildren && <InfoRow depth={depth + 1} text="No teams or roles." />}
        </>
      )}
    </>
  );
}

function SegmentNodeC({ seg, depth }: { seg: SegNode; depth: number }) {
  const { open: openMetrics, activeKey } = useMetrics();
  const [open, setOpen] = useState(true);
  const accent = DOMAIN_HEX[seg.name] ?? '#94a3b8';
  return (
    <>
      <Row depth={depth} open={open} accent={accent} strong selected={activeKey === `domain:${seg.name}`}
        onClick={() => { setOpen((o) => !o); openMetrics('domain', seg.name); }}
        label={seg.name} meta={<Meta>{seg.divisionCount} divisions</Meta>} />
      {open && seg.divisions.map((d) => <DivNodeC key={d.id} div={d} depth={depth + 1} accent={accent} />)}
    </>
  );
}

// High-level overview banner — org totals across the top. Recomputes from the
// CURRENTLY-VISIBLE (filtered) tree, so the depth metrics track the active facets.
function OverviewBanner({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <div className="rounded-xl border border-[#eaeaea] bg-gradient-to-r from-[#fafafa] to-white px-5 py-4 mb-4 flex items-center justify-between gap-x-4">
      {stats.map((s, i) => (
        <div key={s.label} className="flex items-center gap-4 min-w-0">
          {i > 0 && <span className="h-9 w-px bg-[#eaeaea] flex-shrink-0" aria-hidden="true" />}
          <div className="text-center">
            <div className="text-2xl font-bold text-[#171717] leading-none tnum">{s.value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mt-1">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Facet filter bar — segment + division dropdowns. Empty set = show all. ─────
type FilterOption = { id: string; name: string; accent?: string };

function FilterDropdown({ label, options, selected, onToggle }: {
  label: string;
  options: FilterOption[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const count = options.reduce((n, o) => (selected.has(o.id) ? n + 1 : n), 0);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 '
          + (count > 0 ? 'border-[#171717] text-[#171717]' : 'border-[#eaeaea] text-[#525252] hover:border-[#d4d4d4] hover:text-[#171717]')}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">{label}</span>
        <span>{count > 0 ? `${count} selected` : 'All'}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 min-w-[220px] max-h-[300px] overflow-auto rounded-lg border border-[#eaeaea] bg-white shadow-lg p-1">
          {options.length === 0 ? (
            <div className="px-2.5 py-2 text-[12px] text-[#a3a3a3]">No options</div>
          ) : options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-[#fafafa]">
              <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} className="accent-[#171717]" />
              {o.accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.accent }} />}
              <span className="text-[13px] text-[#171717] truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgListExplorer() {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Facet filters: empty set = no constraint (show all).
  const [segFilter, setSegFilter] = useState<Set<string>>(new Set());
  const [divFilter, setDivFilter] = useState<Set<string>>(new Set());

  // Right-hand metrics panel — identical to the map / value-stream list.
  const [base, setBase] = useState<{ level: string; id: string } | null>(null);
  const [ovStack, setOvStack] = useState<{ level: string; id: string }[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [drawerSection, setDrawerSection] = useState<MetricSection | null>(null);
  const target = ovStack.length ? ovStack[ovStack.length - 1] : base;

  const openMetrics = (level: string, id: string) => { setBase({ level, id }); setOvStack([]); };
  const onDrill = (level: string, id: string) => setOvStack((s) => [...s, { level, id }]);
  const onBack = () => setOvStack((s) => s.slice(0, -1));
  const closeMetrics = () => { setBase(null); setOvStack([]); };

  useEffect(() => {
    let cancelled = false; setLoading(true);
    api.get('/explorer/org-table')
      .then((d: OrgData) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message ?? 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!target) { setDash(null); return; }
    let cancelled = false; setDashLoading(true); setDash(null);
    const url = target.id ? `/explorer/roles/${target.level}/${encodeURIComponent(target.id)}` : `/explorer/roles/${target.level}`;
    api.get(url)
      .then((d: Dashboard) => { if (!cancelled) setDash(d); })
      .catch(() => { if (!cancelled) setDash(null); })
      .finally(() => { if (!cancelled) setDashLoading(false); });
    return () => { cancelled = true; };
  }, [target?.level, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Changing the focused entity makes the drawer's snapshot stale — close it.
  useEffect(() => { setDrawerSection(null); }, [target?.level, target?.id]);

  // Visible segments/divisions after applying the facet filters.
  const visibleSegments = useMemo(() => {
    return (data?.segments ?? [])
      .filter((s) => segFilter.size === 0 || segFilter.has(s.name))
      .map((s) => ({ ...s, divisions: s.divisions.filter((d) => divFilter.size === 0 || divFilter.has(d.id)) }))
      .filter((s) => s.divisions.length > 0);
  }, [data, segFilter, divFilter]);

  // Banner depth metrics — recomputed from the visible (filtered) tree.
  const stats = useMemo(() => {
    let divisions = 0, departments = 0, roles = 0, people = 0;
    for (const s of visibleSegments) for (const d of s.divisions) {
      divisions++;
      departments += d.departments.length;
      roles += d.roleCount;
      people += d.peopleCount;
    }
    return [
      { label: 'Domains', value: visibleSegments.length },
      { label: 'Divisions', value: divisions },
      { label: 'Departments', value: departments },
      { label: 'Roles', value: roles },
      { label: 'People', value: people },
    ];
  }, [visibleSegments]);

  // Facet options.
  const segmentOptions: FilterOption[] = (data?.segments ?? []).map((s) => ({ id: s.name, name: s.name, accent: DOMAIN_HEX[s.name] }));
  const divisionOptions: FilterOption[] = (data?.segments ?? [])
    .filter((s) => segFilter.size === 0 || segFilter.has(s.name))
    .flatMap((s) => s.divisions.map((d) => ({ id: d.id, name: d.name, accent: DOMAIN_HEX[s.name] })));

  const toggleSeg = (id: string) => setSegFilter((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDiv = (id: string) => setDivFilter((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clear = () => { setSegFilter(new Set()); setDivFilter(new Set()); };
  const anyFilter = segFilter.size > 0 || divFilter.size > 0;

  const [rootOpen, setRootOpen] = useState(true);
  const activeKey = base ? `${base.level}:${base.id}` : null;
  const name = data?.company.name ?? 'Enterprise';

  return (
    <MetricsCtx.Provider value={{ open: openMetrics, activeKey }}>
      {/* Side-by-side: tree scrolls, metrics panel sits beside it (no overlay). */}
      <div className="h-full flex relative">
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 pt-14 pb-5">
            {loading ? (
              <div className="text-sm text-[#a3a3a3] animate-pulse py-8 text-center">Loading organization…</div>
            ) : error ? (
              <div className="text-sm text-[#be123c] py-8 text-center">{error}</div>
            ) : (
              <>
                <OverviewBanner stats={stats} />
                <div className="rounded-xl border border-[#eaeaea] bg-white px-4 py-3 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FilterDropdown label="Domain" options={segmentOptions} selected={segFilter} onToggle={toggleSeg} />
                    <FilterDropdown label="Division" options={divisionOptions} selected={divFilter} onToggle={toggleDiv} />
                    {anyFilter && (
                      <button onClick={clear} className="ml-auto text-[11px] font-medium text-[#1d4ed8] hover:underline">Clear filters</button>
                    )}
                  </div>
                </div>

                <div className="card p-0 overflow-hidden">
                  {/* Company root */}
                  <Row depth={0} open={rootOpen} selected={activeKey === 'company:'} strong label={name} meta={<Meta>{visibleSegments.length} domains</Meta>}
                    onClick={() => { setRootOpen((o) => !o); openMetrics('company', ''); }} />
                  {rootOpen && (visibleSegments.length > 0
                    ? visibleSegments.map((seg) => <SegmentNodeC key={seg.name} seg={seg} depth={1} />)
                    : <InfoRow depth={1} text="No divisions match the current filters." />)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right-hand metrics panel — same component as the map. */}
        {base && (
          <MetricsSidebar dash={dash} loading={dashLoading} onDrill={onDrill} onBack={ovStack.length ? onBack : undefined} onClose={closeMetrics} onViewAll={setDrawerSection} />
        )}

        {/* Comprehensive "view all" drawer — overlays the panel. */}
        {drawerSection && (
          <MetricsDrawer
            section={drawerSection}
            contextTitle={dash?.title ?? ''}
            onClose={() => setDrawerSection(null)}
            onDrill={onDrill}
          />
        )}
      </div>
    </MetricsCtx.Provider>
  );
}
