import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import { ListSearch } from '../../components/Sheet';
import { BackButton, Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';
import AppDrawer, { type App } from './AppDrawer';

// Application-kind detail — drill target from the Applications TOC (mirrors
// the Standards area page). Shows every application of one kind grouped by
// category; clicking an application opens its detail drawer in place.
export default function ApplicationKind() {
  const { kind } = useParams();
  const kindName = kind ? decodeURIComponent(kind) : '';
  const { data, error, loading } = useApi<{ applications: App[] }>('/applications');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<App | null>(null);

  const apps = useMemo(() => {
    const all = (data?.applications ?? []).filter((a) => a.kind === kindName);
    const needle = q.trim().toLowerCase();
    return needle
      ? all.filter(
          (a) =>
            a.name.toLowerCase().includes(needle) ||
            (a.vendor ?? '').toLowerCase().includes(needle) ||
            (a.category ?? '').toLowerCase().includes(needle) ||
            (a.primaryDivisionName ?? '').toLowerCase().includes(needle),
        )
      : all;
  }, [data, kindName, q]);

  const groups = useMemo(() => {
    const byCat = new Map<string, App[]>();
    for (const a of apps) {
      const cat = a.category ?? 'Uncategorized';
      (byCat.get(cat) ?? byCat.set(cat, []).get(cat)!).push(a);
    }
    return [...byCat.entries()]
      .map(([category, rows]) => ({
        category,
        rows: rows.sort((x, y) => x.name.localeCompare(y.name)),
      }))
      .sort((x, y) => x.category.localeCompare(y.category));
  }, [apps]);

  if (loading)
    return <LoadingState baseClassName="text-slate-500" message="Loading applications…" />;
  if (error)
    return <ErrorMessage baseClassName="text-red-600">Failed to load applications.</ErrorMessage>;

  const totalTco = apps.reduce((n, a) => n + (a.totalTco ?? 0), 0);
  const sorCount = apps.filter((a) => a.systemOfRecord).length;

  return (
    <div>
      <BackButton className="mb-3" />
      <PageHeader
        eyebrow="Application kind"
        title={kindName}
        subtitle={[
          `${apps.length} application${apps.length === 1 ? '' : 's'}`,
          sorCount ? `${sorCount} system${sorCount === 1 ? '' : 's'} of record` : null,
          totalTco > 0 ? `$${Math.round(totalTco / 1000).toLocaleString()}K / yr run cost` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <div className="flex items-center justify-end pb-2">
        <ListSearch value={q} onChange={setQ} placeholder="Search application, vendor…" />
      </div>

      {groups.length === 0 ? (
        <EmptyState message="No applications of this kind." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.category} className="overflow-hidden p-0">
              <div className="px-4 py-2 border-b border-[#eaeaea] flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#525252]">
                  {g.category}
                </span>
                <span className="text-[11px] text-[#a3a3a3] tnum">{g.rows.length}</span>
              </div>
              {g.rows.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className="w-full text-left flex items-center gap-3 px-4 py-2 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
                >
                  <span className="flex-1 min-w-0 text-sm text-[#171717] font-medium truncate">
                    {a.name}
                  </span>
                  {a.systemOfRecord && (
                    <span className="hidden sm:inline text-[9px] font-semibold uppercase tracking-wide text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded px-1 py-0.5 flex-shrink-0">
                      SoR
                    </span>
                  )}
                  <span className="hidden md:inline text-[11px] text-[#737373] truncate max-w-[180px]">
                    {a.vendor ?? '—'}
                  </span>
                  <span className="hidden lg:inline text-[11px] text-[#a3a3a3] truncate max-w-[200px]">
                    {a.primaryDivisionName ?? '—'}
                  </span>
                  <span className="w-20 text-right text-[12px] tnum text-[#525252] flex-shrink-0">
                    {a.totalTco != null
                      ? `$${Math.round(a.totalTco / 1000).toLocaleString()}K`
                      : '—'}
                  </span>
                </button>
              ))}
            </Card>
          ))}
        </div>
      )}

      {selected && <AppDrawer app={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
