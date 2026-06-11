// seed-step-lens.ts — load the Bridge Input application/deliverable lens.
//
//   1. Upserts the "Cap – Application Catalog" (APP-nnn codes, SoR flags) into
//      Application — matching existing rows by name, creating the rest.
//   2. Backfills ProcessStep.code/parentProcessId and SubValueStream.code from
//      the spine (workbook stable keys).
//   3. Imports the REAL "Cap – App Usage by Step" + "Cap – Deliverables &
//      Approvals" rows (illustrative=false).
//   4. Extends both bridges ILLUSTRATIVELY to every L5 step that real rows
//      don't cover — deterministic (stream → app map, step outputs, resolved
//      lead roles; no randomness), all flagged illustrative=true. User-approved
//      approach: the workbook marks these sheets PLACEHOLDER, but the sidebar
//      should show the lens for every step until real data replaces it.
//   5. Applies "Cap – People" capacity fields (FTE, net available hrs) to
//      existing persons via their primary role assignment.
//
// Idempotent: wipes+rebuilds only StepAppUsage/StepDeliverable. Run:
//   npx tsx scripts/seed-step-lens.ts "../AI Transformation Bridge Input.xlsx"
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { prisma } from '../src/db/prisma.js';
import { buildRoleResolver, resolveRoleCell } from '../src/lib/roleMatch.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBOOK = process.argv[2] || resolve(HERE, '../../AI Transformation Bridge Input.xlsx');
const SPINE = resolve(HERE, '../data/seed/spine.json');

const wb = XLSX.read(readFileSync(WORKBOOK), { cellDates: true });
const grid = (name: string): unknown[][] => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
};
const str = (v: unknown): string => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));
const orNull = (v: unknown): string | null => str(v) || null;
const spine = JSON.parse(readFileSync(SPINE, 'utf8'));

// Primary Domain → Application.kind (catalog rows carry no kind of their own).
const KIND: Record<string, string> = { 'Core Insurance': 'Core', Corporate: 'Internal', Technology: 'Platform' };

// Deterministic stream → [execution app code, system-of-record app code].
// Grounded in the workbook's own real rows (U-0001..4, D-0001..3) and the
// catalog's Primary Domain/Category; corporate/tech fallbacks use the closest
// catalog system. Illustrative — replaced row-by-row as real data arrives.
const STREAM_APPS: Record<string, [string, string]> = {
  'Billing, Collections & Receivables': ['APP-003', 'APP-012'],
  'Claims Intake-to-Settlement': ['APP-002', 'APP-002'],
  'Claims Recoveries & Subrogation': ['APP-002', 'APP-002'],
  'Delegated Authority Management': ['APP-017', 'APP-017'],
  'Policy Administration & Servicing': ['APP-001', 'APP-001'],
  'Submission-to-Bind / Underwriting': ['APP-004', 'APP-001'],
  'Reinsurance & Retrocession Management': ['APP-006', 'APP-006'],
  'Distribution & Channel Management': ['APP-007', 'APP-007'],
  'Marketing, Growth & Customer Insights': ['APP-008', 'APP-009'],
  'Customer Service, Complaints & Experience': ['APP-008', 'APP-009'],
  'Product & Proposition Management': ['APP-005', 'APP-009'],
  'Actuarial Pricing, Reserving & Capital Modeling': ['APP-010', 'APP-010'],
  'Finance, Treasury & Capital Management': ['APP-012', 'APP-012'],
  'Investment & Asset Management': ['APP-016', 'APP-012'],
  'Enterprise Strategy & Portfolio Management': ['APP-022', 'APP-013'],
  'Talent & Workforce Management': ['APP-014', 'APP-014'],
  'Legal, Governance & Privacy Management': ['APP-017', 'APP-017'],
  'Risk, Compliance & Regulatory Management': ['APP-019', 'APP-019'],
  'Audit & Assurance': ['APP-019', 'APP-019'],
  'Third-Party & Vendor Management': ['APP-015', 'APP-015'],
  'Change Management & Adoption': ['APP-029', 'APP-020'],
  'Technology Delivery & Change': ['APP-022', 'APP-021'],
  'Technology Strategy, Architecture & Delivery': ['APP-020', 'APP-021'],
  'Data, Analytics & AI Management': ['APP-026', 'APP-026'],
  'MLOps / ML Lifecycle Management': ['APP-026', 'APP-021'],
  'AIOps & Intelligent Operations': ['APP-023', 'APP-023'],
  'Service Operations, Incident & Production Support': ['APP-023', 'APP-023'],
  'Cybersecurity, Identity & Resilience': ['APP-025', 'APP-023'],
  'FinOps / Cloud Financial Management': ['APP-027', 'APP-012'],
  // Life/Disability/Retirement streams have no L4/L5 detail yet; mapping kept
  // for when their process model lands.
  'Life New Business & Underwriting': ['APP-004', 'APP-001'],
  'Life Policy Administration & Inforce Servicing': ['APP-001', 'APP-001'],
  'Life, Annuity & Retirement Billing': ['APP-003', 'APP-012'],
  'Life & Annuity Claims': ['APP-002', 'APP-002'],
  'Disability & Absence Management': ['APP-002', 'APP-002'],
  'Retirement Plan Administration': ['APP-001', 'APP-001'],
  'Annuity New Business & Servicing': ['APP-001', 'APP-001'],
};
const FALLBACK: [string, string] = ['APP-020', 'APP-009'];
const APPROVAL_TYPES = ['System Workflow', 'Manual Sign-off', 'E-Signature'];

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  const c = company.id, t = company.tenantId;

  // ── 1. Application catalog ─────────────────────────────────────────────
  const cat = grid('Cap – Application Catalog');
  const appByCode = new Map<string, string>(); // APP-nnn → Application.id
  let appsCreated = 0, appsLinked = 0;
  for (const row of cat) {
    const code = str(row[0]);
    if (!/^APP-\d+$/.test(code)) continue;
    const name = str(row[1]);
    const data = {
      vendor: orNull(row[2]), category: orNull(row[3]),
      kind: KIND[str(row[4])] ?? 'Internal',
      systemOfRecord: /yes/i.test(str(row[5])),
      description: orNull(row[6]), code,
    };
    const existing = await prisma.application.findFirst({ where: { companyId: c, OR: [{ code }, { name }] }, select: { id: true } });
    if (existing) {
      await prisma.application.update({ where: { id: existing.id }, data });
      appsLinked++;
      appByCode.set(code, existing.id);
    } else {
      const created = await prisma.application.create({ data: { tenantId: t, companyId: c, name, illustrative: true, ...data }, select: { id: true } });
      appsCreated++;
      appByCode.set(code, created.id);
    }
  }
  console.log(`Applications: ${appsCreated} created, ${appsLinked} updated with codes.`);

  // ── 2. Workbook codes onto ProcessStep / SubValueStream ───────────────
  const steps = await prisma.processStep.findMany({
    where: { valueStream: { companyId: c } },
    select: { id: true, l4: true, stepNumber: true, name: true, leads: true, supporting: true, outputs: true, valueStream: { select: { name: true } } },
  });
  const stepKey = (vs: string, l4: string | null, n: number, name: string) => `${vs}␟${l4 ?? ''}␟${n}␟${name}`;
  const spineByKey = new Map<string, any>(spine.processSteps.map((s: any) => [stepKey(s.valueStreamName, s.l4, s.stepNumber, s.name), s]));
  let coded = 0;
  for (const s of steps) {
    const w = spineByKey.get(stepKey(s.valueStream.name, s.l4, s.stepNumber, s.name));
    if (!w?.code) continue;
    await prisma.processStep.update({ where: { id: s.id }, data: { code: w.code, parentProcessId: w.parentProcessId } });
    coded++;
  }
  const l4Code = new Map<string, string>(spine.subValueStreams.filter((s: any) => s.processId).map((s: any) => [s.l4, s.processId]));
  let svsCoded = 0;
  for (const [l4, code] of l4Code) {
    const r = await prisma.subValueStream.updateMany({ where: { level: 4, name: l4, valueStream: { companyId: c } }, data: { code } });
    svsCoded += r.count;
  }
  console.log(`Codes backfilled: ${coded}/${steps.length} process steps, ${svsCoded} L4 sub-streams.`);

  // ── 3 + 4. Bridges: real rows, then illustrative coverage ─────────────
  await prisma.stepAppUsage.deleteMany({ where: { companyId: c } });
  await prisma.stepDeliverable.deleteMany({ where: { companyId: c } });

  const stepsByCode = new Map((await prisma.processStep.findMany({
    where: { valueStream: { companyId: c }, code: { not: null } },
    select: { id: true, code: true, parentProcessId: true, stepNumber: true, name: true, leads: true, supporting: true, outputs: true, valueStream: { select: { name: true } } },
  })).map((s) => [s.code!, s] as const));
  const roles = await prisma.role.findMany({ where: { companyId: c }, select: { id: true, name: true, itemRole: true } });
  const resolveRole = buildRoleResolver(roles);

  // Real bridge rows name the step/sub-process AND carry an Activity ID, and
  // the workbook's example IDs disagree with the L4 master (e.g. it labels
  // CI-04-01 "FNOL capture and triage" while the master says CI-02-01). The
  // name is authoritative — reconcile the code from it when they differ.
  const codeByL4Name = new Map<string, string>(spine.subValueStreams.filter((s: any) => s.processId).map((s: any) => [s.l4.toLowerCase(), s.processId]));
  const codeByStepName = new Map<string, string>(spine.processSteps.filter((s: any) => s.code).map((s: any) => [s.name.toLowerCase(), s.code]));
  const reconcile = (cellCode: string, stepName: string, rowId: string): string => {
    const named = codeByL4Name.get(stepName.toLowerCase()) ?? codeByStepName.get(stepName.toLowerCase());
    if (named && named !== cellCode) { console.warn(`! ${rowId}: Activity ID ${cellCode} disagrees with step name "${stepName}" → using ${named}`); return named; }
    return cellCode;
  };

  // Real app-usage rows. Activity IDs may be L4 (CI-01-01) or L5 codes.
  const realUsageByActivity = new Set<string>();
  let realUsage = 0;
  for (const row of grid('Cap – App Usage by Step')) {
    if (!/^U-\d+$/.test(str(row[0]))) continue;
    const activityCode = reconcile(str(row[1]), str(row[2]), str(row[0]));
    const appId = appByCode.get(str(row[3]));
    if (!appId) { console.warn('! usage row skipped, unknown app:', str(row[3])); continue; }
    await prisma.stepAppUsage.create({
      data: {
        tenantId: t, companyId: c, activityCode, applicationId: appId,
        processStepId: stepsByCode.get(activityCode)?.id ?? null,
        usageType: str(row[5]) || 'Execution', isPrimary: /yes/i.test(str(row[6])),
        notes: orNull(row[7]), illustrative: false,
      },
    });
    realUsageByActivity.add(activityCode);
    realUsage++;
  }

  // Real deliverable rows.
  const realDelivByActivity = new Set<string>();
  let realDeliv = 0;
  for (const row of grid('Cap – Deliverables & Approvals')) {
    if (!/^D-\d+$/.test(str(row[0]))) continue;
    const activityCode = reconcile(str(row[1]), str(row[2]), str(row[0]));
    const approverRaw = orNull(row[6]);
    const approver = approverRaw ? resolveRoleCell(approverRaw, resolveRole).roles[0] ?? null : null;
    await prisma.stepDeliverable.create({
      data: {
        tenantId: t, companyId: c, code: str(row[0]), activityCode,
        processStepId: stepsByCode.get(activityCode)?.id ?? null,
        name: str(row[3]),
        sorApplicationId: appByCode.get(str(row[4])) ?? null,
        approverRoleId: approver?.id ?? null, approverRoleRaw: approverRaw,
        approvalApplicationId: appByCode.get(str(row[7])) ?? null,
        approvalType: orNull(row[9]), notes: orNull(row[10]), illustrative: false,
      },
    });
    realDelivByActivity.add(activityCode);
    realDeliv++;
  }
  console.log(`Real bridge rows: ${realUsage} app usages, ${realDeliv} deliverables.`);

  // Illustrative coverage for every coded L5 step not covered by a real row
  // (directly or via its parent L4 activity).
  const usageRows: any[] = [];
  const delivRows: any[] = [];
  for (const s of stepsByCode.values()) {
    const covered = (code: Set<string>) => code.has(s.code!) || (s.parentProcessId ? code.has(s.parentProcessId) : false);
    const [execCode, sorCode] = STREAM_APPS[s.valueStream.name] ?? FALLBACK;
    const execId = appByCode.get(execCode), sorId = appByCode.get(sorCode);
    if (!covered(realUsageByActivity) && execId && sorId) {
      usageRows.push({ tenantId: t, companyId: c, activityCode: s.code!, processStepId: s.id, applicationId: execId, usageType: 'Execution', isPrimary: true, illustrative: true });
      if (sorId !== execId) usageRows.push({ tenantId: t, companyId: c, activityCode: s.code!, processStepId: s.id, applicationId: sorId, usageType: 'System of Record', isPrimary: false, illustrative: true });
    }
    if (!covered(realDelivByActivity) && sorId) {
      const firstOutput = (s.outputs ?? '').split(/[,;]/)[0]?.trim();
      const approverCell = s.leads || s.supporting;
      const approver = approverCell ? resolveRoleCell(approverCell, resolveRole).roles[0] ?? null : null;
      delivRows.push({
        tenantId: t, companyId: c, activityCode: s.code!, processStepId: s.id,
        name: firstOutput || `${s.name} output`,
        sorApplicationId: sorId,
        approverRoleId: approver?.id ?? null, approverRoleRaw: approver ? null : (approverCell || null),
        approvalApplicationId: sorId, approvalType: APPROVAL_TYPES[s.stepNumber % APPROVAL_TYPES.length],
        illustrative: true,
      });
    }
  }
  for (let i = 0; i < usageRows.length; i += 500) await prisma.stepAppUsage.createMany({ data: usageRows.slice(i, i + 500) });
  for (let i = 0; i < delivRows.length; i += 500) await prisma.stepDeliverable.createMany({ data: delivRows.slice(i, i + 500) });
  console.log(`Illustrative coverage: +${usageRows.length} app usages, +${delivRows.length} deliverables.`);

  // ── 5. Cap – People capacity fields by primary role ───────────────────
  const cap = new Map<string, { fte: number; net: number }>();
  for (const row of grid('Cap – People')) {
    if (!/^P-\d+$/.test(str(row[0]))) continue;
    const role = str(row[2]);
    const fte = Number(row[4]), net = Number(row[7]);
    if (role && Number.isFinite(fte) && Number.isFinite(net) && !cap.has(role)) cap.set(role, { fte, net });
  }
  let people = 0;
  for (const [roleName, v] of cap) {
    const role = roles.find((r) => r.name === roleName);
    if (!role) continue;
    const assignments = await prisma.assignment.findMany({ where: { roleId: role.id, isPrimary: true }, select: { personId: true, allocationPct: true } });
    for (const a of assignments) {
      const frac = (a.allocationPct ?? 100) / 100;
      await prisma.person.update({ where: { id: a.personId }, data: { fte: v.fte * frac, netAvailableHrs: Math.round(v.net * frac * 10) / 10 } });
      people++;
    }
  }
  console.log(`Capacity fields applied to ${people} person rows from ${cap.size} Cap roles.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
