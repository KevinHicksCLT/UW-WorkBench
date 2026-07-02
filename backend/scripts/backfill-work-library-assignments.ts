// Work Library P1b — backfill template assignments from data already on the branch:
//   tasks: ProcessNode.attributes.checklistPattern (module combo names) + attributes.how
//          ("Test by …" pattern + its missing-information items). Items the pattern's
//          generic keys don't cover become task-specific custom answer rows (value blank).
//   leaf standards: Core evidence + default test pattern.
//   ACTIVE regulations: Core evidence + Regulatory/retention module + default test pattern.
// Values are NOT filled (user decision — after templates confirmed). Idempotent.
// Run: npx tsx --env-file=.env scripts/backfill-work-library-assignments.ts
import { prisma } from '../src/db/prisma.js';

const HOW_TO_TEMPLATE: [string, string][] = [
  ['defining expected evidence', 'Expected evidence + SOR tracing'],
  ['confirming the analysis population', 'Analysis population + findings validation'],
  ['inspecting the artifact', 'Artifact inspection'],
  ['tracing workflow history', 'Workflow history tracing'],
  ['independently re-performing the validation rules', 'Re-perform validation rules'],
  ['re-performing the calculation/model run', 'Re-perform calculation/model run'],
  ['running an automated extract', 'Automated SOR extract'],
  ['comparing approved input', 'Config/output comparison'],
];

const CHECKLIST_MODULES = [
  'Methodology/model validation',
  'Source traceability / workflow status',
  'Regulatory / retention evidence',
  'Implementation / change evidence',
  'Approval authority / communication',
];

function parseChecklistModules(pattern: string | null | undefined): string[] {
  if (!pattern) return [];
  return pattern
    .split(' + ')
    .map((p) => p.replace(/\s*\(partial\)\s*/g, '').trim())
    .filter((p) => CHECKLIST_MODULES.includes(p));
}

function parseHow(how: string | null | undefined): { templateName: string | null; items: string[] } {
  if (!how) return { templateName: null, items: [] };
  const lower = how.toLowerCase();
  const templateName = HOW_TO_TEMPLATE.find(([needle]) => lower.includes(needle))?.[1] ?? null;
  const marker = /missing information to complete before automation:?/i;
  const m = how.split(marker)[1];
  const items: string[] = [];
  if (m) {
    for (const raw of m.split(/\n|;/)) {
      const item = raw.replace(/^\s*\d+\.\s*/, '').replace(/\.\s*$/, '').trim();
      if (item) items.push(item);
    }
  }
  return { templateName, items };
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error('no company found');
  const companyId = company.id;

  const templates = await prisma.workTemplate.findMany({
    where: { companyId },
    include: { keys: true },
  });
  const byName = new Map(templates.map((t) => [t.name, t]));
  const core = byName.get('Core evidence checklist');
  const defaultTest = byName.get('Expected evidence + SOR tracing');
  const regModule = byName.get('Regulatory / retention evidence');
  if (!core || !defaultTest || !regModule) throw new Error('templates missing — run seed-work-library-templates first');

  // ── Tasks ─────────────────────────────────────────────────────────────
  const tasks = await prisma.processNode.findMany({
    where: { companyId, isTask: true },
    select: { id: true, attributes: true },
  });
  console.log(`tasks: ${tasks.length}`);

  const links: { companyId: string; processNodeId: string; templateId: string }[] = [];
  const customAnswers: { companyId: string; processNodeId: string; customKey: string; sortOrder: number }[] = [];
  let unmatchedHow = 0;

  for (const task of tasks) {
    const attrs = (task.attributes ?? {}) as Record<string, unknown>;
    links.push({ companyId, processNodeId: task.id, templateId: core.id });
    for (const moduleName of parseChecklistModules(attrs.checklistPattern as string | undefined)) {
      const t = byName.get(moduleName);
      if (t) links.push({ companyId, processNodeId: task.id, templateId: t.id });
    }
    const { templateName, items } = parseHow(attrs.how as string | undefined);
    const testTemplate = templateName ? byName.get(templateName) : null;
    if (testTemplate) {
      links.push({ companyId, processNodeId: task.id, templateId: testTemplate.id });
      const covered = new Set(testTemplate.keys.map((k) => k.key.toLowerCase()));
      let extra = 0;
      for (const item of items) {
        if (covered.has(item.toLowerCase())) continue;
        const customKey = item.charAt(0).toUpperCase() + item.slice(1);
        customAnswers.push({ companyId, processNodeId: task.id, customKey, sortOrder: 100 + extra++ });
      }
    } else if (attrs.how) {
      unmatchedHow++;
    }
  }

  console.log(`assignment rows to write: ${links.length}; task-specific test keys: ${customAnswers.length}; unmatched how: ${unmatchedHow}`);
  for (let i = 0; i < links.length; i += 5000) {
    await prisma.nodeWorkTemplate.createMany({ data: links.slice(i, i + 5000), skipDuplicates: true });
  }
  // Custom answers have no natural unique key (templateKeyId null) — dedupe by re-check.
  const existingCustom = await prisma.nodeTemplateAnswer.findMany({
    where: { companyId, templateKeyId: null },
    select: { processNodeId: true, customKey: true },
  });
  const seen = new Set(existingCustom.map((a) => `${a.processNodeId}|${a.customKey}`));
  const freshCustom = customAnswers.filter((a) => !seen.has(`${a.processNodeId}|${a.customKey}`));
  for (let i = 0; i < freshCustom.length; i += 5000) {
    await prisma.nodeTemplateAnswer.createMany({ data: freshCustom.slice(i, i + 5000) });
  }

  // ── Leaf standards ────────────────────────────────────────────────────
  const leafStandards = await prisma.standard.findMany({
    where: { companyId, isArea: false, children: { none: {} } },
    select: { id: true },
  });
  const stdLinks = leafStandards.flatMap((s) => [
    { companyId, standardId: s.id, templateId: core.id },
    { companyId, standardId: s.id, templateId: defaultTest.id },
  ]);
  await prisma.standardWorkTemplate.createMany({ data: stdLinks, skipDuplicates: true });

  // ── Active regulations ────────────────────────────────────────────────
  const regs = await prisma.regulatoryRequirement.findMany({
    where: { companyId, status: 'ACTIVE' },
    select: { id: true },
  });
  const regLinks = regs.flatMap((r) => [
    { companyId, regId: r.id, templateId: core.id },
    { companyId, regId: r.id, templateId: regModule.id },
    { companyId, regId: r.id, templateId: defaultTest.id },
  ]);
  await prisma.regulationWorkTemplate.createMany({ data: regLinks, skipDuplicates: true });

  const [nwt, sta, rwt, nta] = await Promise.all([
    prisma.nodeWorkTemplate.count({ where: { companyId } }),
    prisma.standardWorkTemplate.count({ where: { companyId } }),
    prisma.regulationWorkTemplate.count({ where: { companyId } }),
    prisma.nodeTemplateAnswer.count({ where: { companyId } }),
  ]);
  console.log(`totals — NodeWorkTemplate: ${nwt} | StandardWorkTemplate: ${sta} (${leafStandards.length} standards) | RegulationWorkTemplate: ${rwt} (${regs.length} regs) | NodeTemplateAnswer: ${nta}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
