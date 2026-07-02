import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { withCompany } from '../lib/portfolio';
import PageHeader from '../components/PageHeader';
import { SCORE_LABEL, SCORE_COLOR, SCORE_DESC, automatablePct } from '../lib/automatable';
import { Card, EmptyState, ErrorMessage, LoadingState } from '../components/ui';

// A-03 — Automatable is a SNAPSHOT of where the company sits in its AI
// transformation, not a task list. It answers "how much of the work can an AI
// agent run today, and where?" The A-02 rollups (% automatable by Division /
// Department / Value stream / Role) live here — moved off the Tasks tab.
//
// Inclusion rule (A-02 decision): a task is "automatable" when its agent score
// reaches the Workflow Agent or Autonomous Agent tier (score ≤ 2). Assist /
// Augment / Human-only are excluded.

type Task = {
  id: string;
  division: string | null; department: string | null; roleName: string | null;
  owner: string | null; valueStreamName: string | null;
  agentScore: number | null;
};
type WorkData = { tasks: Task[] };

// Score → AI tier label (1 = most automatable … 5 = human-only).
const TIER_LABEL: Record<number, string> = {
  1: 'Autonomous Agent', 2: 'Workflow Agent', 3: 'AI Augmented', 4: 'AI Assistant', 5: 'Human-only',
};

const ROLLUP_DIMS = [
  { key: 'division', label: 'Division', of: (t: Task) => t.division },
  { key: 'department', label: 'Department', of: (t: Task) => t.department },
  { key: 'valueStream', label: 'Value stream', of: (t: Task) => t.valueStreamName },
  { key: 'role', label: 'Role', of: (t: Task) => t.roleName ?? t.owner },
] as const;

export default function Automatable() {
  const { companyId } = useCompany();
  const [data, setData] = useState<WorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dim, setDim] = useState<(typeof ROLLUP_DIMS)[number]['key']>('division');

  useEffect(() => {
    setLoading(true); setError('');
    api.get(withCompany('/work', companyId))
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [companyId]);

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const overall = useMemo(() => automatablePct(tasks.map((t) => t.agentScore)), [tasks]);

  // Tier distribution — count of scored tasks at each of the five tiers.
  const tiers = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let scored = 0;
    for (const t of tasks) if (typeof t.agentScore === 'number') { counts[t.agentScore]++; scored++; }
    return { counts, scored };
  }, [tasks]);

  // A-02 rollup — % automatable grouped by the chosen dimension.
  const active = ROLLUP_DIMS.find((d) => d.key === dim)!;
  const groups = useMemo(() => {
    const m = new Map<string, (number | null)[]>();
    for (const t of tasks) {
      const k = active.of(t) || '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t.agentScore);
    }
    return [...m.entries()]
      .map(([name, scores]) => ({ name, ...(automatablePct(scores) ?? { pct: 0, auto: 0, scored: 0 }) }))
      .filter((g) => g.scored > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [tasks, active]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const autoCount = tiers.counts[1] + tiers.counts[2];

  return (
    <div>
      <PageHeader
        title="Automatable"
        subtitle="Where the company stands in its AI transformation — how much of today's work an AI agent can run, and where it concentrates."
      />

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          {/* Headline snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Automatable today" value={overall ? `${overall.pct}%` : '—'}
              sub={overall ? `${overall.auto} of ${overall.scored} scored tasks` : 'no scored tasks'} accent />
            <Stat label="Automatable tasks" value={String(autoCount)} sub="Workflow + Autonomous tier" />
            <Stat label="Autonomous Agent" value={String(tiers.counts[1])} sub="agent runs end-to-end" />
            <Stat label="Workflow Agent" value={String(tiers.counts[2])} sub="agent with light setup" />
          </div>

          {/* Tier distribution — the full automatability spread */}
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-3">
              Automatability spread · {tiers.scored} scored tasks
            </div>
            <div className="flex w-full h-3 rounded-full overflow-hidden bg-[#f0f0f0]">
              {[1, 2, 3, 4, 5].map((s) => {
                const w = tiers.scored ? (100 * tiers.counts[s]) / tiers.scored : 0;
                return w > 0 ? <span key={s} title={`${TIER_LABEL[s]} — ${tiers.counts[s]}`} style={{ width: `${w}%`, background: SCORE_COLOR[s] }} /> : null;
              })}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[11px]" title={SCORE_DESC[s]}>
                  <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: SCORE_COLOR[s] }} />
                  <span className="text-[#525252]">{TIER_LABEL[s]}</span>
                  <span className="tnum font-medium text-[#171717]">{tiers.counts[s]}</span>
                  <span className="text-[#a3a3a3]">({SCORE_LABEL[s]})</span>
                </div>
              ))}
            </div>
          </Card>

          {/* A-02 rollup — % automatable by org / value dimension */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="text-[11px] text-[#737373]">
                <span className="font-semibold text-[#171717]">% automatable by {active.label.toLowerCase()}</span>
                {' '}— share of scored tasks at the Workflow or Autonomous tier
              </div>
              <div className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white p-0.5">
                {ROLLUP_DIMS.map((d) => (
                  <button key={d.key} type="button" onClick={() => setDim(d.key)}
                    className={'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ' +
                      (dim === d.key ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {groups.length === 0 ? (
              <EmptyState className="italic" message="No scored tasks." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {groups.map((g) => (
                  <div key={g.name} className="flex items-center gap-2.5 text-[11px]" title={`${g.auto}/${g.scored} tasks automatable`}>
                    <span className="truncate text-[#525252] flex-1 min-w-0" title={g.name}>{g.name}</span>
                    <span className="w-24 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden flex-shrink-0">
                      <span className="block h-full rounded-full bg-[#059669]" style={{ width: `${g.pct}%` }} />
                    </span>
                    <span className="tnum text-[#171717] font-medium w-9 text-right flex-shrink-0">{g.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
      <div className={'mt-1 text-2xl font-semibold tnum ' + (accent ? 'text-[#059669]' : 'text-[#171717]')}>{value}</div>
      <div className="text-[11px] text-[#737373] mt-0.5">{sub}</div>
    </Card>
  );
}
