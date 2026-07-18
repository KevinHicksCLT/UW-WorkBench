// fix-app-combo-dedup.ts — split semicolon-combo Application rows into atomic apps.
//
// The seed left 170 Application rows whose name is a "; "-joined list of several
// real applications (e.g. "FIS Prophet; Microsoft Excel"). The atomic apps also
// exist as their own rows, so the Applications list shows the same app repeated
// inside many combo rows. This script:
//   1. backs up the affected rows to scripts/backups/,
//   2. creates the atomic apps that only ever appeared inside combos,
//   3. repoints every combo's NodeAppUsage rows to each member app
//      (skipDuplicates honours @@unique(processNodeId, applicationId, usageType)),
//   4. repoints NodeTemplateAnswer.applicationId to the combo's first member,
//   5. deletes the combo rows (cascade clears their remaining junctions).
//
// Idempotent: a re-run finds no names containing ';' and exits. DRY_RUN=1 to preview.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const DRY = process.env.DRY_RUN === '1';

// Vendor/category for atomic apps that only existed inside combo rows —
// same illustrative-catalog conventions as the existing atomic rows.
const NEW_APP_META: Record<string, { vendor: string; category: string }> = {
  'Duck Creek Distribution': { vendor: 'Duck Creek', category: 'Distribution' },
  'Milliman Arius (Reserving)': { vendor: 'Milliman', category: 'Data' },
  'Microsoft Excel': { vendor: 'Microsoft', category: 'Data' },
  'FIS Prophet': { vendor: 'FIS', category: 'Data' },
  "Moody's RMS (Cat Model)": { vendor: "Moody's", category: 'Data' },
  'Catastrophe Data Provider': { vendor: 'External', category: 'Data' },
  'SAS Actuarial Platform': { vendor: 'SAS', category: 'Data' },
  'Reinsurer Exchange': { vendor: 'External', category: 'Distribution' },
  'SAP S/4HANA (GL)': { vendor: 'SAP', category: 'Finance' },
  'BlackLine (Close)': { vendor: 'BlackLine', category: 'Finance' },
  'FRISS Fraud Detection': { vendor: 'FRISS', category: 'Claims' },
  'Microsoft Teams / Email': { vendor: 'Microsoft', category: 'Data' },
  'Medical Bill Review (Coventry)': { vendor: 'Coventry', category: 'Claims' },
  'Policy Administration Platform': { vendor: 'In-house', category: 'Policy' },
  'Jira Align / Rally': { vendor: 'Atlassian / Broadcom', category: 'Infra' },
  'Azure DevOps': { vendor: 'Microsoft', category: 'Infra' },
  'Azure ML / MLflow': { vendor: 'Microsoft', category: 'Data' },
  'Oracle EPM': { vendor: 'Oracle', category: 'Finance' },
  'Marketo (Marketing)': { vendor: 'Adobe', category: 'Distribution' },
  'CrowdStrike Falcon': { vendor: 'CrowdStrike', category: 'Security' },
  'Qualys / Tenable (Vuln)': { vendor: 'Qualys / Tenable', category: 'Security' },
  'Customer Self-Service Portal': { vendor: 'In-house', category: 'Distribution' },
  'Credit Bureau & Data Services': { vendor: 'External', category: 'Data' },
  'Statutory Reporting (NAIC)': { vendor: 'NAIC', category: 'Finance' },
  'BlackRock Aladdin': { vendor: 'BlackRock', category: 'Finance' },
  'Bloomberg Terminal': { vendor: 'Bloomberg', category: 'Finance' },
  'OneStream (FP&A)': { vendor: 'OneStream', category: 'Finance' },
  'iManage (Legal Docs)': { vendor: 'iManage', category: 'Risk & Compliance' },
  'Icertis CLM (Contracts)': { vendor: 'Icertis', category: 'Risk & Compliance' },
  'NIPR (Producer Licensing)': { vendor: 'NIPR', category: 'Distribution' },
  'Greenhouse (Recruiting)': { vendor: 'Greenhouse', category: 'HR' },
  'Databricks Lakehouse': { vendor: 'Databricks', category: 'Data' },
  AuditBoard: { vendor: 'AuditBoard', category: 'Risk & Compliance' },
  'Genesys Cloud (Contact Center)': { vendor: 'Genesys', category: 'Distribution' },
  'CCC / Mitchell Estimating': { vendor: 'CCC / Mitchell', category: 'Claims' },
  'SailPoint IGA': { vendor: 'SailPoint', category: 'Security' },
  'CyberArk (PAM)': { vendor: 'CyberArk', category: 'Security' },
  'ADP Payroll': { vendor: 'ADP', category: 'HR' },
  'Cornerstone LMS': { vendor: 'Cornerstone', category: 'HR' },
};

const norm = (s: string) => s.trim().toLowerCase();

const apps = await prisma.application.findMany({
  select: { id: true, companyId: true, name: true, kind: true, illustrative: true },
});
const combos = apps.filter((a) => a.name.includes(';'));
if (combos.length === 0) {
  console.log('No combo rows found — nothing to do.');
  await prisma.$disconnect();
  process.exit(0);
}
console.log(`apps=${apps.length} combos=${combos.length}`);

const comboIds = combos.map((c) => c.id);
const [comboUsages, comboAnswers] = await Promise.all([
  prisma.nodeAppUsage.findMany({ where: { applicationId: { in: comboIds } } }),
  prisma.nodeTemplateAnswer.findMany({
    where: { applicationId: { in: comboIds } },
    select: { id: true, applicationId: true },
  }),
]);

// ── 1. Backup everything the fix touches.
const here = dirname(fileURLToPath(import.meta.url));
const backupDir = join(here, 'backups');
mkdirSync(backupDir, { recursive: true });
const backupPath = join(backupDir, 'app-combo-dedup-2026-07-18.json');
if (!DRY) {
  const fullCombos = await prisma.application.findMany({ where: { id: { in: comboIds } } });
  writeFileSync(
    backupPath,
    JSON.stringify({ combos: fullCombos, usages: comboUsages, answers: comboAnswers }, null, 1),
  );
  console.log(`backup → ${backupPath}`);
}

// ── 2. Create the atomic apps that only exist inside combos.
const byName = new Map(apps.filter((a) => !a.name.includes(';')).map((a) => [norm(a.name), a.id]));
const companyId = combos[0].companyId;
const missing = new Set<string>();
for (const c of combos)
  for (const p of c.name
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    if (!byName.has(norm(p))) missing.add(p);

console.log(`atomic apps to create: ${missing.size}`);
for (const name of missing) {
  const meta = NEW_APP_META[name];
  if (!meta) console.warn(`  no curated meta for "${name}" — creating with In-house/null`);
  if (DRY) continue;
  const created = await prisma.application.create({
    data: {
      companyId,
      name,
      kind: 'Tool',
      criticality: 'Medium',
      vendor: meta?.vendor ?? 'In-house',
      category: meta?.category ?? null,
      illustrative: true,
    },
    select: { id: true },
  });
  byName.set(norm(name), created.id);
}

// ── 3-4. Repoint junctions combo → member apps.
const usagesByCombo = new Map<string, typeof comboUsages>();
for (const u of comboUsages) {
  const g = usagesByCombo.get(u.applicationId) ?? [];
  g.push(u);
  usagesByCombo.set(u.applicationId, g);
}

let usageRows = 0;
let answerRows = 0;
for (const c of combos) {
  const partIds = c.name
    .split(';')
    .map((s) => byName.get(norm(s.trim())))
    .filter((id): id is string => Boolean(id));
  if (partIds.length === 0) {
    console.warn(`combo ${c.id} "${c.name}" resolved no member apps — skipping`);
    continue;
  }
  const usages = usagesByCombo.get(c.id) ?? [];
  const rows = partIds.flatMap((applicationId) =>
    usages.map((u) => ({
      companyId: u.companyId,
      processNodeId: u.processNodeId,
      applicationId,
      usageType: u.usageType,
    })),
  );
  usageRows += rows.length;
  if (!DRY && rows.length) {
    await prisma.nodeAppUsage.createMany({ data: rows, skipDuplicates: true });
  }
  // A template answer holds ONE app — the combo's first member is its primary.
  const answers = comboAnswers.filter((a) => a.applicationId === c.id);
  answerRows += answers.length;
  if (!DRY && answers.length) {
    await prisma.nodeTemplateAnswer.updateMany({
      where: { id: { in: answers.map((a) => a.id) } },
      data: { applicationId: partIds[0] },
    });
  }
}
console.log(`usage rows fanned out: ${usageRows}; template answers repointed: ${answerRows}`);

// ── 5. Delete the combo rows (cascade clears their usages).
if (!DRY) {
  const del = await prisma.application.deleteMany({ where: { id: { in: comboIds } } });
  console.log(`combo rows deleted: ${del.count}`);
}

// ── Verify.
const after = await prisma.application.count({ where: { name: { contains: ';' } } });
const total = await prisma.application.count();
console.log(`${DRY ? '[dry-run] ' : ''}remaining combo rows: ${after}; total apps: ${total}`);
await prisma.$disconnect();
