// VS-01..VS-07 (Defect-Tracker-v6) — "full sweep": pull apart the placeholder
// L4 sub-processes whose single bundled row collapsed several genuinely distinct
// disciplines ("process should never be combined"). Each flagged L3 currently
// holds ONE L4 named "A, B and C" with only generic lifecycle L5 steps. This
// replaces that bundle with one L4 per discipline, each carrying researched,
// discipline-specific L5 steps.
//
// Scope is deliberately limited to the bundles the user flagged and the streams
// those rows cover. L4s that are a single coherent process (e.g. "FNOL capture
// and triage", "Endorsements, cancellations and renewals") are left alone —
// splitting a real single process would be wrong.
//
// Each L4/L5 is written across the three parallel models so every surface
// reflects it (per the read-path audit):
//   • SubValueStream  L4 (level 4) + L5 (level 5)        → Value Streams detail page
//   • ProcessStep     one per L5 (l3,l4,name,leads…)     → Work tab tasks + sidebar
//   • Node graph      sub_process node (code=L4 SVS id)  → Map / chevrons + Home counts
//                     + step node (code=ProcessStep id)
// The Level tree is a legacy catalog (map reads the Node graph), so it is left
// untouched, matching how split-value-streams.ts treats downstream surfaces.
//
// Idempotent: an L3 whose new L4s already exist and whose old bundle is gone is
// skipped. Transaction per L3. Run from backend/:
//   npx tsx scripts/separate-process-areas.ts
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type NewL4 = { name: string; lead: string; l5s: string[] };
type Separation = { stream: string; l3: string; replace: string[]; into: NewL4[] };

// Researched separations. `replace` = exact name(s) of the bundled L4(s) to
// remove from that L3; `into` = the discipline L4s that take their place. Any
// other L4 already under the L3 (e.g. Escheatment, DSAR) is left in place.
const PLAN: Separation[] = [
  // ── VS-01 Actuarial Capital Modeling ──────────────────────────────────────
  // "Capital adequacy, stress and catastrophe modeling" = three actuarial
  // modeling disciplines (Solvency II SCR / NAIC RBC capital; ORSA stress &
  // reverse-stress; nat-cat accumulation). Different teams, cadence, outputs.
  {
    stream: 'Actuarial Capital Modeling', l3: 'Capital Modeling',
    replace: ['Capital adequacy, stress and catastrophe modeling'],
    into: [
      { name: 'Economic & Regulatory Capital Modeling', lead: 'Capital Actuary', l5s: [
        'Define Capital Model Scope & Assumptions',
        'Calculate Required & Available Capital (SCR / RBC)',
        'Produce ORSA Capital Assessment Inputs',
        'Validate Capital Model & Document Results',
        'Approve & Report Capital Position',
      ] },
      { name: 'Stress & Scenario Testing', lead: 'Capital Actuary', l5s: [
        'Design Stress & Reverse-Stress Scenario Suite',
        'Run Stress & Scenario Calculations',
        'Analyze Capital Impact & Management Actions',
        'Report Stress Results to Risk Committee & Board',
      ] },
      { name: 'Catastrophe Modeling', lead: 'Catastrophe Modeling Analyst', l5s: [
        'Prepare & Cleanse Exposure Data',
        'Run Nat-Cat & Man-Made Cat Models',
        'Analyze PML, AAL & Accumulations',
        'Inform Reinsurance & Capital Decisions',
      ] },
    ],
  },
  // ── VS-02 Treasury & Liquidity ────────────────────────────────────────────
  // "Cash, liquidity and funding management" — three distinct treasury desks.
  {
    stream: 'Treasury & Liquidity', l3: 'Treasury & Liquidity',
    replace: ['Cash, liquidity and funding management'],
    into: [
      { name: 'Cash & Bank Management', lead: 'Treasury Analyst', l5s: [
        'Capture & Position Daily Cash Balances',
        'Execute Payments & Screen Outbound Treasury Payments Against Sanctions Lists',
        'Manage Bank Accounts & Connectivity',
        'Reconcile Cash & Resolve Breaks',
      ] },
      { name: 'Liquidity Management', lead: 'Treasury Manager', l5s: [
        'Forecast Short- & Long-Term Liquidity',
        'Monitor Liquidity Buffers & Limits',
        'Manage Collateral & Stress Liquidity',
        'Report Liquidity Position & Coverage',
      ] },
      { name: 'Funding & Capital Markets', lead: 'Treasury Manager', l5s: [
        'Assess Funding Needs & Options',
        'Execute Funding, Debt Issuance & Repo',
        'Manage Intercompany & FX Funding',
        'Monitor Funding Costs & Covenant Compliance',
      ] },
    ],
  },
  // ── VS-02 Capital Management ───────────────────────────────────────────────
  // "Capital actions, tax and solvency reporting" — three owners (CFO capital,
  // Tax, Regulatory reporting). Escheatment L4 is left untouched.
  {
    stream: 'Capital Management', l3: 'Capital, Tax & Regulatory',
    replace: ['Capital actions, tax and solvency reporting'],
    into: [
      { name: 'Capital Planning & Actions', lead: 'Head of Capital Management', l5s: [
        'Assess Capital Position vs Appetite',
        'Project Capital Needs & Run Capital Plan',
        'Allocate Capital Across Business Units',
        'Execute Capital Actions (Dividends / Issuance)',
        'Monitor Capital Utilization',
      ] },
      { name: 'Tax Provision & Filings', lead: 'Tax Manager', l5s: [
        'Compute Current & Deferred Tax',
        'Prepare Tax Provision & Premium Tax Filings',
        'File Returns & Manage Tax Audits',
        'Reconcile Tax Accounts & Disclosures',
      ] },
      { name: 'Solvency & Regulatory Reporting', lead: 'Regulatory Reporting Manager', l5s: [
        'Compile Solvency & Capital Data',
        'Prepare Statutory & Solvency Returns',
        'Validate & Sign-Off Regulatory Filings',
        'Report to Regulators',
      ] },
    ],
  },
  // ── VS-03 Privacy & Data Protection ───────────────────────────────────────
  // "Privacy review and data handling guidance" — assessment (DPIA/audit) vs
  // advisory are distinct DPO activities. DSAR L4 left untouched.
  {
    stream: 'Privacy & Data Protection', l3: 'Privacy & Data Advice',
    replace: ['Privacy review and data handling guidance'],
    into: [
      { name: 'Privacy Reviews & Impact Assessments', lead: 'Privacy Officer', l5s: [
        'Scope Privacy Review / DPIA',
        'Assess Processing Against Privacy Law',
        'Identify & Mitigate Privacy Risks',
        'Document Findings & Approve',
        'Track Remediation to Closure',
      ] },
      { name: 'Data Handling Guidance & Advisory', lead: 'Privacy Officer', l5s: [
        'Intake & Triage Privacy Advisory Request',
        'Provide Data-Handling & Consent Guidance',
        'Maintain Privacy Policies & Standards',
        'Deliver Privacy Training & Awareness',
      ] },
    ],
  },
  // ── VS-04 Compliance & Regulatory ─────────────────────────────────────────
  // "Action tracking and governance reporting" — remediation tracking vs MI/board
  // reporting. Plus issue-response vs regulator-engagement in the sibling L3.
  {
    stream: 'Compliance & Regulatory', l3: 'Remediation & Reporting',
    replace: ['Action tracking and governance reporting'],
    into: [
      { name: 'Remediation Action Tracking', lead: 'Compliance Manager', l5s: [
        'Log Issues & Assign Action Owners',
        'Track Remediation Actions to Closure',
        'Validate Evidence & Close Actions',
        'Escalate Overdue & At-Risk Items',
      ] },
      { name: 'Compliance Governance & Reporting', lead: 'Head of Compliance', l5s: [
        'Aggregate Compliance MI & Metrics',
        'Prepare Governance & Committee Reports',
        'Maintain Compliance Risk Register',
        'Report to Board & Regulators',
      ] },
    ],
  },
  {
    stream: 'Compliance & Regulatory', l3: 'Incident & Regulatory Response',
    replace: ['Issue response and regulator engagement'],
    into: [
      { name: 'Compliance Issue Response', lead: 'Compliance Manager', l5s: [
        'Intake & Triage Compliance Issue',
        'Investigate & Assess Potential Breach',
        'Determine & Execute Response',
        'Capture Lessons & Update Controls',
      ] },
      { name: 'Regulator Engagement & Exams', lead: 'Head of Compliance', l5s: [
        'Manage Regulator Inquiries & Information Requests',
        'Coordinate Market Conduct Exams & MCAS Filings',
        'Prepare Regulatory Submissions & Notifications',
        'Maintain Regulator Relationship & Engagement Log',
      ] },
    ],
  },
  // ── VS-05 Data Management & Governance ────────────────────────────────────
  {
    stream: 'Data Management & Governance', l3: 'Data Product Intake',
    replace: ['Data demand intake and model design'],
    into: [
      { name: 'Data Demand Intake', lead: 'Data Product Owner', l5s: [
        'Receive & Triage Data Demand',
        'Define Data Requirements & Use Case',
        'Prioritize & Approve Data Product',
        'Source & License External Data',
      ] },
      { name: 'Data Modeling & Design', lead: 'Data Architect', l5s: [
        'Design Logical & Physical Data Models',
        'Define Data Product Structure & Contracts',
        'Build & Configure Data Product',
        'Validate & Review Design',
      ] },
    ],
  },
  {
    stream: 'Data Management & Governance', l3: 'Governance & Quality',
    replace: ['Data standards, stewardship and quality control'],
    into: [
      { name: 'Data Standards & Stewardship', lead: 'Data Governance Lead', l5s: [
        'Define Data Standards & Policies',
        'Assign Data Ownership & Stewardship',
        'Maintain Data Catalog & Lineage',
        'Certify Data Sets',
      ] },
      { name: 'Data Quality Management', lead: 'Data Quality Analyst', l5s: [
        'Profile & Monitor Data Quality',
        'Detect & Triage Quality Issues',
        'Remediate Data Quality Issues',
        'Report Data Quality to Governance',
      ] },
    ],
  },
  {
    stream: 'Data Management & Governance', l3: 'Privacy & Access',
    replace: ['Data access, retention and privacy control'],
    into: [
      { name: 'Data Access Management', lead: 'Data Governance Lead', l5s: [
        'Define Access Policies & Entitlements',
        'Provision & Review Data Access',
        'Certify & Revoke Data Access',
      ] },
      { name: 'Data Retention & Privacy Control', lead: 'Data Privacy Steward', l5s: [
        'Define Retention & Privacy Controls',
        'Apply Masking, Minimization & Tokenization',
        'Enforce Retention & Secure Disposal',
        'Report & Remediate Control Gaps',
      ] },
    ],
  },
  // ── VS-05 Analytics & AI (reconcile AI scope vs MLOps) ────────────────────
  {
    stream: 'Analytics & AI', l3: 'Analytics & AI Delivery',
    replace: ['Analytics, MI and model delivery'],
    into: [
      { name: 'Analytics & MI Delivery', lead: 'Analytics Lead', l5s: [
        'Define Analytics & MI Requirements',
        'Build Reports, Dashboards & MI',
        'Validate & Review Outputs',
        'Publish & Operationalize MI',
      ] },
      { name: 'AI & Model Delivery', lead: 'Data Scientist', l5s: [
        'Frame AI Use Case & Success Measures',
        'Develop & Train Models',
        'Validate Models & Hand Off to MLOps',
        'Approve & Publish Model for Deployment',
      ] },
    ],
  },
  // ── VS-06 Technology Strategy & Architecture ──────────────────────────────
  // Solution architecture (per-initiative) vs enterprise architecture (cross-
  // cutting target state) are distinct roles. Strategy/roadmap & platform
  // governance L3s are single coherent processes — left alone.
  {
    stream: 'Technology Strategy & Architecture', l3: 'Architecture Design',
    replace: ['Solution and enterprise architecture design'],
    into: [
      { name: 'Enterprise Architecture', lead: 'Enterprise Architect', l5s: [
        'Maintain Enterprise Architecture & Domain Models',
        'Define Reference & Target-State Architectures',
        'Govern Architecture Compliance & Exceptions',
        'Approve & Publish Architecture Standards',
      ] },
      { name: 'Solution Architecture', lead: 'Solution Architect', l5s: [
        'Define Solution Architecture for Initiative',
        'Assess Options & Architecture Trade-offs',
        'Document & Review Solution Design',
        'Support Delivery Teams Through Build',
      ] },
    ],
  },
  // ── Actuarial Reserving (user 2026-06-17) ─────────────────────────────────
  // Reserve SETTING (quarterly best-estimate production) vs reserve ADEQUACY
  // REVIEW (assurance + Statement of Actuarial Opinion, Appointed Actuary) are
  // distinct — production vs sign-off, different cadence and owner.
  {
    stream: 'Actuarial Reserving', l3: 'Reserving',
    replace: ['Reserve setting and reserve adequacy review'],
    into: [
      { name: 'Reserve Setting & Booking', lead: 'Reserving Actuary', l5s: [
        'Extract & Reconcile Claims Data',
        'Analyze Development Patterns',
        'Select Reserve Estimates',
        'Book Reserves & Document Analysis',
        'Present Indications to Management',
      ] },
      { name: 'Reserve Adequacy Review & Opinion', lead: 'Appointed Actuary', l5s: [
        'Perform Reserve Adequacy & Roll-Forward Testing',
        'Review by Appointed Actuary',
        'Issue Statement of Actuarial Opinion',
        'Report to Reserve & Audit Committee',
      ] },
    ],
  },
  // (Reinsurance & Retrocession Management gets a full fine-grained PL3→PL5
  //  rebuild in scripts/detail-reinsurance-stream.ts — not L4-level separation.)
  // ── Cybersecurity, Identity & Resilience (user 2026-06-17) ────────────────
  // Distinct security disciplines bundled per L3. Security Design (architecture
  // + control definition) stays as one coherent design process.
  {
    stream: 'Cybersecurity, Identity & Resilience', l3: 'Identity Management',
    replace: ['Provisioning, access review and privileged control'],
    into: [
      { name: 'Access Provisioning & Reviews', lead: 'IAM Analyst', l5s: [
        'Request & Approve Access',
        'Provision Access',
        'Conduct Periodic Access Reviews & Certify',
        'Revoke or Modify Access',
      ] },
      { name: 'Privileged Access Management', lead: 'IAM Engineer', l5s: [
        'Onboard Privileged Accounts to Vault',
        'Broker & Session-Monitor Privileged Access',
        'Rotate Credentials & Enforce Least Privilege',
        'Audit Privileged Activity',
      ] },
    ],
  },
  {
    stream: 'Cybersecurity, Identity & Resilience', l3: 'Resilience & Recovery',
    replace: ['BCP, DR and resilience validation'],
    into: [
      { name: 'Business Continuity Planning', lead: 'Resilience Manager', l5s: [
        'Conduct Business Impact Analysis',
        'Develop & Maintain Continuity Plans',
        'Exercise Continuity Scenarios',
        'Report Continuity Readiness',
      ] },
      { name: 'Disaster Recovery & Resilience Testing', lead: 'Disaster Recovery Engineer', l5s: [
        'Define Recovery Objectives (RTO / RPO)',
        'Maintain DR Runbooks & Replication',
        'Execute DR & Failover Tests',
        'Validate Recovery & Remediate Gaps',
      ] },
    ],
  },
  {
    stream: 'Cybersecurity, Identity & Resilience', l3: 'Threat & Vulnerability Management',
    replace: ['Vulnerability management and penetration testing'],
    into: [
      { name: 'Vulnerability Management', lead: 'Security Analyst', l5s: [
        'Scan & Identify Vulnerabilities',
        'Prioritize by Risk & Exploitability',
        'Remediate & Track to Closure',
        'Report Vulnerability Posture',
      ] },
      { name: 'Penetration Testing', lead: 'Penetration Tester', l5s: [
        'Scope & Plan Penetration Test',
        'Execute Annual & Targeted Penetration Tests',
        'Report Findings & Exploit Paths',
        'Validate Remediation',
      ] },
    ],
  },
  {
    stream: 'Cybersecurity, Identity & Resilience', l3: 'Threat Detection & Response',
    replace: ['Monitoring, incident response and cyber containment'],
    into: [
      { name: 'Security Monitoring & Detection', lead: 'SOC Analyst', l5s: [
        'Monitor Security Events & Telemetry',
        'Tune Detections & Reduce Noise',
        'Detect & Triage Threats',
        'Escalate Confirmed Incidents',
      ] },
      { name: 'Cyber Incident Response', lead: 'Incident Response Lead', l5s: [
        'Investigate & Scope Incident',
        'Contain & Eradicate Threat',
        'Determine Notification Obligations & Escalate to Compliance',
        'Recover Systems & Conduct Post-Incident Review',
      ] },
    ],
  },
];

const STEP_LEAD_FALLBACK = 'Process Owner';

async function applyOne(tx: Prisma.TransactionClient, companyId: string, tenantId: string, sep: Separation) {
  const vs = await tx.valueStream.findFirst({ where: { companyId, name: sep.stream }, select: { id: true } });
  if (!vs) { console.log(`SKIP (stream not found): ${sep.stream}`); return 0; }
  const l3 = await tx.subValueStream.findFirst({ where: { valueStreamId: vs.id, level: 3, name: sep.l3 }, select: { id: true } });
  if (!l3) { console.log(`SKIP (L3 not found): ${sep.stream} / ${sep.l3}`); return 0; }
  const vsNode = await tx.node.findFirst({ where: { companyId, typeKey: 'value_stream', code: vs.id }, select: { id: true } });

  const oldL4s = await tx.subValueStream.findMany({ where: { valueStreamId: vs.id, level: 4, parentId: l3.id, name: { in: sep.replace } }, select: { id: true, name: true } });
  const newExist = await tx.subValueStream.count({ where: { valueStreamId: vs.id, level: 4, parentId: l3.id, name: { in: sep.into.map((n) => n.name) } } });
  if (oldL4s.length === 0 && newExist === sep.into.length) {
    console.log(`SKIP (already applied): ${sep.stream} / ${sep.l3}`);
    return 0;
  }

  // Carry the bundle's lead role onto new steps where the plan didn't override,
  // so role → person drill-down keeps resolving.
  const oldSteps = await tx.processStep.findMany({ where: { valueStreamId: vs.id, l4: { in: sep.replace } }, select: { leads: true } });
  const bundleLead = oldSteps.find((s) => s.leads)?.leads ?? null;

  // sortOrder base for new sub_process nodes (append under the value_stream node).
  let nodeSort = 0;
  if (vsNode) {
    const last = await tx.node.findFirst({ where: { companyId, typeKey: 'sub_process', parentId: vsNode.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    nodeSort = (last?.sortOrder ?? -1) + 1;
  }

  for (const nl4 of sep.into) {
    // Skip a target L4 that already exists (partial prior run).
    const existing = await tx.subValueStream.findFirst({ where: { valueStreamId: vs.id, level: 4, parentId: l3.id, name: nl4.name }, select: { id: true } });
    if (existing) { console.log(`  exists: ${nl4.name}`); continue; }

    const l4row = await tx.subValueStream.create({ data: {
      tenantId, valueStreamId: vs.id, parentId: l3.id, level: 4, name: nl4.name,
      sourceSheet: 'vs-l4-separation',
    } });
    let l4node: { id: string } | null = null;
    if (vsNode) {
      l4node = await tx.node.create({ data: {
        companyId, typeKey: 'sub_process', name: nl4.name, code: l4row.id,
        parentId: vsNode.id, provenance: 'real', sortOrder: nodeSort++,
      } });
    }

    let stepNo = 1;
    let stepSort = 0;
    for (const l5name of nl4.l5s) {
      // SubValueStream L5
      await tx.subValueStream.create({ data: {
        tenantId, valueStreamId: vs.id, parentId: l4row.id, level: 5, name: l5name,
        sourceSheet: 'vs-l4-separation',
      } });
      // ProcessStep (Work tab task)
      const ps = await tx.processStep.create({ data: {
        tenantId, valueStreamId: vs.id, l3: sep.l3, l4: nl4.name, stepNumber: stepNo++,
        name: l5name, leads: nl4.lead || bundleLead || STEP_LEAD_FALLBACK, illustrative: true,
      } });
      // Node step (map / counts), code = ProcessStep id
      if (l4node) {
        await tx.node.create({ data: {
          companyId, typeKey: 'step', name: l5name, code: ps.id,
          parentId: l4node.id, provenance: 'real', sortOrder: stepSort++,
        } });
      }
    }
    console.log(`  + L4 "${nl4.name}" (${nl4.l5s.length} steps)`);
  }

  // Remove the old bundle across all three models.
  for (const old of oldL4s) {
    // sub_process node + its step children (Node tree cascade on delete).
    const node = await tx.node.findFirst({ where: { companyId, typeKey: 'sub_process', code: old.id }, select: { id: true } });
    if (node) await tx.node.delete({ where: { id: node.id } });
    // ProcessStep rows for this bundle (StepAppUsage/StepDeliverable cascade).
    await tx.processStep.deleteMany({ where: { valueStreamId: vs.id, l4: old.name } });
    // SubValueStream L4 (+ L5 children via SubStreamTree cascade).
    await tx.subValueStream.delete({ where: { id: old.id } });
    console.log(`  - removed bundle "${old.name}"`);
  }

  console.log(`Separated ${sep.stream} / ${sep.l3} → ${sep.into.map((n) => n.name).join(' | ')}`);
  return sep.into.length;
}

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, tenantId: true } });
  if (!company) throw new Error('No company');
  let total = 0;
  for (const sep of PLAN) {
    total += await prisma.$transaction((tx) => applyOne(tx, company.id, company.tenantId, sep), { timeout: 60000, maxWait: 15000 });
  }
  console.log(`\nDone. Created ${total} discipline L4s.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });
