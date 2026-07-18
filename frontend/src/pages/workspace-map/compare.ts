import { LAYERS, STATUS_WEIGHT } from './types';
import type {
  BoardComponent,
  BoardDetail,
  BoardMicroservice,
  BoardScreen,
  Finding,
  Layer,
  NormalizationEntry,
} from './types';

// On-the-fly cross-application comparison (generic — works for ANY pair of
// scanned applications). A cross-board comparison has no authored
// NormalizationEntry rows spanning its applications, so the shared/unique
// verdict is COMPUTED here from the findings themselves: steps from different
// applications that resolve to the same normalized name are consolidation
// candidates; everything else is application-specific and migrates as-is.
// Same-board comparisons keep their scan-authored entries (field-level match
// cards, review verdicts) — this module only serves mixed-board scopes.

/** Loose name key: case/punctuation-insensitive so "Validate FEIN" matches
 *  "validate_fein()" but unrelated steps never collide. */
function nameKey(f: Finding): string {
  return `${f.layer}|${f.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()}`;
}

/** Synthesize normalization entries for a cross-board scope: one AUTO entry
 *  per step name that appears in 2+ of the compared applications. Findings in
 *  no group stay uncovered and pass through 1→1 (the column renders them as
 *  application-specific). Zero overlap → zero entries — nothing pretends to
 *  consolidate. */
export function computeCrossAppEntries(findings: Finding[]): NormalizationEntry[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const k = nameKey(f);
    const g = groups.get(k) ?? [];
    g.push(f);
    groups.set(k, g);
  }
  const entries: NormalizationEntry[] = [];
  for (const [k, g] of groups) {
    const apps = new Set(g.map((f) => f.appId));
    if (apps.size < 2) continue;
    entries.push({
      id: `cmp:${k}`,
      layer: g[0].layer,
      notation: null,
      name: g[0].name,
      matchStatus: 'AUTO',
      matchBasis: `Matched on step name across ${apps.size} applications — computed by the comparison, not authored.`,
      differenceNote: null,
      proposedResolution: null,
      sourceCards: null,
      // Lands on the synthesized unified platform's floor for its layer.
      componentId: `cmp:c:${g[0].layer}`,
      findingIds: g.map((f) => f.id),
    });
  }
  return entries;
}

/** Word set of a screen name, case/punctuation-insensitive. */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean),
  );
}

/** Walking a screen in one application pulls the SEMANTICALLY MATCHING screen
 *  of every other compared application into the band — both apps' "Login"
 *  compare side by side. Match = token overlap (Jaccard ≥ 0.5) or full name
 *  containment; the best-scoring screen per application wins, none below the
 *  threshold. Returns appId → that app's matching screen name. */
export function matchScreensAcrossApps(
  screens: BoardScreen[],
  activeAppId: string,
  screenName: string,
): Map<string, string> {
  const walked = tokens(screenName);
  const lcWalked = screenName.toLowerCase().trim();
  const best = new Map<string, { name: string; score: number }>();
  for (const s of screens) {
    if (!s.appId || s.appId === activeAppId) continue;
    const t = tokens(s.name);
    const inter = [...t].filter((x) => walked.has(x)).length;
    const union = new Set([...t, ...walked]).size;
    const jaccard = union ? inter / union : 0;
    const lc = s.name.toLowerCase().trim();
    const contained = lc.includes(lcWalked) || lcWalked.includes(lc);
    const score = Math.max(jaccard, contained ? 0.6 : 0);
    if (score < 0.5) continue;
    const prev = best.get(s.appId);
    if (!prev || score > prev.score) best.set(s.appId, { name: s.name, score });
  }
  return new Map([...best].map(([appId, v]) => [appId, v.name]));
}

/** Catch-all area for steps recorded against no screen (services, jobs, infra). */
export const CORE_AREA = 'Core services';

/** Cluster the comparison's screens into FUNCTIONAL AREAS, on the fly: screens
 *  whose names semantically match (same rule as the screen walk) fall into one
 *  area — "Login" + "Login Page" become the Login area — and every finding maps
 *  to its screen's area (no screen → Core services). Keeps an "all screens"
 *  view readable without hiding any data: the Normalize column groups its
 *  cards under these areas.
 *
 *  `primaryOrder` is the screen picker's own option list (the walked
 *  application's screens, dropdown order): areas take THOSE names as labels
 *  and render in THAT order — the "all screens" view reads as the dropdown,
 *  walked top to bottom — with other applications' unmatched screens after
 *  them and Core services last. */
export function computeFunctionalAreas(
  screens: BoardScreen[],
  findings: Finding[],
  primaryOrder: string[] = [],
): { areaOf: Map<string, string>; order: string[] } {
  // Union-find over screen names (screens with equal names share a node).
  const names = [
    ...new Set([
      ...screens.map((s) => s.name),
      ...findings.map((f) => f.screenRef).filter((n): n is string => Boolean(n)),
    ]),
  ];
  const parent = new Map<string, string>(names.map((n) => [n, n]));
  const find = (n: string): string => {
    const p = parent.get(n) ?? n;
    if (p === n) return n;
    const root = find(p);
    parent.set(n, root);
    return root;
  };
  const unite = (a: string, b: string) => parent.set(find(a), find(b));
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = tokens(names[i]);
      const b = tokens(names[j]);
      const inter = [...a].filter((x) => b.has(x)).length;
      const union = new Set([...a, ...b]).size;
      const la = names[i].toLowerCase().trim();
      const lb = names[j].toLowerCase().trim();
      const contained = la.includes(lb) || lb.includes(la);
      if ((union ? inter / union : 0) >= 0.5 || contained) unite(names[i], names[j]);
    }
  // Area label + position: the cluster member that appears in the screen
  // dropdown wins (its name, its dropdown position); clusters the dropdown
  // doesn't know keep their shortest member name and sort after; Core last.
  const dropdownRank = new Map(primaryOrder.map((n, i) => [n, i]));
  const label = new Map<string, string>();
  const rank = new Map<string, number>();
  for (const n of names) {
    const root = find(n);
    const r = dropdownRank.get(n) ?? Number.MAX_SAFE_INTEGER;
    const cur = rank.get(root);
    if (cur === undefined || r < cur || (r === cur && n.length < (label.get(root)?.length ?? 99))) {
      label.set(root, n);
      rank.set(root, r);
    }
  }
  const areaOf = new Map<string, string>();
  const areaRank = new Map<string, number>();
  for (const f of findings) {
    const root = f.screenRef ? find(f.screenRef) : null;
    const area = root ? (label.get(root) ?? f.screenRef ?? CORE_AREA) : CORE_AREA;
    areaOf.set(f.id, area);
    if (!areaRank.has(area))
      areaRank.set(area, root ? (rank.get(root) ?? Number.MAX_SAFE_INTEGER) : Infinity);
  }
  const order = [...areaRank.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([n]) => n);
  return { areaOf, order };
}

export const UNIFIED_GF_ID = 'cmp:gf';

/** ONE greenfield platform for a cross-board comparison, synthesized on the
 *  fly: each layer slot merges the involved boards' target components — the
 *  slot is only as far along as the LEAST-advanced board — and the whole
 *  comparison lands in this single target instead of one card per board. */
export function synthesizeGreenfield(boards: BoardDetail[]): {
  microservice: BoardMicroservice;
  components: BoardComponent[];
} {
  const byLayer = new Map<Layer, BoardComponent[]>();
  for (const b of boards)
    for (const c of b.components) {
      const g = byLayer.get(c.layer) ?? [];
      g.push(c);
      byLayer.set(c.layer, g);
    }
  const components: BoardComponent[] = LAYERS.filter((l) => byLayer.has(l)).map((layer) => {
    const srcs = byLayer.get(layer) as BoardComponent[];
    const worst = srcs.reduce((a, c) =>
      (STATUS_WEIGHT[c.migrationStatus] ?? 0) < (STATUS_WEIGHT[a.migrationStatus] ?? 0) ? c : a,
    );
    return {
      id: `cmp:c:${layer}`,
      layer,
      name: [...new Set(srcs.map((s) => s.name))].join(' · '),
      destination: 'Unified Greenfield Platform',
      microserviceId: UNIFIED_GF_ID,
      migrationStatus: worst.migrationStatus,
      targetDate:
        srcs
          .map((s) => s.targetDate)
          .filter((d): d is string => Boolean(d))
          .sort()
          .at(-1) ?? null,
    };
  });
  const avg = components.length
    ? components.reduce((a, c) => a + (STATUS_WEIGHT[c.migrationStatus] ?? 0), 0) /
      components.length
    : 0;
  const microservice: BoardMicroservice = {
    id: UNIFIED_GF_ID,
    name: 'Unified Greenfield Platform',
    kind: 'Platform',
    status: avg >= 1 ? 'Live' : avg > 0.3 ? 'Building' : 'Planned',
    techStack: null,
    ownerRole: null,
    targetDate: null,
  };
  return { microservice, components };
}
