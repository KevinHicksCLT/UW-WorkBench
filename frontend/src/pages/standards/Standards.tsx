import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useOpenRole } from '../../lib/roleDrawer';
import { Sheet, SheetCell, ListSearch, type SheetCol } from '../../components/Sheet';
import StandardDrawer from '../../components/StandardDrawer';
import { ViewPills } from '../../components/TocView';
import { useViewState } from '../../lib/viewState';
import { Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';

// Standards — the company's department standards, in two views:
//   • TOC (default): the table of contents — one row per standards area; click
//     through to the area page.
//   • List: a flat spreadsheet of every individual standard in the canonical
//     Sheet format (see components/Sheet.tsx). Clicking a row opens the
//     standard's detail (agent skill, gates, citation…) in a slide-over.

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
  id: string;
  areaId: string;
  department: string;
  category: string;
  group: string | null;
  name: string;
  description: string | null;
  roleId: string | null;
  roleName: string | null;
};

const DASH = '—';

export default function Standards() {
  const { data, error, loading } = useApi<Data>('/explorer/standards');
  const navigate = useNavigate();
  const openRole = useOpenRole();
  // Persisted per session (lib/viewState) so returning restores the TOC|List
  // choice and the TOC search.
  const [view, setView] = useViewState<'toc' | 'list'>('standards.view', 'toc');
  const [items, setItems] = useState<FlatItem[] | null>(null);
  const [q, setQ] = useViewState('standards.q', '');
  const [sel, setSel] = useState<FlatItem | null>(null);

  useEffect(() => {
    api
      .get<{ items: FlatItem[] }>('/explorer/standards-flat')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  const cols = useMemo<SheetCol<FlatItem>[]>(
    () => [
      {
        key: 'department',
        label: 'Department',
        width: '170px',
        value: (r) => r.department,
        dim: true,
        render: (r) => (
          <SheetCell text={r.department} dim onClick={() => navigate(`/standards/${r.areaId}`)} />
        ),
      },
      { key: 'category', label: 'Category', width: '150px', value: (r) => r.category, dim: true },
      {
        key: 'group',
        label: 'Group',
        width: '200px',
        value: (r) => r.group ?? DASH,
        dim: true,
        render: (r) => <SheetCell text={r.group ?? DASH} dim title={r.group ?? undefined} />,
      },
      { key: 'name', label: 'Standard', width: 'minmax(0,1fr)', value: (r) => r.name },
      {
        key: 'description',
        label: 'Description',
        width: 'minmax(0,1.4fr)',
        render: (r) => (
          <SheetCell text={r.description ?? ''} dim title={r.description ?? undefined} />
        ),
      },
      {
        key: 'responsible',
        label: 'Responsible',
        width: '200px',
        value: (r) => r.roleName ?? DASH,
        dim: true,
        render: (r) => (
          <SheetCell
            text={r.roleName ?? DASH}
            dim
            onClick={r.roleId ? () => openRole(r.roleId!) : undefined}
          />
        ),
      },
    ],
    [navigate, openRole],
  );

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

  if (loading) return <LoadingState baseClassName="text-slate-500" message="Loading standards…" />;
  if (error) return <ErrorMessage baseClassName="text-red-600">{error}</ErrorMessage>;
  if (!data) return null;

  const t = data.totals;
  // Locked totals line — identical in both views (mirrors Value Streams / Org):
  // "13 areas · 95 categories · 1010 standards". Category count comes from the
  // flat leaf list; falls back to the area count until it loads.
  const catCount = items ? new Set(items.map((i) => i.category)).size : null;
  const totalsText = `${t.areas} areas · ${catCount ?? '—'} categories · ${t.standards} standards`;

  // Segmented pill toggle — the shared ViewPills control; TOC leads, List follows.
  const viewToggle = (
    <ViewPills
      options={[
        { key: 'toc' as const, label: 'TOC' },
        { key: 'list' as const, label: 'List' },
      ]}
      view={view}
      onChange={setView}
    />
  );

  return (
    <div>
      {view === 'list' ? (
        <Sheet
          sheetKey="standards"
          rows={items ?? []}
          cols={cols}
          rowKey={(r) => r.id}
          loading={items === null}
          unit="standards"
          leading={viewToggle}
          onRowClick={(r) => setSel(r)}
          selectedKey={sel?.id ?? null}
          summarize={(visible) => {
            const areas = new Set(visible.map((r) => r.areaId)),
              cats = new Set(visible.map((r) => r.category));
            return `${areas.size} areas · ${cats.size} categories`;
          }}
        />
      ) : (
        <>
          {/* One compact strip: toggle + totals on the left, search + count on the
              right (matches the list view; no separate control row). */}
          <div className="flex items-center gap-3 pb-2">
            {viewToggle}
            <span className="hidden md:inline text-[11px] text-[#737373] tnum whitespace-nowrap">
              {totalsText}
            </span>
            <div className="flex-1" />
            <ListSearch value={q} onChange={setQ} placeholder="Search department, owner, role…" />
          </div>

          {/* Standards areas — click through to the area's individual standards */}
          <Card className="overflow-hidden p-0">
            <div className="hidden sm:flex items-center px-4 py-2 border-b border-[#eaeaea] text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
              <span className="flex-1">Department</span>
              <span className="w-24 text-center tnum">Standards</span>
              <span className="w-[34%] pl-4">Responsible (owner)</span>
            </div>

            {dRows.length === 0 ? (
              <EmptyState
                baseClassName="px-4 py-8 text-sm text-slate-500 italic"
                message="No standards match."
              />
            ) : (
              dRows.map((s) => (
                <Link
                  key={s.id}
                  to={`/standards/${s.id}`}
                  className="flex items-center px-4 py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm text-[#171717] truncate font-medium">
                      {s.department}
                    </span>
                    <Chevron />
                  </div>
                  <div className="w-24 text-center text-sm tnum text-[#171717] font-medium">
                    {s.count}
                  </div>
                  <div className="w-[34%] pl-4 text-sm text-[#525252] truncate">
                    {s.owner ?? <span className="text-[#a3a3a3] italic">Unassigned</span>}
                  </div>
                </Link>
              ))
            )}
          </Card>
        </>
      )}

      {/* Standard full detail — slides over the list in place. */}
      {sel && <StandardDrawer areaId={sel.areaId} itemId={sel.id} onClose={() => setSel(null)} />}
    </div>
  );
}

function Chevron() {
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
      className="flex-shrink-0 text-[#d4d4d4]"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
