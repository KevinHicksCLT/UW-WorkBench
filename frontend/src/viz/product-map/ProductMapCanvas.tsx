// ProductMapCanvas.tsx — Interactive product-model map with spatial drill-down.
// Company → L1 segments → L2 LOB families → L3 products → L4 versions →
// L5 model components, each level rendering as a centered row under its
// selected parent — the same literal drill-down map as the Organization view
// (OrgMapCanvas.tsx): same 150×68 cards, focus states, 11px breadcrumb,
// top-pinned camera, AND the identical edit system (drag to move/nest/reorder
// with children following, double-click to rename, hover +/× add/remove with
// cascade-delete confirm, custom pan, staged Save/Revert).
//
// Data comes from GET /product-spine/table (one bootstrap payload: company,
// user-editable level captions, per-level totals, and the full nested tree).
// Level names are ALWAYS taken from the payload's `levels`, never hardcoded.
// Writes go through the generic /builder/nodes endpoints (typeKey m1..m5 —
// the ProductNode spine; closure maintained transactionally server-side).
//
// Split for maintainability (mirrors viz/org-map/):
//   viz/product-map/productNodes.tsx      — payload types, card components, layout math
//   viz/product-map/useProductDragDrop.ts — edit-mode pointer drag/drop gesture
//   viz/product-map/useProductCamera.ts   — fit/center helpers + drill camera effects
//   viz/map/MapChrome.tsx                 — shared ghost / rename / toolbar / banner

import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { MAP_CARD_W, MAP_CARD_H, sentenceCase } from '../nodes/MapNode';
import type { NodeFocusState } from '../model';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { useDialogs } from '../../lib/dialogs';
import { useViewState } from '../../lib/viewState';
import { ErrorMessage, LoadingState } from '../../components/ui';
import { PLUS_GAP_SPREAD, type GapState, type RenameState } from '../map/constants';
import { DragGhost, RenameEditor, MapEditToolbar, MoveFlashBanner } from '../map/MapChrome';
import {
  productNodeTypes,
  gridPositions,
  gridHeight,
  segmentPalette,
  levelName,
  childCaption,
  attrString,
  attrStringArray,
  ROW_GAP_Y,
  PRODUCT_MAX_LEVEL,
  type ProductData,
  type ProductNode,
  type ProductDragState,
  type ProductMoveRec,
  type ProductCompanyData,
  type ProductSegmentData,
  type ProductLobData,
  type ProductProductData,
  type ProductVersionData,
  type ProductComponentData,
} from './productNodes';
import { ProductBreadcrumb } from './ProductBreadcrumb';
import { ProductComponentSidebar } from './ProductComponentSidebar';
import { useProductCamera } from './useProductCamera';
import { useProductDragDrop } from './useProductDragDrop';

// ── Inner canvas ─────────────────────────────────────────────────────────────

type Props = { breadcrumbSlot?: Element | null };

// A staged same-level arrival rendered under its new parent before Save (its
// real children/detail fill in on Save's refetch).
function synthNode(id: string, name: string, levelNumber: number): ProductNode {
  return {
    id,
    name,
    levelNumber,
    description: null,
    status: null,
    sortOrder: 0,
    attributes: null,
    rollup: {},
    children: [],
  };
}

function ProductMapCanvasInner({
  data,
  breadcrumbSlot,
  onSaved,
}: Props & { data: ProductData; onSaved: () => void }) {
  const rf = useReactFlow();
  const paneW = useStore((s) => s.width);
  const paneH = useStore((s) => s.height);
  const { companyId } = useCompany();
  const dialogs = useDialogs();

  // Drill state. The company starts open (segments visible), like the org map.
  // Persisted per session (lib/viewState) so leaving the tab and returning
  // restores the exact drill path and open component sidebar.
  const [companyOpen, setCompanyOpen] = useViewState<boolean>('product.map.companyOpen', true);
  const [selSegId, setSelSegId] = useViewState<string | null>('product.map.segment', null);
  const [selLobId, setSelLobId] = useViewState<string | null>('product.map.lob', null);
  const [selProductId, setSelProductId] = useViewState<string | null>('product.map.product', null);
  const [selVersionId, setSelVersionId] = useViewState<string | null>('product.map.version', null);
  // L5 leaf: opens the docked component sidebar instead of drilling deeper.
  const [selComponentId, setSelComponentId] = useViewState<string | null>(
    'product.map.component',
    null,
  );

  // ── Edit state (identical model to OrgMapCanvas / MapCanvas) ─────────────────
  const [editMode, setEditMode] = useState(false);
  const dragRef = useRef<ProductDragState | null>(null);
  const [drag, setDrag] = useState<ProductDragState | null>(null);
  const [gap, setGap] = useState<GapState | null>(null);
  const [nestTargetId, setNestTargetId] = useState<string | null>(null);
  const [moveFlash, setMoveFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setMoveFlash({ kind, text });
    flashTimer.current = window.setTimeout(() => setMoveFlash(null), 2600);
  }, []);
  const [pendingMoves, setPendingMoves] = useState<Map<string, ProductMoveRec>>(new Map());
  const [pendingOrder, setPendingOrder] = useState<Map<string, string[]>>(new Map());
  const [pendingRenames, setPendingRenames] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const dirty = pendingMoves.size > 0 || pendingOrder.size > 0 || pendingRenames.size > 0;
  const pendingCount = pendingMoves.size + pendingOrder.size + pendingRenames.size;
  const [rename, setRename] = useState<RenameState | null>(null);

  // Hovering "+" opens the insertion slot; CLOSING is delayed so micro pointer
  // wobbles don't snap the row back and forth, and OPENING is idempotent so a
  // re-entered gap returns the previous state object and React bails out of
  // the re-render (see MapCanvas — without this hover oscillates at ~40ms).
  const gapCloseTimer = useRef<number | null>(null);
  const plusHoverGap = useCallback((g: GapState | null) => {
    if (gapCloseTimer.current) {
      window.clearTimeout(gapCloseTimer.current);
      gapCloseTimer.current = null;
    }
    if (g)
      setGap((prev) => (prev?.hover && prev.index === g.index && prev.type === g.type ? prev : g));
    else
      gapCloseTimer.current = window.setTimeout(() => {
        gapCloseTimer.current = null;
        setGap((prev) => (prev?.hover ? null : prev));
      }, 250);
  }, []);

  // Canvas node id → raw ProductNode id.
  const rawNodeId = useCallback((node: { id: string }): string | null => {
    const id = node.id;
    if (id === 'company' || id.startsWith('add:')) return null;
    return id.replace(/^(seg|lob|prod|ver|comp):/, '');
  }, []);

  // Apply a parent's staged child order ('' keys the root segments row).
  const applyOrder = useCallback(
    (parentKey: string, arr: ProductNode[]): ProductNode[] => {
      const ord = pendingOrder.get(parentKey);
      if (!ord) return arr;
      const pos = new Map(ord.map((id, i) => [id, i]));
      return [...arr].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
    },
    [pendingOrder],
  );

  // ── Derived selection — pending-aware (mirrors the org map's display arrays):
  // staged departures leave their row, same-level arrivals join the focused
  // parent's row as synth cards, staged orders re-sort. Re-levels reconcile on
  // Save's refetch.
  const stageChildren = useCallback(
    (parentId: string | null, base: ProductNode[], levelNumber: number): ProductNode[] => {
      const key = parentId ?? '';
      let list = base.filter((n) => {
        const rec = pendingMoves.get(n.id);
        return !(rec && rec.parent !== parentId);
      });
      if (parentId) {
        for (const [id, rec] of pendingMoves) {
          if (rec.parent === parentId && !list.some((n) => n.id === id)) {
            list = [...list, synthNode(id, rec.name, levelNumber)];
          }
        }
      }
      return applyOrder(key, list);
    },
    [pendingMoves, applyOrder],
  );

  const segments = useMemo(() => stageChildren(null, data.roots, 1), [data.roots, stageChildren]);
  const selSegment = selSegId ? (segments.find((s) => s.id === selSegId) ?? null) : null;
  const segIndex = selSegment ? segments.indexOf(selSegment) : -1;
  const lobs = useMemo(
    () => (selSegment ? stageChildren(selSegment.id, selSegment.children, 2) : []),
    [selSegment, stageChildren],
  );
  const selLob = selLobId ? (lobs.find((l) => l.id === selLobId) ?? null) : null;
  const products = useMemo(
    () => (selLob ? stageChildren(selLob.id, selLob.children, 3) : []),
    [selLob, stageChildren],
  );
  const selProduct = selProductId ? (products.find((p) => p.id === selProductId) ?? null) : null;
  const versions = useMemo(
    () => (selProduct ? stageChildren(selProduct.id, selProduct.children, 4) : []),
    [selProduct, stageChildren],
  );
  const selVersion = selVersionId ? (versions.find((v) => v.id === selVersionId) ?? null) : null;
  const components = useMemo(
    () => (selVersion ? stageChildren(selVersion.id, selVersion.children, 5) : []),
    [selVersion, stageChildren],
  );
  const selComponent = selComponentId
    ? (components.find((c) => c.id === selComponentId) ?? null)
    : null;

  // ── Click handlers (drill in / toggle out) ─────────────────────────────────
  function onCompanyClick() {
    if (companyOpen) {
      setCompanyOpen(false);
      setSelSegId(null);
      setSelLobId(null);
      setSelProductId(null);
      setSelVersionId(null);
      setSelComponentId(null);
    } else setCompanyOpen(true);
  }
  function onSegmentClick(id: string) {
    setSelSegId(selSegId === id ? null : id);
    setSelLobId(null);
    setSelProductId(null);
    setSelVersionId(null);
    setSelComponentId(null);
  }
  function onLobClick(id: string) {
    setSelLobId(selLobId === id ? null : id);
    setSelProductId(null);
    setSelVersionId(null);
    setSelComponentId(null);
  }
  function onProductClick(id: string) {
    setSelProductId(selProductId === id ? null : id);
    setSelVersionId(null);
    setSelComponentId(null);
  }
  function onVersionClick(id: string) {
    setSelVersionId(selVersionId === id ? null : id);
    setSelComponentId(null);
  }
  function onComponentClick(id: string) {
    setSelComponentId(selComponentId === id ? null : id);
  }

  const crumbClear = useCallback(() => {
    setSelSegId(null);
    setSelLobId(null);
    setSelProductId(null);
    setSelVersionId(null);
    setSelComponentId(null);
  }, []);
  const crumbToSegment = () => {
    setSelLobId(null);
    setSelProductId(null);
    setSelVersionId(null);
    setSelComponentId(null);
  };
  const crumbToLob = () => {
    setSelProductId(null);
    setSelVersionId(null);
    setSelComponentId(null);
  };
  const crumbToProduct = () => {
    setSelVersionId(null);
    setSelComponentId(null);
  };

  // ── Build nodes and edges (from the staged display arrays) ──────────────────
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const LINE = '#9ca3af';
    const accent = segIndex >= 0 ? segmentPalette(segIndex).hex : LINE;

    const companyFs: NodeFocusState = companyOpen ? 'expanded' : 'neutral';
    ns.push({
      id: 'company',
      type: 'productCompany',
      position: { x: -MAP_CARD_W / 2, y: 0 },
      data: {
        name: data.company.name,
        childCaption: childCaption(segments.length, levelName(data.levels, 1)),
        focusState: companyFs,
      } satisfies ProductCompanyData,
      draggable: false,
      selectable: false,
    });
    if (!companyOpen) return { nodes: ns, edges: es };

    const segTop = MAP_CARD_H + 40;
    const segPos = gridPositions(segments.length, 0, segTop);
    let lobCenterX = 0;
    segments.forEach((seg, i) => {
      const id = `seg:${seg.id}`;
      const isSel = selSegId === seg.id;
      const fs: NodeFocusState = !selSegId ? 'neutral' : isSel ? 'expanded' : 'dimmed';
      ns.push({
        id,
        type: 'productSegment',
        position: segPos[i],
        data: {
          name: seg.name,
          childCaption: childCaption(seg.children.length, levelName(data.levels, 2)),
          paletteIndex: i,
          focusState: fs,
          pieceIndex: i,
        } satisfies ProductSegmentData,
        draggable: false,
      });
      es.push({
        id: `e:company->${id}`,
        source: 'company',
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isSel ? accent : LINE,
          strokeWidth: isSel ? 2 : 1.25,
          strokeOpacity: isSel ? 0.95 : selSegId ? 0.2 : 0.55,
        },
      });
      if (isSel) lobCenterX = segPos[i].x + MAP_CARD_W / 2;
    });

    if (!selSegment) return { nodes: ns, edges: es };
    const lobTop = segTop + gridHeight(segments.length) + ROW_GAP_Y;
    const lobPos = gridPositions(lobs.length, lobCenterX, lobTop);
    let prodCenterX = lobCenterX;
    lobs.forEach((lob, i) => {
      const id = `lob:${lob.id}`;
      const isSel = selLobId === lob.id;
      const fs: NodeFocusState = !selLobId ? 'neutral' : isSel ? 'focused' : 'dimmed';
      ns.push({
        id,
        type: 'productLob',
        position: lobPos[i],
        data: {
          name: lob.name,
          childCaption: childCaption(lob.children.length, levelName(data.levels, 3)),
          paletteIndex: segIndex,
          focusState: fs,
          pieceIndex: i,
        } satisfies ProductLobData,
        draggable: false,
      });
      es.push({
        id: `e:seg->${id}`,
        source: `seg:${selSegment.id}`,
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isSel ? accent : LINE,
          strokeWidth: isSel ? 2 : 1.25,
          strokeOpacity: isSel ? 0.95 : selLobId ? 0.18 : 0.6,
        },
      });
      if (isSel) prodCenterX = lobPos[i].x + MAP_CARD_W / 2;
    });

    if (!selLob) return { nodes: ns, edges: es };
    const prodTop = lobTop + gridHeight(lobs.length) + ROW_GAP_Y;
    const prodPos = gridPositions(products.length, prodCenterX, prodTop);
    let verCenterX = prodCenterX;
    products.forEach((p, i) => {
      const id = `prod:${p.id}`;
      const isSel = selProductId === p.id;
      const fs: NodeFocusState = !selProductId ? 'neutral' : isSel ? 'focused' : 'dimmed';
      ns.push({
        id,
        type: 'productProduct',
        position: prodPos[i],
        data: {
          name: p.name,
          childCaption: childCaption(p.children.length, levelName(data.levels, 4)),
          paletteIndex: segIndex,
          focusState: fs,
          pieceIndex: i,
        } satisfies ProductProductData,
        draggable: false,
      });
      es.push({
        id: `e:lob->${id}`,
        source: `lob:${selLob.id}`,
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isSel ? accent : LINE,
          strokeWidth: isSel ? 2 : 1.25,
          strokeOpacity: isSel ? 0.95 : selProductId ? 0.18 : 0.6,
        },
      });
      if (isSel) verCenterX = prodPos[i].x + MAP_CARD_W / 2;
    });

    if (!selProduct) return { nodes: ns, edges: es };
    const verTop = prodTop + gridHeight(products.length) + ROW_GAP_Y;
    const verPos = gridPositions(versions.length, verCenterX, verTop);
    let compCenterX = verCenterX;
    versions.forEach((v, i) => {
      const id = `ver:${v.id}`;
      const isSel = selVersionId === v.id;
      const fs: NodeFocusState = !selVersionId ? 'neutral' : isSel ? 'focused' : 'dimmed';
      ns.push({
        id,
        type: 'productVersion',
        position: verPos[i],
        data: {
          name: v.name,
          status: v.status,
          jurisdiction: attrString(v.attributes, 'jurisdiction'),
          paletteIndex: segIndex,
          focusState: fs,
          pieceIndex: i,
        } satisfies ProductVersionData,
        draggable: false,
      });
      es.push({
        id: `e:prod->${id}`,
        source: `prod:${selProduct.id}`,
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: isSel ? accent : LINE,
          strokeWidth: isSel ? 2 : 1.25,
          strokeOpacity: isSel ? 0.95 : selVersionId ? 0.18 : 0.6,
        },
      });
      if (isSel) compCenterX = verPos[i].x + MAP_CARD_W / 2;
    });

    if (!selVersion) return { nodes: ns, edges: es };
    const compTop = verTop + gridHeight(versions.length) + ROW_GAP_Y;
    const compPos = gridPositions(components.length, compCenterX, compTop);
    components.forEach((c, i) => {
      const id = `comp:${c.id}`;
      const isSel = selComponentId === c.id;
      ns.push({
        id,
        type: 'productComponent',
        position: compPos[i],
        data: {
          name: c.name,
          owner: attrString(c.attributes, 'owner'),
          formats: attrStringArray(c.attributes, 'formats'),
          paletteIndex: segIndex,
          focusState: !selComponentId ? 'neutral' : isSel ? 'focused' : 'dimmed',
          pieceIndex: i,
        } satisfies ProductComponentData,
        draggable: false,
      });
      es.push({
        id: `e:ver->${id}`,
        source: `ver:${selVersion.id}`,
        target: id,
        sourceHandle: 'b',
        targetHandle: 't',
        style: { stroke: accent, strokeWidth: 1.25, strokeOpacity: 0.5 },
      });
    });

    return { nodes: ns, edges: es };
  }, [
    data.company.name,
    data.levels,
    segments,
    companyOpen,
    selSegId,
    selSegment,
    segIndex,
    lobs,
    selLobId,
    selLob,
    products,
    selProductId,
    selProduct,
    versions,
    selVersionId,
    selVersion,
    components,
    selComponentId,
  ]);

  // ── Edit machinery (viz/product-map/useProductDragDrop) ──────────────────────
  const drillByCanvasId = useCallback(
    (canvasId: string, type: string) => {
      if (type === 'productSegment') {
        const id = canvasId.slice(4);
        if (selSegId !== id) onSegmentClick(id);
      } else if (type === 'productLob') {
        const id = canvasId.slice(4);
        if (selLobId !== id) onLobClick(id);
      } else if (type === 'productProduct') {
        const id = canvasId.slice(5);
        if (selProductId !== id) onProductClick(id);
      } else if (type === 'productVersion') {
        const id = canvasId.slice(4);
        if (selVersionId !== id) onVersionClick(id);
      } else if (type === 'productComponent') {
        onComponentClick(canvasId.slice(5));
      }
    },
    [selSegId, selLobId, selProductId, selVersionId, selComponentId],
  );

  const { onStagePointerDown, clearHoverDrill, gapRef, nestRef, DRAGGABLE_TYPES } =
    useProductDragDrop({
      editMode,
      rf,
      nodes,
      drag,
      setDrag,
      dragRef,
      setGap,
      setNestTargetId,
      selSegId,
      selLobId,
      selProductId,
      selVersionId,
      lobs,
      products,
      versions,
      components,
      rawNodeId,
      drillByCanvasId,
      setPendingMoves,
      setPendingOrder,
      pendingRenames,
      setRename,
      flash,
    });

  // ── Save / Revert staged edits ────────────────────────────────────────────────
  const onSave = useCallback(async () => {
    if (!companyId || !dirty || saving) return;
    const ops: (
      | { op: 'move'; id: string; newParentId: string }
      | { op: 'reorder'; parentId: string; orderedIds: string[] }
      | { op: 'rename'; id: string; name: string }
    )[] = [];
    for (const [id, rec] of pendingMoves) ops.push({ op: 'move', id, newParentId: rec.parent });
    for (const [parentId, orderedIds] of pendingOrder)
      ops.push({ op: 'reorder', parentId, orderedIds });
    for (const [id, name] of pendingRenames) ops.push({ op: 'rename', id, name });
    setSaving(true);
    try {
      await api.post(`/builder/nodes/batch?companyId=${encodeURIComponent(companyId)}`, { ops });
      setPendingMoves(new Map());
      setPendingOrder(new Map());
      setPendingRenames(new Map());
      flash('ok', 'Saved.');
      onSaved();
    } catch (e) {
      const msg = (e as Error)?.message;
      flash('err', msg && !/HTTP/.test(msg) ? msg : 'Save failed — your changes are kept.');
    } finally {
      setSaving(false);
    }
  }, [companyId, dirty, saving, pendingMoves, pendingOrder, pendingRenames, onSaved, flash]);

  const onRevert = useCallback(() => {
    setPendingMoves(new Map());
    setPendingOrder(new Map());
    setPendingRenames(new Map());
    setRename(null);
    flash('ok', 'Reverted.');
  }, [flash]);

  const commitRename = useCallback(() => {
    if (!rename) return;
    const v = rename.value.trim();
    if (v)
      setPendingRenames((m) => {
        const n = new Map(m);
        n.set(rename.rawId, v);
        return n;
      });
    setRename(null);
  }, [rename]);

  const onToggleEdit = useCallback(() => {
    if (editMode && dirty) {
      flash('err', 'Save or revert your changes first.');
      return;
    }
    setEditMode((v) => !v);
    dragRef.current = null;
    gapRef.current = null;
    nestRef.current = null;
    setDrag(null);
    setGap(null);
    setNestTargetId(null);
    setRename(null);
    clearHoverDrill();
  }, [editMode, dirty, flash, clearHoverDrill, gapRef, nestRef]);

  // ── Add / Remove (edit mode; applied immediately, not staged) ────────────────
  // Same model as the other maps: creates/deletes hit /builder/nodes directly
  // (typeKey m<level>; closure maintained server-side) and the table refetches.
  const createProductNode = useCallback(
    async (level: number, parentId: string | null, row?: { ids: string[]; afterId: string }) => {
      if (!companyId) return;
      const label = levelName(data.levels, level).toLowerCase();
      const name = await dialogs.prompt({
        title: `Add ${label}`,
        label: 'Name',
        placeholder: `New ${label}`,
        confirmLabel: 'Add',
      });
      if (!name) return;
      try {
        const created = (await api.post(
          `/builder/nodes?companyId=${encodeURIComponent(companyId)}`,
          {
            typeKey: `m${level}`,
            parentId,
            name,
          },
        )) as { id: string };
        if (row && parentId) {
          const ids = row.ids.filter((id) => id !== created.id);
          const at = ids.indexOf(row.afterId);
          if (at >= 0) ids.splice(at + 1, 0, created.id);
          else ids.push(created.id);
          await api.post(`/builder/nodes/batch?companyId=${encodeURIComponent(companyId)}`, {
            ops: [{ op: 'reorder', parentId, orderedIds: ids }],
          });
        }
        // Connected-additions rule: offer the lower-level detail in place.
        if (level < PRODUCT_MAX_LEVEL) {
          const childLabel = levelName(data.levels, level + 1).toLowerCase();
          let addMore = await dialogs.confirm({
            title: `Add ${childLabel}s under “${name}”?`,
            message: `“${name}” was added. You can capture its ${childLabel}s now, one at a time.`,
            confirmLabel: `Add ${childLabel}s`,
            cancelLabel: 'Not now',
          });
          while (addMore) {
            const childName = await dialogs.prompt({
              title: `Add ${childLabel} under “${name}”`,
              label: 'Name',
              message: 'Cancel when you are done.',
              confirmLabel: 'Add',
            });
            if (!childName) {
              addMore = false;
            } else {
              await api.post(`/builder/nodes?companyId=${encodeURIComponent(companyId)}`, {
                typeKey: `m${level + 1}`,
                parentId: created.id,
                name: childName,
              });
            }
          }
        }
        flash('ok', 'Added.');
        onSaved();
      } catch (e) {
        const msg = (e as Error)?.message;
        flash('err', msg && !/HTTP/.test(msg) ? msg : 'Add failed.');
      }
    },
    [companyId, data.levels, dialogs, flash, onSaved],
  );

  // Row context for a canvas node — level, effective parent, sibling raw ids.
  const rowInfoFor = useCallback(
    (n: Node): { level: number; parent: string | null; rowIds: string[] } | null => {
      switch (n.type) {
        case 'productSegment':
          return { level: 1, parent: null, rowIds: segments.map((s) => s.id) };
        case 'productLob':
          return { level: 2, parent: selSegId, rowIds: lobs.map((l) => l.id) };
        case 'productProduct':
          return { level: 3, parent: selLobId, rowIds: products.map((p) => p.id) };
        case 'productVersion':
          return { level: 4, parent: selProductId, rowIds: versions.map((v) => v.id) };
        case 'productComponent':
          return { level: 5, parent: selVersionId, rowIds: components.map((c) => c.id) };
        default:
          return null;
      }
    },
    [
      segments,
      lobs,
      products,
      versions,
      components,
      selSegId,
      selLobId,
      selProductId,
      selVersionId,
    ],
  );

  const handleAddAfter = useCallback(
    (n: Node) => {
      const info = rowInfoFor(n);
      if (!info) return;
      const raw = rawNodeId(n);
      void createProductNode(
        info.level,
        info.parent,
        raw && info.parent ? { ids: info.rowIds, afterId: raw } : undefined,
      );
    },
    [rowInfoFor, rawNodeId, createProductNode],
  );

  const handleRemove = useCallback(
    async (n: Node, name: string) => {
      if (!companyId) return;
      const raw = rawNodeId(n);
      if (!raw) return;
      const ok = await dialogs.confirm({
        title: `Remove “${sentenceCase(name)}”?`,
        message: 'This permanently deletes this item and everything beneath it.',
        danger: true,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
      try {
        await api.delete(
          `/builder/nodes/${raw}?companyId=${encodeURIComponent(companyId)}&confirm=${encodeURIComponent(name)}`,
        );
        // Collapse focus off the deleted branch (each toggle clears its level + below).
        if (raw === selComponentId) setSelComponentId(null);
        else if (raw === selVersionId) onVersionClick(raw);
        else if (raw === selProductId) onProductClick(raw);
        else if (raw === selLobId) onLobClick(raw);
        else if (raw === selSegId) onSegmentClick(raw);
        // Drop any staged edits referencing the deleted node.
        setPendingMoves((m) => {
          if (!m.has(raw)) return m;
          const next = new Map(m);
          next.delete(raw);
          return next;
        });
        setPendingRenames((m) => {
          if (!m.has(raw)) return m;
          const next = new Map(m);
          next.delete(raw);
          return next;
        });
        setPendingOrder((m) => {
          let touched = false;
          const next = new Map<string, string[]>();
          for (const [p, ids] of m) {
            if (p === raw) {
              touched = true;
              continue;
            }
            const filtered = ids.filter((id) => id !== raw);
            if (filtered.length !== ids.length) touched = true;
            next.set(p, filtered);
          }
          return touched ? next : m;
        });
        flash('ok', 'Removed.');
        onSaved();
      } catch (e) {
        const msg = (e as Error)?.message;
        flash('err', msg && !/HTTP/.test(msg) ? msg : 'Remove failed.');
      }
    },
    [
      companyId,
      rawNodeId,
      dialogs,
      selComponentId,
      selVersionId,
      selProductId,
      selLobId,
      selSegId,
      flash,
      onSaved,
    ],
  );

  // ── displayNodes — lift the dragged card, open the gap, overlay edit props ──
  const displayNodes = useMemo<Node[]>(() => {
    if (!editMode) return nodes;
    const liftId = drag?.started ? drag.canvasId : null;
    let result = liftId ? nodes.filter((n) => n.id !== liftId) : nodes;
    if (gap) {
      const rowNodes = result
        .filter((n) => n.type === gap.type)
        .sort((a, b) => a.position.x - b.position.x);
      const shiftIds = new Set(rowNodes.slice(gap.index).map((n) => n.id));
      // A drag opens a full card-width slot; a "+" hover spreads just enough
      // to make room for the badge.
      const spread = gap.hover ? PLUS_GAP_SPREAD : MAP_CARD_W + 12;
      if (shiftIds.size)
        result = result.map((n) =>
          shiftIds.has(n.id)
            ? { ...n, position: { x: n.position.x + spread, y: n.position.y } }
            : n,
        );
    }
    const mapped = result.map((n) => {
      const draggable = DRAGGABLE_TYPES.has(n.type ?? '');
      const raw = rawNodeId(n);
      const renamed = raw != null ? pendingRenames.get(raw) : undefined;
      const staged = (raw != null && pendingMoves.has(raw)) || renamed !== undefined;
      const nestTarget = n.id === nestTargetId;
      if (!draggable && !staged && !nestTarget) return n;
      const data: Record<string, unknown> = {
        ...n.data,
        editable: draggable,
        staged,
        dropTarget: nestTarget,
      };
      if (draggable && !drag?.started && raw) {
        const orig = n.data as { name?: string; pieceIndex?: number };
        const serverName = orig.name ?? '';
        data.plusSide = 'right';
        data.onAddAfter = () => handleAddAfter(n);
        data.onRemove = () => void handleRemove(n, serverName);
        data.onPlusHover = (h: boolean) =>
          plusHoverGap(
            h
              ? { parent: '', index: (orig.pieceIndex ?? 0) + 1, type: n.type ?? '', hover: true }
              : null,
          );
      }
      if (renamed !== undefined) data.name = renamed;
      // Descending zIndex along the row: every card paints ABOVE its following
      // sibling so the "+" badge in the gutter is reachable from any direction.
      if (draggable) {
        const idx = (n.data as { pieceIndex?: number }).pieceIndex ?? 0;
        return { ...n, zIndex: 200 - idx, data };
      }
      return { ...n, data };
    });
    // "+ Add …" placeholder under a focused node with no children yet.
    const placeholders: Node[] = [];
    const addPlaceholder = (parentCanvasId: string, childLevel: number, parentRaw: string) => {
      const p = nodes.find((x) => x.id === parentCanvasId);
      if (!p) return;
      placeholders.push({
        id: `add:${parentRaw}`,
        type: 'addNode',
        position: { x: p.position.x, y: p.position.y + MAP_CARD_H + ROW_GAP_Y },
        data: {
          label: `Add ${levelName(data.levels, childLevel).toLowerCase()}`,
          onClick: () => void createProductNode(childLevel, parentRaw),
        },
        draggable: false,
        selectable: false,
      });
    };
    if (!drag?.started) {
      if (selSegment && lobs.length === 0) addPlaceholder(`seg:${selSegment.id}`, 2, selSegment.id);
      if (selLob && products.length === 0) addPlaceholder(`lob:${selLob.id}`, 3, selLob.id);
      if (selProduct && versions.length === 0)
        addPlaceholder(`prod:${selProduct.id}`, 4, selProduct.id);
      if (selVersion && components.length === 0)
        addPlaceholder(`ver:${selVersion.id}`, 5, selVersion.id);
    }
    return placeholders.length ? [...mapped, ...placeholders] : mapped;
  }, [
    nodes,
    editMode,
    drag,
    gap,
    nestTargetId,
    DRAGGABLE_TYPES,
    rawNodeId,
    pendingMoves,
    pendingRenames,
    handleAddAfter,
    handleRemove,
    plusHoverGap,
    createProductNode,
    data.levels,
    selSegment,
    selLob,
    selProduct,
    selVersion,
    lobs,
    products,
    versions,
    components,
  ]);

  const displayEdges = useMemo<Edge[]>(() => {
    const liftId = drag?.started ? drag.canvasId : null;
    return liftId ? edges.filter((e) => e.source !== liftId && e.target !== liftId) : edges;
  }, [edges, drag]);

  // ── Camera helpers + drill effects ──────────────────────────────────────────
  useProductCamera({
    rf,
    paneW,
    paneH,
    dragRef,
    companyOpen,
    selSegId,
    selSegment,
    selLobId,
    selLob,
    selProductId,
    selProduct,
    selVersionId,
    selVersion,
    lobs,
    products,
    versions,
    components,
  });

  // ── Node click handler (drill / component sidebar) ──────────────────────────
  const onNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.type === 'productCompany') onCompanyClick();
    else if (node.type === 'productSegment') onSegmentClick(node.id.replace(/^seg:/, ''));
    else if (node.type === 'productLob') onLobClick(node.id.replace(/^lob:/, ''));
    else if (node.type === 'productProduct') onProductClick(node.id.replace(/^prod:/, ''));
    else if (node.type === 'productVersion') onVersionClick(node.id.replace(/^ver:/, ''));
    // productComponent: leaf — opens the docked component sidebar.
    else if (node.type === 'productComponent') onComponentClick(node.id.replace(/^comp:/, ''));
  };

  // ── Breadcrumb (portals into breadcrumbSlot when provided, else inline) ─────
  const crumb = (
    <ProductBreadcrumb
      companyName={data.company.name}
      level1Name={levelName(data.levels, 1)}
      selSegment={selSegment}
      selLob={selLob}
      selProduct={selProduct}
      selVersion={selVersion}
      onClear={crumbClear}
      onToSegment={crumbToSegment}
      onToLob={crumbToLob}
      onToProduct={crumbToProduct}
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
      {breadcrumbSlot && createPortal(crumb, breadcrumbSlot)}

      <div
        className={'rf-stage rf-stage--map' + (editMode ? ' rf-stage--edit' : '')}
        style={{ flex: 1, position: 'relative', minWidth: 0 }}
        onPointerDownCapture={onStagePointerDown}
      >
        {!breadcrumbSlot && (
          <div style={{ position: 'absolute', top: 8, left: 12, zIndex: 5 }}>{crumb}</div>
        )}
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={productNodeTypes}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={!editMode}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e5e5" gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>

        {/* Drag ghost */}
        {drag?.started && <DragGhost drag={drag} />}

        {/* Inline rename editor */}
        {rename && (
          <RenameEditor rename={rename} setRename={setRename} commitRename={commitRename} />
        )}

        {/* Edit toolbar */}
        <MapEditToolbar
          editMode={editMode}
          dirty={dirty}
          pendingCount={pendingCount}
          saving={saving}
          onSave={onSave}
          onRevert={onRevert}
          onToggleEdit={onToggleEdit}
        />

        {/* Move feedback banner */}
        {moveFlash && <MoveFlashBanner moveFlash={moveFlash} />}
      </div>

      {selComponent && (
        <ProductComponentSidebar
          node={selComponent}
          ancestry={[selSegment, selLob, selProduct, selVersion]
            .filter((n): n is NonNullable<typeof n> => n !== null)
            .map((n) => n.name)
            .join(' › ')}
          onClose={() => setSelComponentId(null)}
        />
      )}
    </div>
  );
}

// ── Data wrapper + provider ──────────────────────────────────────────────────

export default function ProductMapCanvas({ breadcrumbSlot }: Props) {
  const { data, error, loading, refetch } = useApi<ProductData>('/product-spine/table');

  if (loading && !data) {
    return (
      <div className="h-full grid place-items-center">
        <LoadingState className="animate-pulse" message="Loading product model…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full grid place-items-center">
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  }
  if (!data) return null;

  return (
    <ReactFlowProvider>
      <ProductMapCanvasInner data={data} breadcrumbSlot={breadcrumbSlot} onSaved={refetch} />
    </ReactFlowProvider>
  );
}
