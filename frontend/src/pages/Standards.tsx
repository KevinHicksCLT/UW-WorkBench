import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

// Standards — the company's department standards areas. One row per area; click
// through to the area to see its individual standards and who's accountable.
// Laid out like the Roles tab: header totals, search, and a single card table.

type Responsible = { label: string; roleId: string | null; roleName: string | null };
type Standard = {
  id: string;
  department: string;
  count: number;
  charterIncluded: boolean;
  owner: string | null;
  link: string | null;
  responsible: Responsible[];
};
type Data = {
  company: { id: string; name: string };
  totals: { areas: number; standards: number; withCharter: number };
  standards: Standard[];
};

export default function Standards() {
  const { data, error, loading } = useApi<Data>('/explorer/standards');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.standards;
    return data.standards.filter(
      (s) =>
        s.department.toLowerCase().includes(needle) ||
        (s.owner ?? '').toLowerCase().includes(needle) ||
        s.responsible.some((r) => (r.roleName ?? r.label).toLowerCase().includes(needle)),
    );
  }, [data, q]);

  if (loading) return <div className="text-slate-500">Loading standards…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return null;

  const t = data.totals;
  return (
    <div>
      <PageHeader
        title="Standards"
        subtitle={`${t.areas} standard areas · ${t.standards} standards across ${data.company.name}`}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Search department, owner, role…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex-1" />
        <span className="text-xs text-[#a3a3a3] tnum">{rows.length} of {t.areas} areas</span>
      </div>

      {/* Standards areas — click through to the area's individual standards */}
      <div className="card overflow-hidden p-0">
        <div className="hidden sm:flex items-center px-4 py-2 border-b border-[#eaeaea] text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
          <span className="flex-1">Department</span>
          <span className="w-24 text-right tnum">Standards</span>
          <span className="w-[34%] pl-4">Responsible (owner)</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500 italic">No standards match.</div>
        ) : (
          rows.map((s) => (
            <Link
              key={s.id}
              to={`/standards/${s.id}`}
              className="flex items-center px-4 py-2.5 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm text-[#171717] truncate font-medium">{s.department}</span>
                <Chevron />
              </div>
              <div className="w-24 text-right text-sm tnum text-[#171717] font-medium">{s.count}</div>
              <div className="w-[34%] pl-4 text-sm text-[#525252] truncate">
                {s.owner ?? <span className="text-[#a3a3a3] italic">Unassigned</span>}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="flex-shrink-0 text-[#d4d4d4]" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
