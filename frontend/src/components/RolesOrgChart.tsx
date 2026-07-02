// RolesOrgChart — the Roles tab's map view: a reporting-line org chart rooted
// at the CEO. Role.managerRoleId isn't backfilled company-wide yet, so for now
// this renders just the root box and nothing under it — the chart fills in as
// manager assignments are added. Data: GET /roles/org-chart.
import { useApi } from '../lib/useApi';

type OrgChartData = { root: { id: string; name: string; reports: unknown[] } | null };

export default function RolesOrgChart() {
  const { data, error, loading } = useApi<OrgChartData>('/roles/org-chart');
  const root = data?.root ?? null;

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-6">
      {loading ? (
        <div className="text-sm text-[#a3a3a3] animate-pulse">Loading organization…</div>
      ) : error ? (
        <div className="text-sm text-[#be123c]">Failed to load the org chart.</div>
      ) : !root ? (
        <div className="text-sm text-[#a3a3a3] italic">No CEO role found for this company.</div>
      ) : (
        <>
          <div className="rounded-xl border-2 border-[#171717] bg-white shadow-sm px-6 py-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">Root</div>
            <div className="text-[15px] font-bold text-[#171717] mt-0.5">{root.name}</div>
          </div>
          <div className="text-[11px] text-[#a3a3a3] italic max-w-sm text-center leading-snug">
            Reporting lines below the CEO aren't backfilled yet — this chart will grow down to the lowest role as manager assignments are added.
          </div>
        </>
      )}
    </div>
  );
}
