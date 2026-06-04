import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import {
  MODES, HEAT, profileFor, rolesUsing, efficiencyGain,
} from '../lib/aiAdoption';

// Active AI · value-stream drill-in. Reached from the heat map. Shows, for one
// value stream: the share of its roles utilizing AI (and the efficiency gain),
// the breakdown by autonomy mode, and the concrete use cases — grounded in this
// stream's real work — behind each mode.

type ValueStream = {
  id: string; name: string; domain: string | null; domainId: string | null;
  divisionIds: string[]; categories: string[]; roleIds: string[];
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

export default function ActiveAIDetail() {
  const { id } = useParams();
  const [vs, setVs] = useState<ValueStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/explorer/value-streams')
      .then((d) => setVs((d.valueStreams ?? []).find((s: ValueStream) => s.id === id) ?? null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Per-mode adoption + utilization for this stream, from the authored profile.
  const modeRows = useMemo(() => {
    if (!vs) return [];
    const profile = profileFor(vs.name);
    const N = vs.roleIds.length;
    return MODES.map((mode) => {
      const p = profile[mode.key];
      const { count, pct } = rolesUsing(p.level, N);
      return {
        mode, level: p.level, useCases: p.useCases,
        rolesCount: count, rolesPct: pct,
        effPct: efficiencyGain(vs.name, mode.key, p.level),
      };
    });
  }, [vs]);

  const summary = useMemo(() => {
    if (!vs) return null;
    const N = vs.roleIds.length;
    const active = modeRows.filter((r) => r.level > 0);
    // A role utilizing any mode is utilizing AI; the broadest mode is the lower bound.
    const rolesUsingCount = Math.max(0, ...modeRows.map((r) => r.rolesCount));
    const rolesUsingPct = N ? Math.round((100 * rolesUsingCount) / N) : 0;
    // Efficiency blended across active modes, weighted by how many roles use each.
    const wSum = active.reduce((s, r) => s + r.rolesCount, 0);
    const avgEff = wSum ? Math.round(active.reduce((s, r) => s + r.effPct * r.rolesCount, 0) / wSum) : 0;
    const peak = [...modeRows].reverse().find((r) => r.level > 0)?.mode.label ?? 'None yet';
    const useCaseCount = active.reduce((s, r) => s + r.useCases.length, 0);
    return { N, rolesUsingCount, rolesUsingPct, avgEff, peak, useCaseCount };
  }, [vs, modeRows]);

  if (loading) return <div className="text-sm text-[#a3a3a3]">Loading value stream…</div>;
  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;
  if (!vs || !summary) {
    return (
      <div>
        <PageHeader title="Value stream not found" />
        <Link to="/active-ai" className="text-sm text-[#4338ca] hover:underline">← Back to the AI heat map</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={vs.domain ?? undefined}
        title={vs.name}
        subtitle="How AI is applied in this value stream — role utilization, efficiency gain, and the use cases behind each mode."
        actions={<Link to={`/overview?focus=${vs.id}`} className="btn-secondary">View in map →</Link>}
      />

      {/* Headline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label="Roles utilizing AI" value={`${summary.rolesUsingPct}%`} hint={`${summary.rolesUsingCount} of ${summary.N} ${summary.N === 1 ? 'role' : 'roles'}`} />
        <Tile label="Avg efficiency gain" value={summary.avgEff ? `+${summary.avgEff}%` : '—'} hint="reported time saved" />
        <Tile label="Active use cases" value={summary.useCaseCount} hint="across all modes" />
        <Tile label="Peak autonomy" value={summary.peak} hint="furthest mode in use" />
      </div>

      {/* Per-mode breakdown + use cases */}
      <div className="space-y-4">
        {modeRows.map((r) => {
          const h = HEAT[r.level];
          const inactive = r.level === 0;
          return (
            <div key={r.mode.key} className={'card-elevated overflow-hidden ' + (inactive ? 'opacity-70' : '')}>
              <div className="px-5 py-3.5 border-b border-[#eaeaea] flex flex-wrap items-center gap-x-6 gap-y-3">
                {/* Mode + level (the level chip carries the traffic-light colour) */}
                <div className="flex items-center gap-2.5 min-w-[210px]">
                  <span
                    className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{ backgroundColor: h.bg, color: h.fg }}
                  >
                    {h.short}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#171717] leading-tight">{r.mode.label}</div>
                    <div className="text-[11px] text-[#a3a3a3] leading-tight">{r.mode.short} · {h.name}</div>
                  </div>
                </div>

                {/* Roles utilizing — bar */}
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#666666]">Roles utilizing</span>
                    <span className="tnum text-[#171717] font-medium">{r.rolesPct}% · {r.rolesCount}/{summary.N}</span>
                  </div>
                  <div className="h-2 bg-[#f5f5f5] rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${r.rolesPct}%`, backgroundColor: '#16a34a', minWidth: r.rolesPct ? 2 : 0 }} />
                  </div>
                </div>

                {/* Efficiency gain */}
                <div className="text-right min-w-[110px]">
                  <div className="text-[11px] text-[#666666]">Efficiency gain</div>
                  <div className="text-lg font-semibold tnum text-[#171717] leading-tight">{r.effPct ? `+${r.effPct}%` : '—'}</div>
                </div>
              </div>

              {/* Use cases */}
              {inactive ? (
                <div className="px-5 py-3 text-[13px] text-[#a3a3a3] italic">Not yet adopted in this value stream.</div>
              ) : (
                <ul className="divide-y divide-[#f5f5f5]">
                  {r.useCases.map((u) => (
                    <li key={u.title} className="px-5 py-3 sm:flex sm:gap-5">
                      <div className="sm:w-56 flex-shrink-0 mb-1 sm:mb-0">
                        <div className="text-sm font-medium text-[#171717]">{u.title}</div>
                        <div className="text-[11px] text-[#a3a3a3] mt-0.5">{u.persona}</div>
                      </div>
                      <p className="text-[13px] text-[#525252] leading-relaxed min-w-0 flex-1">{u.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#a3a3a3] mt-4 italic">
        Utilization, efficiency and use cases are illustrative — authored per value stream from its real work until live adoption telemetry is wired in.
      </p>
    </div>
  );
}
