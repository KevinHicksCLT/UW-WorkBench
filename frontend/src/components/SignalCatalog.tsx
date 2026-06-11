import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { withCompany } from '../lib/portfolio';
import { Sheet, SheetCell, type SheetCol } from './Sheet';

// SignalCatalog — the filterable inventory of every trackable signal/metric the
// operating model can measure, rendered in the canonical Sheet format (see
// components/Sheet.tsx): workforce/digital signals (Viva Insights, Microsoft
// 365, GitHub, delivery analytics) plus the operating-model KPIs from the
// workbook. Clicking a row expands its description + provenance; workforce
// signals drill DOWN TO THE ROLE LEVEL via the By-role button.
// Data: GET /explorer/telemetry-catalog (+ /telemetry-signal/by-role).

type Signal = {
  id: string; kind: 'workforce' | 'kpi' | 'system'; type: string; name: string; description: string | null;
  source: string | null; sourceTokens: string[]; category: string | null; framework: string | null;
  frequency: string | null; unit: string | null; direction: string; target: string | null;
  levels: string[]; store?: string; roleDrill: boolean;
  valueStreamName: string | null; domain: string | null; l3: string | null;
  ownerRole: string | null; ownerRoleId: string | null;
  provenance: string | null; calculation: string | null; unsourced: boolean;
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

  useEffect(() => {
    setLoading(true); setError('');
    api.get(withCompany('/explorer/telemetry-catalog', companyId))
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [companyId]);

  const cols: SheetCol<Signal>[] = [
    {
      key: 'name', label: 'Signal', width: 'minmax(0,1.4fr)', value: (s) => s.name,
      render: (s) => (
        <>
          <span className="truncate text-[12px] text-[#171717]">{s.name}</span>
          {s.kind === 'workforce' && <span className="inline-flex items-center px-1 py-0.5 rounded bg-[#eef2ff] text-[9px] font-semibold text-[#4338ca] uppercase tracking-wide flex-shrink-0">Viva</span>}
          {s.unsourced && <span className="inline-flex items-center px-1 py-0.5 rounded bg-[#fef3c7] text-[9px] font-semibold text-[#92400e] uppercase tracking-wide flex-shrink-0">No source</span>}
        </>
      ),
    },
    { key: 'type', label: 'Type', width: '90px', value: (s) => s.type, dim: true },
    { key: 'source', label: 'Source', width: '150px', values: (s) => s.sourceTokens, dim: true },
    { key: 'category', label: 'Category', width: '150px', value: (s) => s.category ?? '', dim: true },
    {
      // 'Role' is dropped from the chips — role-level rollup is the By-role drill, not a tracking level.
      key: 'levels', label: 'Tracked at', width: 'minmax(0,1fr)', values: (s) => s.levels.filter((l) => l !== 'Role'),
      render: (s) => <LevelChips levels={s.levels.filter((l) => l !== 'Role')} />,
    },
    { key: 'frequency', label: 'Frequency', width: '110px', value: (s) => s.frequency ?? '', dim: true },
    {
      key: 'target', label: 'Target', width: '110px',
      render: (s) => <SheetCell text={s.target ?? ((s.unit ?? '').trim() || '—')} dim />,
    },
    {
      key: 'owner', label: 'Value stream / Owner', width: 'minmax(0,1fr)',
      value: (s) => (s.kind === 'kpi' ? s.valueStreamName ?? '' : 'All roles'),
      render: (s) => s.kind === 'kpi' ? (
        <span className="truncate text-[12px] text-[#737373]" title={`${s.valueStreamName ?? ''}${s.ownerRole ? ` · ${s.ownerRole}` : ''}`}>
          {s.valueStreamName ?? '—'}
          {s.ownerRole && (
            s.ownerRoleId
              ? <Link to={`/roles/${s.ownerRoleId}`} onClick={(e) => e.stopPropagation()} className="text-[#4338ca] hover:underline"> · {s.ownerRole}</Link>
              : <span className="text-[#a3a3a3]"> · {s.ownerRole}</span>
          )}
        </span>
      ) : (
        <span className="text-[12px] text-[#a3a3a3]">All roles</span>
      ),
    },
    {
      key: 'drill', label: '', width: '90px',
      render: (s) => s.roleDrill && s.kind === 'workforce' ? (
        <button
          onClick={(e) => { e.stopPropagation(); setDrill(s); }}
          className="inline-flex items-center gap-1 rounded-md border border-[#dbe7ff] bg-[#f5f8ff] px-2 py-0.5 text-[11px] font-semibold text-[#1d4ed8] hover:bg-[#eaf1ff] transition-colors duration-150"
        >
          By role
          <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : null,
    },
  ];

  if (error) return <div className="px-1 py-6 text-sm text-[#be123c]">{error}</div>;

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-[#171717]">Trackable metrics</h2>
        <p className="text-[11px] text-[#666666] mt-0.5">
          Every signal the model can measure — workforce telemetry (Viva Insights, Microsoft 365, GitHub) and operating-model KPIs.
          Click a row for its description &amp; provenance; click <span className="font-semibold">By role</span> on a workforce signal to drill it down to the role level.
        </p>
      </div>

      <Sheet
        rows={data?.signals ?? []}
        cols={cols}
        rowKey={(s) => s.id}
        loading={loading}
        summarize={(v) => `${v.filter((s) => s.kind === 'workforce').length} workforce · ${v.filter((s) => s.kind === 'kpi').length} KPIs · ${v.filter((s) => s.kind === 'system').length} system`}
        expand={(s) => (
          <div className="space-y-1 text-[12px] text-[#525252]">
            {s.description && <div>{s.description}</div>}
            {s.provenance && <div><span className="font-semibold text-[#171717]">Source:</span> {s.provenance}</div>}
            {s.calculation && <div><span className="font-semibold text-[#171717]">Calculation:</span> {s.calculation}</div>}
            {!s.description && !s.provenance && !s.calculation && <div className="text-[#a3a3a3] italic">No further detail for this signal.</div>}
          </div>
        )}
      />

      {drill && <RoleDrawer signal={drill} companyId={companyId} onClose={() => setDrill(null)} />}
    </div>
  );
}
