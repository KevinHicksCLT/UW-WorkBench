import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import SignalCatalog from '../components/SignalCatalog';
import { MODES, HEAT } from '../lib/aiAdoption';

// Active AI — where AI is being applied across the company, and how far up the
// autonomy spectrum (AI assistant → fully autonomous agent). A heat map crosses
// every real value stream with the four AI modes. The adoption level IS the
// traffic light: red (piloting) → green (embedded), so leaders and laggards read
// at a glance. Levels + use cases live in the DB (NodeAiAdoption), edited in
// Data Admin → Telemetry → AI adoption.

// Canonical value stream (Level node) + its AI-adoption levels (0-4 per mode),
// from /explorer/value-stream-adoption. Edited in Data Admin → Telemetry → AI adoption.
type ValueStream = {
  id: string; name: string; domain: string | null; cells: number[];
};

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card-elevated p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
      <div className="text-2xl font-semibold text-[#171717] mt-1 tnum">{value}</div>
      {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
    </div>
  );
}

export default function ActiveAI() {
  const { companyId, company, loading: companyLoading } = useCompany();
  const [streams, setStreams] = useState<ValueStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'adoption' | 'signals'>('adoption');

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    api.get('/explorer/value-stream-adoption')
      .then((d) => setStreams(d.valueStreams ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  // Build the heat matrix: one row per value stream, one cell (level) per mode.
  // Levels come straight from the DB (LevelAiAdoption), edited in Data Admin.
  const rows = useMemo(() =>
    streams.map((vs) => ({ vs, cells: vs.cells ?? [0, 0, 0, 0] })), [streams]);

  // Group rows by value-stream domain for readable section headers.
  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.vs.domain ?? 'Unassigned';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // Headline coverage stats across the whole map.
  const stats = useMemo(() => {
    const total = rows.length;
    const anyAi = rows.filter((r) => r.cells.some((c) => c > 0)).length;
    const embedded = rows.filter((r) => r.cells.some((c) => c >= 4)).length;
    const autonomous = rows.filter((r) => r.cells[3] >= 2).length;
    return { total, anyAi, embedded, autonomous };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Telemetry"
        subtitle="Where AI is applied across the company — and how far up the autonomy spectrum, from in-the-moment assistant to fully autonomous agent."
        eyebrow={company?.name}
      />

      {/* Sub-view switcher — AI adoption vs the trackable-signal catalog. */}
      <div className="border-b border-[#eaeaea] mb-5 flex gap-1">
        {([['adoption', 'AI Adoption'], ['signals', 'Trackable Metrics']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ' +
              (view === v ? 'text-[#171717] border-[#171717]' : 'text-[#a3a3a3] border-transparent hover:text-[#525252]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'signals' ? (
        <SignalCatalog companyId={companyId} />
      ) : (
      <>
      {/* Coverage headline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Tile label="Value streams with AI" value={`${stats.anyAi}/${stats.total}`} hint="at least one active mode" />
        <Tile label="Embedded somewhere" value={stats.embedded} hint="a mode fully embedded" />
        <Tile label="Running autonomous agents" value={stats.autonomous} hint="beyond pilot" />
      </div>

      {/* ── Value-stream × AI-mode heat map ────────────────────────────────── */}
      <div className="card-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-[#eaeaea] flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-[#171717]">AI adoption by value stream</h2>
            <p className="text-[11px] text-[#666666] mt-0.5">How far each value stream has taken AI at every point on the autonomy spectrum. Click a stream to drill in.</p>
          </div>
          {/* Legend — the level IS the traffic light (red behind → green ahead) */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
            {HEAT.map((h) => (
              <span key={h.name} className="inline-flex items-center gap-1.5 text-[10px] text-[#666666]">
                <span className="inline-block h-3 w-3 rounded-sm border border-black/5" style={{ backgroundColor: h.bg }} />
                {h.name}
              </span>
            ))}
          </div>
        </div>

        {loading || companyLoading ? (
          <div className="px-5 py-10 text-sm text-[#a3a3a3]">Loading value streams…</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-[#be123c]">{error}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-sm text-[#a3a3a3] italic">No value streams defined for this company.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-[#eaeaea]">
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] sticky left-0 bg-white z-10">
                    Value stream
                  </th>
                  {MODES.map((m) => (
                    <th key={m.key} className="px-2 py-2.5 text-center align-bottom" title={m.desc}>
                      <div className="text-[11px] font-semibold text-[#171717] leading-tight">{m.short}</div>
                      <div className="text-[10px] text-[#a3a3a3] font-normal leading-tight">{m.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([domain, grp]) => (
                  <DomainGroup key={domain} domain={domain} rows={grp} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mode descriptions footer */}
        <div className="px-5 py-3 border-t border-[#eaeaea] bg-[#fafafa] grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1.5">
          {MODES.map((m) => (
            <div key={m.key} className="text-[11px] text-[#666666]">
              <span className="font-semibold text-[#171717]">{m.label}:</span> {m.desc}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-[#a3a3a3] mt-3 italic">
        Adoption levels are read from the operating model (the same value streams as Value Streams and Home) and edited in
        Data Admin → Telemetry → AI adoption. Streams with no AI yet show “Not used”.
      </p>
      </>
      )}
    </div>
  );
}

// One domain section: a collapsible sub-header row, then its value-stream rows.
function DomainGroup({ domain, rows }: { domain: string; rows: { vs: ValueStream; cells: number[] }[] }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="bg-[#fafafa] border-b border-[#eaeaea] cursor-pointer hover:bg-[#f5f5f5]" onClick={() => setOpen((v) => !v)}>
        <td colSpan={MODES.length + 1} className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#666666] sticky left-0 bg-[#fafafa]">
          <button type="button" aria-expanded={open} className="inline-flex items-center gap-1.5 text-left">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={'text-[#a3a3a3] transition-transform duration-150 ' + (open ? '' : '-rotate-90')} aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
            {domain} <span className="text-[#a3a3a3] font-normal">· {rows.length}</span>
          </button>
        </td>
      </tr>
      {open && rows.map(({ vs, cells }) => (
        <tr key={vs.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] group">
          <td className="px-5 py-2 sticky left-0 bg-white group-hover:bg-[#fafafa] z-10">
            <Link to={`/overview?focus=${vs.id}`} className="text-sm text-[#171717] group-hover:text-[#4338ca] truncate block max-w-[260px]">
              {vs.name}
            </Link>
          </td>
          {cells.map((lvl, i) => {
            const h = HEAT[lvl];
            return (
              <td key={i} className="px-1.5 py-1.5">
                <div
                  className="h-7 rounded flex items-center justify-center text-[10px] font-medium select-none"
                  style={{ backgroundColor: h.bg, color: h.fg }}
                  title={`${vs.name} · ${MODES[i].label}: ${h.name}`}
                >
                  {h.short}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
