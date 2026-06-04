import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { fmt } from '../lib/format';
import PageHeader from '../components/PageHeader';
import { SectionCard, SeverityCell, withCompany } from '../lib/portfolio';

// Portfolio-wide RAID log — a probability × impact risk heatmap, type/status
// filters, and the filtered item table. Scoped to the active company.

type RaidRow = {
  id: string; type: string; title: string; mitigation: string | null; probability: number; impact: number;
  severity: number; status: string; dueDate: string | null; initiative: { id: string; name: string };
};

const TYPES = ['ALL', 'RISK', 'ASSUMPTION', 'ISSUE', 'DECISION'];
const STATUSES = ['ALL', 'OPEN', 'MITIGATED', 'CLOSED'];

// Embeddable: pass `embedded` to render inside another page (Initiatives tab)
// without its own page header.
export default function PortfolioRaid({ embedded = false }: { embedded?: boolean } = {}) {
  const { companyId, loading: companyLoading } = useCompany();
  const [items, setItems] = useState<RaidRow[]>([]);
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('OPEN');

  function load() {
    let path = '/portfolio/raid';
    const params: string[] = [];
    if (type !== 'ALL') params.push(`type=${type}`);
    if (status !== 'ALL') params.push(`status=${status}`);
    if (params.length) path += '?' + params.join('&');
    api.get(withCompany(path, companyId)).then(setItems).catch(() => {});
  }
  useEffect(() => { if (!companyLoading) load(); }, [type, status, companyId, companyLoading]);

  // 5×5 probability × impact heatmap of RISK counts.
  const heatmap = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  for (const i of items) if (i.type === 'RISK') heatmap[i.probability - 1][i.impact - 1]++;

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="RAID Log"
          subtitle="Risks, Assumptions, Issues and Decisions across the portfolio"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SectionCard title="Risk heatmap (probability × impact)">
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
          <SectionCard title="Filters">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <div className="flex flex-wrap gap-1">
                  {TYPES.map((t) => (
                    <button key={t} className={t === type ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setType(t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map((s) => (
                    <button key={s} className={s === status ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setStatus(s)}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-[#f5f5f5]">
              {['RISK', 'ASSUMPTION', 'ISSUE', 'DECISION'].map((t) => (
                <div key={t}>
                  <div className="text-xs text-[#a3a3a3]">{t}</div>
                  <div className="text-xl font-semibold text-[#171717] tnum">{items.filter((i) => i.type === t).length}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title={`Items (${items.length})`}>
        {items.length === 0 ? (
          <div className="text-sm text-[#a3a3a3]">No items match the filters.</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
                <tr>
                  <th className="text-left py-2 font-semibold w-24">Type</th>
                  <th className="text-left py-2 font-semibold">Title</th>
                  <th className="text-left py-2 font-semibold">Initiative</th>
                  <th className="text-center py-2 font-semibold w-20">Severity</th>
                  <th className="text-left py-2 font-semibold w-24">Status</th>
                  <th className="text-left py-2 font-semibold w-24">Due</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                    <td className="py-2.5"><span className="pill-slate text-xs">{r.type}</span></td>
                    <td className="py-2.5">
                      <div className="font-medium text-[#171717]">{r.title}</div>
                      {r.mitigation && <div className="text-xs text-[#a3a3a3] mt-0.5">{r.mitigation}</div>}
                    </td>
                    <td className="py-2.5">
                      <Link to={`/portfolio/initiatives/${r.initiative.id}`} className="text-[#4f46e5] hover:underline">{r.initiative.name}</Link>
                    </td>
                    <td className="py-2.5 text-center"><SeverityCell value={r.severity} /></td>
                    <td className="py-2.5 text-[#525252] text-xs">{r.status}</td>
                    <td className="py-2.5 text-[#525252] text-xs">{fmt.date(r.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
