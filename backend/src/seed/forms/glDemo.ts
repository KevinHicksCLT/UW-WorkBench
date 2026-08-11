// ── General Liability demo library (FORMS-RATION) ──
// The original six client-owned GL endorsement variants (additional-insured /
// primary-noncontributory / cancellation wording drafted slightly differently
// across regional programs). Kept alongside the manuscript library per SCRUM-229
// so the GL demo working set continues to exist unchanged.

const AI_GRANT_A =
  'A. Who Is An Insured is amended to include as an additional insured the person or organization shown in the Schedule, but only with respect to liability for bodily injury or property damage caused in whole or in part by your acts or omissions in the performance of your ongoing operations for the additional insured.';
const AI_GRANT_B =
  'A. Who Is An Insured is amended to include as an additional insured the person or organization shown in the Schedule, but only with respect to liability for bodily injury or property damage caused in whole or in part by your acts or omissions in the performance of your ongoing operations at the location designated above for the additional insured.';
const AI_GRANT_C =
  'A. Who Is An Insured is amended to include as an additional insured any person or organization with whom you have agreed in a written contract to provide such coverage, but only with respect to liability arising out of your ongoing operations performed for that person or organization.';

const PRIMARY_A =
  'B. This insurance is primary to and will not seek contribution from any other insurance available to the additional insured, provided that the additional insured is a named insured under such other insurance and you have agreed in writing in a contract or agreement that this insurance would be primary and would not seek contribution.';
const PRIMARY_B =
  'B. This insurance is primary and noncontributory with respect to any other insurance available to the additional insured when you have agreed in a written contract or written agreement that this insurance will be primary and will not seek contribution from such insurance.';

const CANCEL_A =
  'C. We will not cancel this policy without first providing thirty days advance written notice to the first named insured, or ten days notice when cancellation is for nonpayment of premium.';
const CANCEL_B =
  'C. We will not cancel this policy without first providing sixty days advance written notice to the first named insured, or ten days notice when cancellation is for nonpayment of premium.';

const WAIVER =
  'D. We waive any right of recovery we may have against the person or organization shown in the Schedule because of payments we make for injury or damage arising out of your ongoing operations, but only to the extent you are required by written contract to obtain this waiver.';

const SEVERABILITY =
  'E. Except with respect to the Limits of Insurance, this insurance applies as if each named insured were the only named insured, and separately to each insured against whom claim is made or suit is brought.';

export type GlFormDef = {
  formNumber: string;
  title: string;
  lob: string;
  states: string[] | null;
  editionDate: string;
  filingStatus: string;
  provenance?: string;
  clauses: string[];
};

export const GL_FORMS: GlFormDef[] = [
  {
    formNumber: 'GL 20 10 A',
    title: 'Additional Insured — Ongoing Operations (National)',
    lob: 'General Liability',
    states: null,
    editionDate: '04 13',
    filingStatus: 'Approved',
    clauses: [AI_GRANT_A, PRIMARY_A, CANCEL_A, WAIVER, SEVERABILITY],
  },
  {
    formNumber: 'GL 20 10 E',
    title: 'Additional Insured — Ongoing Operations (East Program)',
    lob: 'General Liability',
    states: ['NY', 'NJ', 'CT'],
    editionDate: '07 19',
    filingStatus: 'Approved',
    clauses: [AI_GRANT_B, PRIMARY_B, CANCEL_B, WAIVER, SEVERABILITY],
  },
  {
    formNumber: 'GL 20 10 W',
    title: 'Additional Insured — Ongoing Operations (West Program)',
    lob: 'General Liability',
    states: ['CA', 'OR', 'WA'],
    editionDate: '01 21',
    filingStatus: 'Filed',
    clauses: [AI_GRANT_C, PRIMARY_B, CANCEL_A, SEVERABILITY],
  },
  {
    formNumber: 'GL 24 04',
    title: 'Waiver of Transfer of Rights (Blanket)',
    lob: 'General Liability',
    states: null,
    editionDate: '05 09',
    filingStatus: 'Approved',
    clauses: [WAIVER, SEVERABILITY, CANCEL_A],
  },
  {
    formNumber: 'GL 02 20',
    title: 'Notice of Cancellation — Extended (Texas Program)',
    lob: 'General Liability',
    states: ['TX'],
    editionDate: '11 17',
    filingStatus: 'Approved',
    clauses: [CANCEL_B, PRIMARY_A, SEVERABILITY],
  },
  {
    formNumber: 'CG 20 10',
    title: 'Additional Insured — Owners, Lessees or Contractors (ISO base)',
    lob: 'General Liability',
    states: null,
    editionDate: '04 13',
    filingStatus: 'Approved',
    provenance: 'iso-flagged',
    clauses: [AI_GRANT_A, PRIMARY_A, SEVERABILITY],
  },
];
