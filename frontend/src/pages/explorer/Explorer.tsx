import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useHeaderBreadcrumbSlot } from '../../lib/breadcrumbs';
import MapCanvas from '../../viz/map/MapCanvas';
import ListExplorer from '../../components/ListExplorer';
import { TocBack, TocView, ViewPills, type TocRow } from '../../components/TocView';
import type { DivisionSummary } from '../../viz/model';
import { ErrorMessage, LoadingState } from '../../components/ui';

type View = 'toc' | 'map' | 'list';

// ── TOC (default view) — the process spine descended one level at a time,
// gold-standard style: domains (process L1) first, a domain's value streams
// (L2 — the tree's "divisions") next, then the stream drill page. The tree's
// nested "valueStreams" are its L3 process areas; they only feed the counts.
type TreeArea = { id: string; name: string; areas: { id: string; subProcesses: unknown[] }[] };
type TreeStream = {
  id: string;
  name: string;
  higherCategory: string | null;
  valueStreams: TreeArea[];
};

function ValueStreamToc({
  onPick,
  leading,
}: {
  onPick: (vsId: string) => void;
  leading?: React.ReactNode;
}) {
  const [streams, setStreams] = useState<TreeStream[] | null>(null);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<{ divisions: TreeStream[] }>('/explorer/tree')
      .then((t) => setStreams(t.divisions ?? []))
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, []);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!streams) return <LoadingState message="Loading value streams…" className="animate-pulse" />;

  // Total processes below a stream (its L3 areas + their L4 sub-processes).
  const processCount = (s: TreeStream) =>
    s.valueStreams.length +
    s.valueStreams.reduce(
      (a, l3) =>
        a + l3.areas.length + l3.areas.reduce((x, l4) => x + (l4.subProcesses?.length ?? 0), 0),
      0,
    );
  const domainOf = (s: TreeStream) => s.higherCategory ?? 'Core Business';

  // Level 2 — one domain's value streams; click through to the stream page.
  if (domain) {
    const rows: TocRow[] = streams
      .filter((s) => domainOf(s) === domain)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        id: s.id,
        name: s.name,
        count: processCount(s),
        extra: `${s.valueStreams.length} process area${s.valueStreams.length === 1 ? '' : 's'}`,
        onClick: () => onPick(s.id),
      }));
    return (
      <TocView
        rows={rows}
        nameLabel="Value stream"
        countLabel="Processes"
        extraLabel="Process areas"
        unit="value streams"
        searchPlaceholder="Search value stream…"
        leading={
          <>
            {leading}
            <TocBack label="All domains" onClick={() => setDomain(null)} />
          </>
        }
        totals={`${domain} · ${rows.length} value streams · ${rows.reduce((a, r) => a + r.count, 0)} processes`}
      />
    );
  }

  // Level 1 — domains (process L1).
  const byDomain = new Map<string, { streams: number; processes: number }>();
  for (const s of streams) {
    const key = domainOf(s);
    const e = byDomain.get(key) ?? { streams: 0, processes: 0 };
    e.streams++;
    e.processes += processCount(s);
    byDomain.set(key, e);
  }
  const rows: TocRow[] = [...byDomain.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, e]) => ({
      id: name,
      name,
      count: e.processes,
      extra: `${e.streams} value stream${e.streams === 1 ? '' : 's'}`,
      onClick: () => setDomain(name),
    }));
  return (
    <TocView
      rows={rows}
      nameLabel="Domain"
      countLabel="Processes"
      extraLabel="Value streams"
      unit="domains"
      searchPlaceholder="Search domain…"
      leading={leading}
      totals={`${rows.length} domains · ${streams.length} value streams · ${rows.reduce((a, r) => a + r.count, 0)} processes`}
    />
  );
}

export default function Explorer() {
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [companyName, setCompanyName] = useState('Enterprise');
  const [streams, setStreams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // View state lives in the URL — the single record of "where I was":
  //   `?focus=<valueStreamId>` → LIST view focused on that value stream (its
  //                              detail opens in the right sidebar); add
  //                              `view=map` to focus the map instead.
  //   `?vs=<name>`             → LIST focused by value-stream NAME (callers
  //                              that only know the name, e.g. Third-Parties).
  //   `?view=list|map`         → force that view.
  // The params are KEPT (not stripped) so the breadcrumb trail, browser
  // back/forward, and a reload all land the user back on the same spot.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const focusVsId = searchParams.get('focus');
  const focusVsName = searchParams.get('vs');
  const view: View =
    viewParam === 'map' || viewParam === 'list'
      ? viewParam
      : focusVsId || focusVsName
        ? 'list'
        : 'toc';

  const setView = useCallback(
    (v: View) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === 'toc') {
            next.delete('view');
            next.delete('focus');
            next.delete('vs');
            next.delete('node');
          } else {
            next.set('view', v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Load the map bootstrap (domains + L2 divisions). Exposed as a callback so the
  // map can re-run it after an edit-mode move (an L2 row could have changed).
  const loadOverview = useCallback(() => {
    api
      .get<{
        divisions?: {
          id: string;
          name: string;
          higherCategory?: string | null;
          higherCategoryId?: string | null;
          roles?: number;
        }[];
        company?: { name?: string };
        counts?: { valueStreams?: number };
      }>('/explorer/overview')
      .then((overview) => {
        // overview.divisions shape: { id, name, higherCategory, higherCategoryId, roles }
        // Null higherCategory → fold into "Core Business"
        const divs: DivisionSummary[] = (overview.divisions ?? []).map(
          (d: {
            id: string;
            name: string;
            higherCategory?: string | null;
            higherCategoryId?: string | null;
            roles?: number;
          }) => ({
            id: d.id,
            name: d.name,
            higherCategory: d.higherCategory ?? 'Core Business',
            higherCategoryId: d.higherCategoryId ?? null,
            roles: d.roles ?? 0,
          }),
        );
        setDivisions(divs);
        if (overview.company?.name) setCompanyName(overview.company.name);
        if (overview.counts?.valueStreams != null) setStreams(overview.counts.valueStreams);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? 'Failed to load');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // TOC row click → the stream's drill page (L3 areas → L4 → tasks), the same
  // gold-standard descent as the Standards TOC. Map/List stay one click away
  // from the page's header actions.
  const navigate = useNavigate();
  const pickFromToc = useCallback(
    (vsId: string) => navigate(`/streams/${encodeURIComponent(vsId)}`),
    [navigate],
  );

  // In map view the drill breadcrumb claims the GLOBAL header bar (Layout's
  // BreadcrumbBar) and MapCanvas portals into it — no in-page header strip.
  const crumbSlot = useHeaderBreadcrumbSlot(view === 'map');

  const pillOptions = [
    { key: 'toc' as const, label: 'TOC' },
    { key: 'map' as const, label: 'Map' },
    { key: 'list' as const, label: 'List' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* TOC hosts the pills inline in its header strip; the full-bleed
            surfaces (map/list) get the hovering toggle. */}
        {view !== 'toc' && (
          <ViewPills floating options={pillOptions} view={view} onChange={setView} />
        )}

        {view === 'toc' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
              <ValueStreamToc
                onPick={pickFromToc}
                leading={<ViewPills options={pillOptions} view={view} onChange={setView} />}
              />
            </div>
          </div>
        ) : view === 'list' ? (
          <ListExplorer
            divisions={divisions}
            companyName={companyName}
            streams={streams}
            focusVsId={focusVsId}
            focusVsName={focusVsName}
          />
        ) : loading ? (
          <div className="h-full grid place-items-center">
            <LoadingState className="animate-pulse" message="Loading operating model…" />
          </div>
        ) : error ? (
          <div className="h-full grid place-items-center">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        ) : (
          <MapCanvas
            divisions={divisions}
            companyName={companyName}
            breadcrumbSlot={crumbSlot}
            focusVsId={focusVsId}
            onMoved={loadOverview}
          />
        )}
      </div>
    </div>
  );
}
