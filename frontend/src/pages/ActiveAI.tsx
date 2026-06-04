import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import {
  MODES, HEAT, SDLC_FLOW, KNOWLEDGE_AGENT, levelsFor, type AiMode,
} from '../lib/aiAdoption';

// Active AI — where AI is being applied across the company, and how far up the
// autonomy spectrum (AI assistant → fully autonomous agent). Two views:
//   1. The SDLC augmented phase-by-phase with purpose-built agents.
//   2. A heat map crossing every real value stream with the four AI modes.
// The adoption level IS the traffic light: red (piloting) → green (embedded),
// so leaders and laggards read at a glance. Use cases + levels are authored per
// value stream in lib/aiAdoption.ts, grounded in each stream's real work.

type ValueStream = {
  id: string; name: string; domain: string | null; domainId: string | null;
  divisionIds: string[]; categories: string[]; roleIds: string[];
};

// Soft accent for the SDLC band's mode tag (the software-delivery view).
const MODE_ACCENT: Record<AiMode['key'], string> = {
  assistant: '#6366f1', augmented: '#6366f1', workflow: '#4f46e5', agent: '#4338ca',
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

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    api.get('/explorer/value-streams')
      .then((d) => setStreams(d.valueStreams ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  // Build the heat matrix: one row per value stream, one cell (level) per mode.
  const rows = useMemo(() =>
    streams.map((vs) => ({ vs, cells: levelsFor(vs.name) })), [streams]);

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

      {/* Coverage headline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label="Value streams with AI" value={`${stats.anyAi}/${stats.total}`} hint="at least one active mode" />
        <Tile label="Embedded somewhere" value={stats.embedded} hint="a mode fully embedded" />
        <Tile label="Running autonomous agents" value={stats.autonomous} hint="beyond pilot" />
        <Tile label="SDLC phases agent-enabled" value={SDLC_FLOW.length} hint="planning → maintenance" />
      </div>

      {/* ── SDLC augmented with AI agents (software-delivery view) ──────────── */}
      <div className="card-elevated p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 className="text-sm font-semibold text-[#171717]">Augmenting the SDLC with AI agents</h2>
          <span className="hidden sm:inline-flex chip-soft">{KNOWLEDGE_AGENT.agent} span every phase</span>
        </div>
        <p className="text-xs text-[#666666] mb-4 max-w-3xl">
          The software-delivery view: each agent's output (human-approved) cascades to the next phase, maintaining
          end-to-end data fidelity and accelerating delivery.
        </p>

        {/* Phase flow — horizontally scrollable on small screens. */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-stretch gap-2 min-w-[860px]">
            {SDLC_FLOW.map((p, i) => {
              const mode = MODES.find((m) => m.key === p.mode)!;
              const accent = MODE_ACCENT[p.mode];
              return (
                <div key={p.phase} className="flex items-stretch gap-2 flex-1">
                  <div className="flex-1 rounded-lg border border-[#eaeaea] bg-white overflow-hidden flex flex-col">
                    {/* Phase header */}
                    <div className="px-3 py-2 bg-[#fafafa] border-b border-[#eaeaea]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="text-xs font-semibold text-[#171717] leading-tight">{p.phase}</div>
                    </div>
                    {/* Body */}
                    <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                        <span className="text-xs font-semibold text-[#171717] leading-tight">{p.agent}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.personas.map((h) => (
                          <span key={h} className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[10px] text-[#525252]">{h}</span>
                        ))}
                      </div>
                      <div className="mt-auto pt-1">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: accent + '14', color: accent }}
                          title={mode.desc}
                        >
                          {mode.label}
                        </span>
                        <div className="text-[10px] text-[#a3a3a3] mt-1 truncate" title={p.sor}>{p.sor}</div>
                      </div>
                    </div>
                  </div>
                  {/* Cascade arrow between phases */}
                  {i < SDLC_FLOW.length - 1 && (
                    <div className="self-center text-[#c7d2fe] flex-shrink-0" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Cross-cutting knowledge layer */}
          <div className="min-w-[860px] mt-2 rounded-lg border border-dashed border-[#c7d2fe] bg-[#f5f7ff] px-3 py-2 flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#4338ca] text-[10px] font-semibold text-white flex-shrink-0">{KNOWLEDGE_AGENT.agent}</span>
            <span className="text-[11px] text-[#4338ca]/80">{KNOWLEDGE_AGENT.blurb}</span>
          </div>
        </div>
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
        Adoption levels and use cases are illustrative — authored per value stream from its real work until live adoption telemetry is wired in.
      </p>
    </div>
  );
}

// One domain section: a sub-header row, then its value-stream rows.
function DomainGroup({ domain, rows }: { domain: string; rows: { vs: ValueStream; cells: number[] }[] }) {
  return (
    <>
      <tr className="bg-[#fafafa] border-b border-[#eaeaea]">
        <td colSpan={MODES.length + 1} className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#666666] sticky left-0 bg-[#fafafa]">
          {domain} <span className="text-[#a3a3a3] font-normal">· {rows.length}</span>
        </td>
      </tr>
      {rows.map(({ vs, cells }) => (
        <tr key={vs.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] group">
          <td className="px-5 py-2 sticky left-0 bg-white group-hover:bg-[#fafafa] z-10">
            <Link to={`/active-ai/${vs.id}`} className="text-sm text-[#171717] group-hover:text-[#4338ca] truncate block max-w-[260px]">
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
