// Work Library P1a — seed the 14 default templates (6 CHECKLIST modules + 8 TEST
// patterns) with their generic keys, decoded from the MERGED-DUPFLAGGED workbook.
// Idempotent: matches on (companyId, kind, name); existing templates keep their ids
// and get keys reconciled by key text. Values are NOT seeded (filled after the
// templates are confirmed).
// Run: npx tsx --env-file=.env scripts/seed-work-library-templates.ts
import { prisma } from '../src/db/prisma.js';

type KeyDef = { key: string; valueKind: string; guidance?: string };
type TemplateDef = { kind: 'CHECKLIST' | 'TEST'; name: string; description: string; isDefault: boolean; keys: KeyDef[] };

// The 4 keys every test pattern demands ("Missing information to complete before automation").
const UNIVERSAL_TEST_KEYS: KeyDef[] = [
  { key: 'Named process owner', valueKind: 'ROLE' },
  { key: 'Test population', valueKind: 'TEXT' },
  { key: 'Pass/fail thresholds', valueKind: 'TEXT' },
  { key: 'Exception handling path', valueKind: 'TEXT' },
];

export const TEMPLATES: TemplateDef[] = [
  // ── CHECKLIST modules ────────────────────────────────────────────────
  {
    kind: 'CHECKLIST',
    name: 'Core evidence checklist',
    description: 'Base checklist applied to every atomic work item.',
    isDefault: true,
    keys: [
      { key: 'Defined scope/population', valueKind: 'TEXT' },
      { key: 'In-scope period', valueKind: 'TEXT' },
      { key: 'Named SOR/report/query', valueKind: 'APPLICATION' },
      { key: 'Data owner', valueKind: 'ROLE' },
      { key: 'Required fields populated and valid', valueKind: 'TEXT' },
      { key: 'Control totals or record counts reconcile', valueKind: 'TEXT' },
      { key: 'Evidence retained with timestamp/version', valueKind: 'TEXT' },
      { key: 'Exceptions logged with disposition', valueKind: 'TEXT' },
      { key: 'Approver/reviewer sign-off captured', valueKind: 'ROLE' },
    ],
  },
  {
    kind: 'CHECKLIST',
    name: 'Methodology/model validation',
    description: 'Add-on module for calculation, model, and analysis work.',
    isDefault: false,
    keys: [
      { key: 'Methodology/model version approved', valueKind: 'TEXT' },
      { key: 'Independent re-performance or reasonableness check completed', valueKind: 'ROLE' },
      { key: 'Sensitivity thresholds documented', valueKind: 'TEXT' },
      { key: 'Materiality thresholds documented', valueKind: 'TEXT' },
    ],
  },
  {
    kind: 'CHECKLIST',
    name: 'Source traceability / workflow status',
    description: 'Add-on module tracing records to source and workflow state.',
    isDefault: false,
    keys: [
      { key: 'Sample records trace to source screens/documents', valueKind: 'TEXT' },
      { key: 'Status fields align to workflow requirements', valueKind: 'TEXT' },
      { key: 'Date fields align to workflow requirements', valueKind: 'TEXT' },
    ],
  },
  {
    kind: 'CHECKLIST',
    name: 'Regulatory / retention evidence',
    description: 'Add-on module for regulated and retention-bound work.',
    isDefault: false,
    keys: [
      { key: 'Regulatory/policy citation included', valueKind: 'TEXT' },
      { key: 'Retention requirement met', valueKind: 'TEXT' },
      { key: 'Filing deadline met', valueKind: 'TEXT' },
    ],
  },
  {
    kind: 'CHECKLIST',
    name: 'Implementation / change evidence',
    description: 'Add-on module for configuration and change work.',
    isDefault: false,
    keys: [
      { key: 'Pre/post implementation comparison passed', valueKind: 'TEXT' },
      { key: 'System audit log linked', valueKind: 'APPLICATION' },
      { key: 'Change ticket linked', valueKind: 'TEXT' },
    ],
  },
  {
    kind: 'CHECKLIST',
    name: 'Approval authority / communication',
    description: 'Add-on module for decisions requiring authority and communication.',
    isDefault: false,
    keys: [
      { key: 'Approver has correct authority', valueKind: 'ROLE' },
      { key: 'Decision documented', valueKind: 'TEXT' },
      { key: 'Communication recipients documented', valueKind: 'TEXT' },
    ],
  },
  // ── TEST patterns (8) — 4 universal keys + the pattern's dominant variant ──
  {
    kind: 'TEST',
    name: 'Expected evidence + SOR tracing',
    description:
      'Test by defining expected evidence, tracing completion in the SOR, sampling supporting records, and confirming owner review and exception closure.',
    isDefault: true,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'Documented acceptance criteria', valueKind: 'TEXT' }, { key: 'Evidence location', valueKind: 'TEXT' }],
  },
  {
    kind: 'TEST',
    name: 'Analysis population + findings validation',
    description:
      'Test by confirming the analysis population is complete, re-running key analytics or agent prompts, validating material findings to source evidence, and checking that conclusions are supported and reviewed.',
    isDefault: false,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'Documented acceptance criteria', valueKind: 'TEXT' }, { key: 'Evidence location', valueKind: 'TEXT' }],
  },
  {
    kind: 'TEST',
    name: 'Artifact inspection',
    description:
      'Test by inspecting the artifact for required sections, linkage to source data, version/date/owner fields, and approval or archival evidence in the designated repository.',
    isDefault: false,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'Source-system field definitions', valueKind: 'TEXT' }, { key: 'Source-system control totals', valueKind: 'TEXT' }],
  },
  {
    kind: 'TEST',
    name: 'Workflow history tracing',
    description:
      'Test by tracing workflow history, confirming approver authority/segregation, timestamps, required attachments, and that the final disposition was communicated or filed as required.',
    isDefault: false,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'Authorized approver', valueKind: 'ROLE' }, { key: 'Delegation matrix documented', valueKind: 'TEXT' }],
  },
  {
    kind: 'TEST',
    name: 'Re-perform validation rules',
    description:
      'Test by independently re-performing the validation rules, comparing totals/keys/statuses across SORs, investigating exceptions, and confirming evidence of resolution or approved tolerance.',
    isDefault: false,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'In-scope period/effective dates', valueKind: 'TEXT' }],
  },
  {
    kind: 'TEST',
    name: 'Re-perform calculation/model run',
    description:
      'Test by re-performing the calculation/model run with controlled inputs, checking formula/model version, reconciling outputs to expected benchmarks, and reviewing exception thresholds/sensitivity results.',
    isDefault: false,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'Approved methodology/model version', valueKind: 'TEXT' }, { key: 'Parameter source', valueKind: 'TEXT' }],
  },
  {
    kind: 'TEST',
    name: 'Automated SOR extract',
    description:
      'Test by running an automated extract from the identified SOR, validating row counts/control totals to source screens or reports, checking required filters/date ranges, and sampling records back to original evidence.',
    isDefault: false,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'Source-system field definitions', valueKind: 'TEXT' }, { key: 'Source-system control totals', valueKind: 'TEXT' }],
  },
  {
    kind: 'TEST',
    name: 'Config/output comparison',
    description:
      'Test by comparing approved input to system configuration/output after implementation, reviewing audit logs, and validating a sample of downstream transactions or reports.',
    isDefault: false,
    keys: [...UNIVERSAL_TEST_KEYS, { key: 'In-scope period/effective dates', valueKind: 'TEXT' }],
  },
];

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('no company found');
  console.log(`seeding templates for company ${company.name}`);

  let created = 0;
  let updated = 0;
  for (let t = 0; t < TEMPLATES.length; t++) {
    const def = TEMPLATES[t];
    let template = await prisma.workTemplate.findFirst({
      where: { companyId: company.id, kind: def.kind, name: def.name },
      include: { keys: true },
    });
    if (!template) {
      template = await prisma.workTemplate.create({
        data: {
          companyId: company.id,
          kind: def.kind,
          name: def.name,
          description: def.description,
          isDefault: def.isDefault,
          sortOrder: t,
        },
        include: { keys: true },
      });
      created++;
    } else {
      await prisma.workTemplate.update({
        where: { id: template.id },
        data: { description: def.description, isDefault: def.isDefault, sortOrder: t },
      });
      updated++;
    }
    for (let k = 0; k < def.keys.length; k++) {
      const kd = def.keys[k];
      const existing = template.keys.find((x) => x.key === kd.key);
      if (existing) {
        await prisma.workTemplateKey.update({
          where: { id: existing.id },
          data: { valueKind: kd.valueKind, sortOrder: k, guidance: kd.guidance ?? null },
        });
      } else {
        await prisma.workTemplateKey.create({
          data: { templateId: template.id, key: kd.key, valueKind: kd.valueKind, sortOrder: k, guidance: kd.guidance ?? null },
        });
      }
    }
  }
  const totals = await prisma.workTemplate.count({ where: { companyId: company.id } });
  const keyTotal = await prisma.workTemplateKey.count({ where: { template: { companyId: company.id } } });
  console.log(`templates created ${created}, updated ${updated}; totals: ${totals} templates, ${keyTotal} keys`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
