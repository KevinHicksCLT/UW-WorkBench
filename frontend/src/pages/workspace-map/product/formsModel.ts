// Forms register vocabulary — layer/content labels and hints shared by the
// grid's forms sections. The register itself is now DERIVED SERVER-SIDE
// (backend/src/lib/resolvers/productForms.ts) and arrives render-ready on the
// board payload (boardApi.ts); this module keeps only the display metadata.
//
// The three rationalization layers (Form rationalization design):
// CORE NATIONAL FORMS · STATE-REQUIRED VARIATIONS · PRODUCT-SPECIFIC
// VARIATIONS — "what can become a national form vs what truly stays
// state-specific" reads straight off the section a form sits in.

export type FormLayer = 'core' | 'state' | 'product';

export const FORM_LAYER_ORDER: FormLayer[] = ['core', 'state', 'product'];

export const FORM_LAYER_META: Record<FormLayer, { label: string; hint: string }> = {
  core: {
    label: 'Countrywide forms',
    hint: '',
  },
  state: {
    label: 'State-required variations',
    hint: 'state-mandated forms — decide what absorbs into the core vs truly stays state-specific',
  },
  product: {
    label: 'Product-specific variations',
    hint: 'forms carried by only one or two products',
  },
};

export type ContentKind = 'coverage' | 'covpart' | 'endorsement' | 'clause';

export const CONTENT_KIND_ORDER: ContentKind[] = ['coverage', 'covpart', 'endorsement', 'clause'];

export const CONTENT_META: Record<ContentKind, { label: string; hint: string }> = {
  coverage: { label: 'Coverages', hint: 'coverages the form grants or modifies' },
  covpart: { label: 'Coverage parts', hint: 'coverage sub-parts and options' },
  endorsement: { label: 'Endorsements', hint: 'endorsement forms that attach to this form' },
  clause: { label: 'Clauses', hint: 'policy terms and clauses the form carries' },
};
