import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import { MODES, HEAT, rolesUsing, efficiencyGain, type AiMode } from '../../lib/aiAdoption';
import { Card, EmptyState, ErrorMessage, LoadingState } from '../../components/ui';

// Active AI · value-stream drill-in. Reached from the heat map. Shows, for one
// value stream: the share of its roles utilizing AI (and the efficiency gain),
// the breakdown by autonomy mode, and the concrete use cases behind each mode.
// Levels + use cases come from the DB (/explorer/value-stream-adoption, stored
// on NodeAiAdoption and edited in Data Admin → Telemetry → AI adoption).

type UseCase = { title: string; persona: string; detail: string };
type ModeStats = { rolesUsingPct: number; efficiencyGainPct: number };

type AdoptionStream = {
  id: string; name: string; domain: string | null;
  cells: number[]; // 0-4 level per mode, in MODES order
  useCases: Partial<Record<AiMode['key'], UseCase[]>> | null;
  stats: Partial<Record<AiMode['key'], ModeStats>> | null;
};

// Legacy value-stream row — used only to count the roles participating in the
// stream (RoleValueStream links live on the legacy table).
type LegacyStream = { id: string; name: string; roleIds: string[] };

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card variant="elevated" className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
      <div className="text-2xl font-semibold text-[#171717] mt-1 tnum">{value}</div>
      {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
    </Card>
  );
}

export default function ActiveAIDetail() {
  const { id } = useParams();
  const [streams, setStreams] = useState<AdoptionStream[]>([]);
  const [legacy, setLegacy] = useState<LegacyStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get<{ valueStreams?: AdoptionStream[] }>('/explorer/value-stream-adoption'),
      api.get<{ valueStreams?: LegacyStream[] }>('/explorer/value-streams'),
    ])
      .then(([a, v]) => { setStreams(a.valueStreams ?? []); setLegacy(v.valueStreams ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // The :id is the canonical value-stream NODE id; older links may carry the
  // legacy ValueStream id, which resolves through the legacy list by name.
  const vs = useMemo(() => {
    const byNode = streams.find((s) => s.id === id);
    if (byNode) return byNode;
    const old = legacy.find((s) => s.id === id);
    return old ? streams.find((s) => s.name === old.name) ?? null : null;
  }, [streams, legacy, id]);

  const roleCount = useMemo(
    () => (vs ? legacy.find((s) => s.name === vs.name)?.roleIds.length ?? 0 : 0),
    [legacy, vs],
  );

  // Per-mode adoption + utilization for this stream. Levels, use cases AND the
  // statistics come from the DB (NodeAiAdoption, edited in Data Admin →
  // Telemetry → AI adoption); the code derivations remain only as a fallback
  // for streams whose stats were never seeded.
  const modeRows = useMemo(() => {
    if (!vs) return [];
    return MODES.map((mode, i) => {
      const level = vs.cells?.[i] ?? 0;
      const s = vs.stats?.[mode.key];
      const fallbackRoles = rolesUsing(level, roleCount);
      const rolesPct = s?.rolesUsingPct ?? fallbackRoles.pct;
      return {
        mode, level, useCases: vs.useCases?.[mode.key] ?? [],
        rolesPct,
        rolesCount: roleCount ? Math.round((rolesPct / 100) * roleCount) : fallbackRoles.count,
        effPct: s?.efficiencyGainPct ?? efficiencyGain(vs.name, mode.key, level),
      };
    });
  }, [vs, roleCount]);

  const summary = useMemo(() => {
    if (!vs) return null;
    const N = roleCount;
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
  }, [vs, roleCount, modeRows]);

  if (loading) return <LoadingState message="Loading value stream…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!vs || !summary) {
    return (
      <div>
        <PageHeader title="Value stream not found" />
        <Link to="/metrics" className="text-sm text-[#4338ca] hover:underline">← Back to the AI heat map</Link>
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
            <Card key={r.mode.key} variant="elevated" className={'overflow-hidden ' + (inactive ? 'opacity-70' : '')}>
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
                <EmptyState baseClassName="px-5 py-3 text-[13px] text-[#a3a3a3] italic" message="Not yet adopted in this value stream." />
              ) : r.useCases.length === 0 ? (
                <EmptyState baseClassName="px-5 py-3 text-[13px] text-[#a3a3a3] italic" message="No use cases recorded yet — add them in Data Admin → Metrics → AI adoption." />
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
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] text-[#a3a3a3] mt-4 italic">
        Adoption levels and use cases are read from the operating model and edited in Data Admin → Metrics → AI adoption.
      </p>
    </div>
  );
}
