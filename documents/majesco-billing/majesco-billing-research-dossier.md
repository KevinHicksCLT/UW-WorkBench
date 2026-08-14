# Majesco Billing — Commercial Lines Research Dossier

**Scope:** Majesco Billing for P&C (part of the Majesco P&C Intelligent Core Suite), with emphasis on Commercial Lines of Business billing. Compiled 2026-08-14 from public web sources.
**Confidence legend:** Items are marked **[Confirmed]** (directly evidenced in a cited source) or **[Inferred]** (reasonable inference from industry-standard P&C billing capability sets, Majesco's marketing language, or sibling-product documentation). Screen names in Section 3 are almost entirely inferred and labeled as such — Majesco does not publish a public screen catalog.

---

## 1. Product Overview & Positioning

### 1.1 What it is

**[Confirmed]** Majesco Billing for P&C is an enterprise billing and receivables system for property & casualty insurers, covering invoicing, receivables, payment plans, commissions/compensation, delinquency, and billing-related customer servicing. Majesco markets it as "the insurance industry leader in enterprise billing management" and "the most widely adopted, award-winning" billing solution in its portfolio. It supports **all P&C lines of business** — the suite wheel diagram in the 2021 datasheet explicitly lists Commercial lines: **Auto, Property, BOP, GL, Inland Marine, Crime, Workers' Compensation**, plus Specialty (Cyber, Aviation, Marine) and Innovative (Rideshare, On-Demand, Usage-Based, Parametric) products.

**[Confirmed]** Suite context: it is one of three modules of the **Majesco P&C Core Suite** (rebranded **P&C Intelligent Core Suite** with the Spring '23 release): **Policy** (WN, rating, CRM, reinsurance, renewals), **Billing** (invoice, commissions, collections, payments), **Claims** (FNOL, fraud, subrogation & salvage, CAT management, settlement). Billing can be deployed **standalone** against a third-party PAS or as part of the suite, via **on-premise, hosted, or cloud (Majesco CloudInsurer®)** — today predominantly "Majesco Cloud" SaaS.

**[Confirmed]** A second, down-market edition exists: **Majesco P&C CoreConnect Billing**, a pre-bundled SaaS package of the same billing capabilities aimed at **MGAs, MGUs, and smaller insurers**, and a digital EBPP front end, **Majesco Digital Electronic Bill360 for P&C**, sold as part of the "Digital1st"/Digital 360 family.

### 1.2 Lineage & release history

**[Confirmed]** The product's heritage is **STG Billing** (a "Billing and Accounts Receivable system") from **Systems Task Group International (STG)**, a North American P&C software firm acquired by Mastek/MajescoMastek in 2007-08 for ~$29M. STG Billing won the overall **Celent Model Carrier Award (2009**, for the Farmers Alliance Mutual implementation**)** and **two Celent XCelent Awards (2012)**. Named STG Billing customers from that era: **Utica National, Catholic Mutual Group, Nautilus Insurance Group, US Assure** (rolled out to a 50,000-agent network), **Amerisure** (live May 2011) — a strongly commercial-lines-weighted customer base (workers' comp, E&S, commercial package).

**[Confirmed]** Version/release timeline assembled from press releases:

| Release | Date | Billing-relevant content |
|---|---|---|
| Suite v11 GA | Oct 28, 2019 | Policy, Billing, Claims for P&C on CloudInsurer |
| Monthly-release model + COVID updates | Jul 23, 2020 announcement | Moved from periodic to **monthly automated releases**; advanced **moratorium** capabilities (fee/late-charge/collections leniency; on return to normal, automatically **spread unpaid balances over multiple installments, even beyond policy expiry**) |
| Suite v11 R2 GA | Oct 13, 2020 | Billing **certified at 100 million policies and 1,000 concurrent users**; **200+ new OAS 3.0 APIs** and a "**no-code API framework**"; new digital 360° agent/producer experience; CAT/moratorium extension-shortening controls |
| Suite v12 GA | Nov 18, 2021 | Suite **re-architected as Docker images, orchestrated with Kubernetes, deployed as Helm charts**; Billing gained **enriched auto-reconciliation and balancing** that "automatically reconciles the trial balance, including general ledger feeds daily" |
| Spring '23 | 2023 | "P&C **Intelligent** Core Suite" launch (analytics/AI-forward rebrand; basis for Tokio Marine's "Intelligent Billing" upgrade) |
| Majesco Copilot | Nov 1, 2023 | GenAI copilot on **Microsoft Azure OpenAI Service**; **Copilot in Billing** handles data retrieval, payment-data requests, billing customer-service inquiries |
| Fall '24 | Oct 2024 | Multi-modal Copilot; automated **bill & invoice processing** (2.5 hrs saved per claim); **20-30% faster API calls** incl. billing transactions; upgrades in <10 days |
| Spring '25 | 2025 | **Automated cash allocation with "98% accuracy in cash application"** via AI document analysis (**DocScribe** ingestion engine); pre-built embedded **BI reports for P&C Policy, Billing, Claims**; responsive Insured Portal billing experience (CoreConnect) |
| Fall '25 | Oct 7, 2025 | **13 AI Agents** across suites; **six for P&C covering quoting, claims triage, billing, and payments** (reasoning agents with human-in-the-loop and insurer-specific guardrails); Power BI analytics library; batch-processing speed-ups |
| Spring '26 | 2026 | 13 more AI agents; **Agentic AI across quoting, servicing, billing, claims**; agents for **bill validation** and **payment reconciliation** (named on the L&AH side; P&C gets equivalent billing/servicing agentic automation); unified task management across policy/billing/claims |

### 1.3 Analyst standing

- **[Confirmed]** **Celent Luminary** for Billing for P&C (June 2023) — the top designation in Celent's billing systems vendor reports — **across four regions: North America, LATAM, EMEA, APAC**; Celent cited "advanced technology in the billing space" and "expansive functionality."
- **[Confirmed]** Historic Celent awards as STG Billing (2009 Model Carrier, 2012 XCelent x2).
- **[Confirmed]** Suite siblings hold parallel recognitions (Policy for P&C Luminary, Celent NA PAS 2023; Claims Luminary 2022/2024) — relevant because Celent evaluates suite technology commonly.
- **[Confirmed]** Customer scale claims: 350+ insurers using Majesco solutions, 900+ implementations (2023); **160+ insurance providers as Billing customers** (2018 datasheet).
- **[Confirmed]** G2 shows a single enterprise review (Nov 2021, 1.5/5) criticizing cost ("seven figures annually") and change/customization dependence on the vendor — worth noting as the only public end-user voice found.

### 1.4 Commercial-lines proof points

**[Confirmed]**
- **Arch Insurance** (commercial/specialty: corporations, professional firms, financial institutions; four US subsidiaries incl. E&S) went **live on Majesco Billing on CloudInsurer in 7 months** (Nov 2019), phase 1 of consolidating multiple legacy billing systems; drivers were multiple payment options, customizable bill plans, real-time billing info.
- **Tokio Marine America** (all major commercial P&C lines, all US states + DC + PR) announced an upgrade to **Majesco Intelligent Billing for P&C on Majesco Cloud** (Dec 2023) for real-time data access, BI reporting, GenAI tools.
- A **Tier 1 global insurer** selected Majesco Billing for a **greenfield small-commercial** launch across multiple states (2018).
- Legacy STG base (Amerisure, US Assure, Nautilus, Utica) is heavily workers' comp / commercial specialty.

---

## 2. Functional Capabilities for Commercial Lines Billing

### 2.1 Billing methods / bill types

**[Confirmed]** The canonical, repeatedly published list: **Direct, Customer Account, Agency Statement, Agency Account Current, Wholesale, List/Payroll Deduction, and Deductible Billing**, "among others"; marketing also summarizes as "agency bill, direct bill, list bill, deductible bill and more," and the Celent press adds "direct, agency, group, and installment billing."

Interpretation for commercial lines:
- **Direct bill** — insurer bills the insured per policy. [Confirmed]
- **Customer/Account billing** — account-level billing consolidating multiple policies: "Customers receive one bill, regardless of how many different P&C policies or lines of business they have purchased," and CoreConnect's "consolidated bill feature enables the seamless compilation of multiple policy bills into a single invoice." Cross-suite consolidation across **P&C, L&A and Group** books is explicitly claimed. [Confirmed]
- **Agency Statement bill and Agency Account Current** — both classic agency-bill modes (statement bill vs. account current) are named as distinct types. Agency bill supports **direct entry of commissionable audit premiums** (i.e., booking audit premium on agency-billed policies with commission impact). [Confirmed]
- **Wholesale billing** — billing an MGA/wholesaler intermediary. [Confirmed name; role inferred]
- **List bill / payroll deduction** — one payer remits for a list of insureds/certificates. [Confirmed]
- **Deductible billing** — billing insureds for deductible reimbursements (large-deductible WC/commercial programs). [Confirmed name; use-case inferred]

### 2.2 Payment plans, invoicing, equity

- **[Confirmed]** "Flexible **user-defined payment plans**" with **optional service charge and finance charge** billing options; insureds can **choose their own payment due date**. CoreConnect states "**unlimited billing plans**."
- **[Confirmed]** Fully automated billing lifecycle "from bill distribution and configurable recurring payment drafts to cancellations, reinstatements with automatic suspense clearing, renewals, refunds, and more."
- **[Confirmed]** **Equity calculations** are supported (CoreConnect Billing page) — i.e., paid-to/equity dating used to time cancellation for non-pay so the carrier stays earned-premium covered. The mechanics (equity date driving cancellation notices) are **[Inferred]** industry-standard behavior consistent with that claim.
- **[Inferred]** Standard plan constructs (down payment %, number of installments, installment fees, invoice lead days, endorsement spreading) — implied by "user-defined payment plans," the moratorium feature that "spreads unpaid balances over multiple installments even beyond policy expiry," and normal P&C billing practice.

### 2.3 Payment processing

- **[Confirmed]** **EBPP** (Electronic Bill Presentment & Payment) with credit/debit cards; **ACH and credit-card processing "using Electronic Bill360 and trusted payment gateways"**; recurring payment drafts (AutoPay), one-time payments, and **guest payments** (no login); deduction "from multiple accounts for different policies."
- **[Confirmed]** Pre-integrated payment partners via **EcoExchange**: **CyberSource** gateway (named on the Bill360 page); **InvoiceCloud** is a named Majesco partner offering "a fully integrated billing and payment solution" (InvoiceCloud's own channels include card/ACH, text/IVR/web).
- **[Inferred]** **Lockbox** file intake and check processing — not found in public materials but effectively universal in commercial P&C billing platforms of this class and implied by "cash application" automation and STG heritage carriers (Amerisure, Utica) that are lockbox-heavy shops.
- **[Confirmed]** **Multi-currency** billing, reconciliation and reporting across regions (product page; supports Celent's four-region Luminary footprint). Multi-company/multi-entity support is **[Inferred]** from "enterprise billing" positioning and the 52-jurisdiction preconfigured content in the suite graphic.

### 2.4 Cash application & suspense

- **[Confirmed]** Automated **suspense clearing** on reinstatement ("automatic suspense clearing"); "automated rules for **suspense and refund processing**" that also reduce misappropriation opportunities (a fraud/segregation-of-duties control point); **early cash handling** (payments received before invoicing/effective date).
- **[Confirmed]** Spring '25: AI-driven **automated cash allocation, "98% accuracy in cash application,"** powered by DocScribe document interpretation (e.g., reading remittance advices) — directly relevant to commercial agency-bill statements and list-bill remittances.
- **[Confirmed]** Spring '26 agents: **bill validation** and **payment reconciliation**.
- **[Inferred]** Tolerance-based small over/under-payment handling — supported by CoreConnect's "**automated waiving of balances based on rules and tolerances**… regardless of cause" [Confirmed language] which is the write-off/tolerance mechanism.

### 2.5 Endorsements, audits, policy-lifecycle alignment

- **[Confirmed]** Billing aligns with policy lifecycle events — endorsements, cancellations, reinstatements, renewals (FitGap/marketplace description: "aligning billing activities with policy lifecycle events such as endorsements, cancellations, and reinstatements").
- **[Confirmed]** **Premium audit billing**: Majesco's separate **Premium Audit** module (workers' comp exposure/payroll verification) feeds "completed audit results… directly into Majesco Policy and Billing," and agency bill supports "**direct entry of commissionable audit premiums**." This is the core commercial-lines audit-premium flow (estimated vs. final audited premium, audit invoice/return premium).
- **[Inferred]** Endorsement premium spread over remaining installments vs. billed immediately as a configurable option — standard behavior implied by "flexible user-defined payment plans" and moratorium balance-spreading.

### 2.6 Commissions / producer compensation

**[Confirmed — one of the best-documented areas]**
- Rules-based **commission engine** ("Compensation Manager") handling flexible commission contracts and changes; **commission rate table uploads; high-volume compensation processing; automated commission advances; charge-backs on policy events; commission sharing/sacrificing; adjustments**; incentive tracking; commission plans and payment detail.
- CoreConnect adds: commission rates maintained for **MGAs, agencies, subagencies, agents, brokers, attorneys-in-fact**; separate commission records per entity by **written vs. paid** basis; commission variation by **channel, affinity group, payment methodology, product, region, effective dates**; tracking of **appointments, licensure, and E&O status**; **EFT distribution and sweep to agency bank accounts**.
- Agency-bill commission netting (account current) is **[Inferred]** from the Agency Account Current bill type + commission engine.

### 2.7 Delinquency, cancellation, reinstatement, collections

- **[Confirmed]** Delinquency handling, cancellation for non-payment, and **automatic reinstatement following late payments** ("enhances customer retention"); configurable **fees, late charges, and collections** with automation; **moratorium** management (full/partial extension or shortening per regulatory announcements — critical for admitted commercial lines in regulated states).
- **[Confirmed]** Embedded analytics monitor **delinquency risk, cash-flow trends, and promise-to-pay** (product page) — implying promise-to-pay tracking exists as a servicing construct.
- **[Inferred]** Jurisdiction-specific notice timing (days of notice by state/line) — implied by "52 jurisdictions" preconfigured suite content and admitted-market operation, not explicitly documented for billing.

### 2.8 Refunds, disbursements, write-offs, NSF

- **[Confirmed]** Refunds are part of the automated lifecycle with **automated refund rules**; **write-offs** are supported and now AI-assisted — Majesco claims an **interactive dialog write-off completes "in less than 30 seconds compared to the 3-5 minutes" in the traditional UI**, and AI Agents handle "repetitive actions such as **write-offs, refunds, and hold-and-release decisions**" (hold-and-release = disbursement approval holds).
- **[Inferred]** NSF/returned-payment handling with fee assessment and payment reversal — not found verbatim publicly, but implied by ACH/card processing, "fees, late charges" configurability, and standard P&C billing scope. Treat as near-certain but unconfirmed.
- **[Inferred]** Escheatment (unclaimed property) processing — no public evidence found; enterprise billing systems of this class typically support stale-check/escheat workflows, and the disbursement "hold-and-release" mechanism is a prerequisite. Flag as unverified.

### 2.9 Reconciliation, GL, financial controls

- **[Confirmed]** v12: **auto-reconciliation and balancing that "automatically reconciles the trial balance, including general ledger feeds daily."** CoreConnect: data analytics/reporting "for month-end balancing"; a "cutting-edge **data warehouse**… central storage of insurance premium data."
- **[Confirmed]** Fraud/misappropriation controls via automated suspense/refund rules; AI-powered validation and "dynamic controls" with real-time KPI visibility at each batch step.
- **[Inferred]** Configurable GL chart-of-accounts mapping per transaction type/company/state — implied by daily GL feed and multi-entity positioning.
- **[Inferred]** Taxes & surcharges billing (state surcharges, WC second-injury funds, etc.) — implied by admitted commercial-lines support and fee configurability; not explicitly documented publicly.

### 2.10 Digital self-service & engagement

- **[Confirmed]** **Digital Electronic Bill360 for P&C**: self-registration, guest pay, multi-policy management, one-time + recurring payments, payment history, bill status, upcoming due dates, transparent transaction breakdowns, branded/dynamic UI, 24/7. Agent and insured self-service with "behind-the-scenes checks and balances" over electronic payments. Portal & mobile access; Insured Portal (CoreConnect) responsive billing experience (Spring '25). **Glovebox** integration for consolidated policy+billing views.
- **[Confirmed]** **Copilot in Billing**: conversational data retrieval, payment-data requests, billing service inquiries; drafts customer/agency outreach; triggers follow-ups; payment allocation and exception-resolution assistance.

---

## 3. Screens / UI Inventory

**Important caveat [Confirmed by absence]:** Majesco does not publish a public user guide, manual, or screen catalog for Billing for P&C; no public demo transcript enumerating screens was found. The inventory below therefore separates the handful of **screen/workspace names with direct public evidence** from a **standard screen inventory inferred** from Majesco's own feature language (each inferred screen is anchored to a confirmed capability that necessarily has a UI surface).

### 3.1 Evidenced UI surfaces [Confirmed]

| Surface | Evidence & purpose |
|---|---|
| **Majesco Copilot pane (in Billing)** | Copilot "embedded in core screens"; chat-style retrieval of billing/payment data, correspondence drafting, follow-up triggers |
| **Interactive write-off dialog** | Product page: dialog-driven write-off "in less than 30 seconds" vs. 3-5 min in the traditional UI — confirms both a conversational flow and a legacy multi-step write-off screen |
| **Compensation Manager** | Named module/workspace for commission plans, rate-table upload, advances, charge-backs, adjustments |
| **Configuration Toolset / Dev Studio** | Business-user configuration environment for rules, payment plans, templates, forms (Dev Studio form building cited at 2-15 min per form) |
| **Batch processing monitor** | "Real-time KPI visibility at each processing step" for high-throughput batch operations |
| **Pre-built BI dashboards & reports** | Spring '25 embedded BI reports for Billing; Power BI library (Fall '25); telemetry dashboards; "best-practice dashboards," A/R views "with a special focus on problem accounts" |
| **Agent/producer 360° digital experience** | v11 R2: "real-time 360° view of their entire book of business" for agents |
| **Bill360 policyholder portal screens** | Registration/login, guest payment, payment entry (card/bank), AutoPay enrollment, payment history, bill status, upcoming due dates, multi-policy view |
| **API Catalog / EcoExchange marketplace** | Admin-facing catalogs for integrations |

### 3.2 Inferred standard screen inventory [Inferred — from confirmed capabilities + P&C billing convention]

Grouped by function; each entry names the capability evidence that makes the screen necessary:

**Account & inquiry**
- **Billing Account Overview / Account Inquiry** — account-level balance, policies on account, next bill/due, plan, delinquency status (from account/consolidated billing, "one bill across policies").
- **Policy Billing Inquiry** — per-policy schedule of invoices, installments, transactions (from installment plans, lifecycle alignment).
- **Invoice / Statement Detail** — line-item premium, fees, taxes, prior balance (from invoicing + "transparent transaction breakdowns").
- **Payment Plan / Schedule Maintenance** — change plan, due-day election, respread balances (from user-defined plans, due-date choice, moratorium respread).

**Money in**
- **Payment Entry (single) & Batch Cash Entry** — manual/CSR payments; batch/lockbox posting (from cash application + high-volume batch claims).
- **Cash Application / Allocation Workbench** — apply/reallocate cash, AI-suggested allocation, exception queue (from 98% auto cash application + Copilot "payment allocation, exception resolution").
- **Suspense Management** — unapplied cash queue with auto-clear rules (from "automatic suspense clearing," "automated rules for suspense").
- **NSF / Payment Reversal processing** — reverse payments, assess fees (inferred, see 2.8).

**Agency bill**
- **Agency Statement / Account Current Reconciliation** — statement generation, agency remittance matching, item-level clear/dispute (from Agency Statement + Account Current bill types).
- **Audit Premium Entry** — "direct entry of commissionable audit premiums" (screen strongly implied by that exact phrase).

**Money out**
- **Disbursement / Refund Queue with Hold-and-Release approval** — refund generation, approval thresholds, release (from automated refund rules + "hold-and-release decisions").
- **Commission Statement & Payment screens** — statements per producer entity, EFT sweep setup (from Compensation Manager + EFT sweep).

**Delinquency & servicing**
- **Delinquency / Collections Workbench** — accounts in dunning, notice history, promise-to-pay records (from delinquency automation + promise-to-pay monitoring).
- **Cancellation / Reinstatement processing screens** — non-pay cancellation initiation and reinstatement with suspense clear (from lifecycle automation).
- **Moratorium administration** — define/extend/shorten moratoria by jurisdiction (from COVID-era moratorium releases).
- **Write-off screen (traditional) + tolerance rules config** (from write-off dialog comparison + balance-waiving rules).

**Financial close**
- **Trial Balance / GL Reconciliation views** — daily auto-reconciliation outputs, month-end balancing (from v12 auto-reconciliation).
- **Day-end/batch job console** (from batch KPI monitoring).

---

## 4. Technical Architecture

- **[Confirmed]** **Cloud-native, API-first**; since v12 (Nov 2021) the P&C Core Suite is packaged as **Docker images orchestrated with Kubernetes and deployed via Helm charts**. Delivery is SaaS on **Majesco CloudInsurer® / "Majesco Cloud"** (historically also on-premise/hosted). Majesco Copilot is built on **Microsoft Azure OpenAI Service** (deep Microsoft collaboration ⇒ Azure is the cloud substrate for the AI layer; **[Inferred]** Azure hosting generally).
- **[Confirmed]** **APIs**: "robust API support for a vast array of billing transaction types"; **200+ OpenAPI (OAS) 3.0 APIs** added in v11 R2 plus a "**no-code API framework**"; an **API Catalog** is part of the platform ring; Fall '24 delivered 20-30% faster API calls. SOAP is not mentioned in current materials (**[Inferred]** legacy SOAP/XML interfaces likely persist from the STG era but are unverified).
- **[Confirmed]** **Configuration**: business-user rules configuration ("business rules, payment plans, templates and forms… modern architecture built on open standards"); changes "that previously took weeks or months… configured in hours"; **Dev Studio** for forms; suite manages "4,000+ forms, 14,000 data fields, 40,000 rules"; preconfigured content for **52 jurisdictions** with monthly content updates; ISO/NCCI bureau content embedded (policy-side but suite-shared).
- **[Confirmed]** **Rules engine**: rules-based commission engine; rules/tolerance-driven waivers, suspense, refunds; "AI-powered validation and dynamic controls."
- **[Confirmed]** **Data & analytics**: pre-integrated **Majesco EDW** and **Majesco Business Analytics**; pre-configured metadata mapping, standard reports, dashboards; embedded BI (Spring '25) and a **Power BI library** (Fall '25); telemetry dashboards; CoreConnect central premium **data warehouse**.
- **[Confirmed]** **AI stack**: Majesco Copilot (multi-modal, GenAI); **DocScribe** document-ingestion engine (200+ page files, sentence-level citations); 26 AI Agents across Fall '25 + Spring '26 with "advanced reasoning, human-in-the-loop control, and company-specific guardrails."
- **[Confirmed]** **Ecosystem**: **EcoExchange** marketplace of pre-integrated partner apps (payments: CyberSource; also eSignature, AI/ML, data prefill, risk); named payments partner **InvoiceCloud**; **Glovebox** app integration.
- **[Confirmed]** **Scale**: certified at **100M policies / 1,000 concurrent users** (v11 R2); upgrade windows <10-14 days claimed in '24-'25 releases.
- **[Inferred]** Core application stack Java-based with RDBMS persistence (SQL Server/Oracle options) — consistent with the product's 2000s STG lineage and Celent-report norms, but **no public confirmation found**; treat as unverified.
- **[Confirmed]** Document generation exists at suite level (Dev Studio forms, document management, faster document generation in Fall '25); billing-specific correspondence (invoices, notices) generation is **[Inferred]** to ride the same engine.

---

## 5. Release Notes / Recent Enhancements (billing-focused digest)

Full public release notes are gated behind the **Majesco Product Portal** (customer-only, launched to help customers plan releases); the public digest is:

- **Jul 2020** — monthly-release cadence announced; moratorium leniency automation; post-moratorium balance respread beyond expiry. [Confirmed]
- **Oct 2020 (v11 R2)** — 100M-policy certification; 200+ OAS 3.0 APIs; no-code API framework; agent 360 experience. [Confirmed]
- **Nov 2021 (v12)** — containerization (Docker/K8s/Helm); daily automated trial-balance/GL reconciliation. [Confirmed]
- **Spring '23** — Intelligent Core Suite launch (embedded analytics/AI direction). [Confirmed]
- **Nov 2023** — Copilot in Billing (Azure OpenAI): payment-data retrieval, billing service inquiries. [Confirmed]
- **Fall '24** — multi-modal Copilot, automated bill/invoice processing, 20-30% faster APIs, <10-day upgrades. [Confirmed]
- **Spring '25** — AI cash allocation at 98% cash-application accuracy (DocScribe); embedded BI reports for Billing; responsive insured-portal billing. [Confirmed]
- **Fall '25** — six P&C AI Agents spanning quoting, claims triage, **billing, payments**; Power BI library; batch speed-ups. Individual agent names are **not published**. [Confirmed]
- **Spring '26** — Agentic AI across billing/servicing; **bill-validation** and **payment-reconciliation** agents; unified task management across policy/billing/claims. [Confirmed]

---

## 6. Sources

| URL | What it provided |
|---|---|
| https://www.majesco.com/core-software-insurance-solutions/pc-core-suite/billing-for-pc/ | Current product page: bill types, AI agents (write-offs/refunds/hold-and-release), Copilot tasks, multi-currency, EBPP, 30-second write-off dialog claim, delinquency/cash-flow analytics |
| https://www.majesco.com/wp-content/uploads/2020/12/PC-Billing.pdf | 2021 datasheet (read in full): suite wheel with commercial LOBs, all-bill-types text, EBPP, moratorium, Compensation Management detail, configuration, EDW/Business Analytics, CloudInsurer deployment options |
| https://www.majesco.com/wp-content/uploads/2019/03/Majesco-Billing-PC-V1.pdf | 2018 datasheet (read in full): 160+ billing customers, cross-suite bill consolidation (P&C/L&A/Group), business-value bullets, module ring (EBPP, Compensation Manager, Portal & Mobile, Reporting, Configuration Toolset) |
| https://www.majesco.com/core-software-insurance-solutions/pc-coreconnect/coreconnect-billing-for-pc/ | CoreConnect Billing: consolidated bill, unlimited plans, equity calculations, suspense/refund rules, tolerance-based waivers, commission entity model (MGA→attorney-in-fact), written-vs-paid, EFT sweep, data warehouse, API support, MGA/MGU target |
| https://www.majesco.com/digital-solutions-insurance-solutions/digital-360-solutions/digital-electronic-bill360-for-pc/ | Bill360 EBPP portal features, CyberSource pre-integration, MMG Insurance quote |
| https://www.majesco.com/core-software-insurance-solutions/pc-core-suite/ | Suite architecture: API-first, containerization, no-code API framework, Dev Studio metrics, EcoExchange, embedded analytics, Copilot in core screens |
| https://insurancenewsnet.com/oarticle/majescos-billing-for-pc-solution-earns-top-luminary-recognition-by-celent-across-four-regions-powering-global-insurance-innovation | Celent Luminary (June 2023) four regions; capability highlights; 350+ insurers / 900+ implementations |
| https://www.majesco.com/press/announcing-general-availability-of-version-11-r2-of-the-market-leading-majesco-pc-core-suite/ | v11 R2: 100M-policy certification, 200+ OAS 3.0 APIs, no-code framework, moratorium/CAT controls, agent 360 |
| https://www.majesco.com/videos/majesco-pc-core-suite-version-12-capabilities/ | v12 GA date; Docker/Kubernetes/Helm re-architecture; daily trial-balance/GL auto-reconciliation |
| Nasdaq press release (Jul 2020, via search snippets) | Monthly-release model; moratorium enhancements incl. balance respread beyond expiry |
| https://www.majesco.com/press/majesco-unveils-majesco-copilot-a-breakthrough-in-insurance-solutions/ | Copilot on Azure OpenAI; Copilot-in-Billing scope |
| https://www.majesco.com/product-release-fall-24/ | Fall '24: bill/invoice automation, API speed-ups, <10-day upgrades |
| https://www.majesco.com/product-release-spring-25/ | Spring '25: 98% cash application, DocScribe, embedded BI for Billing |
| https://www.majesco.com/press/majesco-launches-fall-25-release-with-ai-agents-to-transform-intelligent-insurance-operations/ | Fall '25: 13 AI agents, six P&C (billing/payments), reasoning + human-in-the-loop, Power BI library |
| https://www.majesco.com/product-release-spring-26/ | Spring '26: agentic AI in billing, bill-validation & payment-reconciliation agents |
| https://www.majesco.com/press/arch-insurance-live-with-majesco-billing-for-pc-on-majesco-cloudinsurer/ | Arch commercial-lines go-live, 7 months, legacy consolidation |
| https://www.majesco.com/press/tokio-marine-america-upgrades-to-majesco-intelligent-billing-for-pc-on-majesco-cloud/ | Tokio Marine America commercial-lines upgrade; Spring '23 Intelligent suite launch |
| https://www.majesco.com/press/tier-1-global-insurer-selects-majesco-billing-for-small-commercial-products/ | Small-commercial greenfield selection (2018); bill-type list; 35 cloud customers |
| STG press pages (majesco.com/press: Catholic Mutual, Utica National, Nautilus, US Assure, Amerisure) | STG Billing lineage, 2007-08 acquisition (~$29M), Celent Model Carrier 2009 / XCelent 2012, early customer base |
| https://www.majesco.com/risk-compliance-insurance-solutions/risk-management/premium-audit/ | Premium Audit results flowing into Policy and Billing (audit-premium billing chain) |
| https://invoicecloud.net/partner/majesco | InvoiceCloud partnership (integrated billing+payments) |
| https://www.g2.com/products/majesco-billing-for-p-c/reviews | Bill-type list; single 1.5-star enterprise review (cost, customization dependence) |

**Blocked/unavailable:** Microsoft Marketplace/AppSource listings (403), Businesswire (timeouts), Gartner Peer Insights (not fetched), FitGap (404), Celent full report (paywalled). No public user guide, manual, or screen catalog exists; Section 3.2 and every **[Inferred]** tag should be validated against Majesco's customer-only Product Portal or a live demo before being treated as fact.
