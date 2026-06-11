import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

// Standards — the company's department standards areas, as a compact sortable
// grid (defect backlog 02, D5): one hyperlinked row per area drilling into its
// guidelines. The owner column is gone (it lives at the area level), fonts are
// small/tight, the search box is blank (Google-style), and template-authored
// areas carry an "illustrative" tag (the audit behind the uniform 22-item
// counts — see docs/defect-backlog-02.md).

type Responsible = { label: string; roleId: string | null; roleName: string | null };
type Standard = {
  id: string;
  department: string;
  count: number;
  charterIncluded: boolean;
  owner: string | null;
  link: string | null;
  illustrative: boolean;
  responsible: Responsible[];
};
type Data = {
  company: { id: string; name: string };
  totals: { areas: number; standards: number; withCharter: number };
  standards: Standard[];
};

type Sort = { col: 'department' | 'count'; dir: 1 | -1 };

function SortBtn({ col, sort, onSort, children }: { col: Sort['col']; sort: Sort; onSort: (c: Sort['col']) => void; children: React.ReactNode }) {
  const active = sort.col === col;
  return (
    <button onClick={() => onSort(col)} className={'inline-flex items-center gap-1 hover:text-[#171717] ' + (active ? 'text-[#171717]' : '')}>
      {children}
      <span className={'text-[10px] font-bold ' + (active ? 'text-[#171717]' : 'text-[#a3a3a3]')}>{active ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</span>
    </button>
  );
}

export default function Standards() {
  const { data, error, loading } = useApi<Data>('/explorer/standards');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ col: 'department', dir: 1 });

  const toggleSort = (col: Sort['col']) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const base = needle
      ? data.standards.filter((s) => s.department.toLowerCase().includes(needle))
      : data.standards;
    return [...base].sort((a, b) => {
      const cmp = sort.col === 'department' ? a.department.localeCompare(b.department) : a.count - b.count;
      return cmp * sort.dir || a.department.localeCompare(b.department);
    });
  }, [data, q, sort]);

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

      {/* Controls — blank search box (D5.7), tight to the grid (D5.1) */}
      <div className="flex items-center gap-2 mb-2">
        <input
          className="input max-w-xs py-1 text-[12px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search standards areas"
        />
        <div className="flex-1" />
        <span className="text-[11px] text-[#a3a3a3] tnum">{rows.length} of {t.areas} areas</span>
      </div>

      {/* Sortable grid — each area name is a drill-down hyperlink (D5.2/D5.5) */}
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-[1fr_110px] items-center gap-2 px-3 py-1.5 border-b border-[#eaeaea] bg-[#fafafa] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
          <SortBtn col="department" sort={sort} onSort={toggleSort}>Department</SortBtn>
          <span className="text-right"><SortBtn col="count" sort={sort} onSort={toggleSort}>Standards</SortBtn></span>
        </div>

        {rows.length === 0 ? (
          <div className="px-3 py-6 text-[12px] text-slate-500 italic">No standards match.</div>
        ) : (
          rows.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[1fr_110px] items-center gap-2 px-3 py-1 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
            >
              <div className="min-w-0 flex items-center gap-2">
                <Link to={`/standards/${s.id}`} className="text-[13px] text-[#1d4ed8] truncate font-medium hover:underline">
                  {s.department}
                </Link>
                {s.illustrative && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e] flex-shrink-0"
                    title="Authored baseline content — counts reflect a per-department template, not a real inventory yet."
                  >
                    Illustrative
                  </span>
                )}
              </div>
              <div className="text-right text-[12px] tnum text-[#171717] font-medium">{s.count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
