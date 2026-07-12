/**
 * Typed accessors over the §6.2/§6.4 contract fixtures. The board renders from
 * these in dev/tests until Agent 2's endpoints land — integration is a
 * data-source swap in data.ts, not a rewrite. The JSON is hand-written to the
 * frozen contract; the accessors fill optional finding fields with their
 * defaults so the JSON stays readable.
 */
import type {
  AnatomyCategory,
  Domain,
  Finding,
  ProductModel,
  StageDetail,
  VocabularyRow,
} from '../../../lib/rationalization';
import vocabularyJson from './vocabulary.json';
import productModelsJson from './productModels.json';
import productWorkspaceJson from './productWorkspace.json';
import productAnatomyJson from './productAnatomy.json';

/** §6.4 vocabulary rows (both domains) — the seed contract, verbatim. */
export function fixtureVocabulary(domain?: Domain): VocabularyRow[] {
  const rows = vocabularyJson as VocabularyRow[];
  return domain ? rows.filter((r) => r.domain === domain) : rows;
}

/** GET /product-models fixture rows. */
export const fixtureProductModels = (): ProductModel[] => productModelsJson as ProductModel[];

/** Product anatomy reference rows (GET /product-models/anatomy-catalog twin). */
export const fixtureProductAnatomy = (): AnatomyCategory[] =>
  productAnatomyJson as AnatomyCategory[];

// The workspace JSON keeps findings compact; fill the full Finding shape here.
type CompactFinding = Pick<Finding, 'id' | 'appId' | 'layer' | 'capdan' | 'name'> &
  Partial<Finding>;

const fullFinding = (f: CompactFinding): Finding => ({
  category: null,
  view: null,
  screenRef: null,
  plainSummary: null,
  recommendedLayer: null,
  targetLayer: null,
  sharedServiceId: null,
  codeRef: null,
  migrationApproach: null,
  rationale: null,
  effort: null,
  complexity: null,
  migrationStatus: 'Identified',
  deadCode: false,
  normalizationEntryId: null,
  whyThisMoves: null,
  ...f,
});

/** The seeded product-model demo board (§6.2 board-detail shape). */
export function fixtureProductWorkspace(): StageDetail {
  const raw = productWorkspaceJson as Omit<StageDetail, 'findings'> & {
    findings: CompactFinding[];
  };
  return { ...raw, findings: raw.findings.map(fullFinding) };
}
