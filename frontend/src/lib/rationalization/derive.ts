/**
 * Pure derivations for the workspace boards: §6.2 v3 defaults for pre-v3
 * payloads (withV3Defaults), the per-column / Normalize roll-ups, and the
 * categoryTags grouping that feeds the legacy cells.
 */
import type {
  AppCol,
  CategoryTag,
  Classification,
  ColumnStats,
  Finding,
  FindingView,
  Layer,
  NormalizationEntry,
  NormalizeStats,
  StageDetail,
} from './types';
import { findingView } from './types';
import { staysHere, type ClassificationMeta } from './vocabulary';

export const pct = (n: number) => `${Math.round(n * 100)}%`;

type RawFinding = Omit<Finding, 'capdan' | 'deadCode' | 'normalizationEntryId' | 'whyThisMoves'> &
  Partial<Pick<Finding, 'capdan' | 'deadCode' | 'normalizationEntryId' | 'whyThisMoves'>>;

/**
 * Default the §6.2 v3 finding fields for pre-v3 API payloads. Product-domain
 * findings classify by `scope` — when a payload sends only one of
 * scope/capdan, the other mirrors it so ONE builder serves both domains.
 */
export const normalizeFinding = (f: RawFinding): Finding => ({
  ...f,
  capdan: f.capdan ?? f.scope ?? 'Common',
  scope: f.scope ?? f.capdan,
  deadCode: f.deadCode ?? false,
  normalizationEntryId: f.normalizationEntryId ?? null,
  whyThisMoves: f.whyThisMoves ?? null,
});

/** Per-column roll-ups derived from findings (fallback when the API omits them). */
export function deriveColumnStats(
  apps: AppCol[],
  findings: Finding[],
  classification?: ClassificationMeta,
): ColumnStats[] {
  return apps
    .filter((a) => a.kind !== 'SHARED_SERVICE')
    .map((a) => {
      const own = findings.filter((f) => f.appId === a.id);
      const dead = own.filter((f) => f.deadCode);
      const live = own.filter((f) => !f.deadCode);
      const correct = live.filter((f) => staysHere(f.capdan, classification)).length;
      return {
        sourceId: a.id,
        rawSteps: own.length,
        correct,
        move: live.length - correct,
        deadCode: dead.length,
      };
    });
}

/** Normalize-column roll-up derived from entries + findings (fallback). */
export function deriveNormalizeStats(
  entries: NormalizationEntry[],
  findings: Finding[],
): NormalizeStats {
  return {
    raw: findings.filter((f) => !f.deadCode).length,
    normalized: entries.length,
    awaitingReview: entries.filter((e) => e.matchStatus !== 'AUTO').length,
  };
}

/**
 * Fill the §6.2 v3 board-detail fields when the API predates them: findings
 * get their v3 defaults; columnStats / normalizeStats are derived; the entry
 * list defaults empty; the domain defaults to APPLICATION.
 */
export function withV3Defaults(
  detail: StageDetail,
  classification?: ClassificationMeta,
): StageDetail {
  // Collections default to [] — endpoint payloads may omit ones they don't
  // model (e.g. product workspaces have no screens).
  const apps = detail.apps ?? [];
  const findings = (detail.findings ?? []).map(normalizeFinding);
  const normalizationEntries = detail.normalizationEntries ?? [];
  return {
    ...detail,
    domain: detail.domain ?? 'APPLICATION',
    apps,
    components: detail.components ?? [],
    microservices: detail.microservices ?? [],
    screens: detail.screens ?? [],
    byLayer: detail.byLayer ?? [],
    findings,
    normalizationEntries,
    columnStats: detail.columnStats ?? deriveColumnStats(apps, findings, classification),
    normalizeStats: detail.normalizeStats ?? deriveNormalizeStats(normalizationEntries, findings),
  };
}

/**
 * Group one cell's findings (app × layer) into category tags, ordered by the
 * classification vocabulary then descending count. When `view` is given, only
 * findings of that anatomy view feed the tags (WR-06); findings with a
 * missing view count as COMPONENT.
 */
export function categoryTags(
  findings: Finding[],
  layer: Layer,
  classification?: ClassificationMeta,
  appId?: string,
  view?: FindingView,
): CategoryTag[] {
  const byKey = new Map<string, CategoryTag>();
  for (const f of findings) {
    if (f.layer !== layer) continue;
    if (appId && f.appId !== appId) continue;
    if (view && findingView(f) !== view) continue;
    const cat = f.category ?? 'Other';
    const key = `${cat}␟${f.capdan}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count++;
      existing.findings.push(f);
    } else
      byKey.set(key, {
        appId: f.appId,
        layer,
        category: cat,
        capdan: f.capdan,
        stays: staysHere(f.capdan, classification),
        targetLayer: f.targetLayer,
        count: 1,
        findings: [f],
      });
  }
  const rank = (c: Classification) => {
    const i = classification?.order.indexOf(c) ?? -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...byKey.values()].sort((a, b) => rank(a.capdan) - rank(b.capdan) || b.count - a.count);
}
