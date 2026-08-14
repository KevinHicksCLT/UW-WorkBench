# Majesco Billing — Screen ↔ Process Mapping (L3 → L6)

Maps the Majesco Billing for P&C screen inventory (see [majesco-billing-research-dossier.md](majesco-billing-research-dossier.md), §3) onto the Transformation Bridge process taxonomy. Data wiring is applied by `backend/scripts/add-majesco-billing.ts`, which registers the **Majesco Billing** application and links it (`NodeAppUsage`, `usageType: performed`) to every L5 task listed below — and to any generated L6 child tasks of those L5s present in the live environment (the AAA-rollout task layer; the seed itself is L1–L5).

**Evidence**: `Confirmed` = the screen/workspace is directly evidenced in Majesco public material; `Inferred` = standard screen implied by a confirmed capability (Majesco publishes no public screen catalog).

## High-level mapping (Majesco module → L3 process areas)

| Majesco functional module | L1 | L2 | L3 |
|---|---|---|---|
| Billing operations (plans, notices, collection, suspense, lapse, refunds) | Core Business | Business Operations | **Billing, Collections & Receivables** |
| Receivables accounting, cash application, agency/broker settlement, GL | Corporate Functions | Finance & Investments | **Premium Billing & Receivables Accounting** |

Adjacent areas touched but **not** mapped (different owning systems in the estate): `Finance & Investments > Treasury & Cash Management` (bank-side cash), `Finance & Investments > Statutory & Regulatory Reporting > Escheatment & Unclaimed Property Compliance` (escheat is unverified for Majesco — dossier §2.8), `Claims > Settlement & Payment` (claims money-out), `Reinsurance > Premium & Settlement Accounting`. The L4 `Annuity Purchase Payment Processing` under Billing, Collections & Receivables is L&A-side and out of scope for a commercial-lines P&C billing platform.

## Screen-level mapping (L3 → L4 → L5)

Abbreviations: **BCR** = Core Business › Business Operations › Billing, Collections & Receivables; **PBRA** = Corporate Functions › Finance & Investments › Premium Billing & Receivables Accounting.

### Account & inquiry

| Screen | Evidence | L3 | L4 | L5 task |
|---|---|---|---|---|
| Billing Account Overview / Account Inquiry | Inferred | BCR | Premium Refunds & Overpayment Processing | Identify credit balances and overpayments for refund |
| | | PBRA | Delinquency Monitoring & Receivables Collections | Identify and prioritize past-due premium accounts |
| Policy Billing Inquiry | Inferred | BCR | Billing Mode Setup & Premium Notice Generation | Generate and proof premium notice for the upcoming installment |
| | | PBRA | Invoice & Receivable Creation | Validate invoice data against policy before release |
| Invoice / Statement Detail | Inferred | PBRA | Invoice & Receivable Creation | Generate premium invoice from bound policy terms |
| | | BCR | Billing Mode Setup & Premium Notice Generation | Generate and proof premium notice for the upcoming installment |
| Payment Plan / Schedule Maintenance | Inferred | BCR | Billing Mode Setup & Premium Notice Generation | Configure billing plan and payment schedule on the policy account |
| | | BCR | Billing Mode Setup & Premium Notice Generation | Apply mid-term billing changes from endorsements to the schedule |
| | | PBRA | Invoice & Receivable Creation | Calculate installment schedule and down-payment amounts |

### Money in

| Screen | Evidence | L3 | L4 | L5 task |
|---|---|---|---|---|
| Payment Entry / Batch Cash Entry | Inferred | BCR | Premium Collection & Payment Processing | Capture and validate inbound premium payment against the account |
| | | BCR | Premium Collection & Payment Processing | Post lockbox and bank file payments to policyholder accounts |
| | | PBRA | Cash Application & Suspense Resolution | Process lockbox and ACH/EFT receipt files |
| | | PBRA | Premium Invoice & Payment Processing | Process customer premium payments across channels |
| Cash Application / Allocation Workbench | Inferred (AI cash allocation Confirmed) | PBRA | Cash Application & Suspense Resolution | Match incoming payments to open premium invoices |
| | | PBRA | Cash Application & Suspense Resolution | Reconcile applied cash to daily bank deposits |
| Suspense Management | Inferred | BCR | Cash-with-Application & Premium Suspense Management | Record cash-with-application receipt prior to policy issuance |
| | | BCR | Cash-with-Application & Premium Suspense Management | Match suspense items to issued policies and release funds |
| | | BCR | Cash-with-Application & Premium Suspense Management | Investigate and age unidentified premium suspense items |
| | | PBRA | Cash Application & Suspense Resolution | Investigate and clear unapplied cash in suspense |
| NSF / Payment Reversal Processing | Inferred | BCR | Premium Collection & Payment Processing | Resolve declined and returned payment exceptions |
| | | PBRA | Premium Invoice & Payment Processing | Handle payment exceptions, NSF and chargebacks |

### Agency bill

| Screen | Evidence | L3 | L4 | L5 task |
|---|---|---|---|---|
| Agency Statement / Account Current Reconciliation | Inferred (bill types Confirmed) | PBRA | Agent & Broker Account Reconciliation | Reconcile broker statement-of-account to ledger balances |
| | | PBRA | Agent & Broker Account Reconciliation | Research and resolve broker account discrepancies |
| | | PBRA | Agent & Broker Account Reconciliation | Confirm aged broker balances and request settlement |
| Audit Premium Entry | Confirmed ("direct entry of commissionable audit premiums") | BCR | Billing Mode Setup & Premium Notice Generation | Apply mid-term billing changes from endorsements to the schedule |
| Compensation Manager | Confirmed | PBRA | Agent & Broker Account Reconciliation | Verify commission netting on producer remittances |

### Money out

| Screen | Evidence | L3 | L4 | L5 task |
|---|---|---|---|---|
| Disbursement / Refund Queue (Hold-and-Release) | Confirmed (capability) | BCR | Premium Refunds & Overpayment Processing | Calculate return-premium amount on cancellation or reduction |
| | | BCR | Premium Refunds & Overpayment Processing | Validate refund payee and disbursement details |
| | | BCR | Premium Refunds & Overpayment Processing | Approve and release premium refund disbursement |
| | | BCR | Cash-with-Application & Premium Suspense Management | Disposition declined applications by refunding suspended funds |
| | | PBRA | Premium Invoice & Payment Processing | Process premium refunds and overpayment returns |

### Delinquency & servicing

| Screen | Evidence | L3 | L4 | L5 task |
|---|---|---|---|---|
| Delinquency / Collections Workbench | Inferred (capabilities Confirmed) | BCR | Grace Period & Lapse Billing Administration | Identify past-due accounts entering the grace period |
| | | BCR | Grace Period & Lapse Billing Administration | Issue cancellation and lapse warning notices with statutory timing |
| | | PBRA | Delinquency Monitoring & Receivables Collections | Identify and prioritize past-due premium accounts |
| | | PBRA | Delinquency Monitoring & Receivables Collections | Execute dunning notices and collection outreach |
| | | PBRA | Delinquency Monitoring & Receivables Collections | Negotiate and set up premium payment arrangements |
| Cancellation / Reinstatement Processing | Inferred | BCR | Grace Period & Lapse Billing Administration | Execute lapse or cancellation for unpaid policies at deadline |
| | | BCR | Grace Period & Lapse Billing Administration | Reinstate lapsed policy upon qualifying payment |
| | | PBRA | Delinquency Monitoring & Receivables Collections | Trigger cancellation for non-payment after grace |
| Write-off Dialog / Tolerance Rules | Confirmed | PBRA | Premium Receivable Accounting | Write off uncollectible premium receivables with approval |
| | | PBRA | Premium Receivable Accounting | Compute and book allowance for doubtful premium accounts |

### Financial close

| Screen | Evidence | L3 | L4 | L5 task |
|---|---|---|---|---|
| Trial Balance / GL Reconciliation | Confirmed (daily auto-reconciliation, v12) | PBRA | Billing-to-Ledger Reconciliation | Reconcile billing system premium totals to GL |
| | | PBRA | Billing-to-Ledger Reconciliation | Reconcile suspense and clearing accounts to zero |
| | | PBRA | Billing-to-Ledger Reconciliation | Document reconciliation controls for period close |
| | | PBRA | Premium Receivable Accounting | Reconcile AR subledger to general ledger control account |
| | | PBRA | Premium Receivable Accounting | Record earned premium recognition entries for the period |
| | | PBRA | Invoice & Receivable Creation | Post premium receivable to the general ledger |
| Batch Processing Monitor / Day-End Console | Confirmed | BCR | Premium Collection & Payment Processing | Process recurring auto-pay (EFT) draft run for due installments |
| | | PBRA | Billing-to-Ledger Reconciliation | Investigate billing-to-GL interface posting failures |

### Digital & analytics

| Screen | Evidence | L3 | L4 | L5 task |
|---|---|---|---|---|
| Bill360 Policyholder Portal (EBPP) | Confirmed | BCR | Premium Collection & Payment Processing | Enable policyholder self-service payment and auto-pay enrollment |
| | | BCR | Billing Mode Setup & Premium Notice Generation | Distribute premium notices through print and e-delivery channels |
| | | PBRA | Premium Invoice & Payment Processing | Administer auto-pay and recurring premium enrollment |
| BI Dashboards & Reports | Confirmed | PBRA | Premium Receivable Accounting | Prepare premium receivable aging and rollforward report |
| | | PBRA | Delinquency Monitoring & Receivables Collections | Report collections performance and roll-rate metrics |
| Configuration Toolset / Dev Studio | Confirmed | BCR | Billing Mode Setup & Premium Notice Generation | Configure billing plan and payment schedule on the policy account |
| Majesco Copilot pane | Confirmed | — | — | Cross-cutting: embedded in the screens above (data retrieval, allocation suggestions, exception resolution); no separate task mapping |

## L6 note

The live database carries a generated L6 task layer under some L5s (created out-of-band by the AAA rollout; `ProcessLevelType` L6 exists only in the environment, not the seed). `add-majesco-billing.ts` therefore propagates each mapped L5's link to its `isTask` L6 children at run time, so the mapping is L3→L6-complete wherever L6 decomposition exists, without hardcoding environment-specific ids.

## Coverage summary

20 screens → 51 distinct L5 tasks: all 21 P&C tasks of **Billing, Collections & Receivables** (the 4 L&A annuity tasks excluded) and all 30 tasks of **Premium Billing & Receivables Accounting** — full coverage of both commercial-billing L3 subtrees minus the annuity L4.
