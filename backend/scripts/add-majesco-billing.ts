// Majesco Billing registration — adds "Majesco Billing" to the application
// catalog and wires it to the two billing L3 subtrees via NodeAppUsage, one
// `performed` link per L5 task a Majesco screen supports (screen→task map in
// documents/majesco-billing/majesco-screen-process-map.md). L6 children of a
// mapped L5 (the AAA rollout's generated task layer, present only in live
// environments) inherit the link, mirroring aaa-l6-app-backfill.ts.
// Idempotent: fill-only-if-null on the app row, skipDuplicates on links.
// Run: npx tsx --env-file=.env scripts/add-majesco-billing.ts
import { prisma } from '../src/db/prisma.js';

const APP_NAME = 'Majesco Billing';
const APP_META = {
  kind: 'SystemOfRecord',
  isInternal: false,
  vendor: 'Majesco',
  category: 'Billing',
  criticality: 'High',
  ownershipModel: 'SaaS',
  description:
    'Majesco Billing for P&C (P&C Intelligent Core Suite) — enterprise billing and receivables ' +
    'for commercial lines. Direct, customer account, agency statement/account current, wholesale, ' +
    'list/payroll-deduction and deductible bill types; user-defined payment plans with equity dating; ' +
    'EBPP/ACH/card payment processing with AI-assisted cash application; suspense management; ' +
    'endorsement and audit premium billing; Compensation Manager commissions; delinquency, ' +
    'cancellation for non-payment and reinstatement; refunds with hold-and-release approval; ' +
    'daily automated trial-balance and GL reconciliation. Cloud-native (Docker/Kubernetes on ' +
    'Majesco CloudInsurer), 200+ OAS 3.0 APIs, Copilot and billing/payment AI agents.',
} as const;

const B = 'core business/business operations/billing collections receivables';
const F = 'corporate functions/finance investments/premium billing receivables accounting';

// Screen → L5 task keys (ProcessNode.code). Kept in sync with the mapping doc.
const SCREEN_MAP: { screen: string; evidence: 'confirmed' | 'inferred'; nodeKeys: string[] }[] = [
  {
    screen: 'Billing Account Overview / Account Inquiry',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/premium refunds overpayment processing/identify credit balances and overpayments for refund`,
      `${F}/delinquency monitoring receivables collections/identify and prioritize past due premium accounts`,
    ],
  },
  {
    screen: 'Policy Billing Inquiry',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/billing mode setup premium notice generation/generate and proof premium notice for the upcoming installment`,
      `${F}/invoice receivable creation/validate invoice data against policy before release`,
    ],
  },
  {
    screen: 'Invoice / Statement Detail',
    evidence: 'inferred',
    nodeKeys: [
      `${F}/invoice receivable creation/generate premium invoice from bound policy terms`,
      `${B}/billing mode setup premium notice generation/generate and proof premium notice for the upcoming installment`,
    ],
  },
  {
    screen: 'Payment Plan / Schedule Maintenance',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/billing mode setup premium notice generation/configure billing plan and payment schedule on the policy account`,
      `${B}/billing mode setup premium notice generation/apply mid term billing changes from endorsements to the schedule`,
      `${F}/invoice receivable creation/calculate installment schedule and down payment amounts`,
    ],
  },
  {
    screen: 'Payment Entry / Batch Cash Entry',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/premium collection payment processing/capture and validate inbound premium payment against the account`,
      `${B}/premium collection payment processing/post lockbox and bank file payments to policyholder accounts`,
      `${F}/cash application suspense resolution/process lockbox and ach eft receipt files`,
      `${F}/premium invoice payment processing/process customer premium payments across channels`,
    ],
  },
  {
    screen: 'Cash Application / Allocation Workbench',
    evidence: 'inferred',
    nodeKeys: [
      `${F}/cash application suspense resolution/match incoming payments to open premium invoices`,
      `${F}/cash application suspense resolution/reconcile applied cash to daily bank deposits`,
    ],
  },
  {
    screen: 'Suspense Management',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/cash with application premium suspense management/record cash with application receipt prior to policy issuance`,
      `${B}/cash with application premium suspense management/match suspense items to issued policies and release funds`,
      `${B}/cash with application premium suspense management/investigate and age unidentified premium suspense items`,
      `${F}/cash application suspense resolution/investigate and clear unapplied cash in suspense`,
    ],
  },
  {
    screen: 'NSF / Payment Reversal Processing',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/premium collection payment processing/resolve declined and returned payment exceptions`,
      `${F}/premium invoice payment processing/handle payment exceptions nsf and chargebacks`,
    ],
  },
  {
    screen: 'Agency Statement / Account Current Reconciliation',
    evidence: 'inferred',
    nodeKeys: [
      `${F}/agent broker account reconciliation/reconcile broker statement of account to ledger balances`,
      `${F}/agent broker account reconciliation/research and resolve broker account discrepancies`,
      `${F}/agent broker account reconciliation/confirm aged broker balances and request settlement`,
    ],
  },
  {
    screen: 'Audit Premium Entry',
    evidence: 'confirmed',
    nodeKeys: [
      `${B}/billing mode setup premium notice generation/apply mid term billing changes from endorsements to the schedule`,
    ],
  },
  {
    screen: 'Disbursement / Refund Queue (Hold-and-Release)',
    evidence: 'confirmed',
    nodeKeys: [
      `${B}/premium refunds overpayment processing/calculate return premium amount on cancellation or reduction`,
      `${B}/premium refunds overpayment processing/validate refund payee and disbursement details`,
      `${B}/premium refunds overpayment processing/approve and release premium refund disbursement`,
      `${B}/cash with application premium suspense management/disposition declined applications by refunding suspended funds`,
      `${F}/premium invoice payment processing/process premium refunds and overpayment returns`,
    ],
  },
  {
    screen: 'Compensation Manager',
    evidence: 'confirmed',
    nodeKeys: [
      `${F}/agent broker account reconciliation/verify commission netting on producer remittances`,
    ],
  },
  {
    screen: 'Delinquency / Collections Workbench',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/grace period lapse billing administration/identify past due accounts entering the grace period`,
      `${B}/grace period lapse billing administration/issue cancellation and lapse warning notices with statutory timing`,
      `${F}/delinquency monitoring receivables collections/identify and prioritize past due premium accounts`,
      `${F}/delinquency monitoring receivables collections/execute dunning notices and collection outreach`,
      `${F}/delinquency monitoring receivables collections/negotiate and set up premium payment arrangements`,
    ],
  },
  {
    screen: 'Cancellation / Reinstatement Processing',
    evidence: 'inferred',
    nodeKeys: [
      `${B}/grace period lapse billing administration/execute lapse or cancellation for unpaid policies at deadline`,
      `${B}/grace period lapse billing administration/reinstate lapsed policy upon qualifying payment`,
      `${F}/delinquency monitoring receivables collections/trigger cancellation for non payment after grace`,
    ],
  },
  {
    screen: 'Write-off Dialog / Tolerance Rules',
    evidence: 'confirmed',
    nodeKeys: [
      `${F}/premium receivable accounting/write off uncollectible premium receivables with approval`,
      `${F}/premium receivable accounting/compute and book allowance for doubtful premium accounts`,
    ],
  },
  {
    screen: 'Trial Balance / GL Reconciliation',
    evidence: 'confirmed',
    nodeKeys: [
      `${F}/billing to ledger reconciliation/reconcile billing system premium totals to gl`,
      `${F}/billing to ledger reconciliation/reconcile suspense and clearing accounts to zero`,
      `${F}/billing to ledger reconciliation/document reconciliation controls for period close`,
      `${F}/premium receivable accounting/reconcile ar subledger to general ledger control account`,
      `${F}/premium receivable accounting/record earned premium recognition entries for the period`,
      `${F}/invoice receivable creation/post premium receivable to the general ledger`,
    ],
  },
  {
    screen: 'Batch Processing Monitor / Day-End Console',
    evidence: 'confirmed',
    nodeKeys: [
      `${B}/premium collection payment processing/process recurring auto pay eft draft run for due installments`,
      `${F}/billing to ledger reconciliation/investigate billing to gl interface posting failures`,
    ],
  },
  {
    screen: 'Bill360 Policyholder Portal (EBPP)',
    evidence: 'confirmed',
    nodeKeys: [
      `${B}/premium collection payment processing/enable policyholder self service payment and auto pay enrollment`,
      `${B}/billing mode setup premium notice generation/distribute premium notices through print and e delivery channels`,
      `${F}/premium invoice payment processing/administer auto pay and recurring premium enrollment`,
    ],
  },
  {
    screen: 'BI Dashboards & Reports',
    evidence: 'confirmed',
    nodeKeys: [
      `${F}/premium receivable accounting/prepare premium receivable aging and rollforward report`,
      `${F}/delinquency monitoring receivables collections/report collections performance and roll rate metrics`,
    ],
  },
  {
    screen: 'Configuration Toolset / Dev Studio',
    evidence: 'confirmed',
    nodeKeys: [
      `${B}/billing mode setup premium notice generation/configure billing plan and payment schedule on the policy account`,
    ],
  },
];

const allKeys = [...new Set(SCREEN_MAP.flatMap((s) => s.nodeKeys))];

const nodes = await prisma.processNode.findMany({
  where: { code: { in: allKeys } },
  select: { id: true, companyId: true, code: true },
});
const foundKeys = new Set(nodes.map((n) => n.code));
const missing = allKeys.filter((k) => !foundKeys.has(k));
if (missing.length) {
  console.warn(`WARNING: ${missing.length} node keys not found (skipped):`);
  for (const k of missing) console.warn(`  - ${k}`);
}

const byCompany = new Map<string, { id: string }[]>();
for (const n of nodes) byCompany.set(n.companyId, [...(byCompany.get(n.companyId) ?? []), n]);

let linkedL5 = 0;
let linkedL6 = 0;
for (const [companyId, companyNodes] of byCompany) {
  let app = await prisma.application.findFirst({
    where: { companyId, name: APP_NAME },
    select: { id: true, vendor: true, category: true, description: true },
  });
  if (!app) {
    app = await prisma.application.create({
      data: { companyId, name: APP_NAME, ...APP_META },
      select: { id: true, vendor: true, category: true, description: true },
    });
    console.log(`created application "${APP_NAME}" (${app.id}) for company ${companyId}`);
  } else {
    const fill: Record<string, string> = {};
    if (!app.vendor) fill.vendor = APP_META.vendor;
    if (!app.category) fill.category = APP_META.category;
    if (!app.description) fill.description = APP_META.description;
    if (Object.keys(fill).length)
      await prisma.application.update({ where: { id: app.id }, data: fill });
    console.log(
      `application "${APP_NAME}" already exists (${app.id}); filled ${Object.keys(fill).length} blank fields`,
    );
  }

  const l5Ids = companyNodes.map((n) => n.id);
  const { count: c5 } = await prisma.nodeAppUsage.createMany({
    data: l5Ids.map((processNodeId) => ({
      companyId,
      processNodeId,
      applicationId: app.id,
      usageType: 'performed',
    })),
    skipDuplicates: true,
  });
  linkedL5 += c5;

  // L6 inheritance: link generated child tasks of every mapped L5 (live-env layer).
  const l6s = await prisma.processNode.findMany({
    where: { parentId: { in: l5Ids }, isTask: true },
    select: { id: true },
  });
  if (l6s.length) {
    const { count: c6 } = await prisma.nodeAppUsage.createMany({
      data: l6s.map((n) => ({
        companyId,
        processNodeId: n.id,
        applicationId: app.id,
        usageType: 'performed',
      })),
      skipDuplicates: true,
    });
    linkedL6 += c6;
  }
}

console.log(
  `done: ${SCREEN_MAP.length} screens → ${allKeys.length} distinct L5 tasks across ${byCompany.size} company(ies); ` +
    `new links: ${linkedL5} L5, ${linkedL6} L6 (existing links skipped)`,
);
await prisma.$disconnect();
