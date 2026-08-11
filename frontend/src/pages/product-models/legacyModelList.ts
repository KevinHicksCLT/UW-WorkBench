// Pure helpers behind the Legacy models master list (`/product-models?view=legacy`,
// plan §5 D-1) — kept free of React so they unit-test directly
// (frontend/tests/pages/product-models/legacyModelList.test.ts).
import type { PillTone } from '../../components/ui';

/** One row of `GET /product-models` (frozen DTO, plan §6.2). */
export type LegacyProductModel = {
  id: string;
  name: string;
  description: string | null;
  sourceSystem: string | null;
  segment: string | null;
  geography: string | null;
  disposition: string | null;
  workspaces: { id: string; name: string }[];
  findingCount: number;
  illustrative: boolean;
};

/**
 * Disposition token → StatusPill tone. Tokens are the seeded vocabulary
 * (plan §6.4): Retain / Refactor / Replace / Retire; anything else (including
 * a missing disposition) renders neutral.
 */
export function dispositionTone(disposition: string | null): PillTone {
  switch (disposition) {
    case 'Retain':
      return 'green';
    case 'Refactor':
      return 'blue';
    case 'Replace':
      return 'amber';
    case 'Retire':
      return 'red';
    default:
      return 'slate';
  }
}

/** Workspace names for the multi-valued Sheet column (filter matches ANY). */
export function workspaceNames(model: LegacyProductModel): string[] {
  return model.workspaces.map((w) => w.name);
}

/**
 * Totals-strip summary for the visible rows: distinct source systems plus how
 * many models are on their way out (Replace/Retire) — the number a
 * rationalization owner scans for first.
 */
export function summarizeModels(visible: LegacyProductModel[]): string {
  const systems = new Set(visible.map((m) => m.sourceSystem).filter(Boolean)).size;
  const outbound = visible.filter(
    (m) => m.disposition === 'Replace' || m.disposition === 'Retire',
  ).length;
  return `${systems} source systems · ${outbound} to replace or retire`;
}
