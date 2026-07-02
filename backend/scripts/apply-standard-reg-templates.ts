// Standards + regulations get purpose-built Work Library templates (user
// request 2026-07-01), modeled on control-testing practice (SOX/ITGC-style
// test-of-control design: owner, population/sample, thresholds, independence,
// frequency, evidence, exceptions):
//   Standards → "Standard implementation checklist" + "Standard verification testing"
//   Regulations → "Regulation compliance checklist" + "Regulation verification testing"
// Every LEAF standard and ACTIVE regulation gets exactly those two templates
// (replacing the earlier generic defaults). Per-standard SPECIFIC keys are
// derived from data the standard already carries:
//   testProcedure numbered steps → item-specific TESTING keys
//   evidence artifact text       → one item-specific CHECKLIST key
// Values are NOT prefilled (user decision). Idempotent.
// Run: npx tsx --env-file=.env scripts/apply-standard-reg-templates.ts
import { prisma } from '../src/db/prisma.js';

type KeyDef = { key: string; valueKind: string };
const TEMPLATES: { kind: 'CHECKLIST' | 'TEST'; name: string; description: string; keys: KeyDef[] }[] = [
  {
    kind: 'CHECKLIST',
    name: 'Standard implementation checklist',
    description: 'Is this control in place — owner, scope, procedure, evidence, exceptions.',
    keys: [
      { key: 'Accountable control owner confirmed', valueKind: 'ROLE' },
      { key: 'Applying roles trained and confirmed', valueKind: 'ROLE' },
      { key: 'In-scope systems/SOR where the control operates', valueKind: 'APPLICATION' },
      { key: 'Control procedure documented, versioned, and approved', valueKind: 'TEXT' },
      { key: 'Operating frequency/cadence defined', valueKind: 'TEXT' },
      { key: 'Evidence artifact retained with timestamp/version', valueKind: 'TEXT' },
      { key: 'Exceptions logged with disposition and remediation ticket', valueKind: 'TEXT' },
    ],
  },
  {
    kind: 'TEST',
    name: 'Standard verification testing',
    description: 'Independent test that the control operates as designed.',
    keys: [
      { key: 'Test population and sampling method', valueKind: 'TEXT' },
      { key: 'Pass/fail thresholds', valueKind: 'TEXT' },
      { key: 'Independent tester (segregated from the operator)', valueKind: 'ROLE' },
      { key: 'Testing frequency/cadence', valueKind: 'TEXT' },
      { key: 'Evidence location for test results', valueKind: 'TEXT' },
      { key: 'Exception handling and re-test path', valueKind: 'TEXT' },
    ],
  },
  {
    kind: 'CHECKLIST',
    name: 'Regulation compliance checklist',
    description: 'Is the obligation met — owner, citation, deadlines, evidence, violations.',
    keys: [
      { key: 'Accountable obligation owner', valueKind: 'ROLE' },
      { key: 'Citation verified against current regulatory text', valueKind: 'TEXT' },
      { key: 'In-scope processes and systems', valueKind: 'APPLICATION' },
      { key: 'Compliance procedure documented and approved', valueKind: 'TEXT' },
      { key: 'Filing/reporting deadlines tracked with reminders', valueKind: 'TEXT' },
      { key: 'Evidence retained per the retention requirement', valueKind: 'TEXT' },
      { key: 'Violations/exceptions logged with remediation and sign-off', valueKind: 'TEXT' },
    ],
  },
  {
    kind: 'TEST',
    name: 'Regulation verification testing',
    description: 'Independent test that compliance is demonstrable to a regulator.',
    keys: [
      { key: 'Test population (in-scope transactions, filings, or records)', valueKind: 'TEXT' },
      { key: 'Pass/fail thresholds', valueKind: 'TEXT' },
      { key: 'Compliance test frequency matched to the obligation frequency', valueKind: 'TEXT' },
      { key: 'Independent reviewer (segregated from the performer)', valueKind: 'ROLE' },
      { key: 'Evidence location for test results', valueKind: 'TEXT' },
      { key: 'Regulator-ready documentation and response path', valueKind: 'TEXT' },
    ],
  },
];

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company');
  const companyId = company.id;

  // 1 — templates + keys (idempotent by name).
  const idByName = new Map<string, string>();
  for (let i = 0; i < TEMPLATES.length; i++) {
    const def = TEMPLATES[i];
    let t = await prisma.workTemplate.findFirst({ where: { companyId, kind: def.kind, name: def.name }, include: { keys: true } });
    if (!t) {
      t = await prisma.workTemplate.create({
        data: { companyId, kind: def.kind, name: def.name, description: def.description, sortOrder: 100 + i },
        include: { keys: true },
      });
    }
    for (let k = 0; k < def.keys.length; k++) {
      const kd = def.keys[k];
      const existing = t.keys.find((x) => x.key === kd.key);
      if (existing) await prisma.workTemplateKey.update({ where: { id: existing.id }, data: { valueKind: kd.valueKind, sortOrder: k } });
      else await prisma.workTemplateKey.create({ data: { templateId: t.id, key: kd.key, valueKind: kd.valueKind, sortOrder: k } });
    }
    idByName.set(def.name, t.id);
  }
  console.log('templates ready:', [...idByName.keys()].join(' | '));

  // 2 — assign to every leaf standard + active regulation (replacing defaults).
  const leaves = await prisma.standard.findMany({
    where: { companyId, isArea: false, children: { none: {} } },
    select: { id: true, testProcedure: true, evidence: true },
  });
  await prisma.standardWorkTemplate.deleteMany({ where: { companyId } });
  await prisma.standardWorkTemplate.createMany({
    data: leaves.flatMap((s) => [
      { companyId, standardId: s.id, templateId: idByName.get('Standard implementation checklist')! },
      { companyId, standardId: s.id, templateId: idByName.get('Standard verification testing')! },
    ]),
    skipDuplicates: true,
  });

  const regs = await prisma.regulatoryRequirement.findMany({ where: { companyId, status: 'ACTIVE' }, select: { id: true } });
  await prisma.regulationWorkTemplate.deleteMany({ where: { companyId } });
  await prisma.regulationWorkTemplate.createMany({
    data: regs.flatMap((r) => [
      { companyId, regId: r.id, templateId: idByName.get('Regulation compliance checklist')! },
      { companyId, regId: r.id, templateId: idByName.get('Regulation verification testing')! },
    ]),
    skipDuplicates: true,
  });
  console.log(`assigned — standards: ${leaves.length} × 2 | regulations: ${regs.length} × 2`);

  // 3 — per-standard SPECIFIC keys from the standard's own content (values blank).
  const existingCustom = await prisma.standardTemplateAnswer.findMany({
    where: { companyId, templateKeyId: null },
    select: { standardId: true, customKey: true },
  });
  const seen = new Set(existingCustom.map((a) => `${a.standardId}|${a.customKey}`));
  const customRows: { companyId: string; standardId: string; customKey: string; kind: string; sortOrder: number }[] = [];
  for (const s of leaves) {
    const steps = (s.testProcedure ?? '')
      .split('\n')
      .map((x) => x.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);
    steps.forEach((step, i) => {
      if (!seen.has(`${s.id}|${step}`)) customRows.push({ companyId, standardId: s.id, customKey: step, kind: 'TEST', sortOrder: 100 + i });
    });
    if (s.evidence) {
      const key = `Evidence artifact: ${s.evidence.trim()}`;
      if (!seen.has(`${s.id}|${key}`)) customRows.push({ companyId, standardId: s.id, customKey: key, kind: 'CHECKLIST', sortOrder: 100 });
    }
  }
  for (let i = 0; i < customRows.length; i += 5000) {
    await prisma.standardTemplateAnswer.createMany({ data: customRows.slice(i, i + 5000) });
  }
  console.log(`specific keys written: ${customRows.length} (testProcedure steps → testing, evidence → checklist)`);

  const [swt, rwt, sta] = await Promise.all([
    prisma.standardWorkTemplate.count({ where: { companyId } }),
    prisma.regulationWorkTemplate.count({ where: { companyId } }),
    prisma.standardTemplateAnswer.count({ where: { companyId, templateKeyId: null } }),
  ]);
  console.log(`totals — StandardWorkTemplate: ${swt} | RegulationWorkTemplate: ${rwt} | specific standard keys: ${sta}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
