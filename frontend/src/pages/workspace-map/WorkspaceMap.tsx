import { useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState, ErrorMessage, EmptyState } from '../../components/ui';
import { useOnChange, useViewState } from '../../lib/viewState';
import { useBoardList, useBoardDetails, type Lens } from './useBoard';
import { FlowEdges, useEdges, type EdgeSpec } from './FlowEdges';
import LensBar, { type WorkspaceLens } from './LensBar';
import AppPicker, { type AppOption } from './AppPicker';
import BrownfieldPanel from './BrownfieldPanel';
import NormalizeColumn from './NormalizeColumn';
import GreenfieldColumn from './GreenfieldColumn';
import ProductBoard from './product/ProductBoard';
import VsStreamBoard from './spine/VsStreamBoard';
import RoleCompareBoard from './spine/RoleCompareBoard';
import BoardErrorBoundary from './BoardErrorBoundary';
import TraceBreadcrumb from './TraceBreadcrumb';
import {
  computeCapabilityAreas,
  computeCrossAppEntries,
  matchScreensAcrossApps,
  synthesizeGreenfield,
  CORE_AREA,
} from './compare';
import { ALL_SCREENS, findingMoves, GREEN, RED, READABLE_FIT_MIN } from './types';
import type { BoardDetail, Finding, Layer, NormalizationEntry } from './types';
import { useLayerAlignment, type AlignRow } from './useLayerAlignment';
import { entryAppIds } from './NormalizeCards';
import { BoardLegend, BoardVocabProvider, useBoardVocab } from './vocabulary';

// The Workspace map — an interactive, three-column rationalization board
// (brown-field decomposition → normalize → green-field target) rendered from
// the live APIs. The Applications / Value streams / Roles lenses share the
// /rationalization board; the Products lens renders its own comparison board
// (product/ProductBoard) over /product-models/workspaces.
//
// Like the Products lens, the board compares a PICKED SET of scanned
// applications (from any board): the Brownfield panel walks ONE of them at a
// time (app toggle + screen picker), while Normalize and Greenfield always
// aggregate every application in the comparison.

function lensFromDomain(d?: string): WorkspaceLens {
  if (d === 'value-streams' || d === 'roles' || d === 'products') return d;
  if (d === 'product-models') return 'products'; // e2e / legacy deep-link alias
  return 'applications';
}

export default function WorkspaceMap({ initialDomain }: { initialDomain?: string }) {
  // ONE vocabulary fetch for every lens — the columns read it from context.
  return (
    <BoardVocabProvider>
      <WorkspaceLenses initialDomain={initialDomain} />
    </BoardVocabProvider>
  );
}

function WorkspaceLenses({ initialDomain }: { initialDomain?: string }) {
  // The active lens persists per session (lib/viewState) so returning to the
  // Workspace tab restores the board the user left. An explicit ?domain= deep
  // link states its own intent and wins over the restored lens.
  const [lens, setLens] = useViewState<WorkspaceLens>(
    'workspace.lens',
    lensFromDomain(initialDomain),
    !initialDomain,
  );
  // A crash inside one comparison must never blank the whole tab — the
  // boundary shows a reset that remounts the board with fresh state.
  const [boardKey, setBoardKey] = useState(0);
  // Recursion stop: screen previews iframe app pages, and an embedded app must
  // never render the board again (board → preview → board … melts the page).
  if (window.self !== window.top)
    return <EmptyState message="The Workspace board doesn't render inside screen previews." />;
  if (lens === 'products') return <ProductBoard lens={lens} onLens={setLens} />;
  // Spine lenses compare the REAL operating-model graph: N value streams or
  // N roles horizontally, with consolidation computed on the fly.
  if (lens === 'value-streams')
    return (
      <BoardErrorBoundary onReset={() => setBoardKey((k) => k + 1)}>
        <VsStreamBoard key={boardKey} lens={lens} onLens={setLens} />
      </BoardErrorBoundary>
    );
  if (lens === 'roles')
    return (
      <BoardErrorBoundary onReset={() => setBoardKey((k) => k + 1)}>
        <RoleCompareBoard key={boardKey} lens={lens} onLens={setLens} />
      </BoardErrorBoundary>
    );
  return (
    <BoardErrorBoundary onReset={() => setBoardKey((k) => k + 1)}>
      <AppBoard key={boardKey} lens={lens} onLens={setLens} />
    </BoardErrorBoundary>
  );
}

function AppBoard({ lens, onLens }: { lens: Lens; onLens: (l: WorkspaceLens) => void }) {
  // The DB-driven row axis (vocabulary LAYER order) — every loop below and the
  // alignment engine iterate THIS list so all three columns agree.
  const { layers } = useBoardVocab();
  // Board scope + comparison picks persist per session (lib/viewState) so the
  // tab restores exactly on return. Picks stored as an array (Sets don't
  // serialize); null = the active board's own apps.
  const [boardId, setBoardId] = useViewState<string | null>('workspace.app.boardId', null);
  const [pickedArr, setPickedArr] = useViewState<string[] | null>('workspace.app.picked', null);
  const pickedAppIds = useMemo(() => (pickedArr ? new Set(pickedArr) : null), [pickedArr]);
  const [activeAppId, setActiveAppId] = useViewState<string | null>(
    'workspace.app.activeApp',
    null,
  );
  const [screenName, setScreenName] = useViewState<string | null>('workspace.app.screen', null);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [zoom, setZoom] = useState(1);
  // One expand/collapse state per LAYER, shared by all three columns: opening
  // "UI" anywhere opens the UI row in the panel, the Normalize section and the
  // Greenfield floor together, so the whole band reads as one row.
  const [expandedLayers, setExpandedLayers] = useViewState<Partial<Record<Layer, boolean>>>(
    'workspace.app.expanded',
    {},
  );
  const toggleLayer = (layer: Layer) => setExpandedLayers((c) => ({ ...c, [layer]: !c[layer] }));

  const { data: boards, loading: listLoading, error: listError } = useBoardList({ lens });

  // Default the selected board to the first in the list for the active lens.
  useEffect(() => {
    if (boards && boards.length > 0 && (!boardId || !boards.some((b) => b.id === boardId))) {
      setBoardId(boards[0].id);
    }
    if (boards && boards.length === 0) setBoardId(null);
  }, [boards, boardId]);

  // Every scanned application across every board of the lens, as one FLAT
  // pool — the compare picker can mix applications from any board, and its
  // domain/value-stream filters come from the owning board's wiring.
  const pool: AppOption[] = useMemo(
    () =>
      (boards ?? []).flatMap((b) => {
        const legacy = (b.apps ?? []).filter((a) => a.kind === 'LEGACY');
        const src = legacy.length ? legacy : (b.apps ?? []);
        return src.map((a) => ({
          id: a.id,
          name: a.name,
          boardId: b.id,
          valueStream: b.valueStream,
          domain: b.valueStreamDomain,
        }));
      }),
    [boards],
  );

  // Selection defaults to the active board's own applications.
  const selectedAppIds = useMemo(
    () => pickedAppIds ?? new Set(pool.filter((o) => o.boardId === boardId).map((o) => o.id)),
    [pickedAppIds, pool, boardId],
  );
  const selectedOptions = useMemo(
    () => pool.filter((o) => selectedAppIds.has(o.id)),
    [pool, selectedAppIds],
  );
  const involvedBoardIds = useMemo(
    () => [...new Set(selectedOptions.map((o) => o.boardId))],
    [selectedOptions],
  );
  // Undefined while the board list is loading, so the loading→loaded
  // transition never reads as a comparison change (see useOnChange contract).
  const selectionKey = useMemo(
    () => (boards ? [...selectedAppIds].sort().join('+') : undefined),
    [boards, selectedAppIds],
  );

  const { data: details, loading, error, refetch } = useBoardDetails(involvedBoardIds);

  // A board switch resets the whole comparison scope — change-only
  // (lib/viewState useOnChange), so a restored board keeps its restored
  // picks/expansion on mount.
  useOnChange(boardId, () => {
    setPickedArr(null);
    setActiveAppId(null);
    setScreenName(null);
    setSelected(null);
    setExpandedLayers({});
  });

  // A different comparison (app added/removed) starts collapsed again.
  useOnChange(selectionKey, () => {
    setSelected(null);
    setExpandedLayers({});
  });

  // A screen switch starts collapsed again (the counts live in the headers).
  useOnChange(screenName, () => {
    setExpandedLayers({});
  });

  // Merge the involved boards into one comparison, scoped to the picked apps.
  // Normalize/Greenfield read this full scope; the Brownfield panel narrows
  // further to its active application.
  const merged = useMemo(() => {
    if (!details) return null;
    const list = involvedBoardIds
      .map((id) => details[id])
      .filter((b): b is BoardDetail => Boolean(b));
    if (list.length === 0) return null;
    const boardOfApp = new Map<string, string>();
    const boardOfMs = new Map<string, string>();
    const boardOfComp = new Map<string, string>();
    for (const b of list) {
      for (const a of b.apps) boardOfApp.set(a.id, b.id);
      for (const m of b.microservices) boardOfMs.set(m.id, b.id);
      for (const c of b.components) boardOfComp.set(c.id, b.id);
    }
    const apps = list.flatMap((b) => b.apps.filter((a) => selectedAppIds.has(a.id)));
    const findings = list.flatMap((b) => b.findings.filter((f) => selectedAppIds.has(f.appId)));
    const inScope = new Set(findings.map((f) => f.id));
    // Same-board comparisons keep their scan-authored entries (field-level
    // cards, review verdicts). A MIXED-board comparison has no authored rows
    // spanning its applications, so the shared/unique verdict is computed on
    // the fly from the findings themselves — generic for any pair of scanned
    // applications; zero overlap yields zero consolidation entries.
    const crossBoard = list.length > 1;
    const normalizationEntries = crossBoard
      ? computeCrossAppEntries(findings)
      : list.flatMap((b) =>
          b.normalizationEntries.filter((e) => e.findingIds.some((id) => inScope.has(id))),
        );
    // A comparison has ONE greenfield: mixed-board scopes synthesize a unified
    // target platform on the fly (layer slots merged from the boards' own
    // targets) instead of stacking each board's card.
    const gf = crossBoard ? synthesizeGreenfield(list) : null;
    const title = apps.map((a) => a.name).join(' + ');
    return {
      name: title,
      application: title,
      apps,
      findings,
      normalizationEntries,
      components: gf ? gf.components : list.flatMap((b) => b.components),
      microservices: gf ? [gf.microservice] : list.flatMap((b) => b.microservices),
      screens: list.flatMap((b) => b.screens.filter((s) => selectedAppIds.has(s.appId))),
      boardOfApp,
      boardOfMs,
      boardOfComp,
    };
  }, [details, involvedBoardIds, selectedAppIds]);

  const addApp = (id: string) => {
    const next = new Set(selectedAppIds);
    next.add(id);
    setPickedArr([...next]);
  };
  const removeApp = (id: string) => {
    if (selectedAppIds.size === 1) return; // at least one application stays
    const next = new Set(selectedAppIds);
    next.delete(id);
    setPickedArr([...next]);
    if (activeAppId === id) setActiveAppId(null);
  };
  const replaceApp = (oldId: string, newId: string) => {
    if (oldId === newId) return;
    const next = new Set(selectedAppIds);
    next.delete(oldId);
    next.add(newId);
    setPickedArr([...next]);
    if (activeAppId === oldId) setActiveAppId(null);
  };

  // The Brownfield panel walks ONE application of the comparison at a time.
  const activeApp = merged
    ? (merged.apps.find((a) => a.id === activeAppId) ?? merged.apps[0] ?? null)
    : null;
  const activeId = activeApp?.id ?? null;

  // Switching the brownfield application restarts its screen walk — unless the
  // current pick already belongs to the new application (a shared-dropdown pick
  // switched the app) or is the ALL_SCREENS view.
  const screenOwner = (name: string): string | null =>
    merged?.screens.find((s) => s.name === name)?.appId ?? null;
  useEffect(() => {
    setSelected(null);
    setScreenName((cur) =>
      !cur || cur === ALL_SCREENS || screenOwner(cur) === activeId ? cur : null,
    );
  }, [activeId]);

  // Shared dropdown: picking another application's screen walks that app.
  const pickScreen = (name: string | null) => {
    setSelected(null);
    if (name && name !== ALL_SCREENS) {
      const owner = screenOwner(name);
      if (owner && owner !== activeId) setActiveAppId(owner);
    }
    setScreenName(name);
  };

  const canvasRef = useRef<HTMLDivElement>(null);
  const activeLayer = selected ? selected.layer : null;

  // Fit-to-frame: scale the canvas once per comparison so all three columns
  // are in view on load; after that the zoom buttons own the scale. Width-only
  // — the columns are tall lists, so fitting height too crushed the board to
  // the zoom floor and made it unreadable; the board scrolls vertically
  // instead. zoom is read via a ref so setting it can't re-trigger the effect.
  const fittedFor = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    if (!merged || fittedFor.current === selectionKey) return;
    const canvas = canvasRef.current;
    const scroller = canvas?.parentElement;
    if (!canvas || !scroller) return;
    // getBoundingClientRect is in screen px (post-zoom) — divide back to natural.
    const rect = canvas.getBoundingClientRect();
    const naturalW = rect.width / (zoomRef.current || 1);
    if (naturalW <= 0) return;
    fittedFor.current = selectionKey ?? null;
    const fit = Math.min(1, (scroller.clientWidth - 8) / naturalW);
    setZoom(Math.max(READABLE_FIT_MIN, Math.round(fit * 100) / 100));
  }, [merged, selectionKey]);

  // Brownfield scope: the active application's findings/screens; the connector
  // counts additionally narrow to the active screen so the map always agrees
  // with what the panel is showing.
  const bfFindings = useMemo(
    () => (merged && activeId ? merged.findings.filter((f) => f.appId === activeId) : []),
    [merged, activeId],
  );
  // ALL_SCREENS walks every screen at once — no single-screen narrowing; the
  // Normalize column groups the full comparison by functional area instead.
  const screenWalk = screenName && screenName !== ALL_SCREENS ? screenName : null;
  const scoped = useMemo(
    () => (screenWalk ? bfFindings.filter((f) => f.screenRef === screenWalk) : bfFindings),
    [bfFindings, screenWalk],
  );

  // The whole band follows the Brownfield walk BY SCREEN: while a screen is
  // active, only that screen's steps stay in the model — Normalize and
  // Greenfield show the screen's slice, never the totals. The SEMANTICALLY
  // MATCHING screen of every other compared application joins the slice (both
  // apps' "Login" compare side by side), and shared entries drag their partner
  // sources back in so consolidations still read N→1.
  const matchedScreens = useMemo(
    () =>
      merged && screenWalk && activeId
        ? matchScreensAcrossApps(merged.screens, activeId, screenWalk)
        : new Map<string, string>(),
    [merged, activeId, screenWalk],
  );
  const modelEntries = useMemo(() => {
    if (!merged) return [];
    const walked =
      !screenWalk || !activeId
        ? merged.findings
        : merged.findings.filter((f) =>
            f.appId === activeId
              ? f.screenRef === screenWalk
              : matchedScreens.get(f.appId) === f.screenRef,
          );
    const ids = new Set(walked.map((f) => f.id));
    return merged.normalizationEntries.filter((e) => e.findingIds.some((id) => ids.has(id)));
  }, [merged, activeId, screenWalk, matchedScreens]);
  const modelFindings = useMemo(() => {
    if (!merged) return [];
    if (!screenWalk || !activeId) return merged.findings;
    const partners = new Set(modelEntries.flatMap((e) => e.findingIds));
    return merged.findings.filter((f) =>
      f.appId === activeId
        ? f.screenRef === screenWalk
        : matchedScreens.get(f.appId) === f.screenRef || partners.has(f.id),
    );
  }, [merged, activeId, screenWalk, matchedScreens, modelEntries]);
  // Capability areas keep the "all screens" view readable AND comparable:
  // every step classifies into the same generic taxonomy (Intake,
  // Authentication, Logging …) regardless of application vocabulary, so both
  // sides produce identical groups and their steps meet inside them.
  const areas = useMemo(
    () => (merged && !screenWalk ? computeCapabilityAreas(modelFindings) : null),
    [merged, screenWalk, modelFindings],
  );

  // Greenfield pass-through scoping: a target service only counts findings
  // from ITS OWN board's applications (cross-board findings never leak onto
  // another initiative's floors).
  const findingsByMs = useMemo(() => {
    const m = new Map<string, Finding[]>();
    if (!merged) return m;
    for (const ms of merged.microservices) {
      const bId = merged.boardOfMs.get(ms.id);
      // A synthesized unified platform belongs to no single board — the whole
      // comparison lands on it.
      m.set(
        ms.id,
        bId === undefined
          ? modelFindings
          : modelFindings.filter((f) => merged.boardOfApp.get(f.appId) === bId),
      );
    }
    return m;
  }, [merged, modelFindings]);

  // SCRUM-259: inside an EXPANDED layer, every brownfield step aligns with its
  // normalize card (and, when it carries into the target, its greenfield floor
  // row) so the per-row connectors run dead horizontal. Pairs are listed in
  // the Normalize column's EXACT render order — area sections on the "all
  // screens" walk, then shared → unique → pass-through inside each — and the
  // brownfield + greenfield rows re-sort to the same order (bfRowOrder /
  // gfRowOrder below), so the connectors stay parallel and never cross.
  const innerAlign = useMemo(() => {
    const byLayer: Partial<Record<Layer, AlignRow[]>> = {};
    const nzAnchorOf: Record<string, string> = {};
    const gfAnchorOf: Record<string, string> = {};
    const gfRowOrder: Record<string, number> = {};
    if (!merged) return { byLayer, nzAnchorOf, gfAnchorOf, gfRowOrder };
    const findingsById = new Map(merged.findings.map((f) => [f.id, f]));
    const areaOfF = (f: Finding) => areas?.areaOf.get(f.id) ?? CORE_AREA;
    const areaOfE = (e: NormalizationEntry) => {
      const f = e.findingIds.map((id) => findingsById.get(id)).find(Boolean);
      return f ? areaOfF(f) : CORE_AREA;
    };
    // Which greenfield floor row an item lands on (mirrors GreenfieldColumn's
    // per-floor lists) — null when it doesn't reach the target.
    const gfForEntry = (e: NormalizationEntry): string | null => {
      const comp = merged.components.find((c) => c.id === e.componentId);
      return comp?.microserviceId ? `gf:${comp.microserviceId}:${comp.layer}:e:${e.id}` : null;
    };
    const gfForFinding = (f: Finding): string | null => {
      if (f.deadCode || f.capdan === 'Eliminate') return null;
      const comp = merged.components.find(
        (c) =>
          c.layer === f.layer &&
          c.microserviceId &&
          (findingsByMs.get(c.microserviceId) ?? []).some((x) => x.id === f.id),
      );
      return comp?.microserviceId ? `gf:${comp.microserviceId}:${f.layer}:f:${f.id}` : null;
    };
    for (const layer of layers) {
      if (!expandedLayers[layer]) continue;
      const layerScoped = scoped.filter((f) => f.layer === layer);
      if (layerScoped.length === 0) continue;
      const layerEntries = modelEntries.filter((e) => e.layer === layer);
      const covered = new Set(layerEntries.flatMap((e) => e.findingIds));
      const shared = layerEntries.filter((e) => entryAppIds(e, findingsById).length > 1);
      const unique = layerEntries.filter((e) => entryAppIds(e, findingsById).length <= 1);
      const pool =
        layerEntries.length > 0 ? layerScoped.filter((f) => !covered.has(f.id)) : layerScoped;
      // Mirror LayerSection: multi-area layers group under functional areas.
      const names = new Set([...layerEntries.map(areaOfE), ...pool.map(areaOfF)]);
      const items: { e?: NormalizationEntry; f?: Finding }[] =
        areas && names.size > 1
          ? [
              ...areas.order.filter((a) => names.has(a)),
              ...[...names].filter((n) => !areas.order.includes(n)),
            ].flatMap((area) => [
              ...shared.filter((e) => areaOfE(e) === area).map((e) => ({ e })),
              ...unique.filter((e) => areaOfE(e) === area).map((e) => ({ e })),
              ...pool.filter((f) => areaOfF(f) === area).map((f) => ({ f })),
            ])
          : [
              ...shared.map((e) => ({ e })),
              ...unique.map((e) => ({ e })),
              ...pool.map((f) => ({ f })),
            ];
      const rows: AlignRow[] = [];
      for (const it of items) {
        if (it.e) {
          const f = layerScoped.find((x) => it.e!.findingIds.includes(x.id));
          if (!f) continue;
          const key = `f:${f.id}`;
          const gf = gfForEntry(it.e);
          rows.push({ key, bf: `bf:f:${f.id}`, nz: `nz:e:${it.e.id}`, gf });
          nzAnchorOf[key] = `nz:e:${it.e.id}`;
          if (gf) {
            gfAnchorOf[key] = gf;
            gfRowOrder[`e:${it.e.id}`] = rows.length - 1;
          }
        } else if (it.f) {
          const key = `f:${it.f.id}`;
          const gf = gfForFinding(it.f);
          rows.push({ key, bf: `bf:f:${it.f.id}`, nz: `nz:f:${it.f.id}`, gf });
          nzAnchorOf[key] = `nz:f:${it.f.id}`;
          if (gf) {
            gfAnchorOf[key] = gf;
            gfRowOrder[`f:${it.f.id}`] = rows.length - 1;
          }
        }
      }
      byLayer[layer] = rows;
    }
    return { byLayer, nzAnchorOf, gfAnchorOf, gfRowOrder };
  }, [merged, scoped, modelEntries, expandedLayers, areas, findingsByMs, layers]);

  const specs: EdgeSpec[] = useMemo(() => {
    if (!merged) return [];
    const out: EdgeSpec[] = [];
    const findingsById = new Map(merged.findings.map((f) => [f.id, f]));
    for (const layer of layers) {
      const rows = scoped.filter((f) => f.layer === layer);
      const stays = rows.filter((f) => !findingMoves(f)).length;
      const moves = rows.length - stays;
      const dim = activeLayer != null && activeLayer !== layer;
      const both = stays > 0 && moves > 0;
      // Every layer gets its own gutter lane so verticals never stack; a
      // stay/move pair splits one lane further apart.
      const base = (layers.indexOf(layer) - 2) * 2;
      const perRow = expandedLayers[layer] && rows.length > 0;
      if (perRow) {
        // Expanded layer: one connector PER ROW, from the brownfield step to
        // the normalize card it lands on — green = stays, red = moves — and,
        // for rows that carry into the target, a second green connector from
        // the normalize card to its greenfield floor row. Dead code and
        // eliminations stop at Normalize.
        (innerAlign.byLayer[layer] ?? []).forEach((r, ri) => {
          const f = findingsById.get(r.key.slice(2));
          if (!f || !r.bf || !r.nz) return;
          out.push({
            id: `row-${f.id}`,
            from: r.bf,
            to: r.nz,
            color: findingMoves(f) ? RED : GREEN,
            width: 2,
            dim,
            lane: (ri % 3) - 1,
          });
          if (r.gf)
            out.push({
              id: `grow-${f.id}`,
              from: r.nz,
              to: r.gf,
              color: GREEN,
              width: 2,
              dim,
              lane: (ri % 3) - 1,
            });
        });
      } else {
        // A stay/move pair splits SYMMETRICALLY (same offset both ends) so the
        // two connectors run parallel and horizontal, never at a slant.
        if (stays > 0)
          out.push({
            id: `s-${layer}`,
            from: `bf:${layer}`,
            to: `nz:${layer}`,
            color: GREEN,
            width: 2.5,
            count: stays,
            dim,
            y0Offset: both ? -12 : 0,
            y1Offset: both ? -12 : 0,
            lane: both ? base - 1 : base,
          });
        if (moves > 0)
          out.push({
            id: `m-${layer}`,
            from: `bf:${layer}`,
            to: `nz:${layer}`,
            color: RED,
            width: 2.5,
            count: moves,
            dim,
            y0Offset: both ? 14 : 0,
            y1Offset: both ? 14 : 0,
            lane: both ? base + 1 : base,
          });
      }
      // One green edge per component whose floor actually renders — a merged
      // comparison can land the same layer on several boards' services. An
      // expanded layer's rows carry their own connectors instead.
      if (!perRow)
        for (const comp of merged.components) {
          if (comp.layer !== layer || !comp.microserviceId) continue;
          const lands =
            modelEntries.some((e) => e.componentId === comp.id) ||
            (findingsByMs.get(comp.microserviceId) ?? []).some(
              (f) => f.layer === layer && !f.deadCode && f.capdan !== 'Eliminate',
            );
          if (lands)
            out.push({
              id: `g-${comp.id}`,
              from: `nz:${layer}`,
              to: `gf:${comp.microserviceId}:${layer}`,
              color: GREEN,
              width: 2.5,
              dim,
              lane: base,
            });
        }
    }
    return out;
  }, [merged, scoped, activeLayer, findingsByMs, expandedLayers, modelEntries, innerAlign, layers]);

  // SCRUM-222: line each layer's rows up across the three columns so the
  // connectors run horizontally instead of criss-crossing diagonals.
  const pads = useLayerAlignment(
    canvasRef,
    merged ? (selectionKey ?? null) : null,
    merged?.components ?? [],
    zoom,
    innerAlign.byLayer,
    layers,
  );
  // Split the inner-row pads out for the columns: brownfield rows keyed by
  // finding id, normalize cards and greenfield rows keyed by their anchor key.
  const { bfRowPads, nzCardPads, gfRowPads } = useMemo(() => {
    const bf: Record<string, number> = {};
    const nz: Record<string, number> = {};
    const gf: Record<string, number> = {};
    for (const [key, nzAnchor] of Object.entries(innerAlign.nzAnchorOf)) {
      const bfPad = pads.bf[key];
      if (bfPad) bf[key.slice(2)] = bfPad;
      const nzPad = pads.nz[key];
      if (nzPad) nz[nzAnchor] = nzPad;
      const gfAnchor = innerAlign.gfAnchorOf[key];
      const gfPad = pads.gf[key];
      if (gfAnchor && gfPad) gf[gfAnchor] = gfPad;
    }
    return { bfRowPads: bf, nzCardPads: nz, gfRowPads: gf };
  }, [innerAlign, pads]);
  // Render the brownfield rows of an expanded layer in the SAME vertical order
  // as their normalize cards — the alignment engine (and the eye) needs both
  // columns ordered alike for the per-row connectors to run level.
  const bfRowOrder = useMemo(() => {
    const order: Record<string, number> = {};
    for (const rows of Object.values(innerAlign.byLayer)) {
      rows?.forEach((r, i) => {
        order[r.key.slice(2)] = i;
      });
    }
    return order;
  }, [innerAlign]);
  const edges = useEdges(canvasRef, specs, zoom, JSON.stringify(pads));

  if (listLoading || loading) return <LoadingState message="Loading workspace board…" />;
  if (listError) return <ErrorMessage>{listError}</ErrorMessage>;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!boards || boards.length === 0)
    return (
      <EmptyState message="No scanned applications yet — the Workspace only shows applications whose codebase has been scanned. Open an application's page and run a codebase scan to light up its board." />
    );
  // Selection resolved to nothing (filters excluded every picked app, or the
  // boards share no data) — keep the toolbar + picker so the user can adjust,
  // instead of a dead "Loading…" or a crash.
  if (!merged || !activeApp)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <LensBar
          lens={lens}
          onLens={(l) => {
            setSelected(null);
            onLens(l);
          }}
          boards={[]}
          boardId={null}
          onBoard={() => undefined}
          legend={<BoardLegend />}
        />
        <AppPicker
          pool={pool}
          selected={selectedOptions}
          onReplace={replaceApp}
          onAdd={addApp}
          onRemove={removeApp}
        />
        <EmptyState message="Nothing to compare for this selection — add a scanned application with the picker above, or clear the filters." />
      </div>
    );

  const destination = selected
    ? (merged.components.find(
        (c) =>
          c.layer === selected.layer &&
          merged.boardOfComp.get(c.id) === merged.boardOfApp.get(selected.appId),
      )?.destination ??
      // Synthesized unified-platform components belong to no board.
      merged.components.find((c) => c.layer === selected.layer)?.destination ??
      null)
    : null;

  return (
    // Fill the viewport below the app chrome (header + tabs + breadcrumb +
    // page padding ≈ 156px): toolbar and trace take their height, the map
    // canvas flexes into everything left.
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 156px)',
        minHeight: 480,
      }}
    >
      {/* No board dropdown here — applications are picked flat via AppPicker;
          the board is only the data container behind each application. */}
      <LensBar
        lens={lens}
        onLens={(l) => {
          setSelected(null);
          onLens(l);
        }}
        boards={[]}
        boardId={null}
        onBoard={() => undefined}
        legend={<BoardLegend />}
      />
      <AppPicker
        pool={pool}
        selected={selectedOptions}
        onReplace={replaceApp}
        onAdd={addApp}
        onRemove={removeApp}
      />
      {selected && <TraceBreadcrumb finding={selected} destination={destination} />}

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div
          style={{
            border: '1px solid #eaeaea',
            borderRadius: 12,
            background: '#fff',
            backgroundImage: 'radial-gradient(circle,#ececec 1px,transparent 1px)',
            backgroundSize: '24px 24px',
            overflow: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={canvasRef}
            style={{
              position: 'relative',
              // CSS zoom (not transform) so the scaled size IS the layout size —
              // fit-to-frame leaves no phantom scroll range.
              zoom,
              width: 'max-content',
              padding: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 120,
            }}
          >
            <FlowEdges edges={edges} />
            <BrownfieldPanel
              title={activeApp.name}
              apps={merged.apps}
              activeAppId={activeApp.id}
              onActiveApp={setActiveAppId}
              findings={bfFindings}
              screens={merged.screens}
              screenName={screenName}
              onScreen={pickScreen}
              selectedFindingId={selected?.id ?? null}
              onSelectFinding={setSelected}
              layerPads={pads.bf}
              rowPads={bfRowPads}
              rowOrder={bfRowOrder}
              expandedLayers={expandedLayers}
              onToggleLayer={toggleLayer}
            />
            <NormalizeColumn
              board={merged}
              activeLayer={activeLayer}
              findings={modelFindings}
              areas={areas}
              onResolved={refetch}
              layerPads={pads.nz}
              cardPads={nzCardPads}
              expandedLayers={expandedLayers}
              onToggleLayer={toggleLayer}
            />
            <GreenfieldColumn
              microservices={merged.microservices}
              components={merged.components}
              findings={modelFindings}
              findingsByMs={findingsByMs}
              normalizationEntries={modelEntries}
              layerPads={pads.gf}
              rowPads={gfRowPads}
              rowOrder={innerAlign.gfRowOrder}
              expandedLayers={expandedLayers}
              onToggleLayer={toggleLayer}
            />
          </div>
        </div>

        {/* Zoom controls float over the scroller's top-right corner. */}
        <div
          style={{
            position: 'absolute',
            right: 18,
            top: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 2,
          }}
        >
          <ZoomBtn label="+" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} />
          <ZoomBtn label="−" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} />
          <ZoomBtn label="⛶" onClick={() => setZoom(1)} />
        </div>
      </div>
    </div>
  );
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        border: '1px solid #eaeaea',
        borderRadius: 6,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.05)',
        fontSize: label === '⛶' ? 13 : 16,
        color: '#525252',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
