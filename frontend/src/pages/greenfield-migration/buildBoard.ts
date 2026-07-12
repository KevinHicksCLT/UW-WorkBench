/**
 * Data → board builder for the workspace board (v3). ONE builder serves both
 * domains — the row axis, classification meta and domain arrive as options
 * (from the vocabulary), never as hardcoded arrays. Renders N legacy columns
 * (the pre-v3 two-app cap is gone), per-column roll-up headers, Normalize
 * boxes with normalization entries, the full-width dead-code lane, the
 * shared-services lane (WR-15), and the green stay / red move edge model.
 */
import type { Node, Edge } from '@xyflow/react';
import {
  categoryTags,
  staysHere,
  type AnatomyCategory,
  type ClassificationMeta,
  type ColumnStats,
  type Domain,
  type FindingView,
  type Layer,
  type MatchMeta,
  type NormalizationEntry,
  type StageDetail,
} from '../../lib/rationalization';
import {
  BOX_W,
  PANEL_PAD,
  PANEL_W,
  PANEL_GAP,
  HEADER_H,
  LANE_GAP,
  LANE_H,
  X,
  deadLaneHeight,
  estimateCellHeight,
  estimateNormalizeHeight,
  panelX,
  slotHeightFor,
  slotOffsets,
} from './cellGeometry';
import { tagKey, type CellAnatomyRow, type CellScreen, type ToggleCategoryFn } from './CellNode';
import type { EntryAction } from './normalizeNodes';
import { chainEdge, greenfieldEdge, moveEdge, sharedEdge, stayEdge } from './edges';
import type { DeadItem } from './boardNodes';

/** Inputs that shape the derived board beyond the stage detail itself. */
export type BoardBuildOptions = {
  /** WR-06 anatomy lens — null when the domain has no view axis. */
  view: FindingView | null;
  /** WR-10 in-box expansion state: `cell:<appId>:<layer>` → expanded categories. */
  expanded: Record<string, string[]>;
  onToggleCategory: ToggleCategoryFn;
  /** Anatomy-catalog rows (chip tooltips + product in-box anatomy, 3-D). */
  catalog?: AnatomyCategory[];
  /** Vocabulary-derived lookups (3-A) — the axis and all meta. */
  layers: Layer[];
  layerHints?: Record<string, string>;
  classification: ClassificationMeta;
  matchMeta: MatchMeta;
  domain: Domain;
  /** Selected source pair framing Normalize comparisons when > 2 columns. */
  comparePair?: [string, string] | null;
  /** v3 interactions (all optional — the builder stays renderable in tests). */
  onEntryAction?: (entryId: string, action: EntryAction) => void;
  onRetireFinding?: (findingId: string) => void;
  onEditFinding?: (findingId: string) => void;
  onAddFinding?: (appId: string, layer: Layer) => void;
};

/** Header stats line: `12 screens · 80 steps · 43 correct · 17 move`. */
export function columnStatsLine(stats: ColumnStats | undefined, screens: number): string | null {
  if (!stats) return null;
  const parts = [
    ...(screens > 0 ? [`${screens} screens`] : []),
    `${stats.rawSteps} steps`,
    `${stats.correct} correct`,
    `${stats.move} move`,
    ...(stats.deadCode > 0 ? [`${stats.deadCode} dead`] : []),
  ];
  return parts.join(' · ');
}

// The data-derived board (before any user overlay). Panels, headers and layer
// labels are scaffolding — always locked; the cell / Normalize / service boxes
// follow the global `nodesDraggable` flag so they can be dragged in edit mode.
export function buildBoardBase(
  detail: StageDetail | null,
  opts: BoardBuildOptions,
): { nodes: Node[]; edges: Edge[] } {
  if (!detail) return { nodes: [] as Node[], edges: [] as Edge[] };
  const { view, expanded, onToggleCategory, catalog, layers, classification, matchMeta } = opts;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const layerIndex = Object.fromEntries(layers.map((l, i) => [l, i])) as Record<Layer, number>;
  const lock = { draggable: false, selectable: false } as const;

  // Shared services (WR-15) live in their own lane, not the legacy columns.
  const legacyApps = detail.apps.filter((a) => a.kind !== 'SHARED_SERVICE');
  const sharedApps = detail.apps.filter((a) => a.kind === 'SHARED_SERVICE');
  const entries = detail.normalizationEntries ?? [];
  const entriesByLayer = new Map<Layer, NormalizationEntry[]>();
  for (const e of entries) {
    const arr = entriesByLayer.get(e.layer) ?? [];
    arr.push(e);
    entriesByLayer.set(e.layer, arr);
  }

  // Layers owned by each greenfield service + kept-finding counts.
  const layersByService = new Map<string, Layer[]>();
  for (const c of detail.components)
    if (c.microserviceId) {
      const arr = layersByService.get(c.microserviceId) ?? [];
      arr.push(c.layer);
      layersByService.set(c.microserviceId, arr);
    }
  const liveFindings = detail.findings.filter((f) => !f.deadCode);
  const keptCountByLayer = (layer: Layer) =>
    liveFindings.filter((f) => f.layer === layer && staysHere(f.capdan, classification)).length;

  // Screen lookup + per-layer catalog tooltips + product anatomy rows (3-D).
  const screenByName: Record<string, CellScreen> = {};
  for (const s of detail.screens) screenByName[s.name] = { url: s.url, kind: s.kind };
  const tipsByLayer: Record<string, Record<string, string>> = {};
  const anatomyByLayerScope: Record<string, CellAnatomyRow[]> = {};
  for (const row of catalog ?? []) {
    const forLayer = (tipsByLayer[row.layer] ??= {});
    if (row.description && !forLayer[row.name]) forLayer[row.name] = row.description;
    if (row.scope) {
      const key = `${row.layer}␟${row.scope.toUpperCase()}`;
      anatomyByLayerScope[key] ??= [];
      anatomyByLayerScope[key].push({ name: row.name, description: row.description });
    }
  }
  const sharedNameById = Object.fromEntries(sharedApps.map((s) => [s.id, s.name]));
  const columnStatsById = new Map((detail.columnStats ?? []).map((s) => [s.sourceId, s]));
  const screensByApp = new Map<string, number>();
  for (const s of detail.screens)
    if (s.appId) screensByApp.set(s.appId, (screensByApp.get(s.appId) ?? 0) + 1);

  // Matched anatomy sub-categories per expanded tag (product boards, capped).
  const anatomyFor = (layer: Layer, capdan: string): CellAnatomyRow[] =>
    (anatomyByLayerScope[`${layer}␟${(capdan ?? '').toUpperCase()}`] ?? []).slice(0, 6);

  // Variable slot heights (WR-10 + v3): tags per layer × app are
  // view-filtered; each layer's slot grows to fit its tallest box — legacy
  // cells (with expansions, WHY panels, anatomy) or the Normalize box.
  const expandedFor = (appId: string, layer: Layer) => expanded[`cell:${appId}:${layer}`] ?? [];
  const tagsByLayerApp = layers.map((layer) =>
    legacyApps.map((a) =>
      categoryTags(detail.findings, layer, classification, a.id, view ?? undefined),
    ),
  );
  const slotHeights = layers.map((layer, li) =>
    slotHeightFor([
      ...legacyApps.map((a, i) =>
        estimateCellHeight(tagsByLayerApp[li][i], expandedFor(a.id, layer), (tag) =>
          expandedFor(a.id, layer).includes(tag.category)
            ? anatomyFor(layer, tag.capdan).length
            : 0,
        ),
      ),
      estimateNormalizeHeight(entriesByLayer.get(layer) ?? []),
    ]),
  );
  const offsets = slotOffsets(slotHeights);
  const slotY = (li: number) => offsets[li] + PANEL_PAD;
  const boardHeight = slotHeights.reduce((s, h) => s + h, 0);

  // Panels — one framed column per stage (each legacy source, Normalize,
  // Greenfield); header text is a separate node ON the band so the panel can
  // stay pointer-transparent (pan/zoom passes through, dblclick-app works).
  const appXs = legacyApps.map((_, i) => panelX(i));
  const capX = panelX(legacyApps.length);
  const svcX = panelX(legacyApps.length + 1);
  const panelHeight = HEADER_H + boardHeight + PANEL_PAD;
  const ns = detail.normalizeStats;
  const columns: { key: string; x: number; title: string; stats: string | null; appId?: string }[] =
    [
      ...legacyApps.map((a, i) => ({
        key: `app${i}`,
        x: appXs[i],
        title: a.name,
        stats: columnStatsLine(columnStatsById.get(a.id), screensByApp.get(a.id) ?? 0),
        appId: a.id,
      })),
      {
        key: 'cap',
        x: capX,
        title: 'Normalize',
        stats: ns
          ? `${ns.raw} raw → ${ns.normalized} · ${ns.awaitingReview} awaiting review`
          : null,
      },
      {
        key: 'svc',
        x: svcX,
        title: 'Greenfield',
        stats: detail.microservices.length ? `${detail.microservices.length} targets` : null,
      },
    ];
  for (const col of columns) {
    nodes.push({
      id: `panel:${col.key}`,
      type: 'panel',
      position: { x: col.x, y: -HEADER_H },
      data: { height: panelHeight },
      zIndex: -10,
      focusable: false,
      style: { pointerEvents: 'none' },
      ...lock,
    });
    nodes.push({
      id: col.appId ? `hdr:${col.appId}` : `hdr:${col.key}`,
      type: 'header',
      position: { x: col.x + PANEL_PAD, y: -HEADER_H + 10 },
      data: { title: col.title, stats: col.stats, ...(col.appId ? { appId: col.appId } : {}) },
      ...lock,
    });
  }

  // Which pair the Normalize comparison verdicts frame (>2 sources, 3-B).
  const pairLabel =
    legacyApps.length > 2 && opts.comparePair
      ? opts.comparePair
          .map((id) => legacyApps.find((a) => a.id === id)?.name)
          .filter(Boolean)
          .join(' vs ')
      : null;

  layers.forEach((layer, li) => {
    nodes.push({
      id: `lbl:${layer}`,
      type: 'layerLabel',
      position: { x: X.label, y: offsets[li] + slotHeights[li] / 2 - 12 },
      data: { layer, hint: opts.layerHints?.[layer] ?? null },
      ...lock,
    });

    // Edges flow strictly left → right so nothing crosses a box: each source
    // chains into the next, and only the LAST column connects across to the
    // Normalize box (kept + relocate findings of all sources union onto it).
    const tagsByApp = tagsByLayerApp[li];
    legacyApps.forEach((a, i) => {
      nodes.push({
        id: `cell:${a.id}:${layer}`,
        type: 'cell',
        position: { x: appXs[i] + PANEL_PAD, y: slotY(li) },
        data: {
          layer,
          appId: a.id,
          tags: tagsByApp[i],
          expanded: expandedFor(a.id, layer),
          onToggle: onToggleCategory,
          screens: screenByName,
          tips: tipsByLayer[layer] ?? {},
          sharedNames: sharedNameById,
          classification,
          anatomyByTag: Object.fromEntries(
            tagsByApp[i]
              .filter((t) => expandedFor(a.id, layer).includes(t.category))
              .map((t) => [tagKey(t), anatomyFor(layer, t.capdan)]),
          ),
          onEditFinding: opts.onEditFinding,
          onAddFinding: opts.onAddFinding,
        },
        selectable: false,
      });
      if (i > 0 && tagsByApp[i - 1].length > 0)
        edges.push(
          chainEdge(
            `f-${layer}-${i}`,
            `cell:${legacyApps[i - 1].id}:${layer}`,
            `cell:${a.id}:${layer}`,
          ),
        );
    });

    const hasNormalizeBox =
      detail.components.some((c) => c.layer === layer) || entriesByLayer.has(layer);
    const lastCell = legacyApps.length
      ? `cell:${legacyApps[legacyApps.length - 1].id}:${layer}`
      : null;
    if (lastCell && hasNormalizeBox && tagsByApp.some((tags) => tags.some((t) => t.stays)))
      edges.push(stayEdge(`c-${layer}`, lastCell, `cap:${layer}`));

    // Relocations leave this layer for another — red move-edges down the lane.
    const relocateTargets = [
      ...new Set(
        tagsByApp
          .flat()
          .filter((t) => !t.stays && t.targetLayer)
          .map((t) => t.targetLayer as Layer),
      ),
    ];
    for (const target of relocateTargets) {
      if (!lastCell || layerIndex[target] === undefined) continue;
      edges.push(moveEdge(`r-${layer}-${target}`, lastCell, `cap:${target}`, `→ ${target}`));
    }

    if (hasNormalizeBox) {
      const comp = detail.components.find((c) => c.layer === layer);
      const layerEntries = entriesByLayer.get(layer) ?? [];
      nodes.push({
        id: `cap:${layer}`,
        type: 'capdan',
        position: { x: capX + PANEL_PAD, y: slotY(li) },
        data: {
          layer,
          name: comp?.name ?? layer,
          componentId: comp?.id ?? null,
          destination: comp?.destination ?? null,
          rawCount: liveFindings.filter((f) => f.layer === layer).length,
          entries: layerEntries,
          matchMeta,
          pairLabel,
          onEntryAction: opts.onEntryAction,
        },
      });
    }
  });

  // Greenfield services — slotted onto the shared baseline grid at the slot
  // nearest the centre of the layers they own. Collisions advance to the
  // nearest free slot; overflow stacks within the slot.
  const usedSlots = new Map<number, number>();
  const pickSlot = (want: number) => {
    const clamp = Math.min(Math.max(want, 0), layers.length - 1);
    if (!usedSlots.has(clamp)) return clamp;
    for (let d = 1; d < layers.length; d++) {
      if (clamp + d < layers.length && !usedSlots.has(clamp + d)) return clamp + d;
      if (clamp - d >= 0 && !usedSlots.has(clamp - d)) return clamp - d;
    }
    return clamp;
  };
  detail.microservices.forEach((m) => {
    const owned = (layersByService.get(m.id) ?? [])
      .filter((l) => layerIndex[l] !== undefined)
      .sort((a, b) => layerIndex[a] - layerIndex[b]);
    const idxs = owned.length ? owned.map((l) => layerIndex[l]) : [Math.floor(layers.length / 2)];
    const slot = pickSlot(Math.round(idxs.reduce((s, v) => s + v, 0) / idxs.length));
    const stack = usedSlots.get(slot) ?? 0;
    usedSlots.set(slot, stack + 1);
    const count = owned.reduce((s, l) => s + keptCountByLayer(l), 0);
    nodes.push({
      id: `svc:${m.id}`,
      type: 'service',
      position: { x: svcX + PANEL_PAD, y: slotY(slot) + stack * 92 },
      data: { name: m.name, status: m.status, tech: m.techStack, layers: owned, count },
    });
  });
  for (const comp of detail.components) {
    if (!comp.microserviceId) continue;
    edges.push(
      greenfieldEdge(`d-${comp.layer}`, `cap:${comp.layer}`, `svc:${comp.microserviceId}`),
    );
  }

  // Full-width lanes below the grid: the v3 dead-code lane, then the
  // shared-services lane (WR-15).
  const columnsW = panelX(legacyApps.length + 1) + PANEL_W;
  let laneTop = boardHeight + PANEL_PAD + LANE_GAP;
  const deadFindings = detail.findings.filter((f) => f.deadCode);
  if (deadFindings.length > 0) {
    const appName = (id: string) => detail.apps.find((a) => a.id === id)?.name ?? 'unknown';
    const items: DeadItem[] = deadFindings.map((f) => ({
      id: f.id,
      name: f.name,
      appName: appName(f.appId),
      retired: f.migrationStatus === 'Retired',
    }));
    const deadH = deadLaneHeight(deadFindings.length);
    nodes.push({
      id: 'lane:dead',
      type: 'deadLane',
      position: { x: 0, y: laneTop },
      data: {
        items,
        width: columnsW,
        appCount: new Set(deadFindings.map((f) => f.appId)).size,
        onRetire: opts.onRetireFinding,
      },
      ...lock,
    });
    laneTop += deadH + LANE_GAP;
  }

  if (sharedApps.length > 0) {
    const boxesW = PANEL_PAD * 2 + sharedApps.length * BOX_W + (sharedApps.length - 1) * PANEL_GAP;
    nodes.push({
      id: 'panel:sharedLane',
      type: 'panel',
      position: { x: 0, y: laneTop },
      data: { height: LANE_H, width: Math.max(columnsW, boxesW) },
      zIndex: -10,
      focusable: false,
      style: { pointerEvents: 'none' },
      ...lock,
    });
    nodes.push({
      id: 'hdr:sharedLane',
      type: 'header',
      position: { x: PANEL_PAD, y: laneTop + 14 },
      data: { title: 'Shared services', stats: null },
      ...lock,
    });
    const countByService = new Map<string, number>();
    for (const f of detail.findings)
      if (f.sharedServiceId)
        countByService.set(f.sharedServiceId, (countByService.get(f.sharedServiceId) ?? 0) + 1);
    sharedApps.forEach((s, i) => {
      nodes.push({
        id: `shared:${s.id}`,
        type: 'shared',
        position: { x: PANEL_PAD + i * (BOX_W + PANEL_GAP), y: laneTop + HEADER_H + PANEL_PAD },
        data: { name: s.name, tech: s.techStack, count: countByService.get(s.id) ?? 0 },
      });
    });
    // One arrow per (cell → shared service) pair with relocating findings.
    const legacyIds = new Set(legacyApps.map((a) => a.id));
    const pairs = new Set<string>();
    for (const f of detail.findings) {
      if (!f.sharedServiceId || !legacyIds.has(f.appId)) continue;
      const key = `${f.appId}:${f.layer}:${f.sharedServiceId}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      const svcName = sharedNameById[f.sharedServiceId] ?? 'shared service';
      edges.push(
        sharedEdge(
          `sh-${key}`,
          `cell:${f.appId}:${f.layer}`,
          `shared:${f.sharedServiceId}`,
          `→ ${svcName}`,
        ),
      );
    }
  }

  return { nodes, edges };
}
