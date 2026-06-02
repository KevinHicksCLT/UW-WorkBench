// MapCanvas.tsx — Interactive operating-model map with spatial drill-down.
// Three cores pinned at top; divisions cascade down per column.
// Click a division → gap opens, value streams render L-to-R.
// Click a value stream → process steps render L-to-R.
// Deepest level → right ContextSidebar with people + apps.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow, Background, Controls, ReactFlowProvider,
  useReactFlow,
  type Node, type Edge, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { mapNodeTypes } from './nodes/MapNode';
import type {
  CompanyNodeData, CoreNodeData, DivisionNodeData, ValueStreamNodeData, StepNodeData,
} from './nodes/MapNode';
import type { NodeFocusState, DivisionSummary, DivisionFlow, FlowStep, FlowValueStream } from './model';
import ContextSidebar, { type StepContext } from '../components/ContextSidebar';
import { api } from '../lib/api';

// ── Layout constants ─────────────────────────────────────────────────────────

const COMPANY_H        = 64;
const DOMAIN_TOP_OFFSET = 72;  // y offset from company bottom to the domain row
const CORE_W          = 200;
const CORE_H          = 52;
const DIV_W           = 210;
const DIV_H           = 78;   // fixed row height (division nodes use this as min-height → even gaps)
const DIV_GAP_Y       = 20;
const COL_GAP_X       = 160;   // horizontal gap between column centers
const DIV_TOP_OFFSET  = 60;    // y offset from domain bottom to first division top
const VS_W            = 188;
const VS_H            = 68;
const VS_GAP_X        = 12;
const VS_TOP_OFFSET   = 28;    // gap between focused-division bottom and VS row top
const STEP_W          = 172;
const STEP_H          = 80;
const STEP_GAP_X      = 12;
const STEP_TOP_OFFSET = 24;    // gap between focused-VS bottom and step row top

// Left-to-right order requested by the user: Corporate Function · Core Business · IT.
const CATEGORIES = ['Corporate Function', 'Core Business', 'IT'] as const;
type Category = (typeof CATEGORIES)[number];

function catFor(div: DivisionSummary): Category {
  if (div.higherCategory === 'Corporate Function') return 'Corporate Function';
  if (div.higherCategory === 'IT') return 'IT';
  return 'Core Business';
}

// ── Inner canvas ─────────────────────────────────────────────────────────────

type Props = { divisions: DivisionSummary[]; companyName: string; breadcrumbSlot?: HTMLElement | null };

function MapCanvasInner({ divisions, companyName, breadcrumbSlot }: Props) {
  const rf = useReactFlow();

  // Top-of-map gating: company → domains → divisions.
  const [companyOpen, setCompanyOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Category | null>(null);

  // Level / focus state (within a selected domain)
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [focusedDivisionId, setFocusedDivisionId] = useState<string | null>(null);
  const [focusedVsId, setFocusedVsId] = useState<string | null>(null);
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);

  // API data
  const [flowData, setFlowData] = useState<DivisionFlow | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [vsFlowData, setVsFlowData] = useState<DivisionFlow | null>(null);
  const [vsFlowLoading, setVsFlowLoading] = useState(false);
  const [stepCtx, setStepCtx] = useState<StepContext | null>(null);
  const [stepCtxLoading, setStepCtxLoading] = useState(false);

  // Fetch helpers
  const fetchFlow = useCallback(async (divId: string) => {
    setFlowLoading(true);
    setFlowData(null);
    try {
      const data: DivisionFlow = await api.get(`/explorer/division/${divId}/flow`);
      setFlowData(data);
    } catch { /* ignore */ }
    finally { setFlowLoading(false); }
  }, []);

  const fetchVsFlow = useCallback(async (divId: string, vsId: string) => {
    setVsFlowLoading(true);
    setVsFlowData(null);
    try {
      const data: DivisionFlow = await api.get(`/explorer/division/${divId}/flow?vs=${vsId}`);
      setVsFlowData(data);
    } catch { /* ignore */ }
    finally { setVsFlowLoading(false); }
  }, []);

  const fetchStepCtx = useCallback(async (stepId: string) => {
    setStepCtxLoading(true);
    setStepCtx(null);
    try {
      const data: StepContext = await api.get(`/explorer/node/subValueStream/${stepId}`);
      setStepCtx(data);
    } catch { /* ignore */ }
    finally { setStepCtxLoading(false); }
  }, []);

  // Reset everything below the domain level.
  const resetBelowDomain = useCallback(() => {
    setLevel(0); setFocusedDivisionId(null); setFlowData(null);
    setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setStepCtx(null);
  }, []);

  // Click handlers
  const onCompanyClick = useCallback(() => {
    if (companyOpen) {
      setCompanyOpen(false); setSelectedDomain(null); resetBelowDomain();
    } else {
      setCompanyOpen(true);
    }
  }, [companyOpen, resetBelowDomain]);

  const onDomainClick = useCallback((cat: Category) => {
    if (selectedDomain === cat) {
      setSelectedDomain(null); resetBelowDomain();  // toggle off → hide divisions
    } else {
      setSelectedDomain(cat); resetBelowDomain();    // switch → show this domain's divisions
    }
  }, [selectedDomain, resetBelowDomain]);

  const onDivisionClick = useCallback((divId: string) => {
    if (focusedDivisionId === divId && level >= 1) {
      setLevel(0); setFocusedDivisionId(null); setFlowData(null);
      setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setStepCtx(null);
      return;
    }
    setLevel(1); setFocusedDivisionId(divId);
    setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setStepCtx(null);
    fetchFlow(divId);
  }, [focusedDivisionId, level, fetchFlow]);

  const onVsClick = useCallback((vsId: string) => {
    if (!focusedDivisionId) return;
    if (focusedVsId === vsId && level >= 2) {
      setLevel(1); setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setStepCtx(null);
      return;
    }
    setLevel(2); setFocusedVsId(vsId); setFocusedStepId(null); setStepCtx(null);
    fetchVsFlow(focusedDivisionId, vsId);
  }, [focusedDivisionId, focusedVsId, level, fetchVsFlow]);

  const onStepClick = useCallback((stepId: string) => {
    if (focusedStepId === stepId && level === 3) {
      setLevel(2); setFocusedStepId(null); setStepCtx(null);
      return;
    }
    setLevel(3); setFocusedStepId(stepId);
    fetchStepCtx(stepId);
  }, [focusedStepId, level, fetchStepCtx]);

  // Breadcrumb collapse
  const crumbToL0 = useCallback(() => {
    setLevel(0); setFocusedDivisionId(null); setFlowData(null);
    setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setStepCtx(null);
  }, []);
  const crumbToL1 = useCallback(() => {
    if (level >= 2) { setLevel(1); setFocusedVsId(null); setVsFlowData(null); setFocusedStepId(null); setStepCtx(null); }
  }, [level]);
  const crumbToL2 = useCallback(() => {
    if (level >= 3) { setLevel(2); setFocusedStepId(null); setStepCtx(null); }
  }, [level]);
  // Back to the domains row (clears the selected domain + everything below).
  const crumbToDomains = useCallback(() => {
    setSelectedDomain(null); resetBelowDomain();
  }, [resetBelowDomain]);

  // Derived
  const focusedDivision = divisions.find((d) => d.id === focusedDivisionId) ?? null;
  const valueStreams: FlowValueStream[] = flowData?.valueStreams ?? [];
  const focusedVs = valueStreams.find((vs) => vs.id === focusedVsId) ?? null;
  const steps: FlowStep[] = vsFlowData?.selected?.steps ?? [];
  const focusedStep = steps.find((s) => s.id === focusedStepId) ?? null;

  // ── Build nodes and edges ─────────────────────────────────────────────────
  // Two-pass layout:
  //   Pass 1: Compute geometry — for each column, walk divisions top-to-bottom.
  //           When reaching the focused division, insert the VS+step block.
  //           Push all subsequent divisions down by the block height.
  //   Pass 2: Emit Node/Edge objects using the computed positions.

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];

    // Partition divisions by category, preserving order from the API.
    const cols: Record<Category, DivisionSummary[]> = {
      'Core Business':      divisions.filter((d) => catFor(d) === 'Core Business'),
      'Corporate Function': divisions.filter((d) => catFor(d) === 'Corporate Function'),
      'IT':                 divisions.filter((d) => catFor(d) === 'IT'),
    };

    // Column center-x values, left→right: Corporate Function · Core Business · IT.
    const colWidth = DIV_W + COL_GAP_X;
    const colCenterX: Record<Category, number> = {
      'Corporate Function': colWidth * 0,
      'Core Business':      colWidth * 1,
      'IT':                 colWidth * 2,
    };
    const middleX = colCenterX['Core Business']; // geometric centre of the 3 columns

    // ── Company root (always present) ─────────────────────────────────────────
    const companyFs: NodeFocusState = !companyOpen ? 'neutral' : 'expanded';
    ns.push({
      id: 'company',
      type: 'companyNode',
      position: { x: middleX - 220 / 2, y: 0 },
      data: { name: companyName, focusState: companyFs } satisfies CompanyNodeData,
      draggable: false,
      selectable: false,
    });

    // Domains only appear once the company is opened.
    if (!companyOpen) return { nodes: ns, edges: es };

    const domainRowY = COMPANY_H + DOMAIN_TOP_OFFSET;

    // ── Compute VS block height (depends on step data) ────────────────────────
    const hasSteps = level >= 2 && focusedVsId && vsFlowData && steps.length > 0;
    const stepsBlockHeight = hasSteps ? (STEP_TOP_OFFSET + STEP_H) : 0;
    const vsBlockHeight = (level >= 1 && flowData && valueStreams.length > 0)
      ? (VS_TOP_OFFSET + VS_H + stepsBlockHeight)
      : 0;

    // ── Process each column ───────────────────────────────────────────────────
    CATEGORIES.forEach((cat, ci) => {
      const cx = colCenterX[cat];
      const divLeft  = cx - DIV_W / 2;
      const coreLeft = cx - CORE_W / 2;
      const isDomainSelected = selectedDomain === cat;

      // Domain header node. Selected → expanded (stays visible while drilling);
      // a different domain selected → dimmed; none selected → neutral.
      const domainFs: NodeFocusState = !selectedDomain ? 'neutral'
        : isDomainSelected ? 'expanded'
        : 'dimmed';
      ns.push({
        id: `core:${cat}`,
        type: 'coreNode',
        position: { x: coreLeft, y: domainRowY },
        data: { label: cat, category: cat, focusState: domainFs, pieceIndex: ci } satisfies CoreNodeData,
        draggable: false,
      });

      // Edge: company → domain
      es.push({
        id: `e:company->${cat}`,
        source: 'company',
        target: `core:${cat}`,
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: '#d4d4d4', strokeWidth: 1,
          strokeOpacity: (selectedDomain && !isDomainSelected) ? 0.12 : 0.35,
        },
      });

      // Divisions render ONLY for the selected domain (hidden otherwise).
      if (!isDomainSelected) return;

      const divs = cols[cat];
      const focusedDivInThisCol = (focusedDivision && catFor(focusedDivision) === cat) ? focusedDivision : null;
      const focusedIndexInCol = focusedDivInThisCol ? divs.findIndex((d) => d.id === focusedDivInThisCol.id) : -1;

      let currentDivY = domainRowY + CORE_H + DIV_TOP_OFFSET;

      divs.forEach((div, di) => {
        const isDivFocused = div.id === focusedDivisionId;

        // Push this division down if it comes after the focused one in this column.
        if (focusedIndexInCol >= 0 && di > focusedIndexInCol) {
          currentDivY += vsBlockHeight;
        }

        const divFs: NodeFocusState = !focusedDivisionId ? 'neutral'
          : isDivFocused ? 'focused'
          : 'dimmed';

        ns.push({
          id: div.id,
          type: 'divisionNode',
          position: { x: divLeft, y: currentDivY },
          data: {
            name: div.name,
            category: cat,
            focusState: divFs,
            pieceIndex: di,
          } satisfies DivisionNodeData,
          draggable: false,
        });

        // Edge: core → division
        es.push({
          id: `e:core:${cat}->${div.id}`,
          source: `core:${cat}`,
          target: div.id,
          sourceHandle: 'b',
          targetHandle: 't',
          style: {
            stroke: '#d4d4d4',
            strokeWidth: 1,
            strokeOpacity: (focusedDivisionId && !isDivFocused) ? 0.12 : 0.35,
          },
        });

        // ── If this is the focused division, insert VS block below it ─────────
        if (isDivFocused && flowData && valueStreams.length > 0) {
          const vsRowTop = currentDivY + DIV_H + VS_TOP_OFFSET;

          // VS row: centered on the focused division's column x.
          // Total VS row width
          const totalVsRowWidth = valueStreams.length * VS_W + (valueStreams.length - 1) * VS_GAP_X;
          const vsRowLeft = cx - totalVsRowWidth / 2;

          valueStreams.forEach((vs, vi) => {
            const vsNodeId = `vs:${vs.id}`;
            const isVsFocused = focusedVsId === vs.id;
            const vsFs: NodeFocusState = level < 2 ? 'neutral'
              : isVsFocused ? 'focused'
              : 'dimmed';

            const vsX = vsRowLeft + vi * (VS_W + VS_GAP_X);
            const vsY = vsRowTop;

            ns.push({
              id: vsNodeId,
              type: 'valueStreamNode',
              position: { x: vsX, y: vsY },
              data: {
                name: vs.name,
                participationType: vs.participationType,
                focusState: vsFs,
                pieceIndex: vi,
              } satisfies ValueStreamNodeData,
              draggable: false,
            });

            // Edge: division → VS
            es.push({
              id: `e:${div.id}->${vsNodeId}`,
              source: div.id,
              target: vsNodeId,
              sourceHandle: 'b',
              targetHandle: 't',
              style: {
                stroke: '#d4d4d4',
                strokeWidth: 1,
                strokeOpacity: (focusedVsId && !isVsFocused) ? 0.15 : 0.5,
              },
            });

            // ── If this VS is focused, insert step block below it ─────────────
            if (isVsFocused && vsFlowData && steps.length > 0) {
              const stepsTop = vsY + VS_H + STEP_TOP_OFFSET;

              // Center steps on the focused VS x.
              const totalStepsWidth = steps.length * STEP_W + (steps.length - 1) * STEP_GAP_X;
              const stepsLeft = vsX + VS_W / 2 - totalStepsWidth / 2;
              // Clamp so we don't go off-screen left
              const stepsLeftClamped = Math.max(stepsLeft, 16);

              steps.forEach((step, si) => {
                const stepNodeId = `step:${step.id}`;
                const isStepFocused = focusedStepId === step.id;
                const stepFs: NodeFocusState = level < 3 ? 'neutral'
                  : isStepFocused ? 'focused'
                  : 'dimmed';

                ns.push({
                  id: stepNodeId,
                  type: 'stepNode',
                  position: { x: stepsLeftClamped + si * (STEP_W + STEP_GAP_X), y: stepsTop },
                  data: {
                    step: step.step,
                    name: step.name,
                    primaryCategory: step.primaryCategory,
                    categories: step.categories,
                    subStepCount: step.subSteps.length,
                    unowned: step.unowned,
                    focusState: stepFs,
                    pieceIndex: si,
                  } satisfies StepNodeData,
                  draggable: false,
                });

                // Edge: step[i-1] → step[i]
                if (si > 0) {
                  es.push({
                    id: `e:step${steps[si - 1].id}->step${step.id}`,
                    source: `step:${steps[si - 1].id}`,
                    target: stepNodeId,
                    sourceHandle: 'r',
                    targetHandle: 'l',
                    type: 'smoothstep',
                    style: { stroke: '#d4d4d4', strokeWidth: 1.25, strokeOpacity: 0.7 },
                  });
                }
              });

              // Edge: VS → first step
              es.push({
                id: `e:${vsNodeId}->step:${steps[0].id}`,
                source: vsNodeId,
                target: `step:${steps[0].id}`,
                sourceHandle: 'b',
                targetHandle: 't',
                style: { stroke: '#d4d4d4', strokeWidth: 1, strokeOpacity: 0.4 },
              });
            }
          });
        }

        currentDivY += DIV_H + DIV_GAP_Y;
      });
    });

    return { nodes: ns, edges: es };
  }, [
    divisions, companyName, companyOpen, selectedDomain, level,
    focusedDivisionId, focusedDivision, focusedVsId, focusedStepId,
    flowData, valueStreams, vsFlowData, steps,
  ]);

  // ── Camera helper ─────────────────────────────────────────────────────────
  const moveCameraToNode = useCallback((nodeId: string, yBias = 0.5) => {
    setTimeout(() => {
      const node = rf.getNode(nodeId);
      if (!node) return;
      const w = node.measured?.width ?? DIV_W;
      const h = node.measured?.height ?? DIV_H;
      const cx = node.position.x + w / 2;
      // Bias y downward so opened children stay in frame
      const cy = node.position.y + h / 2 + yBias * 80;
      rf.setCenter(cx, cy, { zoom: 0.9, duration: 420 });
    }, 60);
  }, [rf]);

  // Camera: company open/close → fit the visible graph
  useEffect(() => {
    setTimeout(() => rf.fitView({ duration: 400, padding: 0.12, maxZoom: 0.95 }), 70);
  }, [companyOpen]); // eslint-disable-line

  // Camera: domain selected → center on it (divisions appear below); deselected → fit
  useEffect(() => {
    if (selectedDomain && !focusedDivisionId) moveCameraToNode(`core:${selectedDomain}`, 1.4);
    else if (!selectedDomain && companyOpen) setTimeout(() => rf.fitView({ duration: 400, padding: 0.12, maxZoom: 0.95 }), 70);
  }, [selectedDomain]); // eslint-disable-line

  // Camera: division focused → center on it; collapsed back → re-center on its domain
  useEffect(() => {
    if (focusedDivisionId) moveCameraToNode(focusedDivisionId, 0.8);
    else if (selectedDomain) moveCameraToNode(`core:${selectedDomain}`, 1.4);
  }, [focusedDivisionId]); // eslint-disable-line

  // Camera: re-center when VS data arrives (async)
  useEffect(() => {
    if (level >= 1 && focusedDivisionId && flowData) {
      setTimeout(() => moveCameraToNode(focusedDivisionId, 0.8), 120);
    }
  }, [flowData]); // eslint-disable-line

  // Camera: L2 → focus VS
  useEffect(() => {
    if (level >= 2 && focusedVsId) moveCameraToNode(`vs:${focusedVsId}`, 0.8);
  }, [focusedVsId]); // eslint-disable-line

  // Camera: re-center when step data arrives (async)
  useEffect(() => {
    if (level >= 2 && focusedVsId && vsFlowData) {
      setTimeout(() => moveCameraToNode(`vs:${focusedVsId}`, 0.8), 120);
    }
  }, [vsFlowData]); // eslint-disable-line

  // Camera: L3 → focus step
  useEffect(() => {
    if (level === 3 && focusedStepId) moveCameraToNode(`step:${focusedStepId}`, 0.3);
  }, [focusedStepId]); // eslint-disable-line

  // ── Node click handler ────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.type === 'companyNode') {
      onCompanyClick();
    } else if (node.type === 'coreNode') {
      onDomainClick(node.id.replace(/^core:/, '') as Category);
    } else if (node.type === 'divisionNode') {
      onDivisionClick(node.id);
    } else if (node.type === 'valueStreamNode') {
      onVsClick(node.id.replace(/^vs:/, ''));
    } else if (node.type === 'stepNode') {
      onStepClick(node.id.replace(/^step:/, ''));
    }
  }, [onCompanyClick, onDomainClick, onDivisionClick, onVsClick, onStepClick]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>

      {/* Breadcrumb — rendered into the page header via portal (lives in the header, not over the canvas). */}
      {breadcrumbSlot && createPortal(
        selectedDomain ? (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
            <button onClick={crumbToDomains} className="focus-crumb-ancestor">{companyName}</button>
            <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>
            {!focusedDivision
              ? <span className="focus-crumb-active">{selectedDomain}</span>
              : <button onClick={crumbToL0} className="focus-crumb-ancestor">{selectedDomain}</button>}
            {focusedDivision && (
              <>
                <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>
                {level === 1
                  ? <span className="focus-crumb-active">{focusedDivision.name}</span>
                  : <button onClick={crumbToL1} className="focus-crumb-ancestor">{focusedDivision.name}</button>}
              </>
            )}
            {level >= 2 && focusedVs && (
              <>
                <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>
                {level === 2
                  ? <span className="focus-crumb-active">{focusedVs.name}</span>
                  : <button onClick={crumbToL2} className="focus-crumb-ancestor">{focusedVs.name}</button>}
              </>
            )}
            {level === 3 && focusedStep && (
              <>
                <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>
                <span className="focus-crumb-active">{focusedStep.name}</span>
              </>
            )}
            <button
              onClick={crumbToDomains}
              aria-label="Clear focus"
              style={{
                marginLeft: 6, width: 22, height: 22, borderRadius: 6,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#a3a3a3',
                background: 'transparent', border: '1px solid #eaeaea', cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span className="text-[13px] text-[#666666]">
            Click the company to reveal its domains, then a domain to drill into the end-to-end process.
          </span>
        ),
        breadcrumbSlot
      )}

      {/* Right sidebar at L3 */}
      {level === 3 && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 15 }}>
          <ContextSidebar
            stepName={focusedStep?.name ?? ''}
            ctx={stepCtx}
            loading={stepCtxLoading}
            side="right"
          />
        </div>
      )}

      {/* Fetch loading indicator */}
      {(flowLoading || vsFlowLoading) && (
        <div
          className="animate-pulse"
          style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, padding: '6px 14px',
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
            border: '1px solid #eaeaea', borderRadius: 8, fontSize: 12, color: '#a3a3a3',
          }}
        >
          Loading…
        </div>
      )}

      {/* React Flow canvas */}
      <div className="rf-stage rf-stage--map" style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={mapNodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e5e5" gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </div>
    </div>
  );
}

// ── Provider wrapper ──────────────────────────────────────────────────────────

export default function MapCanvas({ divisions, companyName, breadcrumbSlot }: Props) {
  return (
    <ReactFlowProvider>
      <MapCanvasInner divisions={divisions} companyName={companyName} breadcrumbSlot={breadcrumbSlot} />
    </ReactFlowProvider>
  );
}
