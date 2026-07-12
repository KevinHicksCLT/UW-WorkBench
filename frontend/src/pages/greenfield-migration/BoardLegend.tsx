/**
 * v3 board header strip: the legend (rendered from vocabulary `meta.legend`
 * rows — 3-A), the board-level roll-ups (*60 components · 43 correct · 17
 * move*, *102 raw → 58 normalized · 5 awaiting review · 7 dead code*), the
 * demo-data badge for fixture-sourced boards, and the selected-pair switcher
 * that frames Normalize comparisons when more than two sources render (3-B).
 */
import type { LegendItem, StageDetail } from '../../lib/rationalization';
import type { BoardSource } from './data';
import { LENS_SELECT_CLS } from './lens';

const chipCls =
  'inline-flex items-center gap-1.5 rounded-full border border-[#eaeaea] bg-white px-2.5 py-0.5 text-[11px] text-[#525252]';

export function BoardLegend({
  legend,
  detail,
  source,
  comparePair,
  onComparePair,
}: {
  legend: LegendItem[];
  detail: StageDetail | null;
  source: BoardSource;
  comparePair: [string, string] | null;
  onComparePair: (pair: [string, string]) => void;
}) {
  const legacyApps = (detail?.apps ?? []).filter((a) => a.kind !== 'SHARED_SERVICE');
  const stats = detail?.columnStats ?? [];
  const totals = stats.reduce(
    (acc, s) => ({
      raw: acc.raw + s.rawSteps,
      correct: acc.correct + s.correct,
      move: acc.move + s.move,
      dead: acc.dead + s.deadCode,
    }),
    { raw: 0, correct: 0, move: 0, dead: 0 },
  );
  const ns = detail?.normalizeStats;
  const pair = comparePair ?? [legacyApps[0]?.id ?? '', legacyApps[1]?.id ?? ''];
  const pickPair = (idx: 0 | 1, id: string) => {
    const next: [string, string] = [pair[0], pair[1]];
    next[idx] = id;
    onComparePair(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      {legend.map((l) => (
        <span key={l.text} className={chipCls}>
          <span
            aria-hidden="true"
            className="inline-block w-3 h-[3px] rounded-full"
            style={{ backgroundColor: l.dot }}
          />
          {l.text}
        </span>
      ))}
      {detail && stats.length > 0 && (
        <span className={`${chipCls} tnum`}>
          <strong className="text-[#171717]">{totals.raw}</strong> components ·{' '}
          <span className="text-[#047857] font-semibold">{totals.correct} correct</span> ·{' '}
          <span className="text-[#be123c] font-semibold">{totals.move} move</span>
        </span>
      )}
      {detail && ns && (
        <span className={`${chipCls} tnum`}>
          <strong className="text-[#171717]">{ns.raw} raw</strong> →{' '}
          <span className="text-[#047857] font-semibold">{ns.normalized} normalized</span> ·{' '}
          <span className="text-[#b45309] font-semibold">{ns.awaitingReview} awaiting review</span>
          {totals.dead > 0 && (
            <>
              {' '}
              · <span className="text-[#be123c] font-semibold">{totals.dead} dead code</span>
            </>
          )}
        </span>
      )}
      {source === 'fixture' && (
        <span
          className={`${chipCls} border-[#fde68a] bg-[#fffbeb] text-[#b45309]`}
          title="Rendering §6.2 contract fixtures — swaps to the live endpoint automatically once it responds"
        >
          demo data
        </span>
      )}
      {/* Normalize comparisons frame one source pair when > 2 columns (3-B). */}
      {legacyApps.length > 2 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-[#525252]">
          Compare
          {([0, 1] as const).map((idx) => (
            <select
              key={idx}
              aria-label={`Comparison source ${idx + 1}`}
              value={pair[idx]}
              onChange={(e) => pickPair(idx, e.target.value)}
              className={`${LENS_SELECT_CLS} max-w-[180px]`}
            >
              {legacyApps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ))}
        </span>
      )}
    </div>
  );
}
