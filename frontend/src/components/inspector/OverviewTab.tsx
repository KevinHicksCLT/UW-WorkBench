/**
 * Inspector Overview tab — the count tiles, the AI-automation snapshot, and
 * the Governance panel (standards + regulations inherited from ancestors).
 * Extracted verbatim from Inspector.tsx.
 */
import { Link } from 'react-router-dom';
import {
  scoreToPct,
  AutomatableMeter,
  SCORE_DESC,
  SCORE_COLOR,
  SCORE_LABEL,
} from '../../lib/automatable';
import type { Payload, Tab } from './types';

// ── Overview ──────────────────────────────────────────────────────────────────
export function OverviewTab({
  data,
  onTab,
  onRetarget,
}: {
  data: Payload;
  onTab: (t: Tab) => void;
  onRetarget: (id: string) => void;
}) {
  const tiles: { label: string; n: number; tab: Tab }[] = [
    { label: 'Roles', n: data.counts.roles, tab: 'Roles' },
    { label: 'Applications', n: data.counts.applications, tab: 'Applications' },
    { label: 'Deliverables', n: data.counts.deliverables, tab: 'Deliverables' },
    { label: 'Tasks', n: data.counts.tasks, tab: 'Tasks' },
    { label: 'Sub-tasks', n: data.counts.checklist, tab: 'Checklist' },
    { label: 'Sub-task testing', n: data.counts.testing, tab: 'Testing' },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={() => onTab(t.tab)}
            className="text-left rounded-lg border border-[#eaeaea] bg-[#f7f9fb] px-3 py-2.5 hover:bg-[#f5f8ff] hover:border-[#dbe7ff]"
          >
            <div className="text-[17px] font-bold text-[#171717] tabular-nums leading-none">
              {t.n}
            </div>
            <div className="text-[9.5px] text-[#737575] mt-1 leading-tight">{t.label}</div>
          </button>
        ))}
      </div>
      <AutomationPanel data={data} onRetarget={onRetarget} />

      {data.detail && (
        <div className="mt-4 rounded-lg bg-[#fbfcfd] border border-[#eaeaea] px-3 py-2.5 text-[11px] text-[#737575] leading-snug">
          The real, editable detail of one step. Everything here is the live, shared record.
        </div>
      )}
    </div>
  );
}

// Governance — the standards + regulations governing this node, inherited from
// its value-stream + area ancestors. Read-only; "N/A" when the area carries none.
export function GovernancePanel({ data }: { data: Payload }) {
  const scope = data.detail ? 'this step' : 'this branch';
  const Group = ({
    label,
    items,
    hrefs,
  }: {
    label: string;
    items: string[];
    hrefs?: Map<string, string>;
  }) => (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9.5px] font-medium uppercase tracking-wide text-[#a3a3a3]">
          {label}
        </span>
        <span className="text-[9.5px] text-[#a3a3a3] tabular-nums">{items.length || 'N/A'}</span>
      </div>
      {items.length ? (
        <div className="flex flex-wrap gap-1">
          {items.map((t) => {
            const cls =
              'max-w-full truncate rounded-md bg-[#f4ecf7] border border-[#e6d6f0] px-1.5 py-0.5 text-[10.5px] text-[#6c3fa0]';
            const href = hrefs?.get(t);
            return href ? (
              <Link key={t} to={href} title={t} className={cls + ' hover:bg-[#eee0f5]'}>
                {t}
              </Link>
            ) : (
              <span key={t} title={t} className={cls}>
                {t}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-[#a3a3a3] italic">N/A — none govern {scope}.</div>
      )}
    </div>
  );
  const regHrefs = new Map(
    data.regulations.map((r) => [r.title, `/regulations/requirement/${r.regId}`]),
  );
  return (
    <div className="mt-4 rounded-lg border border-[#eaeaea] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3] mb-2">
        Governance
      </div>
      <Group label="Standards" items={data.standards.map((s) => s.name)} />
      <Group label="Regulations" items={data.regulations.map((r) => r.title)} hrefs={regHrefs} />
    </div>
  );
}

// AI-automation snapshot, computed from the tasks' ability to be automated
// (score ≤ 2 = Workflow/Autonomous tier). Shows the overall % at this node, then
// a "% automatable by <next level down>" breakdown — value stream → PL3, PL3 →
// PL4, PL4 → step — so it adapts to whatever level we're on. At a step it shows
// that step's own 1-5 agent-automatability meter.
const pctColor = (p: number) => (p >= 67 ? '#059669' : p >= 34 ? '#d97706' : '#dc2626');

function AutomationPanel({
  data,
  onRetarget,
}: {
  data: Payload;
  onRetarget: (id: string) => void;
}) {
  const a = data.automation;
  // Single task → graded % from its 1-5 score (partial reads partial). Group →
  // share of tasks that are agent-runnable (score ≤ 2), as a count.
  const overall = data.detail
    ? typeof a.score === 'number'
      ? { pct: scoreToPct(a.score)!, auto: 0, scored: 1 }
      : null
    : a.pct != null
      ? { pct: a.pct, auto: a.auto, scored: a.scored }
      : null;
  const rows = (a.byChild ?? [])
    .filter((c) => c.scored > 0)
    .sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0));
  const levelWord = a.byChildLabel ?? 'level';
  return (
    <div className="mt-4 rounded-lg border border-[#eaeaea] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3] mb-2">
        AI automation
      </div>
      <div className="flex items-end gap-4">
        <div>
          <div
            className="text-[22px] font-bold leading-none tabular-nums"
            style={{ color: overall ? pctColor(overall.pct) : '#a3a3a3' }}
          >
            {overall ? `${overall.pct}%` : '—'}
          </div>
          <div className="text-[9.5px] text-[#737575] mt-1">Automatable by AI agents</div>
        </div>
        {!data.detail && overall && (
          <div className="text-[10.5px] text-[#737575] pb-0.5">
            {overall.auto} of {overall.scored} tasks can be
            <br />
            agent-run (Workflow + Autonomous)
          </div>
        )}
        {data.detail && typeof a.score === 'number' && (
          <div className="pb-0.5">
            <AutomatableMeter score={a.score} />
          </div>
        )}
      </div>

      {data.detail && typeof a.score === 'number' && (
        <div className="mt-2 rounded-md bg-[#fbfcfd] border border-[#eaeaea] px-2.5 py-1.5 text-[11px] text-[#525252] leading-snug">
          <span className="font-semibold" style={{ color: SCORE_COLOR[a.score] }}>
            {SCORE_LABEL[a.score]}
          </span>{' '}
          — {SCORE_DESC[a.score]}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1.5">
            % automatable by {levelWord.toLowerCase()}
          </div>
          <div className="flex flex-col gap-1.5">
            {rows.map((c) => {
              const p = c.pct ?? 0;
              return (
                <button key={c.id} onClick={() => onRetarget(c.id)} className="text-left group/row">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] text-[#171717] truncate group-hover/row:underline decoration-[#c8d6ea]">
                      {c.name}
                    </span>
                    <span
                      className="text-[10.5px] font-semibold tabular-nums flex-shrink-0"
                      style={{ color: pctColor(p) }}
                    >
                      {p}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${p}%`, background: pctColor(p) }}
                    />
                  </div>
                  <div className="text-[9px] text-[#a3a3a3] mt-0.5">
                    {c.auto} of {c.scored} tasks
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
