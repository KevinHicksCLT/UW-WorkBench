import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useViewState } from '../lib/viewState';
import { TocBack, TocView, type TocRow } from './TocView';
import { ErrorMessage, LoadingState } from './ui';

// OrgDrillToc — the org spine as a gold-standard TOC descent, mirroring the
// org map's hierarchy in table form: segment (org L1) → division (L2) →
// department (L3) → roles; clicking a role lands on its full profile page.
// Shared by the Organization tab (starts at segments) and the Roles tab
// (starts at divisions). Data: one org-table bootstrap fetch.

type TocRole = {
  id: string;
  name: string;
  valueStreamCount: number;
};
type TocDivision = {
  id: string;
  name: string;
  segment: string;
  roleCount: number;
  departments: { id: string; name: string; roles: TocRole[] }[];
  looseRoles: TocRole[];
};
type TocSegment = {
  id: string;
  name: string;
  divisionCount: number;
  roleCount: number;
  divisions: TocDivision[];
};

export default function OrgDrillToc({
  startAt,
  leading,
}: {
  /** Topmost level shown: 'segment' (Organization tab) or 'division' (Roles tab). */
  startAt: 'segment' | 'division';
  leading?: ReactNode;
}) {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<TocSegment[] | null>(null);
  const [error, setError] = useState('');
  // Drill stack; departmentId '' = the direct-to-division bucket.
  // Persisted per session (lib/viewState) so returning restores the drill depth.
  const [segmentId, setSegmentId] = useViewState<string | null>('org.toc.segment', null);
  const [divisionId, setDivisionId] = useViewState<string | null>('org.toc.division', null);
  const [departmentId, setDepartmentId] = useViewState<string | null>('org.toc.department', null);

  useEffect(() => {
    api
      .get<{ segments: TocSegment[] }>('/explorer/org-table')
      .then((t) => setSegments(t.segments))
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, []);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!segments) return <LoadingState message="Loading organization…" className="animate-pulse" />;

  const divisions = segments.flatMap((s) => s.divisions).filter((d) => d.id !== '__unassigned'); // pseudo-bucket, not navigable
  const division = divisionId ? divisions.find((d) => d.id === divisionId) : null;

  // Level 4 — one department's roles; click through to the role profile.
  if (division && departmentId != null) {
    const dept =
      departmentId === ''
        ? { name: 'Direct to division', roles: division.looseRoles }
        : division.departments.find((x) => x.id === departmentId);
    const rows: TocRow[] = (dept?.roles ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({
        id: r.id,
        name: r.name,
        count: r.valueStreamCount,
        onClick: () => navigate(`/roles/${r.id}`),
      }));
    return (
      <TocView
        stateKey="org.toc.roles"
        rows={rows}
        nameLabel="Role"
        countLabel="Value streams"
        unit="roles"
        searchPlaceholder="Search role…"
        leading={
          <>
            {leading}
            <TocBack label={division.name} onClick={() => setDepartmentId(null)} />
          </>
        }
        totals={`${division.name} · ${dept?.name ?? ''} · ${rows.length} roles`}
      />
    );
  }

  // Level 3 — one division's departments (+ the direct-to-division bucket).
  if (division) {
    const rows: TocRow[] = division.departments
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((dept) => ({
        id: dept.id,
        name: dept.name,
        count: dept.roles.length,
        extra: division.name,
        onClick: () => setDepartmentId(dept.id),
      }));
    if (division.looseRoles.length) {
      rows.push({
        id: '__loose',
        name: 'Direct to division',
        count: division.looseRoles.length,
        extra: division.name,
        onClick: () => setDepartmentId(''),
      });
    }
    const backLabel =
      startAt === 'segment' && segmentId
        ? (segments.find((s) => s.id === segmentId)?.name ?? 'All divisions')
        : 'All divisions';
    return (
      <TocView
        stateKey="org.toc.departments"
        rows={rows}
        nameLabel="Department"
        countLabel="Roles"
        extraLabel="Division"
        unit="departments"
        searchPlaceholder="Search department…"
        leading={
          <>
            {leading}
            <TocBack label={backLabel} onClick={() => setDivisionId(null)} />
          </>
        }
        totals={`${division.name} · ${rows.length} departments · ${division.roleCount} roles`}
      />
    );
  }

  // Level 2 — divisions (of the opened segment, or all when starting here).
  const openSegment = segmentId ? segments.find((s) => s.id === segmentId) : null;
  if (openSegment || startAt === 'division') {
    const pool = openSegment
      ? openSegment.divisions.filter((d) => d.id !== '__unassigned')
      : divisions;
    const rows: TocRow[] = pool
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({
        id: d.id,
        name: d.name,
        count: d.roleCount,
        extra: openSegment
          ? `${d.departments.length} department${d.departments.length === 1 ? '' : 's'}`
          : d.segment,
        onClick: () => setDivisionId(d.id),
      }));
    return (
      <TocView
        stateKey="org.toc.divisions"
        rows={rows}
        nameLabel="Division"
        countLabel="Roles"
        extraLabel={openSegment ? 'Departments' : 'Segment'}
        unit="divisions"
        searchPlaceholder="Search division…"
        leading={
          <>
            {leading}
            {openSegment && <TocBack label="All segments" onClick={() => setSegmentId(null)} />}
          </>
        }
        totals={
          openSegment
            ? `${openSegment.name} · ${rows.length} divisions · ${openSegment.roleCount} roles`
            : `${rows.length} divisions · ${rows.reduce((a, r) => a + r.count, 0)} roles`
        }
      />
    );
  }

  // Level 1 — segments (org L1).
  const rows: TocRow[] = segments
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      id: s.id,
      name: s.name,
      count: s.roleCount,
      extra: `${s.divisionCount} division${s.divisionCount === 1 ? '' : 's'}`,
      onClick: () => setSegmentId(s.id),
    }));
  return (
    <TocView
      stateKey="org.toc.segments"
      rows={rows}
      nameLabel="Segment"
      countLabel="Roles"
      extraLabel="Divisions"
      unit="segments"
      searchPlaceholder="Search segment…"
      leading={leading}
      totals={`${rows.length} segments · ${divisions.length} divisions · ${rows.reduce((a, r) => a + r.count, 0)} roles`}
    />
  );
}
