// ── Forms Rationalization demo library (FORMS-RATION) ──
// Six client-owned GL endorsement variants that echo a real carrier problem:
// the same additional-insured / primary-noncontributory / cancellation
// provisions drafted slightly differently across regional programs. Ingested
// through the SAME segmentation + hashing pipeline the API uses, so clause
// offsets and hashes are production-identical. Plus the field plane: a
// starter dictionary (ACORD-aware, one do-not-map, one calculated composite)
// with extracted fields on three forms and τ-routed mapping suggestions.
// Idempotent: rows are replaced wholesale per company.
import type { PrismaClient } from '@prisma/client';
import { segmentClauses, meanSegConfidence } from '../lib/forms/segmentation.js';
import { clauseTextHash } from '../lib/forms/similarity.js';
import { suggestMapping, type MappingCandidate } from '../lib/forms/fieldMapping.js';
import { routeMappingStatus, QUARANTINE_THRESHOLD } from '../lib/forms/trust.js';

type Ctx = { tenantId: string; companyId: string };

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

type FormDef = {
  formNumber: string;
  title: string;
  lob: string;
  states: string[] | null;
  editionDate: string;
  filingStatus: string;
  provenance?: string;
  clauses: string[];
};

const FORMS: FormDef[] = [
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

// Field-plane starter dictionary. insured.name.full is a calculated composite
// (get-only, INV-F2); legacy.insured.fein is do-not-map (INV-F1); FEIN and
// state carry ACORD refs (semantic deference, INV-F4).
const DICTIONARY = [
  { key: 'insured.name.first', dataSetType: 'Insured', dataType: 'string' },
  { key: 'insured.name.last', dataSetType: 'Insured', dataType: 'string' },
  {
    key: 'insured.name.full',
    dataSetType: 'Insured',
    dataType: 'string',
    compositionParts: ['insured.name.first', 'insured.name.last'],
    compositionFormat: '{First} {Last}',
  },
  {
    key: 'insured.tax.fein',
    dataSetType: 'Identification',
    dataType: 'string',
    acordRef: 'ACORD:FEIN',
  },
  {
    key: 'policy.number',
    dataSetType: 'Policy',
    dataType: 'string',
    acordRef: 'ACORD:PolicyNumber',
  },
  {
    key: 'policy.date.effective',
    dataSetType: 'Policy',
    dataType: 'date',
    acordRef: 'ACORD:EffectiveDt',
  },
  {
    key: 'policy.address.state',
    dataSetType: 'Location',
    dataType: 'choice',
    acordRef: 'ACORD:StateProvCd',
  },
  { key: 'producer.name.full', dataSetType: 'Producer', dataType: 'string' },
  { key: 'signature.insured.sign', dataSetType: 'Signature', dataType: 'signature' },
  {
    key: 'legacy.insured.fein',
    dataSetType: 'Identification',
    dataType: 'string',
    stability: 'do-not-map',
  },
] as const;

const STATE_OPTIONS = ['NY', 'NJ', 'CT', 'CA', 'OR', 'WA', 'TX'].map((s) => ({
  label: s,
  exportValue: s,
}));

// Divergently-named fields asking the SAME questions across three forms —
// the seed for the "same question, N phrasings" report (FORMS-HLR-020).
const FIELDS: Record<
  string,
  {
    sourceName: string;
    label: string;
    widgetType?: string;
    options?: { label: string; exportValue: string }[];
    required?: boolean;
  }[]
> = {
  'GL 20 10 A': [
    { sourceName: 'InsuredFirstName', label: 'Insured First Name', required: true },
    { sourceName: 'InsuredLastName', label: 'Insured Last Name', required: true },
    { sourceName: 'InsuredFEIN', label: 'FEIN', required: true },
    { sourceName: 'PolicyNumber', label: 'Policy Number', required: true },
    { sourceName: 'EffectiveDate', label: 'Effective Date', widgetType: 'date' },
    { sourceName: 'State', label: 'State', widgetType: 'choice', options: STATE_OPTIONS },
    { sourceName: 'InsuredSignature', label: 'Signature of Insured', widgetType: 'signature' },
  ],
  'GL 20 10 E': [
    { sourceName: 'FirstNameOfInsured', label: 'First Name of Named Insured', required: true },
    { sourceName: 'LastNameOfInsured', label: 'Last Name of Named Insured', required: true },
    { sourceName: 'FederalEIN', label: 'Federal Employer ID Number', required: true },
    { sourceName: 'PolicyNo', label: 'Policy No.' },
    { sourceName: 'PolEffDate', label: 'Policy Effective Date', widgetType: 'date' },
    { sourceName: 'RiskState', label: 'Risk State', widgetType: 'choice', options: STATE_OPTIONS },
  ],
  'GL 02 20': [
    { sourceName: 'NamedInsuredFEIN', label: 'Named Insured FEIN' },
    { sourceName: 'PolicyNumberField', label: 'Policy #', required: true },
    { sourceName: 'EffDt', label: 'Eff. Date', widgetType: 'date' },
    { sourceName: 'ProducerFullName', label: 'Producer Name' },
  ],
};

export async function seedForms(p: PrismaClient, ctx: Ctx): Promise<void> {
  const { tenantId, companyId } = ctx;
  // Wholesale replace (cascades take versions/clauses/fields/clusters/etc.).
  await p.formWorkingSet.deleteMany({ where: { companyId } });
  await p.policyForm.deleteMany({ where: { companyId } });
  await p.fieldDefinition.deleteMany({ where: { companyId } });

  // Owner role: forms live with product development when present.
  const ownerRole = await p.role.findFirst({
    where: { companyId, displayValue: { contains: 'Product', mode: 'insensitive' } },
    select: { id: true },
  });

  const versionIds: string[] = [];
  const versionIdByForm: Record<string, string> = {};
  for (const def of FORMS) {
    const sourceText = def.clauses.join('\n');
    const segmented = segmentClauses(sourceText);
    const segConfidence = meanSegConfidence(segmented);
    const form = await p.policyForm.create({
      data: {
        tenantId,
        companyId,
        formNumber: def.formNumber,
        title: def.title,
        lob: def.lob,
        states: def.states ?? undefined,
        editionDate: def.editionDate,
        filingStatus: def.filingStatus,
        provenance: def.provenance ?? 'client',
        ownerRoleId: ownerRole?.id,
        versions: {
          create: {
            tenantId,
            companyId,
            versionNo: 1,
            status: segConfidence < QUARANTINE_THRESHOLD ? 'quarantined' : 'ready',
            sourceText,
            segConfidence,
            clauses: {
              create: segmented.map((c) => ({
                tenantId,
                companyId,
                ordinal: c.ordinal,
                level: c.level,
                heading: c.heading,
                text: c.text,
                charStart: c.charStart,
                charEnd: c.charEnd,
                textHash: clauseTextHash(c.text),
                segConfidence: c.segConfidence,
              })),
            },
            fields: {
              create: (FIELDS[def.formNumber] ?? []).map((f) => ({
                tenantId,
                companyId,
                sourceName: f.sourceName,
                label: f.label,
                page: 1,
                widgetType: f.widgetType ?? 'text',
                options: f.options ?? undefined,
                selectMode: f.options ? 'single' : undefined,
                required: f.required ?? false,
                instance: 1,
              })),
            },
          },
        },
      },
      include: { versions: { select: { id: true } } },
    });
    versionIds.push(form.versions[0].id);
    versionIdByForm[def.formNumber] = form.versions[0].id;
  }

  // Working set over the five client-owned forms (Reading-mode scale).
  await p.formWorkingSet.create({
    data: {
      tenantId,
      companyId,
      name: 'GL endorsement rationalization',
      description:
        'Additional-insured, primary-and-noncontributory and cancellation wording variants across the regional GL programs.',
      members: {
        create: FORMS.filter((f) => f.provenance !== 'iso-flagged').map((f) => ({
          companyId,
          formVersionId: versionIdByForm[f.formNumber],
        })),
      },
    },
  });

  // Field dictionary + τ-routed mapping suggestions over extracted fields.
  const defIdByKey: Record<string, string> = {};
  for (const d of DICTIONARY) {
    const row = await p.fieldDefinition.create({
      data: {
        tenantId,
        companyId,
        key: d.key,
        dataSetType: d.dataSetType,
        dataType: d.dataType,
        acordRef: 'acordRef' in d ? d.acordRef : undefined,
        stability: 'stability' in d ? d.stability : 'stable',
        compositionParts: 'compositionParts' in d ? [...d.compositionParts] : undefined,
        compositionFormat: 'compositionFormat' in d ? d.compositionFormat : undefined,
      },
    });
    defIdByKey[d.key] = row.id;
  }
  const candidates: MappingCandidate[] = DICTIONARY.map((d) => ({
    id: defIdByKey[d.key],
    key: d.key,
    stability: 'stability' in d ? d.stability : 'stable',
    optionValues: [],
  }));
  const fields = await p.formField.findMany({
    where: { formVersionId: { in: versionIds } },
    select: { id: true, sourceName: true, label: true, options: true },
  });
  for (const field of fields) {
    const optionLabels = Array.isArray(field.options)
      ? (field.options as { label?: string }[]).map((o) => o.label ?? '').filter(Boolean)
      : [];
    const suggestion = suggestMapping(
      { sourceName: field.sourceName, label: field.label, optionLabels },
      candidates,
    );
    if (!suggestion) continue;
    await p.fieldMapping.create({
      data: {
        tenantId,
        companyId,
        formFieldId: field.id,
        fieldDefinitionId: suggestion.fieldDefinitionId,
        confidence: suggestion.confidence,
        nameSim: suggestion.nameSim,
        labelSim: suggestion.labelSim,
        optionOverlap: suggestion.optionOverlap,
        status: routeMappingStatus(suggestion.confidence),
      },
    });
  }
}
