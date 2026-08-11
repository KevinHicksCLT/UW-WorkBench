// Pure roll-up helpers for the v3 board headers: the per-source column stats
// (brownfield header), the Normalize header stats, and the dead-code lane
// grouping. Server-computed values (BoardDetail.columnStats / normalizeStats)
// are authoritative when the shown scope matches what the server counted;
// these helpers provide the client-side fallback and the formatting.
import type { BoardApp, ColumnStat, Finding, NormalizeStats } from './types';

/** Client-side fallback for one source's column stats. Mirrors the backend's
 *  columnStatsOf semantics: dead code counts apart, then Relocate/Eliminate
 *  move, everything else is correct-here. */
export function clientColumnStat(sourceId: string, findings: Finding[]): ColumnStat {
  const s: ColumnStat = { sourceId, rawSteps: 0, correct: 0, move: 0, deadCode: 0 };
  for (const f of findings) {
    s.rawSteps++;
    if (f.deadCode) s.deadCode++;
    else if (f.capdan === 'Relocate' || f.capdan === 'Eliminate') s.move++;
    else s.correct++;
  }
  return s;
}

/** "80 steps · 43 correct · 17 move" — the brownfield column-header roll-up. */
export function columnStatSummary(s: ColumnStat): string {
  return `${s.rawSteps} steps · ${s.correct} correct · ${s.move} move`;
}

/** "3 dead code", or null when the source has none (the header omits it). */
export function columnDeadLabel(s: ColumnStat): string | null {
  return s.deadCode > 0 ? `${s.deadCode} dead code` : null;
}

/** Prefer the server's Normalize header roll-up when the rendered scope is the
 *  whole board it was computed for; otherwise the client-side numbers. */
export function normalizeHeaderStats(
  server: NormalizeStats | null | undefined,
  client: NormalizeStats,
  scopeIsFullBoard: boolean,
): NormalizeStats {
  return scopeIsFullBoard && server ? server : client;
}

/** Dead-code findings grouped per source application (apps order, no empties)
 *  — the full-width dead-code lane under the applications board. */
export interface DeadCodeGroup {
  appId: string;
  appName: string;
  findings: Finding[];
}

export function deadCodeGroups(findings: Finding[], apps: BoardApp[]): DeadCodeGroup[] {
  const dead = findings.filter((f) => f.deadCode);
  return apps
    .map((a) => ({
      appId: a.id,
      appName: a.name,
      findings: dead.filter((f) => f.appId === a.id),
    }))
    .filter((g) => g.findings.length > 0);
}
