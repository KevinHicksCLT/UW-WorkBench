import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { useHeaderBreadcrumbSlot } from '../../lib/breadcrumbs';
import PageHeader from '../../components/PageHeader';
import RoleDrawer from '../../components/RoleDrawer';
import { Card, Chip, ErrorMessage, LoadingState } from '../../components/ui';

// ── Box drill-down: Divisions → Teams (departments) → Roles ─────────────────
// The org spine is L2 Division → L3 Department → L4 Role. We start with every
// division as a box (grouped by its CEO-facing segment), drill into a
// division's teams, then a team's roles. Clicking a role opens the RoleDrawer
// slide-over (the standalone role detail page was retired into it).

type RoleLite = { id: string; name: string; roleLevel: string | null; roleFamily: string | null; valueStreamCount: number };
type Dept = { id: string; name: string; roles: RoleLite[]; roleCount: number };
type Division = { id: string; name: string; segment: string; departments: Dept[]; looseRoles: RoleLite[]; roleCount: number };
type Segment = { name: string; divisions: Division[]; divisionCount: number; roleCount: number };
type OrgData = { company: { id: string; name: string }; totals: Record<string, number>; segments: Segment[] };

const LOOSE = '__loose'; // sentinel department id for roles reporting directly to a division

export default function OrgTable() {
  const { data, error, loading } = useApi<OrgData>('/explorer/org-table');
  const [divId, setDivId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null); // null = none selected; LOOSE = direct roles
  const [roleId, setRoleId] = useState<string | null>(null); // open role drawer
  const [query, setQuery] = useState('');

  // Deep-link: `?view=departments` (from the home "Departments" footprint tile)
  // lands on a flat grid of every department across divisions. Lift it into
  // state and clear the param so it doesn't linger or re-fire.
  const [searchParams, setSearchParams] = useSearchParams();
  const [deptOverview, setDeptOverview] = useState(false);
  useEffect(() => {
    if (searchParams.get('view') !== 'departments') return;
    setDeptOverview(true);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const allDivisions = useMemo(() => (data ? data.segments.flatMap((s) => s.divisions) : []), [data]);

  // Every department, flattened with its parent division/segment — for the
  // departments-overview grid reached via the home page.
  const allDepartments = useMemo(() => {
    if (!data) return [] as (Dept & { divisionId: string; divisionName: string; segment: string })[];
    const out: (Dept & { divisionId: string; divisionName: string; segment: string })[] = [];
    for (const seg of data.segments) for (const dv of seg.divisions) for (const dp of dv.departments) {
      out.push({ ...dp, divisionId: dv.id, divisionName: dv.name, segment: seg.name });
    }
    return out;
  }, [data]);

  // Flattened roles (with their division/department context) for the search bar —
  // scope is roles only, not value streams / other entities.
  const allRoles = useMemo(() => {
    if (!data) return [] as (RoleLite & { divisionId: string; divisionName: string; departmentId: string | null; departmentName: string | null; segment: string })[];
    const out: (RoleLite & { divisionId: string; divisionName: string; departmentId: string | null; departmentName: string | null; segment: string })[] = [];
    for (const seg of data.segments) {
      for (const dv of seg.divisions) {
        for (const dp of dv.departments) {
          for (const r of dp.roles) out.push({ ...r, divisionId: dv.id, divisionName: dv.name, departmentId: dp.id, departmentName: dp.name, segment: seg.name });
        }
        for (const r of dv.looseRoles) out.push({ ...r, divisionId: dv.id, divisionName: dv.name, departmentId: null, departmentName: null, segment: seg.name });
      }
    }
    return out;
  }, [data]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? allRoles.filter((r) => [r.name, r.roleFamily, r.roleLevel, r.departmentName, r.divisionName, r.segment].some((v) => v?.toLowerCase().includes(q))) : []),
    [q, allRoles],
  );
  const division = divId ? allDivisions.find((d) => d.id === divId) ?? null : null;
  const dept = division && deptId && deptId !== LOOSE ? division.departments.find((d) => d.id === deptId) ?? null : null;
  const rolesInView = deptId === LOOSE ? division?.looseRoles ?? [] : dept?.roles ?? [];

  // While drilled into a division, the state-driven drill breadcrumb claims
  // the global header bar (same pattern as the map views) — no in-page crumb.
  const headerSlot = useHeaderBreadcrumbSlot(division != null);

  const goDivisions = () => { setDivId(null); setDeptId(null); setRoleId(null); };
  const goTeams = () => { setDeptId(null); setRoleId(null); };
  // Open a role found via search — jump into its team so the surrounding context
  // resolves normally behind the drawer.
  const openRoleFromSearch = (r: { id: string; divisionId: string; departmentId: string | null }) => {
    setDivId(r.divisionId); setDeptId(r.departmentId ?? LOOSE); setRoleId(r.id);
  };

  if (loading) return <LoadingState baseClassName="text-slate-500" message="Loading roles…" />;
  if (error) return <ErrorMessage baseClassName="text-red-600">{error}</ErrorMessage>;
  if (!data) return null;

  const t = data.totals;
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Organization', onClick: divId ? goDivisions : undefined }];
  if (division) crumbs.push({ label: division.name, onClick: deptId ? goTeams : undefined });
  if (deptId) crumbs.push({ label: deptId === LOOSE ? 'Direct to division' : dept?.name ?? '…' });

  return (
    <div>
      {division && headerSlot && createPortal(<Crumbs crumbs={crumbs} />, headerSlot)}
      {!division ? (
        // ── Level 1: all divisions, grouped by segment ───────────────────────
        <>
          <PageHeader
            title={deptOverview ? 'Departments' : 'Organization'}
            subtitle={deptOverview
              ? `${t.departments} teams across ${t.divisions} divisions`
              : `${t.divisions} divisions · ${t.departments} teams · ${t.roles} roles`}
          />
          <RoleSearch value={query} onChange={setQuery} />
          {q ? (
            // ── Search results: matching roles (across all divisions/teams) ──────
            matches.length === 0 ? (
              <Card className="text-sm text-slate-500 italic">No roles match “{query.trim()}”.</Card>
            ) : (
              <section className="mb-8">
                <div className="text-xs text-[#a3a3a3] mb-3">{matches.length} role{matches.length === 1 ? '' : 's'} matching “{query.trim()}”</div>
                <Grid>
                  {matches.map((r) => (
                    <Box key={r.id} title={r.name}
                      tag={r.roleLevel && r.roleLevel !== 'Individual Contributor' ? <Chip>{r.roleLevel}</Chip> : undefined}
                      meta={[r.divisionName, r.departmentName].filter(Boolean).join(' · ')}
                      onClick={() => openRoleFromSearch(r)} />
                  ))}
                </Grid>
              </section>
            )
          ) : deptOverview ? (
            // ── Departments overview: every team across divisions ────────────────
            <Grid>
              {allDepartments.map((dp) => (
                <Box key={dp.id} title={dp.name}
                  meta={`${dp.divisionName} · ${dp.roleCount} roles`}
                  onClick={() => { setDivId(dp.divisionId); setDeptId(dp.id); }} />
              ))}
            </Grid>
          ) : data.segments.map((seg) => (
            <section key={seg.name} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-[#171717]">{seg.name}</h2>
                <span className="text-xs text-[#a3a3a3]">{seg.divisionCount} divisions · {seg.roleCount} roles</span>
              </div>
              <Grid>
                {seg.divisions.map((dv) => (
                  <Box key={dv.id} title={dv.name} meta={`${dv.roleCount} roles`} onClick={() => setDivId(dv.id)} />
                ))}
              </Grid>
            </section>
          ))}
        </>
      ) : !deptId ? (
        // ── Level 2: teams (departments) within a division ───────────────────
        <>
          <PageHeader title={division.name} subtitle={`${division.departments.length} teams · ${division.roleCount} roles`} />
          {division.departments.length === 0 && division.looseRoles.length === 0 ? (
            <Card className="text-sm text-slate-500 italic">No teams or roles in this division.</Card>
          ) : (
            <Grid>
              {division.departments.map((dp) => (
                <Box key={dp.id} title={dp.name} meta={`${dp.roleCount} roles`} onClick={() => setDeptId(dp.id)} />
              ))}
              {division.looseRoles.length > 0 && (
                <Box title="Direct to division" tag={<Chip>No team</Chip>}
                  meta={`${division.looseRoles.length} roles`} onClick={() => setDeptId(LOOSE)} />
              )}
            </Grid>
          )}
        </>
      ) : (
        // ── Level 3: roles within a team — clicking opens the role drawer ────
        <>
          <PageHeader title={deptId === LOOSE ? 'Direct to division' : dept?.name ?? ''} subtitle={`${rolesInView.length} roles · ${division.name}`} />
          {rolesInView.length === 0 ? (
            <Card className="text-sm text-slate-500 italic">No roles here.</Card>
          ) : (
            <Grid>
              {rolesInView.map((r) => (
                <Box key={r.id} title={r.name}
                  tag={r.roleLevel && r.roleLevel !== 'Individual Contributor' ? <Chip>{r.roleLevel}</Chip> : undefined}
                  meta={`${r.valueStreamCount} value streams`}
                  onClick={() => setRoleId(r.id)} />
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Role full detail — slides over the drill-down in place. */}
      {roleId && <RoleDrawer roleId={roleId} onClose={() => setRoleId(null)} />}
    </div>
  );
}

// ── Shared UI ───────────────────────────────────────────────────────────────
function RoleSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mb-6 max-w-md">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] pointer-events-none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search roles…"
        aria-label="Search roles"
        className="w-full rounded-lg border border-[#eaeaea] bg-white pl-9 pr-9 py-2 text-sm text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#d4d4d4] focus:ring-2 focus:ring-[#f5f8ff] transition-colors duration-150"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>;
}

function Box({ title, meta, tag, onClick }: { title: string; meta: string; tag?: ReactNode; onClick: () => void }) {
  return (
    <Card as="button" onClick={onClick}
      className="text-left flex flex-col gap-2 group hover:border-[#d4d4d4] hover:shadow-md transition-all duration-150">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[#171717] leading-snug">{title}</span>
        {tag}
      </div>
      <div className="text-xs text-[#a3a3a3]">{meta}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-[#a3a3a3] group-hover:text-[#525252]">
        Open <Chevron />
      </div>
    </Card>
  );
}

// Same chevron + dark-pill + clear-focus treatment as the Value Streams map
// breadcrumb (see MapCanvas.tsx / .focus-crumb-* in index.css). The ✕ resets to
// the Roles base via the first crumb's handler (goDivisions).
// Rendered into the global header bar (via portal), not in the page body.
function Crumbs({ crumbs }: { crumbs: { label: string; onClick?: () => void }[] }) {
  const clear = crumbs[0]?.onClick;
  return (
    <nav className="flex items-center flex-wrap" aria-label="Breadcrumb">
      {crumbs.map((b, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="inline-flex items-center">
            {i > 0 && <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>}
            {isLast ? (
              <span className="focus-crumb-active">{b.label}</span>
            ) : b.onClick ? (
              <button onClick={b.onClick} className="focus-crumb-ancestor">{b.label}</button>
            ) : (
              <span className="focus-crumb-ancestor" style={{ cursor: 'default' }}>{b.label}</span>
            )}
          </span>
        );
      })}
      {clear && (
        <button
          onClick={clear}
          aria-label="Clear focus"
          style={{
            marginLeft: 6, width: 22, height: 22, borderRadius: 6,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#a3a3a3',
            background: 'transparent', border: '1px solid #eaeaea', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      )}
    </nav>
  );
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
