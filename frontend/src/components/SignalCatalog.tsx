import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { withCompany } from '../lib/portfolio';

// SignalCatalog — the filterable inventory of every trackable signal/metric the
// operating model can measure: workforce/digital signals (Viva Insights, Microsoft
// 365, GitHub, delivery analytics) that roll up from the individual to the role,
// plus the operating-model KPIs from the workbook. Each signal drills DOWN TO THE
// ROLE LEVEL. Data: GET /explorer/telemetry-catalog (+ /telemetry-signal/by-role).

type Signal = {
  id: string; kind: 'workforce' | 'kpi' | 'system'; type: string; name: string; description: string | null;
  source: string | null; sourceTokens: string[]; category: string | null; framework: string | null;
  frequency: string | null; unit: string | null; direction: string; target: string | null;
  levels: string[]; store?: string; roleDrill: boolean;
  valueStreamName: string | null; domain: string | null; l3: string | null;
  ownerRole: string | null; ownerRoleId: string | null;
};
type Filters = { types: string[]; sources: string[]; categories: string[] };
type Catalog = { signals: Signal[]; filters: Filters };
type RoleRow = { roleId: string; roleName: string; value: number; people: number; unit: string };
type ByRole = { name: string; unit: string; period: string; roles: RoleRow[] };

const LEVEL_CLASS: Record<string, string> = {
  Individual: 'bg-[#eef2ff] text-[#4338ca]', Role: 'bg-[#e0e7ff] text-[#3730a3]',
  Team: 'bg-[#ecfdf5] text-[#047857]', Department: 'bg-[#fef3c7] text-[#92400e]',
  Division: 'bg-[#fae8ff] text-[#86198f]', Company: 'bg-[#f1f5f9] text-[#334155]',
  Executive: 'bg-[#ffe4e6] text-[#9f1239]', Product: 'bg-[#e0f2fe] text-[#0369a1]',
};

function Dropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="min-w-[120px]">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full rounded-lg border border-[#eaeaea] bg-white pl-3 pr-8 py-1.5 text-sm text-[#171717] cursor-pointer hover:border-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150"
        >
          {['All', ...options].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

function LevelChips({ levels }: { levels: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {levels.map((l) => (
        <span key={l} className={'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ' + (LEVEL_CLASS[l] ?? 'bg-[#f5f5f5] text-[#525252]')}>{l}</span>
      ))}
    </div>
  );
}

// Right-hand drawer: a signal broken down to the role level.
function RoleDrawer({ signal, companyId, onClose }: { signal: Signal; companyId: string | null; onClose: () => void }) {
  const [data, setData] = useState<ByRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true); setError('');
    const qs = withCompany(`/explorer/telemetry-signal/by-role?name=${encodeURIComponent(signal.name)}&store=${signal.store ?? 'signal'}`, companyId);
    api.get(qs).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [signal, companyId]);

  const max = Math.max(1, ...(data?.roles.map((r) => r.value) ?? [1]));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col" style={{ width: 460, maxWidth: '92vw' }}>
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">{signal.source} · by role</div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug">{signal.name}</div>
            {signal.description && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{signal.description}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-sm text-[#a3a3a3]">Loading role breakdown…</div>
          ) : error ? (
            <div className="text-sm text-[#be123c]">{error}</div>
          ) : !data || data.roles.length === 0 ? (
            <div className="text-sm text-[#a3a3a3] italic">No per-role readings available for this signal.</div>
          ) : (
            <>
              <div className="text-[11px] text-[#a3a3a3] mb-3">
                Average per role · {data.period} · {data.unit} · {data.roles.length} roles
              </div>
              <div className="flex flex-col gap-2.5">
                {data.roles.map((r) => (
                  <div key={r.roleId}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <Link to={`/roles/${r.roleId}`} className="text-[13px] text-[#171717] hover:text-[#4338ca] hover:underline truncate">{r.roleName}</Link>
                      <span className="text-[12px] font-semibold text-[#171717] tabular-nums flex-shrink-0">
                        {r.value} <span className="text-[#a3a3a3] font-normal">{r.unit}</span>
                        <span className="text-[10px] text-[#a3a3a3] ml-1.5">· {r.people} ppl</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4338ca]" style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function SignalCatalog({ companyId }: { companyId: string | null }) {
  const [data, setData] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drill, setDrill] = useState<Signal | null>(null);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const [source, setSource] = useState('All');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    setLoading(true); setError('');
    api.get(withCompany('/explorer/telemetry-catalog', companyId))
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const matchesSearch = (s: Signal) => !q || [s.name, s.description, s.ownerRole, s.valueStreamName, s.category, s.source]
      .some((v) => v?.toLowerCase().includes(q));
    return data.signals.filter((s) =>
      matchesSearch(s)
      && (type === 'All' || s.type === type)
      && (source === 'All' || s.sourceTokens.includes(source))
      && (category === 'All' || s.category === category)
    );
  }, [data, search, type, source, category]);

  const reset = () => { setSearch(''); setType('All'); setSource('All'); setCategory('All'); };
  const anyFilter = !!search || [type, source, category].some((v) => v !== 'All');

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-[#eaeaea]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-[#171717]">Trackable metrics</h2>
            <p className="text-[11px] text-[#666666] mt-0.5">
              Every signal the model can measure — workforce telemetry (Viva Insights, Microsoft 365, GitHub) and operating-model KPIs.
              Click a workforce signal to drill it down to the role level.
            </p>
          </div>
          <span className="text-[11px] text-[#a3a3a3] tnum">
            {loading ? '—' : `${filtered.length} of ${data?.signals.length ?? 0} signals`}
          </span>
        </div>

        {data && (
          <div className="flex items-end gap-3 flex-wrap mt-3">
            <div className="min-w-[180px] flex-1">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, description, owner…"
                className="w-full rounded-lg border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-[#171717] placeholder:text-[#c4c4c4] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150"
              />
            </div>
            <Dropdown label="Type" value={type} onChange={setType} options={data.filters.types} />
            <Dropdown label="Source" value={source} onChange={setSource} options={data.filters.sources} />
            <Dropdown label="Category" value={category} onChange={setCategory} options={data.filters.categories} />
            {anyFilter && (
              <button onClick={reset} className="text-xs text-[#525252] hover:text-[#171717] underline underline-offset-2 pb-2">Clear</button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="px-5 py-10 text-sm text-[#a3a3a3]">Loading signal catalog…</div>
      ) : error ? (
        <div className="px-5 py-10 text-sm text-[#be123c]">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-10 text-sm text-[#a3a3a3] italic">No signals match the filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1040px]">
            <thead>
              <tr className="border-b border-[#eaeaea] bg-[#fafafa]">
                {['Signal', 'Source', 'Category', 'Tracked at', 'Frequency', 'Target', 'Value stream / Owner', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] align-top">
                  <td className="px-4 py-2.5 max-w-[280px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-[#171717] font-medium leading-tight">{s.name}</span>
                      {s.kind === 'workforce' && <span className="inline-flex items-center px-1 py-0.5 rounded bg-[#eef2ff] text-[9px] font-semibold text-[#4338ca] uppercase tracking-wide flex-shrink-0">Viva</span>}
                    </div>
                    {s.description && <div className="text-[11px] text-[#a3a3a3] mt-0.5 leading-snug">{s.description}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-[#525252] whitespace-nowrap">{s.source ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {s.category && <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[11px] text-[#525252]">{s.category}</span>}
                  </td>
                  <td className="px-4 py-2.5"><LevelChips levels={s.levels} /></td>
                  <td className="px-4 py-2.5 text-[12px] text-[#525252] whitespace-nowrap">{s.frequency ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#525252] whitespace-nowrap">{s.target ?? ((s.unit ?? '').trim() || '—')}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#525252] max-w-[220px]">
                    {s.kind === 'kpi' ? (
                      <div>
                        <div className="truncate" title={s.valueStreamName ?? ''}>{s.valueStreamName ?? '—'}</div>
                        {s.ownerRole && (
                          s.ownerRoleId
                            ? <Link to={`/roles/${s.ownerRoleId}`} className="text-[11px] text-[#4338ca] hover:underline truncate block" title={s.ownerRole}>{s.ownerRole} →</Link>
                            : <div className="text-[10px] text-[#a3a3a3] truncate" title={s.ownerRole}>{s.ownerRole}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#a3a3a3]">All roles</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    {s.roleDrill && s.kind === 'workforce' && (
                      <button onClick={() => setDrill(s)} className="inline-flex items-center gap-1 rounded-md border border-[#dbe7ff] bg-[#f5f8ff] px-2 py-1 text-[11px] font-semibold text-[#1d4ed8] hover:bg-[#eaf1ff] transition-colors duration-150">
                        By role
                        <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drill && <RoleDrawer signal={drill} companyId={companyId} onClose={() => setDrill(null)} />}
    </div>
  );
}
