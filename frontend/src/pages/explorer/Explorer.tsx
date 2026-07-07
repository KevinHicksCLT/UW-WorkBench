import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useHeaderBreadcrumbSlot } from '../../lib/breadcrumbs';
import MapCanvas from '../../viz/map/MapCanvas';
import ListExplorer from '../../components/ListExplorer';
import { TocView, ViewPills, type TocRow } from '../../components/TocView';
import type { DivisionSummary } from '../../viz/model';
import { ErrorMessage, LoadingState } from '../../components/ui';

type View = 'toc' | 'map' | 'list';

// ── TOC (default view): one row per value stream — process count + divisions.
// Clicking a stream jumps to the LIST view focused on it (detail sidebar opens).
type TreeVS = { id: string; name: string; areas: { id: string; subProcesses: unknown[] }[] };
type TreeDiv = { name: string; valueStreams: TreeVS[] };

function ValueStreamToc({
  onPick,
  leading,
}: {
  onPick: (vsId: string) => void;
  leading?: React.ReactNode;
}) {
  const [rows, setRows] = useState<TocRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get<{ divisions: TreeDiv[] }>('/explorer/tree')
      .then((t) => {
        // A stream can hang under several divisions — dedupe and carry them all.
        const byId = new Map<string, { vs: TreeVS; divisions: Set<string> }>();
        for (const d of t.divisions ?? []) {
          for (const vs of d.valueStreams) {
            const e = byId.get(vs.id) ?? { vs, divisions: new Set<string>() };
            e.divisions.add(d.name);
            byId.set(vs.id, e);
          }
        }
        setRows(
          [...byId.values()]
            .sort((a, b) => a.vs.name.localeCompare(b.vs.name))
            .map(({ vs, divisions }) => ({
              id: vs.id,
              name: vs.name,
              count:
                vs.areas.length + vs.areas.reduce((a, ar) => a + (ar.subProcesses?.length ?? 0), 0),
              extra: [...divisions].sort().join(', '),
              onClick: () => onPick(vs.id),
            })),
        );
      })
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, [onPick]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!rows) return <LoadingState message="Loading value streams…" className="animate-pulse" />;
  return (
    <TocView
      rows={rows}
      nameLabel="Value stream"
      countLabel="Processes"
      extraLabel="Division"
      unit="value streams"
      searchPlaceholder="Search value stream, division…"
      leading={leading}
      totals={`${rows.length} value streams · ${rows.reduce((a, r) => a + r.count, 0)} processes`}
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

  // TOC row click → the LIST view focused on that stream (same deep-link path
  // the rest of the app uses; the URL carries it so "back" restores the spot).
  const pickFromToc = useCallback(
    (vsId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('focus', vsId);
          next.set('view', 'list');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
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
