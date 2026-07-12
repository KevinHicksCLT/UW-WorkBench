/**
 * Data → board builder for the workspace board (v3 wireframe). ONE builder
 * serves both domains — the row axis, classification meta and domain arrive as
 * options (from the vocabulary), never as hardcoded arrays.
 *
 * v3 wireframe layout: ONE legacy panel on the left showing the selected
 * source's findings per layer section (app-switcher chips in its header), the
 * wide Normalize comparison column in the center (side-by-side source cards),
 * the Greenfield targets on the right, and the full-width dead-code lane.
 * Green stay-edges and red move-edges carry the wireframe's count badges.
 */
import type { Node, Edge } from '@xyflow/react';
import {
  categoryTags,
  staysHere,
  type AnatomyCategory,
  type ClassificationMeta,
  type ColumnStats,
  type Domain,
  type Finding,
  type FindingView,
  type Layer,
  type LayerMeta,
  type MatchMeta,
  type NormalizationEntry,
  type StageDetail,
} from '../../lib/rationalization';
import {
  GF_W,
  HEADER_H,
  LANE_GAP,
  LANE_H,
  LEG_W,
  NORM_W,
  PANEL_GAP,
  PANEL_PAD,
  X,
  columnXs,
  deadLaneHeight,
  estimateCellHeight,
  estimateNormalizeHeight,
  panelW,
  slotHeightFor,
  slotOffsets,
} from './cellGeometry';
import { tagKey, type CellAnatomyRow, type CellScreen, type ToggleCategoryFn } from './CellNode';
import type { EntryAction } from './normalizeNodes';
import { greenfieldEdge, moveEdge, sharedEdge, stayEdge } from './edges';
import type { DeadItem } from './boardNodes';

/** Inputs that shape the derived board beyond the stage detail itself. */
export type BoardBuildOptions = {
  /** WR-06 anatomy lens — null when the domain has no view axis. */
  view: FindingView | null;
  /** Expansion tokens per cell: `cell:<appId>:<layer>` → tokens. */
  expanded: Record<string, string[]>;
  onToggleCategory: ToggleCategoryFn;
  /** Anatomy-catalog rows (chip tooltips + product in-box anatomy, 3-D). */
  catalog?: AnatomyCategory[];
  /** Vocabulary-derived lookups (3-A) — the axis and all meta. */
  layers: Layer[];
  layerHints?: Record<string, string>;
  layerMeta?: Record<string, LayerMeta>;
  classification: ClassificationMeta;
  matchMeta: MatchMeta;
  domain: Domain;
  /** Which legacy source the left panel shows (defaults to the first). */
  selectedSourceId?: string | null;
  onSelectSource?: (appId: string) => void;
  /** Selected source pair framing Normalize comparisons when > 2 columns. */
  comparePair?: [string, string] | null;
  /** v3 interactions (all optional — the builder stays renderable in tests). */
  onSelectFinding?: (finding: Finding) => void;
  onEntryAction?: (entryId: string, action: EntryAction) => void;
  onRetireFinding?: (findingId: string) => void;
  onEditFinding?: (findingId: string) => void;
  onAddFinding?: (appId: string, layer: Layer) => void;
};

/** Header stats line: `12 screens · 60 steps · 43 correct · 17 move`. */
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
  const selApp = legacyApps.find((a) => a.id === opts.selectedSourceId) ?? legacyApps[0] ?? null;
  const entries = detail.normalizationEntries ?? [];
  const entriesByLayer = new Map<Layer, NormalizationEntry[]>();
  for (const e of entries) {
    const arr = entriesByLayer.get(e.layer) ?? [];
    arr.push(e);
    entriesByLayer.set(e.layer, arr);
  }

  // The two sources framing the Normalize comparison columns.
  const pairApps =
    legacyApps.length > 2 && opts.comparePair
      ? (opts.comparePair
          .map((id) => legacyApps.find((a) => a.id === id))
          .filter(Boolean) as typeof legacyApps)
      : legacyApps.slice(0, 2);
  const sourceNames: [string, string] | null =
    pairApps.length === 2 ? [pairApps[0].name, pairApps[1].name] : null;

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

  // Variable slot heights: the selected source's cell vs the Normalize box.
  const expandedFor = (appId: string, layer: Layer) => expanded[`cell:${appId}:${layer}`] ?? [];
  const tagsByLayer = layers.map((layer) =>
    selApp
      ? categoryTags(detail.findings, layer, classification, selApp.id, view ?? undefined)
      : [],
  );
  const slotHeights = layers.map((layer, li) =>
    slotHeightFor([
      selApp ? estimateCellHeight(tagsByLayer[li], expandedFor(selApp.id, layer)) : 0,
      estimateNormalizeHeight(entriesByLayer.get(layer) ?? []),
    ]),
  );
  const offsets = slotOffsets(slotHeights);
  const slotY = (li: number) => offsets[li] + PANEL_PAD;
  const boardHeight = slotHeights.reduce((s, h) => s + h, 0);

  // Panels — the three v3 columns (legacy source, Normalize, Greenfield).
  const xs = columnXs();
  const panelHeight = HEADER_H + boardHeight + PANEL_PAD;
  const ns = detail.normalizeStats;
  const selStats = selApp ? columnStatsById.get(selApp.id) : undefined;
  const columns: {
    key: string;
    x: number;
    width: number;
    title: string;
    sub?: string | null;
    stats: string | null;
    appId?: string;
    sources?: { id: string; name: string }[];
  }[] = [
    {
      key: 'legacy',
      x: xs.legacy,
      width: LEG_W,
      title: selApp?.name ?? 'Legacy',
      sub: 'what each screen captures · sends · processes · validates',
      stats: selApp ? columnStatsLine(selStats, screensByApp.get(selApp.id) ?? 0) : null,
      appId: selApp?.id,
      sources: legacyApps.map((a) => ({ id: a.id, name: a.name })),
    },
    {
      key: 'cap',
      x: xs.normalize,
      width: NORM_W,
      title: 'Normalize',
      sub: sourceNames ? `${sourceNames[0]} + ${sourceNames[1]} — one normalized model` : null,
      stats: ns
        ? `${ns.raw} raw steps · ${ns.normalized} normalized · ${ns.awaitingReview} awaiting review`
        : null,
    },
    {
      key: 'svc',
      x: xs.greenfield,
      width: GF_W,
      title: 'Greenfield',
      stats: detail.microservices.length ? `${detail.microservices.length} targets` : null,
    },
  ];
  for (const col of columns) {
    nodes.push({
      id: `panel:${col.key}`,
      type: 'panel',
      position: { x: col.x, y: -HEADER_H },
      data: { height: panelHeight, width: panelW(col.width) },
      zIndex: -10,
      focusable: false,
      style: { pointerEvents: 'none' },
      ...lock,
    });
    nodes.push({
      id: col.appId ? `hdr:${col.appId}` : `hdr:${col.key}`,
      type: 'header',
      position: { x: col.x + PANEL_PAD, y: -HEADER_H + 8 },
      data: {
        title: col.title,
        sub: col.sub ?? null,
        stats: col.stats,
        width: col.width,
        ...(col.appId ? { appId: col.appId } : {}),
        ...(col.sources && col.sources.length > 1
          ? { sources: col.sources, selectedId: col.appId, onSelect: opts.onSelectSource }
          : {}),
      },
      ...lock,
    });
  }

  const deadFindings = detail.findings.filter((f) => f.deadCode);
  const hasDeadLane = deadFindings.length > 0;

  layers.forEach((layer, li) => {
    nodes.push({
      id: `lbl:${layer}`,
      type: 'layerLabel',
      position: { x: X.label, y: offsets[li] + slotHeights[li] / 2 - 12 },
      data: { layer, hint: opts.layerHints?.[layer] ?? null },
      ...lock,
    });

    const tags = tagsByLayer[li];
    if (selApp) {
      nodes.push({
        id: `cell:${selApp.id}:${layer}`,
        type: 'cell',
        position: { x: xs.legacy + PANEL_PAD, y: slotY(li) },
        data: {
          layer,
          appId: selApp.id,
          tags,
          expanded: expandedFor(selApp.id, layer),
          onToggle: onToggleCategory,
          screens: screenByName,
          tips: tipsByLayer[layer] ?? {},
          sharedNames: sharedNameById,
          classification,
          layerMeta: opts.layerMeta?.[layer] ?? null,
          anatomyByTag: Object.fromEntries(
            tags.map((t) => [
              tagKey(t),
              (anatomyByLayerScope[`${layer}␟${(t.capdan ?? '').toUpperCase()}`] ?? []).slice(0, 6),
            ]),
          ),
          onSelectFinding: opts.onSelectFinding,
          onEditFinding: opts.onEditFinding,
          onAddFinding: opts.onAddFinding,
        },
        selectable: false,
      });
    }

    const hasNormalizeBox =
      detail.components.some((c) => c.layer === layer) || entriesByLayer.has(layer);
    const cellId = selApp ? `cell:${selApp.id}:${layer}` : null;

    // Green stay-edge with the wireframe's count badge.
    const stayCount = tags
      .filter((t) => t.stays)
      .reduce((s, t) => s + t.findings.filter((f) => !f.deadCode).length, 0);
    if (cellId && hasNormalizeBox && stayCount > 0)
      edges.push(stayEdge(`c-${layer}`, cellId, `cap:${layer}`, stayCount));

    // Relocations leave this layer for another — red move-edges with counts.
    const moversByTarget = new Map<Layer, number>();
    for (const t of tags) {
      if (t.stays || !t.targetLayer) continue;
      const live = t.findings.filter((f) => !f.deadCode).length;
      if (live > 0)
        moversByTarget.set(t.targetLayer, (moversByTarget.get(t.targetLayer) ?? 0) + live);
    }
    for (const [target, count] of moversByTarget) {
      if (!cellId || layerIndex[target] === undefined) continue;
      edges.push(moveEdge(`r-${layer}-${target}`, cellId, `cap:${target}`, `→ ${target}`, count));
    }

    // Dead findings in this section drop to the dead-code lane.
    const deadCount = tags.reduce((s, t) => s + t.findings.filter((f) => f.deadCode).length, 0);
    if (cellId && hasDeadLane && deadCount > 0)
      edges.push(moveEdge(`dead-${layer}`, cellId, 'lane:dead', '→ Dead code', deadCount));

    if (hasNormalizeBox) {
      const comp = detail.components.find((c) => c.layer === layer);
      const layerEntries = entriesByLayer.get(layer) ?? [];
      nodes.push({
        id: `cap:${layer}`,
        type: 'capdan',
        position: { x: xs.normalize + PANEL_PAD, y: slotY(li) },
        data: {
          layer,
          name: comp?.name ?? layer,
          componentId: comp?.id ?? null,
          destination: comp?.destination ?? null,
          rawCount: liveFindings.filter((f) => f.layer === layer).length,
          entries: layerEntries,
          matchMeta,
          sourceNames,
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
      position: { x: xs.greenfield + PANEL_PAD, y: slotY(slot) + stack * 100 },
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
  const columnsW = xs.greenfield + panelW(GF_W);
  let laneTop = boardHeight + PANEL_PAD + LANE_GAP;
  if (hasDeadLane) {
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
    const boxesW = PANEL_PAD * 2 + sharedApps.length * GF_W + (sharedApps.length - 1) * PANEL_GAP;
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
      data: { title: 'Shared services', stats: null, width: GF_W },
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
        position: { x: PANEL_PAD + i * (GF_W + PANEL_GAP), y: laneTop + HEADER_H + PANEL_PAD },
        data: { name: s.name, tech: s.techStack, count: countByService.get(s.id) ?? 0 },
      });
    });
    // One arrow per (cell → shared service) pair with relocating findings.
    const pairs = new Set<string>();
    for (const f of detail.findings) {
      if (!f.sharedServiceId || f.appId !== selApp?.id) continue;
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
