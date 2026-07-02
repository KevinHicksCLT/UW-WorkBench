/**
 * MapNode.tsx — barrel for the map node cards. The implementation was split
 * (pure code motion — behavior unchanged) into:
 *   viz/nodes/mapNodeShared.tsx — dimensions, sentenceCase, styles, data types
 *   viz/nodes/mapNodeCards.tsx  — the seven card components + mapNodeTypes
 * Every existing import site (`from './nodes/MapNode'`) keeps working.
 */
export {
  MAP_CARD_W, MAP_CARD_H, sentenceCase,
  type CompanyNodeData, type CoreNodeData, type DivisionNodeData,
  type ValueStreamNodeData, type StepNodeData, type SubStepNodeData,
  type LeafStepNodeData, type EditAffordance,
} from './mapNodeShared';
export { mapNodeTypes } from './mapNodeCards';
