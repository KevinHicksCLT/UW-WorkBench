import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { fmt } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { FALLBACK_BANDS, SectionCard, SeverityCell, useRiskBands, withCompany } from '../../lib/portfolio';
import { StatusPill } from '../../components/ui';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';

// Portfolio-wide RAID log — open-risk counts per severity band (the same
// company-configurable bands the severity badges use) plus the item list in
// the canonical Sheet format (see components/Sheet.tsx); Type / Status are
// column filters (status defaults to OPEN). Clicking a row expands its
// mitigation. Scoped to the active company.

type RaidRow = {
  id: string; type: string; title: string; mitigation: string | null; probability: number; impact: number;
  severity: number; status: string; dueDate: string | null; createdAt: string; initiative: { id: string; name: string };
};

const TYPES = ['RISK', 'ASSUMPTION', 'ISSUE', 'DECISION'];

// Embeddable: pass `embedded` to render inside another page (Initiatives tab)
// without its own page header. Pass `programId` to scope the log to one
// program — every program gets its own RAID log (program page → RAID tab).
export default function PortfolioRaid({ embedded = false, programId }: { embedded?: boolean; programId?: string } = {}) {
  const { companyId, loading: companyLoading } = useCompany();
  const bands = useRiskBands();
  const [params] = useSearchParams();
  const [items, setItems] = useState<RaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  // ?type=RISK etc. presets the type filter (the Home RAID widget deep-links here).
  const linkedType = params.get('type') ?? '';
  // ?new=1 narrows the list to items raised in the last 7 days (FB-31).
  const isNew = params.get('new') === '1';

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    api.get<RaidRow[]>(withCompany(programId ? `/portfolio/raid?programId=${programId}` : '/portfolio/raid', companyId))
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, companyLoading, programId]);

  // Open-risk counts per severity band, worst band first. Severity is the 5×5
  // probability × impact score; the bands map it to ratings (badges use the
  // same bands, so the chart and the list can never disagree).
  // Apply the "new" (last-7-days) narrowing once, up front; everything below
  // (band chart, type counts, list) then agrees.
  const shown = isNew
    ? items.filter((i) => Date.now() - new Date(i.createdAt).getTime() <= 86400000)
    : items;

  const effectiveBands = bands.length ? bands : FALLBACK_BANDS;
  const openRisks = shown.filter((i) => i.type === 'RISK' && i.status === 'OPEN');
  const bandRows = [...effectiveBands]
    .sort((a, b) => b.minScore - a.minScore)
    .map((band) => ({ band, count: openRisks.filter((r) => r.severity >= band.minScore && r.severity <= band.maxScore).length }));
  const bandMax = Math.max(1, ...bandRows.map((r) => r.count));

  const cols: SheetCol<RaidRow>[] = [
    {
      key: 'type', label: 'Type', width: '130px', value: (r) => r.type,
      render: (r) => <StatusPill tone="slate" className="text-xs">{r.type}</StatusPill>,
    },
    { key: 'title', label: 'Title', width: 'minmax(0,1.6fr)', value: (r) => r.title },
    {
      key: 'initiative', label: 'Initiative', width: 'minmax(0,1fr)', value: (r) => r.initiative.name,
      render: (r) => (
        <Link to={`/initiatives/${r.initiative.id}`} onClick={(e) => e.stopPropagation()} className="truncate text-[12px] text-[#4f46e5] hover:underline">
          {r.initiative.name}
        </Link>
      ),
    },
    {
      key: 'severity', label: 'Severity', width: '90px', value: (r) => String(r.severity), filterable: false,
      render: (r) => <SeverityCell value={r.severity} />,
    },
    { key: 'status', label: 'Status', width: '110px', value: (r) => r.status, dim: true },
    {
      key: 'due', label: 'Due', width: '100px', value: (r) => r.dueDate ?? '', filterable: false,
      render: (r) => <SheetCell text={fmt.date(r.dueDate)} dim />,
    },
  ];

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="RAID Log"
          subtitle="Risks, Assumptions, Issues and Decisions across the portfolio"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <SectionCard title="Open risks by severity">
          <div className="space-y-3">
            {bandRows.map(({ band, count }) => (
              <div
                key={band.id}
                className="flex items-center gap-3"
                title={`${band.label}: probability × impact score ${band.minScore}–${band.maxScore}${band.description ? ` — ${band.description}` : ''}`}
              >
                <div className="w-20 flex-shrink-0">
                  <div className="text-xs font-semibold" style={{ color: band.color }}>{band.label}</div>
                  <div className="text-[10px] text-[#a3a3a3] tnum">{band.minScore}–{band.maxScore}</div>
                </div>
                <div className="flex-1 h-5 bg-[#f5f5f5] rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(count / bandMax) * 100}%`, backgroundColor: band.color, minWidth: count ? 2 : 0 }} />
                </div>
                <div className="w-8 text-right text-sm font-semibold text-[#171717] tnum flex-shrink-0">{count}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#a3a3a3] mt-4 pt-3 border-t border-[#f5f5f5]">
            Severity = probability × impact on the 5×5 matrix. Bands are set in Data Admin → Initiatives → Risk scoring bands.
          </p>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard title={programId ? 'Across this program' : 'Across the portfolio'}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Open only — must agree with the Home RAID widget and the
                  default-filtered list below (one number per click path). */}
              {TYPES.map((t) => (
                <div key={t}>
                  <div className="text-xs text-[#a3a3a3]">{t} open</div>
                  <div className="text-xl font-semibold text-[#171717] tnum">{shown.filter((i) => i.type === t && i.status === 'OPEN').length}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#a3a3a3] mt-4 pt-3 border-t border-[#f5f5f5]">
              Filter the list below by any column — Status starts on OPEN; clear it to see mitigated and closed items.
            </p>
          </SectionCard>
        </div>
      </div>

      {isNew && (
        <div className="mb-2 flex items-center gap-2 text-xs text-[#525252]">
          <StatusPill tone="blue">New only</StatusPill>
          <span>Showing RAID items raised in the last 24 hours.</span>
          <Link to={programId ? `/programs/${programId}?tab=RAID` : '/raid'} className="text-[#4f46e5] hover:underline">Show all</Link>
        </div>
      )}

      <Sheet
        rows={shown}
        cols={cols}
        rowKey={(r) => r.id}
        loading={loading}
        unit="items"
        defaultFilters={{ status: 'OPEN', ...(TYPES.includes(linkedType) ? { type: linkedType } : {}) }}
        summarize={(v) => TYPES.map((t) => `${v.filter((r) => r.type === t).length} ${t.toLowerCase()}${v.filter((r) => r.type === t).length === 1 ? '' : 's'}`).join(' · ')}
        expand={(r) => (
          <div className="text-xs text-[#525252]">
            {r.mitigation ? (
              <><span className="font-semibold text-[#171717]">Mitigation: </span>{r.mitigation}</>
            ) : (
              <span className="text-[#a3a3a3] italic">No mitigation recorded.</span>
            )}
          </div>
        )}
      />
    </div>
  );
}
