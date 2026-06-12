import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';
import StandardDrawer from '../components/StandardDrawer';

// Standards — the company's department standards, in two views:
//   • List (default): a flat spreadsheet of every individual standard in the
//     canonical Sheet format (see components/Sheet.tsx). Clicking a row opens
//     the standard's detail (agent skill, gates, citation…) in a slide-over.
//   • Drilldown: one row per standards area; click through to the area page.

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
type FlatItem = {
  id: string; areaId: string; department: string; category: string; group: string | null;
  name: string; description: string | null; roleId: string | null; roleName: string | null;
};

const DASH = '—';

export default function Standards() {
  const { data, error, loading } = useApi<Data>('/explorer/standards');
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'drilldown'>('list');
  const [items, setItems] = useState<FlatItem[] | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<FlatItem | null>(null);

  useEffect(() => {
    api.get('/explorer/standards-flat').then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);

  const cols = useMemo<SheetCol<FlatItem>[]>(() => [
    {
      key: 'department', label: 'Department', width: '170px',
      value: (r) => r.department, dim: true,
      render: (r) => <SheetCell text={r.department} dim onClick={() => navigate(`/standards/${r.areaId}`)} />,
    },
    { key: 'category', label: 'Category', width: '150px', value: (r) => r.category, dim: true },
    {
      key: 'group', label: 'Group', width: '200px',
      value: (r) => r.group ?? DASH, dim: true,
      render: (r) => <SheetCell text={r.group ?? DASH} dim title={r.group ?? undefined} />,
    },
    { key: 'name', label: 'Standard', width: 'minmax(0,1fr)', value: (r) => r.name },
    {
      key: 'description', label: 'Description', width: 'minmax(0,1.4fr)',
      render: (r) => <SheetCell text={r.description ?? ''} dim title={r.description ?? undefined} />,
    },
    {
      key: 'responsible', label: 'Responsible', width: '200px',
      value: (r) => r.roleName ?? DASH, dim: true,
      render: (r) => <SheetCell text={r.roleName ?? DASH} dim onClick={r.roleId ? () => navigate(`/roles/${r.roleId}`) : undefined} />,
    },
  ], [navigate]);

  const dRows = useMemo(() => {
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

  // Segmented pill toggle (same control as the Value Streams / Organization
  // List↔Map switch) — sits inline on the totals strip to keep the header to
  // one compact row.
  const viewToggle = (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white/90 backdrop-blur p-0.5 shadow-sm" role="tablist" aria-label="View mode">
      {([
        ['list', 'List', 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
        ['drilldown', 'Drilldown', 'M3 3h7v7H3zM14 5h7M14 9h7M10 14h11M10 18h11M5 10v8h5'],
      ] as const).map(([v, label, icon]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ' +
            (view === v ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={icon} />
          </svg>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {view === 'list' ? (
        <Sheet
          rows={items ?? []}
          cols={cols}
          rowKey={(r) => r.id}
          loading={items === null}
          leading={viewToggle}
          onRowClick={(r) => setSel(r)}
          selectedKey={sel?.id ?? null}
          summarize={(visible) => {
            const areas = new Set(visible.map((r) => r.areaId)), cats = new Set(visible.map((r) => r.category));
            return `${areas.size} areas · ${cats.size} categories`;
          }}
        />
      ) : (
        <>
          {/* Toggle + totals on one compact strip (matches the list view). */}
          <div className="flex items-center gap-3 flex-wrap pb-1.5">
            {viewToggle}
            <span className="text-[11px] text-[#737373] tnum">
              {t.areas} standard areas · {t.standards} standards across {data.company.name}
            </span>
          </div>

          {/* Drilldown controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <input
              className="input sm:max-w-xs"
              placeholder="Search department, owner, role…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex-1" />
            <span className="text-xs text-[#a3a3a3] tnum">{dRows.length} of {t.areas} areas</span>
          </div>

          {/* Standards areas — click through to the area's individual standards */}
          <div className="card overflow-hidden p-0">
            <div className="hidden sm:flex items-center px-4 py-2 border-b border-[#eaeaea] text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
              <span className="flex-1">Department</span>
              <span className="w-24 text-right tnum">Standards</span>
              <span className="w-[34%] pl-4">Responsible (owner)</span>
            </div>

            {dRows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-500 italic">No standards match.</div>
            ) : (
              dRows.map((s) => (
                <Link
                  key={s.id}
                  to={`/standards/${s.id}`}
                  className="flex items-center px-4 py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
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
        </>
      )}

      {/* Standard full detail — slides over the list in place. */}
      {sel && <StandardDrawer areaId={sel.areaId} itemId={sel.id} onClose={() => setSel(null)} />}
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
