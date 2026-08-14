// Shared cell/count/review-row types for the Products grid. The heavy
// derivations that used to live here (buildHeatmap / buildGridModel /
// buildFormsModel over the whole spine) moved to the backend resolver
// (backend/src/lib/resolvers/productBoard.ts) when the client-side design
// collapsed at 381 versions — the board now renders the server's aggregates
// (see boardApi.ts) and only these type shapes remain shared.

import type { ElementGroup, ProductDecision } from './spine';

export type Rag = 'green' | 'amber' | 'red';

export interface HeatCounts {
  total: number;
  auto: number;
  need: number;
  decided: number;
  /** Status mix — common + similar + unique always sums to total. */
  common: number;
  similar: number;
  unique: number;
}

export interface HeatCell extends HeatCounts {
  /** true when the column does not carry the component/form at all. */
  na: boolean;
  versionId: string;
  lobId: string;
}

export interface ReviewRow {
  lobId: string;
  lobName: string;
  group: ElementGroup;
  /** Library clause row inside a form's drill — part of the form's wording,
   *  standardized or retired WITH the form, never individually. */
  contained?: boolean;
  needsDecision: boolean;
  decision: ProductDecision | null;
  /** Presence per grid column (column-axis order — versions, or products
   *  once the server folds the axis). */
  presence: boolean[];
}
