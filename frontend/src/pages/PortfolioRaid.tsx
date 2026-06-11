import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { fmt } from '../lib/format';
import PageHeader from '../components/PageHeader';
import { SectionCard, SeverityCell, withCompany } from '../lib/portfolio';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';

// Portfolio-wide RAID log — a probability × impact risk heatmap plus the item
// list in the canonical Sheet format (see components/Sheet.tsx); Type / Status
// are column filters (status defaults to OPEN). Clicking a row expands its
// mitigation. Scoped to the active company.

type RaidRow = {
  id: string; type: string; title: string; mitigation: string | null; probability: number; impact: number;
  severity: number; status: string; dueDate: string | null; initiative: { id: string; name: string };
};

const TYPES = ['RISK', 'ASSUMPTION', 'ISSUE', 'DECISION'];

// Embeddable: pass `embedded` to render inside another page (Initiatives tab)
// without its own page header.
export default function PortfolioRaid({ embedded = false }: { embedded?: boolean } = {}) {
  const { companyId, loading: companyLoading } = useCompany();
  const [params] = useSearchParams();
  const [items, setItems] = useState<RaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  // ?type=RISK etc. presets the type filter (the Home RAID widget deep-links here).
  const linkedType = params.get('type') ?? '';

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    api.get(withCompany('/portfolio/raid', companyId))
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  // 5×5 probability × impact heatmap of OPEN RISK counts.
  const heatmap = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  for (const i of items) if (i.type === 'RISK' && i.status === 'OPEN') heatmap[i.probability - 1][i.impact - 1]++;

  const cols: SheetCol<RaidRow>[] = [
    {
      key: 'type', label: 'Type', width: '130px', value: (r) => r.type,
      render: (r) => <span className="pill-slate text-xs">{r.type}</span>,
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
        <SectionCard title="Open-risk heatmap (probability × impact)">
          <div className="flex">
            <div className="text-xs text-[#a3a3a3] flex flex-col justify-around pr-2 text-right" style={{ height: 200 }}>
              <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-0.5" style={{ height: 200 }}>
                {[5, 4, 3, 2, 1].map((p) => [1, 2, 3, 4, 5].map((i) => {
                  const sev = p * i;
                  const count = heatmap[p - 1][i - 1];
                  const bg = sev >= 16 ? 'bg-[#be123c]' : sev >= 9 ? 'bg-[#f59e0b]' : 'bg-[#10b981]';
                  return (
                    <div key={`${p}-${i}`} className={`${bg} flex items-center justify-center text-white font-bold text-xs rounded`} title={`Prob ${p} × Impact ${i} = ${sev}`}>
                      {count > 0 ? count : ''}
                    </div>
                  );
                }))}
              </div>
              <div className="flex justify-between text-xs text-[#a3a3a3] mt-1"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
              <div className="text-center text-xs text-[#a3a3a3] mt-1">Impact →</div>
            </div>
          </div>
          <div className="text-xs text-[#a3a3a3] mt-2">↑ Probability</div>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard title="Across the portfolio">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Open only — must agree with the Home RAID widget and the
                  default-filtered list below (one number per click path). */}
              {TYPES.map((t) => (
                <div key={t}>
                  <div className="text-xs text-[#a3a3a3]">{t} open</div>
                  <div className="text-xl font-semibold text-[#171717] tnum">{items.filter((i) => i.type === t && i.status === 'OPEN').length}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#a3a3a3] mt-4 pt-3 border-t border-[#f5f5f5]">
              Filter the list below by any column — Status starts on OPEN; clear it to see mitigated and closed items.
            </p>
          </SectionCard>
        </div>
      </div>

      <Sheet
        rows={items}
        cols={cols}
        rowKey={(r) => r.id}
        loading={loading}
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
