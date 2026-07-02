// Atomize Work Library template keys (user request 2026-07-02): every generic
// key defines ONE thing only — compound keys like "Named SOR/report/query and
// data owner" split into single-fact keys ("Named SOR/report/query" +
// "Data owner"), each with the value kind that fits the single fact.
// Reconciles every template against the canonical list below: matching keys
// keep their id (answers preserved), missing keys are created, removed keys
// are deleted (their answers cascade — values are blank at this stage).
// Run: npx tsx --env-file=.env scripts/atomize-template-keys.ts
import { prisma } from '../src/db/prisma.js';

type KeyDef = { key: string; valueKind: string };
const K = (key: string, valueKind = 'TEXT'): KeyDef => ({ key, valueKind });

const TEST_UNIVERSAL: KeyDef[] = [
  K('Named process owner', 'ROLE'),
  K('Test population'),
  K('Pass/fail thresholds'),
  K('Exception handling path'),
];

// Canonical atomized key list per template (by name).
const CANON: Record<string, KeyDef[]> = {
  // ── Checklist modules ────────────────────────────────────────────────
  'Core evidence checklist': [
    K('Defined scope/population'),
    K('In-scope period'),
    K('Named SOR/report/query', 'APPLICATION'),
    K('Data owner', 'ROLE'),
    K('Required fields populated and valid'),
    K('Control totals or record counts reconcile'),
    K('Evidence retained with timestamp/version'),
    K('Exceptions logged with disposition'),
    K('Approver/reviewer sign-off captured', 'ROLE'),
  ],
  'Methodology/model validation': [
    K('Methodology/model version approved'),
    K('Independent re-performance or reasonableness check completed', 'ROLE'),
    K('Sensitivity thresholds documented'),
    K('Materiality thresholds documented'),
  ],
  'Source traceability / workflow status': [
    K('Sample records trace to source screens/documents'),
    K('Status fields align to workflow requirements'),
    K('Date fields align to workflow requirements'),
  ],
  'Regulatory / retention evidence': [
    K('Regulatory/policy citation included'),
    K('Retention requirement met'),
    K('Filing deadline met'),
  ],
  'Implementation / change evidence': [
    K('Pre/post implementation comparison passed'),
    K('System audit log linked', 'APPLICATION'),
    K('Change ticket linked'),
  ],
  'Approval authority / communication': [
    K('Approver has correct authority', 'ROLE'),
    K('Decision documented'),
    K('Communication recipients documented'),
  ],
  // ── Test patterns (4 universal keys + atomized variants) ─────────────
  'Expected evidence + SOR tracing': [...TEST_UNIVERSAL, K('Documented acceptance criteria'), K('Evidence location')],
  'Analysis population + findings validation': [...TEST_UNIVERSAL, K('Documented acceptance criteria'), K('Evidence location')],
  'Artifact inspection': [...TEST_UNIVERSAL, K('Source-system field definitions'), K('Source-system control totals')],
  'Workflow history tracing': [...TEST_UNIVERSAL, K('Authorized approver', 'ROLE'), K('Delegation matrix documented')],
  'Re-perform validation rules': [...TEST_UNIVERSAL, K('In-scope period/effective dates')],
  'Re-perform calculation/model run': [...TEST_UNIVERSAL, K('Approved methodology/model version'), K('Parameter source')],
  'Automated SOR extract': [...TEST_UNIVERSAL, K('Source-system field definitions'), K('Source-system control totals')],
  'Config/output comparison': [...TEST_UNIVERSAL, K('In-scope period/effective dates')],
  // ── Standards ────────────────────────────────────────────────────────
  'Standard implementation checklist': [
    K('Accountable control owner confirmed', 'ROLE'),
    K('Applying roles confirmed', 'ROLE'),
    K('Applying roles trained'),
    K('In-scope systems/SOR where the control operates', 'APPLICATION'),
    K('Control procedure documented'),
    K('Control procedure version approved'),
    K('Operating frequency/cadence defined'),
    K('Evidence artifact retained with timestamp/version'),
    K('Exceptions logged with disposition'),
    K('Remediation ticket linked for each exception'),
  ],
  'Standard verification testing': [
    K('Test population'),
    K('Sampling method'),
    K('Pass/fail thresholds'),
    K('Independent tester (segregated from the operator)', 'ROLE'),
    K('Testing frequency/cadence'),
    K('Evidence location for test results'),
    K('Exception handling path'),
    K('Re-test path'),
  ],
  // ── Regulations ──────────────────────────────────────────────────────
  'Regulation compliance checklist': [
    K('Accountable obligation owner', 'ROLE'),
    K('Citation verified against current regulatory text'),
    K('In-scope processes'),
    K('In-scope systems', 'APPLICATION'),
    K('Compliance procedure documented'),
    K('Compliance procedure approved'),
    K('Filing/reporting deadlines tracked'),
    K('Deadline reminders configured'),
    K('Evidence retained per the retention requirement'),
    K('Violations/exceptions logged with disposition'),
    K('Remediation sign-off captured', 'ROLE'),
  ],
  'Regulation verification testing': [
    K('Test population (in-scope transactions, filings, or records)'),
    K('Pass/fail thresholds'),
    K('Compliance test frequency matched to the obligation frequency'),
    K('Independent reviewer (segregated from the performer)', 'ROLE'),
    K('Evidence location for test results'),
    K('Regulator-ready documentation'),
    K('Regulator response path'),
  ],
};

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company');
  const templates = await prisma.workTemplate.findMany({ where: { companyId: company.id }, include: { keys: true } });
  let created = 0;
  let updated = 0;
  let deleted = 0;
  for (const t of templates) {
    const canon = CANON[t.name];
    if (!canon) { console.log(`  (no canonical list for "${t.name}" — skipped)`); continue; }
    for (let i = 0; i < canon.length; i++) {
      const def = canon[i];
      const existing = t.keys.find((k) => k.key === def.key);
      if (existing) {
        await prisma.workTemplateKey.update({ where: { id: existing.id }, data: { valueKind: def.valueKind, sortOrder: i } });
        updated++;
      } else {
        await prisma.workTemplateKey.create({ data: { templateId: t.id, key: def.key, valueKind: def.valueKind, sortOrder: i } });
        created++;
      }
    }
    const keep = new Set(canon.map((d) => d.key));
    for (const k of t.keys) {
      if (!keep.has(k.key)) {
        await prisma.workTemplateKey.delete({ where: { id: k.id } }); // compound key retired (answers cascade)
        deleted++;
      }
    }
  }
  const total = await prisma.workTemplateKey.count({ where: { template: { companyId: company.id } } });
  console.log(`keys — created ${created}, updated ${updated}, deleted ${deleted}; total now ${total}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
