// Majesco Billing screen inventory → process-taxonomy mapping (MAJESCO-BILL).
// Source of truth: documents/majesco-billing/majesco-screen-process-map.md —
// keep in sync with backend/scripts/add-majesco-billing.ts, which applies the
// same mapping as NodeAppUsage links in the database.

export type BillingArea = 'BCR' | 'PBRA';

export const AREA_LABELS: Record<BillingArea, string> = {
  BCR: 'Core Business › Business Operations › Billing, Collections & Receivables',
  PBRA: 'Corporate Functions › Finance & Investments › Premium Billing & Receivables Accounting',
};

export type ScreenMapping = { area: BillingArea; l4: string; l5: string };

export type BillingScreen = {
  name: string;
  evidence: 'Confirmed' | 'Inferred';
  evidenceNote?: string;
  mappings: ScreenMapping[];
};

export type ScreenGroup = { group: string; screens: BillingScreen[] };

export const SCREEN_GROUPS: ScreenGroup[] = [
  {
    group: 'Account & inquiry',
    screens: [
      {
        name: 'Billing Account Overview / Account Inquiry',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'BCR',
            l4: 'Premium Refunds & Overpayment Processing',
            l5: 'Identify credit balances and overpayments for refund',
          },
          {
            area: 'PBRA',
            l4: 'Delinquency Monitoring & Receivables Collections',
            l5: 'Identify and prioritize past-due premium accounts',
          },
        ],
      },
      {
        name: 'Policy Billing Inquiry',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'BCR',
            l4: 'Billing Mode Setup & Premium Notice Generation',
            l5: 'Generate and proof premium notice for the upcoming installment',
          },
          {
            area: 'PBRA',
            l4: 'Invoice & Receivable Creation',
            l5: 'Validate invoice data against policy before release',
          },
        ],
      },
      {
        name: 'Invoice / Statement Detail',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'PBRA',
            l4: 'Invoice & Receivable Creation',
            l5: 'Generate premium invoice from bound policy terms',
          },
          {
            area: 'BCR',
            l4: 'Billing Mode Setup & Premium Notice Generation',
            l5: 'Generate and proof premium notice for the upcoming installment',
          },
        ],
      },
      {
        name: 'Payment Plan / Schedule Maintenance',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'BCR',
            l4: 'Billing Mode Setup & Premium Notice Generation',
            l5: 'Configure billing plan and payment schedule on the policy account',
          },
          {
            area: 'BCR',
            l4: 'Billing Mode Setup & Premium Notice Generation',
            l5: 'Apply mid-term billing changes from endorsements to the schedule',
          },
          {
            area: 'PBRA',
            l4: 'Invoice & Receivable Creation',
            l5: 'Calculate installment schedule and down-payment amounts',
          },
        ],
      },
    ],
  },
  {
    group: 'Money in',
    screens: [
      {
        name: 'Payment Entry / Batch Cash Entry',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'BCR',
            l4: 'Premium Collection & Payment Processing',
            l5: 'Capture and validate inbound premium payment against the account',
          },
          {
            area: 'BCR',
            l4: 'Premium Collection & Payment Processing',
            l5: 'Post lockbox and bank file payments to policyholder accounts',
          },
          {
            area: 'PBRA',
            l4: 'Cash Application & Suspense Resolution',
            l5: 'Process lockbox and ACH/EFT receipt files',
          },
          {
            area: 'PBRA',
            l4: 'Premium Invoice & Payment Processing',
            l5: 'Process customer premium payments across channels',
          },
        ],
      },
      {
        name: 'Cash Application / Allocation Workbench',
        evidence: 'Inferred',
        evidenceNote: 'AI cash allocation Confirmed',
        mappings: [
          {
            area: 'PBRA',
            l4: 'Cash Application & Suspense Resolution',
            l5: 'Match incoming payments to open premium invoices',
          },
          {
            area: 'PBRA',
            l4: 'Cash Application & Suspense Resolution',
            l5: 'Reconcile applied cash to daily bank deposits',
          },
        ],
      },
      {
        name: 'Suspense Management',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'BCR',
            l4: 'Cash-with-Application & Premium Suspense Management',
            l5: 'Record cash-with-application receipt prior to policy issuance',
          },
          {
            area: 'BCR',
            l4: 'Cash-with-Application & Premium Suspense Management',
            l5: 'Match suspense items to issued policies and release funds',
          },
          {
            area: 'BCR',
            l4: 'Cash-with-Application & Premium Suspense Management',
            l5: 'Investigate and age unidentified premium suspense items',
          },
          {
            area: 'PBRA',
            l4: 'Cash Application & Suspense Resolution',
            l5: 'Investigate and clear unapplied cash in suspense',
          },
        ],
      },
      {
        name: 'NSF / Payment Reversal Processing',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'BCR',
            l4: 'Premium Collection & Payment Processing',
            l5: 'Resolve declined and returned payment exceptions',
          },
          {
            area: 'PBRA',
            l4: 'Premium Invoice & Payment Processing',
            l5: 'Handle payment exceptions, NSF and chargebacks',
          },
        ],
      },
    ],
  },
  {
    group: 'Agency bill',
    screens: [
      {
        name: 'Agency Statement / Account Current Reconciliation',
        evidence: 'Inferred',
        evidenceNote: 'bill types Confirmed',
        mappings: [
          {
            area: 'PBRA',
            l4: 'Agent & Broker Account Reconciliation',
            l5: 'Reconcile broker statement-of-account to ledger balances',
          },
          {
            area: 'PBRA',
            l4: 'Agent & Broker Account Reconciliation',
            l5: 'Research and resolve broker account discrepancies',
          },
          {
            area: 'PBRA',
            l4: 'Agent & Broker Account Reconciliation',
            l5: 'Confirm aged broker balances and request settlement',
          },
        ],
      },
      {
        name: 'Audit Premium Entry',
        evidence: 'Confirmed',
        evidenceNote: 'direct entry of commissionable audit premiums',
        mappings: [
          {
            area: 'BCR',
            l4: 'Billing Mode Setup & Premium Notice Generation',
            l5: 'Apply mid-term billing changes from endorsements to the schedule',
          },
        ],
      },
      {
        name: 'Compensation Manager',
        evidence: 'Confirmed',
        mappings: [
          {
            area: 'PBRA',
            l4: 'Agent & Broker Account Reconciliation',
            l5: 'Verify commission netting on producer remittances',
          },
        ],
      },
    ],
  },
  {
    group: 'Money out',
    screens: [
      {
        name: 'Disbursement / Refund Queue (Hold-and-Release)',
        evidence: 'Confirmed',
        evidenceNote: 'capability',
        mappings: [
          {
            area: 'BCR',
            l4: 'Premium Refunds & Overpayment Processing',
            l5: 'Calculate return-premium amount on cancellation or reduction',
          },
          {
            area: 'BCR',
            l4: 'Premium Refunds & Overpayment Processing',
            l5: 'Validate refund payee and disbursement details',
          },
          {
            area: 'BCR',
            l4: 'Premium Refunds & Overpayment Processing',
            l5: 'Approve and release premium refund disbursement',
          },
          {
            area: 'BCR',
            l4: 'Cash-with-Application & Premium Suspense Management',
            l5: 'Disposition declined applications by refunding suspended funds',
          },
          {
            area: 'PBRA',
            l4: 'Premium Invoice & Payment Processing',
            l5: 'Process premium refunds and overpayment returns',
          },
        ],
      },
    ],
  },
  {
    group: 'Delinquency & servicing',
    screens: [
      {
        name: 'Delinquency / Collections Workbench',
        evidence: 'Inferred',
        evidenceNote: 'capabilities Confirmed',
        mappings: [
          {
            area: 'BCR',
            l4: 'Grace Period & Lapse Billing Administration',
            l5: 'Identify past-due accounts entering the grace period',
          },
          {
            area: 'BCR',
            l4: 'Grace Period & Lapse Billing Administration',
            l5: 'Issue cancellation and lapse warning notices with statutory timing',
          },
          {
            area: 'PBRA',
            l4: 'Delinquency Monitoring & Receivables Collections',
            l5: 'Identify and prioritize past-due premium accounts',
          },
          {
            area: 'PBRA',
            l4: 'Delinquency Monitoring & Receivables Collections',
            l5: 'Execute dunning notices and collection outreach',
          },
          {
            area: 'PBRA',
            l4: 'Delinquency Monitoring & Receivables Collections',
            l5: 'Negotiate and set up premium payment arrangements',
          },
        ],
      },
      {
        name: 'Cancellation / Reinstatement Processing',
        evidence: 'Inferred',
        mappings: [
          {
            area: 'BCR',
            l4: 'Grace Period & Lapse Billing Administration',
            l5: 'Execute lapse or cancellation for unpaid policies at deadline',
          },
          {
            area: 'BCR',
            l4: 'Grace Period & Lapse Billing Administration',
            l5: 'Reinstate lapsed policy upon qualifying payment',
          },
          {
            area: 'PBRA',
            l4: 'Delinquency Monitoring & Receivables Collections',
            l5: 'Trigger cancellation for non-payment after grace',
          },
        ],
      },
      {
        name: 'Write-off Dialog / Tolerance Rules',
        evidence: 'Confirmed',
        mappings: [
          {
            area: 'PBRA',
            l4: 'Premium Receivable Accounting',
            l5: 'Write off uncollectible premium receivables with approval',
          },
          {
            area: 'PBRA',
            l4: 'Premium Receivable Accounting',
            l5: 'Compute and book allowance for doubtful premium accounts',
          },
        ],
      },
    ],
  },
  {
    group: 'Financial close',
    screens: [
      {
        name: 'Trial Balance / GL Reconciliation',
        evidence: 'Confirmed',
        evidenceNote: 'daily auto-reconciliation, v12',
        mappings: [
          {
            area: 'PBRA',
            l4: 'Billing-to-Ledger Reconciliation',
            l5: 'Reconcile billing system premium totals to GL',
          },
          {
            area: 'PBRA',
            l4: 'Billing-to-Ledger Reconciliation',
            l5: 'Reconcile suspense and clearing accounts to zero',
          },
          {
            area: 'PBRA',
            l4: 'Billing-to-Ledger Reconciliation',
            l5: 'Document reconciliation controls for period close',
          },
          {
            area: 'PBRA',
            l4: 'Premium Receivable Accounting',
            l5: 'Reconcile AR subledger to general ledger control account',
          },
          {
            area: 'PBRA',
            l4: 'Premium Receivable Accounting',
            l5: 'Record earned premium recognition entries for the period',
          },
          {
            area: 'PBRA',
            l4: 'Invoice & Receivable Creation',
            l5: 'Post premium receivable to the general ledger',
          },
        ],
      },
      {
        name: 'Batch Processing Monitor / Day-End Console',
        evidence: 'Confirmed',
        mappings: [
          {
            area: 'BCR',
            l4: 'Premium Collection & Payment Processing',
            l5: 'Process recurring auto-pay (EFT) draft run for due installments',
          },
          {
            area: 'PBRA',
            l4: 'Billing-to-Ledger Reconciliation',
            l5: 'Investigate billing-to-GL interface posting failures',
          },
        ],
      },
    ],
  },
  {
    group: 'Digital & analytics',
    screens: [
      {
        name: 'Bill360 Policyholder Portal (EBPP)',
        evidence: 'Confirmed',
        mappings: [
          {
            area: 'BCR',
            l4: 'Premium Collection & Payment Processing',
            l5: 'Enable policyholder self-service payment and auto-pay enrollment',
          },
          {
            area: 'BCR',
            l4: 'Billing Mode Setup & Premium Notice Generation',
            l5: 'Distribute premium notices through print and e-delivery channels',
          },
          {
            area: 'PBRA',
            l4: 'Premium Invoice & Payment Processing',
            l5: 'Administer auto-pay and recurring premium enrollment',
          },
        ],
      },
      {
        name: 'BI Dashboards & Reports',
        evidence: 'Confirmed',
        mappings: [
          {
            area: 'PBRA',
            l4: 'Premium Receivable Accounting',
            l5: 'Prepare premium receivable aging and rollforward report',
          },
          {
            area: 'PBRA',
            l4: 'Delinquency Monitoring & Receivables Collections',
            l5: 'Report collections performance and roll-rate metrics',
          },
        ],
      },
      {
        name: 'Configuration Toolset / Dev Studio',
        evidence: 'Confirmed',
        mappings: [
          {
            area: 'BCR',
            l4: 'Billing Mode Setup & Premium Notice Generation',
            l5: 'Configure billing plan and payment schedule on the policy account',
          },
        ],
      },
      {
        name: 'Majesco Copilot pane',
        evidence: 'Confirmed',
        evidenceNote:
          'cross-cutting: embedded in the screens above (data retrieval, allocation suggestions, exception resolution); no separate task mapping',
        mappings: [],
      },
    ],
  },
];

export const COVERAGE_SUMMARY =
  '20 screens → 51 distinct L5 tasks: all 21 P&C tasks of Billing, Collections & Receivables ' +
  '(4 L&A annuity tasks excluded) and all 30 tasks of Premium Billing & Receivables Accounting.';
