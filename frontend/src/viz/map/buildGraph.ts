/**
 * Pure two-pass layout builder for the operating-model map. Computes the full
 * React Flow node/edge arrays for the current drill state — extracted verbatim
 * from the MapCanvas layout memo. No React state; safe to call from a useMemo.
 *
 * Two-pass layout:
 *   Pass 1: Compute geometry — for each column, walk divisions top-to-bottom.
 *           When reaching the focused division, insert the VS+step block.
 *           Push all subsequent divisions down by the block height.
 *   Pass 2: Emit Node/Edge objects using the computed positions.
 */
import type { Node, Edge } from '@xyflow/react';

import { MAP_CARD_W, MAP_CARD_H } from '../nodes/MapNode';
import type {
  CompanyNodeData,
  CoreNodeData,
  DivisionNodeData,
  ValueStreamNodeData,
  StepNodeData,
  SubStepNodeData,
  LeafStepNodeData,
} from '../nodes/MapNode';
import { DOMAIN_HEX } from '../model';
import type {
  NodeFocusState,
  DivisionSummary,
  DivisionFlow,
  FlowStep,
  FlowValueStream,
} from '../model';
import {
  catFor,
  categoriesOf,
  type Category,
  COMPANY_H,
  DOMAIN_TOP_OFFSET,
  CORE_W,
  CORE_H,
  DIV_W,
  DIV_H,
  DIV_GAP_X,
  COL_GAP_X,
  DIV_TOP_OFFSET,
  VS_W,
  VS_H,
  VS_GAP_X,
  VS_TOP_OFFSET,
  STEP_W,
  STEP_H,
  STEP_GAP_X,
  STEP_TOP_OFFSET,
  SUBSTEP_TOP_OFFSET,
  LEAF_GAP_Y,
  LEAF_TOP_OFFSET,
} from './constants';

export type BuildMapGraphArgs = {
  displayDivisions: DivisionSummary[];
  companyName: string;
  companyOpen: boolean;
  selectedDomain: Category | null;
  level: number;
  focusedDivisionId: string | null;
  focusedVsId: string | null;
  focusedStepId: string | null;
  focusedSubStepId: string | null;
  flowData: DivisionFlow | null;
  valueStreams: FlowValueStream[];
  vsFlowData: DivisionFlow | null;
  steps: FlowStep[];
  applyOrder: <T>(parentRaw: string | null, arr: T[], idOf: (t: T) => string) => T[];
  domainIdByCat: Map<string, string>;
};

export function buildMapGraph(args: BuildMapGraphArgs): { nodes: Node[]; edges: Edge[] } {
  const {
    displayDivisions,
    companyName,
    companyOpen,
    selectedDomain,
    level,
    focusedDivisionId,
    focusedVsId,
    focusedStepId,
    focusedSubStepId,
    flowData,
    valueStreams,
    vsFlowData,
    steps,
    applyOrder,
    domainIdByCat,
  } = args;

  const ns: Node[] = [];
  const es: Edge[] = [];

  // Edge palette. Base lines are a visible neutral gray (darker than before so
  // the structure reads); the actively-drilled "selected flow" is drawn in the
  // selected domain's color, thicker and fully opaque.
  const LINE = '#9ca3af'; // visible neutral line
  const accent = selectedDomain ? (DOMAIN_HEX[selectedDomain] ?? LINE) : LINE;

  // Partition divisions by their segment; the API already delivers them in
  // value-chain order (Node.sortOrder), so each column keeps incoming order.
  const categories = categoriesOf(displayDivisions);
  const cols: Record<Category, DivisionSummary[]> = {};
  for (const d of displayDivisions) {
    const cat = catFor(d);
    if (!cols[cat]) cols[cat] = [];
    cols[cat].push(d);
  }

  // Column center-x values, left→right in segment order.
  const colWidth = DIV_W + COL_GAP_X;
  const colCenterX: Record<Category, number> = {};
  categories.forEach((c, i) => {
    colCenterX[c] = colWidth * i;
  });
  const middleX = (colWidth * Math.max(categories.length - 1, 0)) / 2; // geometric centre of the columns

  // ── Company root (always present) ─────────────────────────────────────────
  const companyFs: NodeFocusState = !companyOpen ? 'neutral' : 'expanded';
  ns.push({
    id: 'company',
    type: 'companyNode',
    position: { x: middleX - MAP_CARD_W / 2, y: 0 },
    data: { name: companyName, focusState: companyFs } satisfies CompanyNodeData,
    draggable: false,
    selectable: false,
  });

  // Domains only appear once the company is opened.
  if (!companyOpen) return { nodes: ns, edges: es };

  const domainRowY = COMPANY_H + DOMAIN_TOP_OFFSET;

  // ── Process each domain column ─────────────────────────────────────────────
  categories.forEach((cat, ci) => {
    const cx = colCenterX[cat];
    const coreLeft = cx - CORE_W / 2;
    const isDomainSelected = selectedDomain === cat;

    // Domain header node. Selected → expanded (stays visible while drilling);
    // a different domain selected → dimmed; none selected → neutral.
    const domainFs: NodeFocusState = !selectedDomain
      ? 'neutral'
      : isDomainSelected
        ? 'expanded'
        : 'dimmed';
    ns.push({
      id: `core:${cat}`,
      type: 'coreNode',
      position: { x: coreLeft, y: domainRowY },
      data: {
        label: cat,
        category: cat,
        focusState: domainFs,
        pieceIndex: ci,
      } satisfies CoreNodeData,
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
        stroke: isDomainSelected ? accent : LINE,
        strokeWidth: isDomainSelected ? 2 : 1.25,
        strokeOpacity: isDomainSelected ? 0.95 : selectedDomain ? 0.2 : 0.55,
      },
    });

    // Divisions render ONLY for the selected domain — as a horizontal (L2) row
    // centered under the domain header.
    if (!isDomainSelected) return;

    const divs = applyOrder(domainIdByCat.get(cat) ?? null, cols[cat], (d) => d.id);
    const divRowY = domainRowY + CORE_H + DIV_TOP_OFFSET;
    const totalDivRowWidth = divs.length * DIV_W + (divs.length - 1) * DIV_GAP_X;
    const divRowLeft = cx - totalDivRowWidth / 2;

    divs.forEach((div, di) => {
      const isDivFocused = div.id === focusedDivisionId;
      const divX = divRowLeft + di * (DIV_W + DIV_GAP_X);
      const divCenterX = divX + DIV_W / 2;

      const divFs: NodeFocusState = !focusedDivisionId
        ? 'neutral'
        : isDivFocused
          ? 'focused'
          : 'dimmed';

      ns.push({
        id: div.id,
        type: 'divisionNode',
        position: { x: divX, y: divRowY },
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
          stroke: isDivFocused ? accent : LINE,
          strokeWidth: isDivFocused ? 2 : 1.25,
          strokeOpacity: isDivFocused ? 0.95 : focusedDivisionId ? 0.18 : 0.55,
        },
      });

      // ── Focused division → its value streams render L-to-R below it ───────
      if (isDivFocused && flowData && valueStreams.length > 0) {
        const vsRowTop = divRowY + DIV_H + VS_TOP_OFFSET;

        // VS row: centered under the focused division.
        const totalVsRowWidth = valueStreams.length * VS_W + (valueStreams.length - 1) * VS_GAP_X;
        const vsRowLeft = divCenterX - totalVsRowWidth / 2;

        valueStreams.forEach((vs, vi) => {
          const vsNodeId = `vs:${vs.id}`;
          const isVsFocused = focusedVsId === vs.id;
          const vsFs: NodeFocusState = level < 2 ? 'neutral' : isVsFocused ? 'focused' : 'dimmed';

          const vsX = vsRowLeft + vi * (VS_W + VS_GAP_X);
          const vsY = vsRowTop;

          ns.push({
            id: vsNodeId,
            type: 'valueStreamNode',
            position: { x: vsX, y: vsY },
            data: {
              name: vs.name,
              category: cat,
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
              stroke: isVsFocused ? accent : LINE,
              strokeWidth: isVsFocused ? 2 : 1.25,
              strokeOpacity: isVsFocused ? 0.95 : focusedVsId ? 0.18 : 0.6,
            },
          });

          // ── If this VS is focused, insert step block below it ─────────────
          // The L4 process steps render as an ORDERED HORIZONTAL ROW (step 1
          // leftmost), since a process flow that has an order must be drawn in
          // that order. The row is centered horizontally under the VS; each
          // step increases in X at a constant Y. Connectors run l→r (left
          // handle of one card to the right handle of the previous), so the
          // arrows read left-to-right.
          if (isVsFocused && vsFlowData && steps.length > 0) {
            const stepsTop = vsY + VS_H + STEP_TOP_OFFSET;

            // Single row, centered under the focused VS.
            const vsCenterX = vsX + VS_W / 2;
            const totalStepRowWidth = steps.length * STEP_W + (steps.length - 1) * STEP_GAP_X;
            const stepsLeft = vsCenterX - totalStepRowWidth / 2;

            steps.forEach((step, si) => {
              const stepNodeId = `step:${step.id}`;
              const isStepFocused = focusedStepId === step.id;
              const stepFs: NodeFocusState =
                level < 3 ? 'neutral' : isStepFocused ? 'focused' : 'dimmed';

              const stepX = stepsLeft + si * (STEP_W + STEP_GAP_X);
              const stepY = stepsTop;

              ns.push({
                id: stepNodeId,
                type: 'stepNode',
                position: { x: stepX, y: stepY },
                data: {
                  step: step.step,
                  name: step.name,
                  category: cat,
                  primaryCategory: step.primaryCategory,
                  categories: step.categories,
                  subStepCount: step.subSteps.length,
                  unowned: step.unowned,
                  focusState: stepFs,
                  pieceIndex: si,
                } satisfies StepNodeData,
                draggable: false,
              });

              // Edge: step[i-1] → step[i] (horizontal: right → left)
              if (si > 0) {
                es.push({
                  id: `e:step${steps[si - 1].id}->step${step.id}`,
                  source: `step:${steps[si - 1].id}`,
                  target: stepNodeId,
                  sourceHandle: 'r',
                  targetHandle: 'l',
                  type: 'smoothstep',
                  style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.9 },
                });
              }

              // ── If this step is focused, its L5 tasks render as an ORDERED
              //    HORIZONTAL ROW below it (task 1 leftmost) — the process
              //    reads left-to-right; each L5's generated L6 tasks drop as a
              //    vertical column beneath it when focused. ──
              if (isStepFocused && step.subSteps.length > 0) {
                const stepCenterX = stepX + STEP_W / 2;
                const subTop = stepY + STEP_H + SUBSTEP_TOP_OFFSET;
                const subs = step.subSteps;
                const totalSubRowWidth = subs.length * MAP_CARD_W + (subs.length - 1) * STEP_GAP_X;
                const subRowLeft = stepCenterX - totalSubRowWidth / 2;

                subs.forEach((sub, sj) => {
                  const subNodeId = `substep:${sub.id}`;
                  const isSubFocused = focusedSubStepId === sub.id;
                  const subFs: NodeFocusState =
                    level < 4 ? 'neutral' : isSubFocused ? 'focused' : 'dimmed';
                  const subLeft = subRowLeft + sj * (MAP_CARD_W + STEP_GAP_X);
                  const subY = subTop;

                  ns.push({
                    id: subNodeId,
                    type: 'subStepNode',
                    position: { x: subLeft, y: subY },
                    data: {
                      step: sub.step,
                      name: sub.name,
                      l5Count: sub.l5.length,
                      focusState: subFs,
                      pieceIndex: sj,
                    } satisfies SubStepNodeData,
                    draggable: false,
                  });

                  // Edge: subStep[j-1] → subStep[j]. Default bezier like the
                  // L4 row — smoothstep drew a right-angle fold here.
                  if (sj > 0) {
                    es.push({
                      id: `e:substep${subs[sj - 1].id}->substep${sub.id}`,
                      source: `substep:${subs[sj - 1].id}`,
                      target: subNodeId,
                      sourceHandle: 'r',
                      targetHandle: 'l',
                      style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.9 },
                    });
                  }

                  // ── EVERY L5 shows its generated L6 task column beneath it,
                  //    ordered top-to-bottom — the L6 grouping is the point of
                  //    the view, so it is always visible, not click-gated. ──
                  if (sub.l5.length > 0) {
                    const subCenterX = subLeft + MAP_CARD_W / 2;
                    const leafLeft = subCenterX - MAP_CARD_W / 2;
                    const leafTop = subY + MAP_CARD_H + LEAF_TOP_OFFSET;
                    const l5 = sub.l5;

                    l5.forEach((leaf, lk) => {
                      const leafNodeId = `leaf:${leaf.id}`;
                      ns.push({
                        id: leafNodeId,
                        type: 'leafStepNode',
                        position: { x: leafLeft, y: leafTop + lk * (MAP_CARD_H + LEAF_GAP_Y) },
                        data: {
                          step: leaf.step,
                          name: leaf.name,
                          focusState: 'neutral',
                          pieceIndex: lk,
                        } satisfies LeafStepNodeData,
                        draggable: false,
                      });
                      // Edge: leaf[k-1] → leaf[k] (vertical: bottom → top)
                      if (lk > 0) {
                        es.push({
                          id: `e:leaf${l5[lk - 1].id}->leaf${leaf.id}`,
                          source: `leaf:${l5[lk - 1].id}`,
                          target: leafNodeId,
                          sourceHandle: 'b',
                          targetHandle: 't',
                          type: 'smoothstep',
                          style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.9 },
                        });
                      }
                    });

                    // Edge: sub-process → first L5 step (top → bottom, into the column)
                    es.push({
                      id: `e:${subNodeId}->leaf:${l5[0].id}`,
                      source: subNodeId,
                      target: `leaf:${l5[0].id}`,
                      sourceHandle: 'b',
                      targetHandle: 't',
                      type: 'smoothstep',
                      style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.8 },
                    });
                  }
                });

                // Edge: step → first L5 of the row. Default bezier — smoothstep
                // drew a right-angle fold across the horizontal offset.
                es.push({
                  id: `e:${stepNodeId}->substep:${subs[0].id}`,
                  source: stepNodeId,
                  target: `substep:${subs[0].id}`,
                  sourceHandle: 'b',
                  targetHandle: 't',
                  style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.8 },
                });
              }
            });

            // Edge: VS → first step (left of the row)
            es.push({
              id: `e:${vsNodeId}->step:${steps[0].id}`,
              source: vsNodeId,
              target: `step:${steps[0].id}`,
              sourceHandle: 'b',
              targetHandle: 't',
              style: { stroke: accent, strokeWidth: 2, strokeOpacity: 0.8 },
            });
          }
        });
      }
    });
  });

  return { nodes: ns, edges: es };
}
