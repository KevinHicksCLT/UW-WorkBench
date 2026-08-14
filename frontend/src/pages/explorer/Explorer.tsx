import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useBackHandler } from '../../lib/navBack';
import MapCanvas from '../../viz/map/MapCanvas';
import ListExplorer from '../../components/ListExplorer';
import { TocView, ViewPills, type TocRow } from '../../components/TocView';
import { useViewState } from '../../lib/viewState';
import type { DivisionSummary } from '../../viz/model';
import { Chip, ErrorMessage, LoadingState } from '../../components/ui';
import {
  LENS_GENERIC,
  VariantLensBar,
  lensFromParams,
  type LensDimension,
} from '../../viz/map/VariantLensBar';

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
  // Server-computed full process total (L3 + L4 + L5 + the L6 task layer).
  processes?: number;
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
  // Persisted per session (lib/viewState) so returning restores the drilled domain.
  const [domain, setDomain] = useViewState<string | null>('explorer.tocDomain', null);
  useEffect(() => {
    api
      .get<{ divisions: TreeStream[] }>('/explorer/tree')
      .then((t) => setStreams(t.divisions ?? []))
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, []);

  // The header's back button pops the domain drill (lib/navBack); at the root
  // it falls through to history. No in-page back pill.
  useBackHandler(() => {
    if (domain === null) return false;
    setDomain(null);
    return true;
  });

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!streams) return <LoadingState message="Loading value streams…" className="animate-pulse" />;

  // Total processes below a stream — the server computes the FULL total
  // (L3 + L4 + L5 + L6 tasks); the tree-shape sum is only a fallback for a
  // payload that predates the field.
  const processCount = (s: TreeStream) =>
    s.processes ??
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
      <>
        <TocTotals
          text={`${domain} · ${rows.length} value streams · ${rows.reduce((a, r) => a + r.count, 0)} processes`}
        />
        <TocView
          stateKey="explorer.toc.streams"
          rows={rows}
          nameLabel="Value stream"
          countLabel="Processes"
          extraLabel="Process areas"
          unit="value streams"
          searchPlaceholder="Search value stream…"
          leading={leading}
        />
      </>
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
    <>
      <TocTotals
        text={`${rows.length} domains · ${streams.length} value streams · ${rows.reduce((a, r) => a + r.count, 0)} processes`}
      />
      <TocView
        stateKey="explorer.toc.domains"
        rows={rows}
        nameLabel="Domain"
        countLabel="Processes"
        extraLabel="Value streams"
        unit="domains"
        searchPlaceholder="Search domain…"
        leading={leading}
      />
    </>
  );
}

// Module totals on their own line ABOVE the pills/lens strip — the strip is
// too crowded to also hold the totals without wrapping (they used to sit
// inline via TocView's `totals` prop).
function TocTotals({ text }: { text: string }) {
  return <div className="pb-2 text-[11px] text-[#737373] tnum">{text}</div>;
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

  // Variant lens (map view) — Market › Segment › LOB › Cross-cutting, every
  // axis defaulting to the generic model. Picks live in the URL like the rest
  // of the view state; generic picks are simply absent params.
  const lens = lensFromParams(searchParams);
  const lensActive = Object.values(lens).some((v) => v !== LENS_GENERIC);
  const setLens = useCallback(
    (dimension: LensDimension['key'], value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === LENS_GENERIC) next.delete(dimension);
          else next.set(dimension, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const pillOptions = [
    { key: 'toc' as const, label: 'TOC' },
    { key: 'map' as const, label: 'Map' },
    { key: 'list' as const, label: 'List' },
  ];

  // One lens bar instance shared by all three views (TOC header strip, list
  // header strip, floating row on the map). All axes start Generic; until the
  // variant tables land a non-generic pick is annotational only.
  const lensBar = (
    <VariantLensBar
      lens={lens}
      onChange={setLens}
      trailing={
        lensActive ? (
          <Chip
            variant="soft"
            title="Variant deltas are not seeded yet; the generic model is shown."
          >
            Generic shown
          </Chip>
        ) : undefined
      }
    />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* TOC hosts the pills inline in its header strip; the full-bleed
            surfaces (map/list) get the hovering toggle. */}
        {/* Map is the only full-bleed surface that needs the hovering controls;
            TOC and List host the pills + lens inline in their header strips. */}
        {view === 'map' && (
          <div className="map-float-controls absolute top-3 left-4 z-20 flex items-center gap-3">
            <ViewPills options={pillOptions} view={view} onChange={setView} />
            {lensBar}
          </div>
        )}

        {view === 'toc' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
              <ValueStreamToc
                onPick={pickFromToc}
                leading={
                  <>
                    <ViewPills options={pillOptions} view={view} onChange={setView} />
                    {lensBar}
                  </>
                }
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
            leading={<ViewPills options={pillOptions} view={view} onChange={setView} />}
            lensBar={lensBar}
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
            focusVsId={focusVsId}
            onMoved={loadOverview}
          />
        )}
      </div>
    </div>
  );
}
