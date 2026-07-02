import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import RolesListSheet from '../../components/RolesListSheet';
import RolesOrgChart from '../../components/RolesOrgChart';
import { TocView, ViewPills, type TocRow } from '../../components/TocView';
import { ErrorMessage, LoadingState } from '../../components/ui';

// Roles tab — mirrors the Value Streams / Organization tabs, roles are the
// centerpiece:
//   TOC  — (default) table of contents: one row per division with its role
//          count and segment; click through to the List pre-filtered to it.
//   List — flat spreadsheet, one row per role: Department, Division, Role, Role
//          Type, participating value streams / deliverables / tasks / standards,
//          checklist responsibilities.
//   Map  — org chart hierarchy rooted at the CEO, drilling down to the lowest
//          role (scaffold: just the CEO for now, see RolesOrgChart).
type View = 'toc' | 'list' | 'map';

// TOC rows — one per ORG division (OrgUnit L2) from the org-table bootstrap:
// role counts homed in the division + its departments, and the parent segment.
function RolesToc({
  onPick,
  leading,
}: {
  onPick: (divisionName: string) => void;
  leading?: React.ReactNode;
}) {
  const [rows, setRows] = useState<TocRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get<{
        segments: {
          divisions: { id: string; name: string; segment: string; roleCount: number }[];
        }[];
      }>('/explorer/org-table')
      .then((t) => {
        setRows(
          t.segments
            .flatMap((s) => s.divisions)
            .filter((d) => d.id !== '__unassigned') // pseudo-bucket, not a division
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((d) => ({
              id: d.id,
              name: d.name,
              count: d.roleCount,
              extra: d.segment,
              onClick: () => onPick(d.name),
            })),
        );
      })
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, [onPick]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!rows) return <LoadingState message="Loading roles…" className="animate-pulse" />;
  return (
    <TocView
      rows={rows}
      nameLabel="Division"
      countLabel="Roles"
      extraLabel="Segment"
      unit="divisions"
      searchPlaceholder="Search division, segment…"
      leading={leading}
      totals={`${rows.length} divisions · ${rows.reduce((a, r) => a + r.count, 0)} roles`}
    />
  );
}

export default function Roles() {
  const [view, setView] = useState<View>('toc');
  // Division picked on the TOC — the List opens pre-filtered to it.
  const [preFilter, setPreFilter] = useState<string | null>(null);

  const pillOptions = [
    { key: 'toc' as const, label: 'TOC' },
    { key: 'list' as const, label: 'List' },
    { key: 'map' as const, label: 'Map' },
  ];
  const pills = (
    <ViewPills
      options={pillOptions}
      view={view}
      onChange={(v) => {
        if (v === 'toc') {
          setPreFilter(null);
        }
        setView(v);
      }}
    />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {view === 'toc' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
              <RolesToc
                leading={pills}
                onPick={(division) => {
                  setPreFilter(division);
                  setView('list');
                }}
              />
            </div>
          </div>
        ) : view === 'list' ? (
          <RolesListSheet
            key={`roles-${preFilter ?? ''}`}
            leading={pills}
            defaultFilters={preFilter ? { division: preFilter } : undefined}
          />
        ) : (
          <>
            <div className="absolute top-3 left-4 z-20">{pills}</div>
            <RolesOrgChart />
          </>
        )}
      </div>
    </div>
  );
}
