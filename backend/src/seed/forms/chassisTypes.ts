// ── Product form chassis types (SCRUM-229 forms single-source-of-truth) ──
// A chassis is the specimen-grade content skeleton for one product family:
// the defined terms, insuring agreements, exclusions, conditions and dec-page
// line items the form generator assembles into full synthetic documents.
// All wording is fictional specimen text — no real carrier language.
export type FormChassis = {
  key: string;
  documentKind: 'policy' | 'coverage-form' | 'binder' | 'treaty-wording';
  definitions: { term: string; text: string }[]; // 4-6 defined terms
  insuringAgreements: { name: string; text: string }[]; // 2-5 coverages/insuring agreements
  limitsNote: string; // one paragraph on limits/retentions
  exclusions: { name: string; text: string }[]; // 5-8
  conditions: { name: string; text: string }[]; // 4-6
  endorsements: { suffixNo: string; title: string; body: string }[]; // 1-2; body uses lettered sections A./B./C.
  decItems: string[]; // 5-8 declarations page line items
};
