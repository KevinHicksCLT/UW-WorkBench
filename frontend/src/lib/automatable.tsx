// Agent-automatability scale — shared rendering + math for the Work tab.
//
// Each task carries an `agentScore` of 1–5 (Claude's assessment of how readily
// an AI agent could perform it today): 1 = agent can do it end-to-end now, 5 =
// human-only. We express a group's "automatable %" as the mean of each task's
// score mapped linearly to a percent — score 1 → 100%, score 5 → 0%.

export const SCORE_LABEL: Record<number, string> = {
  1: 'Agent-ready',
  2: 'Needs setup',
  3: 'Partial',
  4: 'Mostly human',
  5: 'Human-only',
};

export const SCORE_DESC: Record<number, string> = {
  1: 'An AI agent can do this end-to-end today',
  2: 'Largely automatable, but needs integration/tooling or a light human check',
  3: 'Partially automatable — meaningful human judgment or coordination required',
  4: 'Mostly human — agent assists on sub-steps only',
  5: 'Human-only — accountability, negotiation, physical presence or sign-off',
};

const SCORE_COLOR: Record<number, string> = {
  1: '#059669', // emerald
  2: '#65a30d', // lime
  3: '#d97706', // amber
  4: '#ea580c', // orange
  5: '#dc2626', // red
};

// Per-task meter: five segments, the first (6 − score) filled in the score's
// colour (more filled + greener = more automatable). Title carries the rationale.
export function AutomatableMeter({ score, rationale }: { score?: number | null; rationale?: string | null }) {
  if (typeof score !== 'number') return <span className="text-[12px] text-[#c4c4c4]">—</span>;
  const filled = 6 - score; // score 1 → 5 filled, score 5 → 1 filled
  const color = SCORE_COLOR[score] ?? '#737373';
  const title = `${score}/5 · ${SCORE_LABEL[score]} — ${SCORE_DESC[score]}${rationale ? `\n\n“${rationale}”` : ''}`;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0" title={title}>
      <span className="inline-flex items-center gap-[2px] flex-shrink-0" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="w-[5px] h-[11px] rounded-[1px]" style={{ background: i <= filled ? color : '#ededed' }} />
        ))}
      </span>
      <span className="truncate text-[11px] font-medium" style={{ color }}>{SCORE_LABEL[score]}</span>
    </span>
  );
}
