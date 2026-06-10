import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import { PARTICIPATION_CLASS } from '../lib/format';

// ── Box drill-down: Divisions → Teams (departments) → Roles → Role detail ──
// The org spine is L2 Division → L3 Department → L4 Role → L5 Person. We start
// with every division as a box (grouped by its CEO-facing segment), drill into a
// division's teams, then a team's roles, then a single role's I/O & deliverables,
// responsibilities, and the people who sit in it.

type RoleLite = { id: string; name: string; roleLevel: string | null; roleFamily: string | null; peopleCount: number; valueStreamCount: number };
type Dept = { id: string; name: string; roles: RoleLite[]; roleCount: number; peopleCount: number };
type Division = { id: string; name: string; segment: string; departments: Dept[]; looseRoles: RoleLite[]; roleCount: number; peopleCount: number };
type Segment = { name: string; divisions: Division[]; divisionCount: number; roleCount: number; peopleCount: number };
type OrgData = { company: { id: string; name: string }; totals: Record<string, number>; segments: Segment[] };

const LOOSE = '__loose'; // sentinel department id for roles reporting directly to a division

export default function OrgTable() {
  const { data, error, loading } = useApi<OrgData>('/explorer/org-table');
  const [divId, setDivId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null); // null = none selected; LOOSE = direct roles
  const [roleId, setRoleId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
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
  // scope is roles only, not people / value streams / other entities.
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

  // Deep-link: `?role=<legacy role id>` (role links across the app — Work,
  // External, Standards, the map — land here now that the standalone role page
  // is gone). Open the role inside its own hierarchy and clear the param.
  useEffect(() => {
    const wanted = searchParams.get('role');
    if (!wanted || allRoles.length === 0) return;
    const match = allRoles.find((r) => r.id === wanted);
    if (match) { setDivId(match.divisionId); setDeptId(match.departmentId ?? LOOSE); setRoleId(match.id); setPersonId(null); }
    const next = new URLSearchParams(searchParams);
    next.delete('role');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, allRoles]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? allRoles.filter((r) => [r.name, r.roleFamily, r.roleLevel, r.departmentName, r.divisionName, r.segment].some((v) => v?.toLowerCase().includes(q))) : []),
    [q, allRoles],
  );
  const division = divId ? allDivisions.find((d) => d.id === divId) ?? null : null;
  const dept = division && deptId && deptId !== LOOSE ? division.departments.find((d) => d.id === deptId) ?? null : null;
  const rolesInView = deptId === LOOSE ? division?.looseRoles ?? [] : dept?.roles ?? [];

  const goDivisions = () => { setDivId(null); setDeptId(null); setRoleId(null); setPersonId(null); };
  const goTeams = () => { setDeptId(null); setRoleId(null); setPersonId(null); };
  const goRoles = () => { setRoleId(null); setPersonId(null); };
  // Open a role found via search — jump straight into it within its own hierarchy
  // so breadcrumbs and the surrounding team/role context resolve normally.
  const openRoleFromSearch = (r: { id: string; divisionId: string; departmentId: string | null }) => {
    setDivId(r.divisionId); setDeptId(r.departmentId ?? LOOSE); setRoleId(r.id); setPersonId(null);
  };

  if (loading) return <div className="text-slate-500">Loading roles…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return null;

  const t = data.totals;
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Organization', onClick: (divId || roleId) ? goDivisions : undefined }];
  if (division) crumbs.push({ label: division.name, onClick: deptId ? goTeams : undefined });
  if (deptId) crumbs.push({ label: deptId === LOOSE ? 'Direct to division' : dept?.name ?? '…', onClick: roleId ? goRoles : undefined });

  // ── Level 4–5: a single role, and the people in it ───────────────────────
  if (roleId) {
    if (personId) {
      const roleName = rolesInView.find((r) => r.id === roleId)?.name ?? 'Role';
      return <PersonDetailView personId={personId} crumbs={[...crumbs, { label: roleName, onClick: () => setPersonId(null) }]} />;
    }
    return <RoleDetailView roleId={roleId} crumbs={crumbs} onSelectPerson={setPersonId} />;
  }

  return (
    <div>
      {division && <Crumbs crumbs={crumbs} />}
      {!division ? (
        // ── Level 1: all divisions, grouped by segment ───────────────────────
        <>
          <PageHeader
            title={deptOverview ? 'Departments' : 'Organization'}
            subtitle={deptOverview
              ? `${t.departments} teams across ${t.divisions} divisions`
              : `${t.divisions} divisions · ${t.departments} teams · ${t.roles} roles · ${t.people} people`}
          />
          <RoleSearch value={query} onChange={setQuery} />
          {q ? (
            // ── Search results: matching roles (across all divisions/teams) ──────
            matches.length === 0 ? (
              <div className="card text-sm text-slate-500 italic">No roles match “{query.trim()}”.</div>
            ) : (
              <section className="mb-8">
                <div className="text-xs text-[#a3a3a3] mb-3">{matches.length} role{matches.length === 1 ? '' : 's'} matching “{query.trim()}”</div>
                <Grid>
                  {matches.map((r) => (
                    <Box key={r.id} title={r.name}
                      tag={r.roleLevel && r.roleLevel !== 'Individual Contributor' ? <span className="chip-soft">{r.roleLevel}</span> : undefined}
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
                  meta={`${dp.divisionName} · ${dp.roleCount} roles · ${dp.peopleCount} people`}
                  onClick={() => { setDivId(dp.divisionId); setDeptId(dp.id); }} />
              ))}
            </Grid>
          ) : data.segments.map((seg) => (
            <section key={seg.name} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-[#171717]">{seg.name}</h2>
                <span className="text-xs text-[#a3a3a3]">{seg.divisionCount} divisions · {seg.roleCount} roles · {seg.peopleCount} people</span>
              </div>
              <Grid>
                {seg.divisions.map((dv) => (
                  <Box key={dv.id} title={dv.name} meta={`${dv.roleCount} roles · ${dv.peopleCount} people`} onClick={() => setDivId(dv.id)} />
                ))}
              </Grid>
            </section>
          ))}
        </>
      ) : !deptId ? (
        // ── Level 2: teams (departments) within a division ───────────────────
        <>
          <PageHeader hideBreadcrumb title={division.name} subtitle={`${division.departments.length} teams · ${division.roleCount} roles · ${division.peopleCount} people`} />
          {division.departments.length === 0 && division.looseRoles.length === 0 ? (
            <div className="card text-sm text-slate-500 italic">No teams or roles in this division.</div>
          ) : (
            <Grid>
              {division.departments.map((dp) => (
                <Box key={dp.id} title={dp.name} meta={`${dp.roleCount} roles · ${dp.peopleCount} people`} onClick={() => setDeptId(dp.id)} />
              ))}
              {division.looseRoles.length > 0 && (
                <Box title="Direct to division" tag={<span className="chip-soft">No team</span>}
                  meta={`${division.looseRoles.length} roles`} onClick={() => setDeptId(LOOSE)} />
              )}
            </Grid>
          )}
        </>
      ) : (
        // ── Level 3: roles within a team ─────────────────────────────────────
        <>
          <PageHeader hideBreadcrumb title={deptId === LOOSE ? 'Direct to division' : dept?.name ?? ''} subtitle={`${rolesInView.length} roles · ${division.name}`} />
          {rolesInView.length === 0 ? (
            <div className="card text-sm text-slate-500 italic">No roles here.</div>
          ) : (
            <Grid>
              {rolesInView.map((r) => (
                <Box key={r.id} title={r.name}
                  tag={r.roleLevel && r.roleLevel !== 'Individual Contributor' ? <span className="chip-soft">{r.roleLevel}</span> : undefined}
                  meta={`${r.peopleCount} people · ${r.valueStreamCount} value streams`}
                  onClick={() => setRoleId(r.id)} />
              ))}
            </Grid>
          )}
        </>
      )}
    </div>
  );
}

// ── Level 4: role detail — I/O & deliverables, responsibilities, users ──────
type Person = { id: string; name: string; title: string | null; region: string | null; employmentType: string; vendor: string | null; allocationPct: number; isPrimary: boolean };
type RoleParticipation = { valueStreamId: string; valueStreamName: string; participationType: string; subStream: string | null; inputs: string | null; outputs: string | null };
type Grouped = { category: string; items: string[] };
// Lowest-level, role-resolved I/O (one row per value stream + L4 sub-process) and
// process tasks — supplied by the roles route from the I/O inventory + L5 steps.
type ServerIoRow = { valueStreamId: string; valueStreamName: string; domain: string | null; l3: string | null; l4: string | null; inputs: string[]; deliverables: string[] };
type ProcTask = { valueStreamId: string; valueStreamName: string; l3: string | null; l4: string | null; stepNumber: number; name: string; relation: 'Lead' | 'Support'; outputs: string | null };
type RoleDetailData = {
  id: string; name: string; roleFamily: string | null; roleLevel: string | null;
  division?: { id: string; name: string }; department?: { id: string; name: string };
  participation: RoleParticipation[]; people: Person[]; responsibilities: Grouped[];
  ioRows?: ServerIoRow[]; deliverableCount?: number; inputCount?: number; processTasks?: ProcTask[];
};

function RoleDetailView({ roleId, crumbs, onSelectPerson }: { roleId: string; crumbs: { label: string; onClick?: () => void }[]; onSelectPerson: (id: string) => void }) {
  const { data: r, error, loading } = useApi<RoleDetailData>(`/roles/${roleId}`);

  // Inputs & deliverables, related per (value stream, sub-process), at the LOWEST
  // level. Prefer the server's role-resolved I/O inventory (one row per L4
  // sub-process); fall back to the coarse value-stream participation I/O for roles
  // the inventory doesn't tag. "Outputs" and "deliverables" are the same thing, so
  // they show once — as deliverables — paired with the inputs that feed them.
  const ioRows = useMemo(() => {
    if (!r) return [] as { vsId: string; vsName: string; sub: string | null; inputs: string[]; deliverables: string[] }[];
    if (r.ioRows && r.ioRows.length) {
      return r.ioRows.map((x) => ({ vsId: x.valueStreamId, vsName: x.valueStreamName, sub: x.l4 ?? x.l3 ?? null, inputs: x.inputs, deliverables: x.deliverables }));
    }
    return r.participation.map((p) => ({ vsId: p.valueStreamId, vsName: p.valueStreamName, sub: p.subStream, inputs: splitItems(p.inputs), deliverables: splitItems(p.outputs) }));
  }, [r]);
  const deliverableCount = r?.deliverableCount ?? ioRows.reduce((a, row) => a + row.deliverables.length, 0);
  const inputCount = r?.inputCount ?? ioRows.reduce((a, row) => a + row.inputs.length, 0);

  // Process tasks — the L5 steps the role leads/supports — grouped by value stream.
  const taskGroups = useMemo(() => {
    const groups = new Map<string, { vsId: string; vsName: string; tasks: ProcTask[] }>();
    for (const t of r?.processTasks ?? []) {
      const g = groups.get(t.valueStreamId) ?? { vsId: t.valueStreamId, vsName: t.valueStreamName, tasks: [] };
      g.tasks.push(t); groups.set(t.valueStreamId, g);
    }
    return [...groups.values()].sort((a, b) => a.vsName.localeCompare(b.vsName));
  }, [r]);
  const processTaskCount = r?.processTasks?.length ?? 0;

  return (
    <div>
      <Crumbs crumbs={[...crumbs, { label: r?.name ?? 'Role' }]} />
      {loading ? (
        <div className="text-slate-500">Loading role…</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : !r ? null : (
        <>
          <PageHeader
            hideBreadcrumb
            title={r.name}
            subtitle={[r.roleFamily, r.department?.name, r.division?.name].filter(Boolean).join(' · ') || 'Role'}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Inputs & Deliverables — every input the role receives and
                  deliverable it produces, at the LOWEST (sub-process) level, drawn
                  from the role-tagged I/O inventory and related per value stream /
                  L4. "Outputs" and "deliverables" are the same list, so they show
                  once — as deliverables — paired with their inputs. No repetition. */}
              <div className="card">
                <div className="mb-3">
                  <h3 className="font-semibold text-slate-900">Inputs &amp; Deliverables</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {deliverableCount} deliverable{deliverableCount === 1 ? '' : 's'} and {inputCount} input{inputCount === 1 ? '' : 's'} across {ioRows.length} sub-process{ioRows.length === 1 ? '' : 'es'} — the role's lowest-level work products and what feeds them.
                  </p>
                </div>
                {ioRows.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">Not mapped to any value stream.</div>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <div className="min-w-[480px] px-1">
                      {/* Header row */}
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] gap-3 pb-2 border-b border-slate-200">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Value stream · sub-process</div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Receives (inputs)</div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Deliverables</div>
                      </div>
                      {/* Body rows */}
                      {ioRows.map((row, i) => (
                        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] gap-3 py-3 border-b border-slate-100 last:border-0 items-start">
                          <div className="min-w-0">
                            <Link to={`/overview?focus=${row.vsId}`} className="text-sm font-medium text-brand-700 hover:underline break-words">{row.vsName}</Link>
                            {row.sub && <div className="text-xs text-slate-400 mt-0.5 break-words">{row.sub}</div>}
                          </div>
                          <ItemList items={row.inputs} tone="in" />
                          <ItemList items={row.deliverables} tone="out" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Process Tasks — the L5 process steps this role leads or supports,
                  tied back to the role. These are its lowest-level activities; each
                  yields the output shown. */}
              <div className="card">
                <div className="mb-3">
                  <h3 className="font-semibold text-slate-900">Process Tasks ({processTaskCount})</h3>
                  <p className="text-xs text-slate-400 mt-0.5">The process steps this role leads or supports — its lowest-level activities, by value stream.</p>
                </div>
                {processTaskCount === 0 ? (
                  <div className="text-sm text-slate-500 italic">No process steps tie to this role.</div>
                ) : (
                  <div className="space-y-4">
                    {taskGroups.map((g) => (
                      <div key={g.vsId}>
                        <Link to={`/overview?focus=${g.vsId}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:underline">{g.vsName} ({g.tasks.length})</Link>
                        <ul className="mt-1.5 divide-y divide-slate-100">
                          {g.tasks.map((t, i) => (
                            <li key={i} className="flex items-start gap-2.5 py-2 first:pt-0">
                              <span className={`${t.relation === 'Lead' ? 'pill-blue' : 'pill-slate'} mt-0.5 flex-shrink-0`}>{t.relation}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-slate-700 break-words">{t.name}</div>
                                {t.outputs && <div className="text-[11px] text-[#a3a3a3] mt-0.5 break-words">→ {t.outputs}</div>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Block 3 — Responsibilities (merged checklist + role tasks) */}
              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-3">Responsibilities ({r.responsibilities.reduce((a, g) => a + g.items.length, 0)})</h3>
                {r.responsibilities.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No responsibilities recorded.</div>
                ) : (
                  r.responsibilities.map((g) => (
                    <div key={g.category} className="mb-4 last:mb-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{g.category} ({g.items.length})</div>
                      <ul className="space-y-1.5">
                        {g.items.map((it, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-700 leading-snug">
                            <span className="mt-[7px] h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Users in the role + where it participates */}
            <div className="space-y-6">
              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-3">Value-Stream Participation ({r.participation.length})</h3>
                {r.participation.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">Not mapped to any value stream.</div>
                ) : (
                  <div className="space-y-1.5">
                    {r.participation.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                        <div className="min-w-0">
                          <Link to={`/overview?focus=${p.valueStreamId}`} className="text-sm text-brand-700 hover:underline">{p.valueStreamName}</Link>
                          {p.subStream && <div className="text-xs text-slate-400 truncate">{p.subStream}</div>}
                        </div>
                        <span className={`${PARTICIPATION_CLASS[p.participationType] || 'pill-slate'} flex-shrink-0`}>{p.participationType}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-3">Users in Role ({r.people.length})</h3>
                {r.people.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No people assigned yet.</div>
                ) : (
                  <div className="space-y-0.5">
                    {r.people.map((pp) => (
                      <button key={pp.id} onClick={() => onSelectPerson(pp.id)}
                        className="w-full flex items-center justify-between gap-2 text-sm py-1 px-1.5 -mx-1.5 rounded-md hover:bg-[#fafafa] transition-colors duration-150 text-left group">
                        <span className="min-w-0">
                          <span className="text-[#171717] truncate group-hover:underline">{pp.name}</span>
                          {pp.title && <span className="block text-xs text-[#a3a3a3] truncate">{pp.title}</span>}
                        </span>
                        <span className="flex items-center gap-1.5 flex-shrink-0 text-[11px] text-[#a3a3a3]">
                          {pp.employmentType !== 'badged' && <span className="chip-soft">{pp.vendor ?? pp.employmentType}</span>}
                          {pp.region && <span>{pp.region}</span>}
                          <span className="tnum">{pp.allocationPct}%</span>
                          <Chevron />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Split a workbook I/O field (comma / semicolon / newline separated) into the
// discrete items that read as chips instead of a single cramped text blob.
function splitItems(value: string | null): string[] {
  if (!value) return [];
  return value.split(/[;,\n]+/).map((s) => s.trim()).filter(Boolean);
}

// A vertical list of I/O items for one table cell. Inputs ("in") read as a plain
// bulleted list; deliverables ("out") get a doc glyph so they stand apart as the
// owned work products — even though they share a row with their inputs.
function ItemList({ items, tone }: { items: string[]; tone: 'in' | 'out' }) {
  if (items.length === 0) return <span className="text-xs text-[#a3a3a3] italic">—</span>;
  return (
    <ul className="space-y-1.5 min-w-0">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-1.5 text-sm text-slate-700">
          <span className={`mt-0.5 flex-shrink-0 ${tone === 'out' ? 'text-emerald-500' : 'text-slate-300'}`} aria-hidden="true">
            {tone === 'out' ? <DocIcon /> : <Dot />}
          </span>
          <span className="min-w-0 break-words">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Dot() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  );
}

// ── Level 5: a single person — location, assignment, KPI performance ────────
type PersonMetric = { name: string; unit: string; target: number | null; direction: string; latest: number | null; latestPeriod: string | null; onTarget: boolean | null; history: { period: string; value: number }[] };
type PersonAssignment = { roleId: string; roleName: string; roleLevel: string | null; divisionName: string | null; departmentName: string | null; allocationPct: number; isPrimary: boolean; employmentType: string };
type PersonSignal = { name: string; unit: string; latest: number | null; latestPeriod: string | null; history: { period: string; value: number }[] };
type AppUsage = { appName: string; category: string | null; usagePct: number; rank: number };
type PersonData = {
  person: { id: string; name: string; title: string | null; location: string | null; region: string | null; employmentType: string; vendor: string | null };
  assignments: PersonAssignment[];
  valueStreams: { id: string; name: string; participationType: string }[];
  metrics: PersonMetric[];
  signals: PersonSignal[];
  apps: AppUsage[];
};

function PersonDetailView({ personId, crumbs }: { personId: string; crumbs: { label: string; onClick?: () => void }[] }) {
  const { data: d, error, loading } = useApi<PersonData>(`/explorer/person/${personId}`);

  return (
    <div>
      <Crumbs crumbs={[...crumbs, { label: d?.person.name ?? 'Person' }]} />
      {loading ? (
        <div className="text-slate-500">Loading person…</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : !d ? null : (
        <>
          <PageHeader
            hideBreadcrumb
            title={d.person.name}
            subtitle={[d.person.title, d.person.employmentType !== 'badged' ? (d.person.vendor ?? d.person.employmentType) : 'Employee'].filter(Boolean).join(' · ')}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Digital productivity signals (illustrative) */}
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900">Digital Productivity</h3>
                </div>
                <p className="text-xs text-[#a3a3a3] mb-3">Synthesized activity signals · latest {d.signals[0]?.latestPeriod ?? ''}</p>
                {d.signals.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No signals.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {d.signals.map((s) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-[#171717] truncate">{s.name}</div>
                          <div className="text-xs text-[#a3a3a3]">{s.unit}</div>
                        </div>
                        <MiniTrend history={s.history} />
                        <div className="w-12 text-right text-sm font-semibold text-[#171717] tnum flex-shrink-0">{s.latest ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Performance vs the role's relevant KPIs */}
              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-1">Performance Metrics ({d.metrics.length})</h3>
                <p className="text-xs text-[#a3a3a3] mb-3">Based on the KPIs of the value stream{d.valueStreams.length === 1 ? '' : 's'} this role participates in · latest {d.metrics[0]?.latestPeriod ?? ''}</p>
                {d.metrics.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No performance metrics tracked.</div>
                ) : (
                  <div className="space-y-3">
                    {d.metrics.map((m) => (
                      <div key={m.name} className="flex items-center gap-3 border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-[#171717] truncate">{m.name}</div>
                          <div className="text-xs text-[#a3a3a3]">
                            {m.target != null ? `Target ${m.direction === 'down' ? '≤' : '≥'} ${m.target}${m.unit === '%' ? '%' : ` ${m.unit}`}` : 'No target'}
                          </div>
                        </div>
                        <MiniTrend history={m.history} />
                        <div className="w-24 text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-[#171717] tnum">{m.latest != null ? `${m.latest}${m.unit === '%' ? '%' : ` ${m.unit}`}` : '—'}</div>
                          {m.onTarget != null && (
                            <span className={m.onTarget ? 'pill-green' : 'pill-red'}>{m.onTarget ? 'On target' : 'Off target'}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Location + assignment + value streams */}
            <div className="space-y-6">
              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-3">Location</h3>
                <dl className="text-sm space-y-2">
                  <DRow label="Location" value={d.person.location || '—'} />
                  <DRow label="Region" value={d.person.region || '—'} />
                  <DRow label="Employment" value={d.person.employmentType === 'badged' ? 'Badged employee' : (d.person.employmentType === 'si_partner' ? 'SI partner' : 'Contractor')} />
                  {d.person.vendor && <DRow label="Vendor" value={d.person.vendor} />}
                </dl>
              </div>

              {d.apps.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-slate-900 mb-3">Most Used Apps</h3>
                  <div className="space-y-2">
                    {d.apps.map((a) => (
                      <div key={a.appName}>
                        <div className="flex items-center justify-between gap-2 text-sm mb-0.5">
                          <span className="text-[#171717] truncate flex items-center gap-1.5">{a.appName}{a.rank === 1 && <span className="chip-soft">Top</span>}</span>
                          <span className="tnum text-xs text-[#a3a3a3] flex-shrink-0">{a.usagePct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                          <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${a.usagePct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-3">Assignment{d.assignments.length === 1 ? '' : 's'} ({d.assignments.length})</h3>
                <div className="space-y-3">
                  {d.assignments.map((a) => (
                    <div key={a.roleId} className="text-sm border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/roles/${a.roleId}`} className="font-medium text-brand-700 hover:underline">{a.roleName}</Link>
                        <span className="tnum text-xs text-[#a3a3a3] flex-shrink-0">{a.allocationPct}%</span>
                      </div>
                      <div className="text-xs text-[#a3a3a3]">{[a.departmentName, a.divisionName].filter(Boolean).join(' · ')}</div>
                      {a.isPrimary && <span className="chip-soft mt-1 inline-block">Primary</span>}
                    </div>
                  ))}
                </div>
              </div>

              {d.valueStreams.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-slate-900 mb-3">Value Streams</h3>
                  <div className="space-y-1.5">
                    {d.valueStreams.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                        <Link to={`/overview?focus=${v.id}`} className="text-[#171717] hover:underline truncate">{v.name}</Link>
                        <span className={`${PARTICIPATION_CLASS[v.participationType] || 'pill-slate'} flex-shrink-0`}>{v.participationType}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 6-month sparkline of a metric's readings.
function MiniTrend({ history }: { history: { period: string; value: number }[] }) {
  if (history.length < 2) return <div className="w-20 flex-shrink-0" />;
  const vals = history.map((h) => h.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  return (
    <div className="w-20 h-8 flex items-end gap-0.5 flex-shrink-0" title={history.map((h) => `${h.period}: ${h.value}`).join('\n')}>
      {history.map((h, i) => (
        <div key={i} className="flex-1 bg-[#e5e5e5] rounded-sm" style={{ height: `${20 + ((h.value - min) / span) * 80}%` }} />
      ))}
    </div>
  );
}

function DRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500 flex-shrink-0">{label}</dt>
      <dd className="font-medium text-slate-800 text-right">{value}</dd>
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
    <button onClick={onClick}
      className="card text-left flex flex-col gap-2 group hover:border-[#d4d4d4] hover:shadow-md transition-all duration-150">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[#171717] leading-snug">{title}</span>
        {tag}
      </div>
      <div className="text-xs text-[#a3a3a3]">{meta}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-[#a3a3a3] group-hover:text-[#525252]">
        Open <Chevron />
      </div>
    </button>
  );
}

// Same chevron + dark-pill + clear-focus treatment as the Value Streams map
// breadcrumb (see MapCanvas.tsx / .focus-crumb-* in index.css). The ✕ resets to
// the Roles base via the first crumb's handler (goDivisions).
function Crumbs({ crumbs }: { crumbs: { label: string; onClick?: () => void }[] }) {
  const clear = crumbs[0]?.onClick;
  return (
    <nav className="flex items-center flex-wrap mb-4" aria-label="Breadcrumb">
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
