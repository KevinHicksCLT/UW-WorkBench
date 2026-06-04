import type { PrismaClient } from '@prisma/client';

// "Evergreen" Application Rationalization Workspace — the full CAPDAN view.
// A company runs many INITIATIVES (one per application/platform being
// rationalized). Each initiative's value stream is split into business-process
// STAGES (the chevron lenses). For each stage, two overlapping brown-field apps
// are decomposed by IT layer into findings, classified CAPDAN
// (Common | Different | Relocate→targetLayer | Eliminate). Kept findings
// normalize into one CAPDAN component per layer, which lands on a GREEN-FIELD
// target that is specific to that IT layer (a React web app for UI, an API
// gateway for Integration, a domain service for Business Service, a data store
// for Data, a platform for Infrastructure). All illustrative=true.

const LAYERS = ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'] as const;
type Layer = (typeof LAYERS)[number];
type Capdan = 'Common' | 'Different' | 'Relocate' | 'Eliminate';

type Item = { name: string; code1: string; code2: string };
type Cat = { category: string; capdan: Capdan; targetLayer?: Layer; approach: string; rationale: string; effort: string; complexity: string; items: Item[] };
type LayerDef = { component: string; pattern: string; targetTech: string; cats: Cat[] };
type Stage = { key: string; name: string; order: number; status: string; base: number; apps: { name: string; techStack: string }[]; layers: Record<Layer, LayerDef> };
type Initiative = { app: string; stages: Stage[] };

// Per-IT-layer green-field profile — drives the layer-appropriate name + stack
// so a UI target is a web app, an Integration target is an API gateway, etc.
const GF: Record<Layer, { suffix: string; kind: string; tech: string; owner: string }> = {
  UI: { suffix: 'Web App', kind: 'Web App', tech: 'React 18 + TypeScript, Module Federation', owner: 'UX Engineering' },
  Integration: { suffix: 'API Gateway', kind: 'API Service', tech: 'Spring Cloud Gateway, Kafka, OpenAPI', owner: 'Integration Squad' },
  'Business Service': { suffix: 'Domain Service', kind: 'Microservice', tech: 'Java 21 / Spring Boot, Drools 8', owner: 'Domain Squad' },
  Data: { suffix: 'Data Store', kind: 'Data Platform', tech: 'Postgres 16, Debezium CDC, Snowflake', owner: 'Data Platform Team' },
  Infrastructure: { suffix: 'Platform & Security', kind: 'Platform', tech: 'OPA, mTLS, OpenTelemetry, Grafana', owner: 'Platform Security' },
};

const LAYER_OFFSET: Record<Layer, number> = { UI: 0.15, Integration: 0, 'Business Service': -0.08, Data: 0.05, Infrastructure: -0.18 };
const KEEP_LADDER = ['Identified', 'In Analysis', 'Normalized', 'In Migration', 'Migrated'];
const ELIM_LADDER = ['Identified', 'In Analysis', 'Normalized', 'In Migration', 'Retired'];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
function statusFor(a: number, t: 'Retain' | 'Eliminate') { const i = Math.min(4, Math.max(0, Math.floor(clamp(a) * 5))); return (t === 'Retain' ? KEEP_LADDER : ELIM_LADDER)[i]; }
const gfStatus = (advance: number) => (advance > 0.66 ? 'Live' : advance > 0.4 ? 'Building' : 'Planned');

const C = (category: string, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat => ({ category, capdan: 'Common', approach, rationale, effort, complexity, items });
const D = (category: string, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat => ({ category, capdan: 'Different', approach, rationale, effort, complexity, items });
const R = (category: string, targetLayer: Layer, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat => ({ category, capdan: 'Relocate', targetLayer, approach, rationale, effort, complexity, items });
const E = (category: string, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat => ({ category, capdan: 'Eliminate', approach, rationale, effort, complexity, items });

const INITIATIVES: Initiative[] = [
  {
    app: 'Underwriting Platform',
    stages: [
      {
        key: 'SUB', name: 'Submission', order: 0, status: 'Migrating', base: 0.62,
        apps: [{ name: 'PolicyPro', techStack: 'C# / .NET 4.7, WebForms, WCF, SQL Server' }, { name: 'QuoteMaster', techStack: 'Java 8, Struts, Oracle, jQuery' }],
        layers: {
          UI: { component: 'UI Components / Fields', pattern: 'Micro-frontend', targetTech: 'React 18 + TypeScript', cats: [
            C('Rendering & layout', 'Rebuild as React components.', 'Carrier-standard capture UI.', 'M', 'Medium', [
              { name: 'ACORD 125 form', code1: 'SubmissionForm.aspx', code2: 'submission.jsp' },
              { name: 'Risk summary panel', code1: 'RiskSummary.ascx', code2: 'riskSummary.tag' }]),
            R('Business validations', 'Integration', 'Move to API-gateway request validation.', 'Validation belongs at the service boundary.', 'M', 'Medium', [
              { name: 'Validate FEIN', code1: 'SubmissionForm.aspx.cs : ValidateFein()', code2: 'SubmitAction.java : validateFein()' },
              { name: 'Validate effective dates', code1: 'SubmissionForm.aspx.cs : ValidateDates()', code2: 'SubmitAction.java : validateDates()' },
              { name: 'Sanctions pre-check', code1: 'SubmissionForm.aspx.cs : Sanctions()', code2: 'SubmitAction.java : sanctions()' }]),
            E('State management', 'Replace with client state + stateless APIs.', 'ViewState / session bloat blocks scale-out.', 'M', 'Medium', [
              { name: 'ViewState cache', code1: 'SubmissionForm.aspx (ViewState)', code2: 'HttpSession (wizard)' }]),
          ] },
          Integration: { component: 'Integration Logic', pattern: 'API gateway + ACL', targetTech: 'Spring Cloud Gateway, Kafka', cats: [
            C('Broker intake', 'Mediate behind the gateway + canonical model.', 'Broker channels must keep working.', 'L', 'High', [
              { name: 'Broker endpoint', code1: 'BrokerService.svc', code2: 'BrokerAction.java' },
              { name: 'ACORD XML parser', code1: 'AcordParser.cs', code2: 'AcordParser.java' }]),
            R('Routing logic', 'Business Service', 'Move triage/decline rules to the domain service.', 'Business rules buried in integration.', 'L', 'High', [
              { name: 'Triage routing', code1: 'BrokerService.svc : Triage()', code2: 'BrokerAction.java : triage()' }]),
          ] },
          'Business Service': { component: 'Business Service Logic', pattern: 'Externalized rules', targetTech: 'Drools 8, Spring Boot', cats: [
            C('Submission rules', 'Externalize to Drools.', 'Core appetite/clearance logic.', 'L', 'High', [
              { name: 'Appetite check', code1: 'AppetiteEngine.cs', code2: 'AppetiteRules.java' },
              { name: 'Clearance / dedup', code1: 'Clearance.cs', code2: 'Clearance.java' }]),
            D('Workflow', 'Configurable workflow per LOB.', 'Final-triage flow varies by line of business.', 'M', 'Medium', [
              { name: 'Final triage workflow', code1: 'FinalTriage.workflow', code2: 'triage.bpmn' }]),
          ] },
          Data: { component: 'Data Schema & Payload', pattern: 'Canonical model + CDC', targetTech: 'Postgres + Snowflake, Debezium', cats: [
            C('Schema', 'Lift to canonical Postgres.', 'Clean 3NF core.', 'L', 'High', [
              { name: 'Submission / risk tables', code1: 'dbo.Submission', code2: 'SUBMISSION (Oracle)' }]),
            E('Batch sync', 'Replace with Debezium CDC.', 'Nightly batch is too slow.', 'M', 'Medium', [
              { name: 'Nightly clearance batch', code1: 'SSIS : ClearanceLoad.dtsx', code2: 'cron : clearance.sh' }]),
          ] },
          Infrastructure: { component: 'Infra Security Rules & Logs', pattern: 'Zero-trust', targetTech: 'OPA, mTLS, OpenTelemetry', cats: [
            C('Security', 'OPA policies + WAF.', 'Keep fine-grained access.', 'M', 'Medium', [
              { name: 'Role authorization', code1: 'web.config (AD)', code2: 'ldap.xml' }]),
            E('Over-provisioning', 'Move to autoscaling.', 'Idle static capacity.', 'M', 'Medium', [
              { name: 'Static VMs', code1: 'vsphere : sub-pool', code2: 'vsphere : qm-pool' }]),
          ] },
        },
      },
      {
        key: 'PQ', name: 'Pricing & Quote', order: 1, status: 'Migrating', base: 0.46,
        apps: [{ name: 'PolicyPro Rating', techStack: 'C# / .NET rating engine, SQL Server' }, { name: 'QuoteMaster', techStack: 'Java 8, Struts, Oracle, jQuery' }],
        layers: {
          UI: { component: 'UI Components / Fields', pattern: 'Micro-frontend', targetTech: 'React 18', cats: [
            C('Rendering & layout', 'Rebuild as React.', 'Broker-trusted quote presentation.', 'M', 'Medium', [
              { name: 'Rating worksheet', code1: 'RatingWorksheet.ascx', code2: 'RatingWorksheet.jsp' },
              { name: 'Quote comparison grid', code1: 'QuoteCompare.ascx', code2: 'QuoteCompare.jsp' }]),
            R('Business validations', 'Integration', 'Move to gateway validation.', 'Pricing validations belong at the boundary.', 'M', 'Medium', [
              { name: 'Validate rating factors', code1: 'Rating.js : validateFactors()', code2: 'rating.js : validateFactors()' },
              { name: 'Min/max premium check', code1: 'Rating.js : checkBounds()', code2: 'rating.js : checkBounds()' }]),
          ] },
          Integration: { component: 'Integration Logic', pattern: 'Events + canonical API', targetTech: 'Kafka, Spring', cats: [
            C('Rating data', 'Events / canonical API.', 'Exposure + bureau feeds.', 'M', 'Medium', [
              { name: 'Exposure load', code1: 'ExposureLoader.cs', code2: 'ExposureLoader.java' },
              { name: 'Bureau rate sync', code1: 'BureauSync.cs', code2: 'BureauSync.java' }]),
            E('Direct DB access', 'Go through the domain service.', 'UI reaches into the DB.', 'M', 'Medium', [
              { name: 'Direct rate reads', code1: 'RateDao.cs', code2: 'RateDao.java' }]),
          ] },
          'Business Service': { component: 'Business Service Logic', pattern: 'Externalized rules', targetTech: 'Drools 8', cats: [
            C('Rating rules', 'Externalize to Drools.', 'Actuarially-validated pricing.', 'L', 'High', [
              { name: 'Base rate calc', code1: 'RatingEngine.cs : CalcBaseRate()', code2: 'RatingEngine.java : calcBase()' },
              { name: 'Rating adjustments', code1: 'RatingEngine.cs : Adjust()', code2: 'RatingEngine.java : adjust()' },
              { name: 'Classify risk', code1: 'RiskClassifier.cs', code2: 'RiskClassifier.java' }]),
            D('Pricing variants', 'Keep as state/LOB config.', 'Rates differ by state and line.', 'M', 'Medium', [
              { name: 'State rate tables', code1: 'RateTables (per state)', code2: 'RATE_TABLE (Oracle)' }]),
          ] },
          Data: { component: 'Data Schema & Payload', pattern: 'Canonical model', targetTech: 'Postgres + Snowflake', cats: [
            C('Schema', 'Map to canonical model.', 'Quote/rate schema.', 'L', 'High', [
              { name: 'Quote schema', code1: 'dbo.Quote', code2: 'QUOTE (Oracle)' }]),
            R('Embedded logic', 'Business Service', 'Extract rules from PL/SQL into the decision service.', 'Pricing logic hidden in the DB.', 'L', 'High', [
              { name: 'Rate logic in procs', code1: 'usp_RateAdjust', code2: 'PKG_RATING.calc' }]),
          ] },
          Infrastructure: { component: 'Infra Security Rules & Logs', pattern: 'Zero-trust', targetTech: 'OPA, OpenTelemetry', cats: [
            C('Security', 'OPA policies.', 'Keep role-based access.', 'M', 'Medium', [
              { name: 'Role authorization', code1: 'web.config', code2: 'ldap.xml' }]),
          ] },
        },
      },
      {
        key: 'POL', name: 'Policy', order: 2, status: 'In Progress', base: 0.36,
        apps: [{ name: 'PolicyPro Policy', techStack: 'C# / .NET 4.7, WCF, SQL Server' }, { name: 'BillCenter', techStack: 'Java, Oracle' }],
        layers: {
          UI: { component: 'UI Components / Fields', pattern: 'Micro-frontend', targetTech: 'React 18', cats: [
            C('Rendering & layout', 'Rebuild as React.', 'Bind/endorsement screens.', 'M', 'Medium', [
              { name: 'Bind screen', code1: 'BindPolicy.aspx', code2: 'invoice.jsp' }]),
            R('Business validations', 'Business Service', 'Enforce pre-bind/reg checks server-side.', 'Regulated checks must be server-side.', 'M', 'Medium', [
              { name: 'Pre-bind re-validation', code1: 'BindPolicy.aspx.cs : PreBind()', code2: 'BindAction.java : preBind()' },
              { name: 'Reg-reporting completeness', code1: 'BindPolicy.aspx.cs : RegCheck()', code2: 'BillAction.java : regCheck()' }]),
          ] },
          Integration: { component: 'Integration Logic', pattern: 'Event-driven', targetTech: 'Kafka', cats: [
            C('Billing integration', 'Event-driven via Kafka.', 'Decouple billing/payments.', 'M', 'Medium', [
              { name: 'Billing API', code1: 'BillingClient.cs', code2: 'BillingClient.java' }]),
            E('Persistence in adapter', 'Publish events instead.', 'Adapter writes policy rows directly.', 'M', 'Medium', [
              { name: 'Direct policy writes', code1: 'BillingClient.cs : WritePolicy()', code2: 'BillDao.java : write()' }]),
          ] },
          'Business Service': { component: 'Business Service Logic', pattern: 'Domain service', targetTech: 'Spring Boot', cats: [
            C('Policy rules', 'Policy domain service.', 'Bind/collection/reporting logic.', 'L', 'High', [
              { name: 'Bind logic', code1: 'BindEngine.cs', code2: 'BindEngine.java' },
              { name: 'Premium collection', code1: 'Collections.cs', code2: 'Collections.java' }]),
            D('Approval workflow', 'Configurable approval/referral flow.', 'Referral paths vary by authority.', 'M', 'Medium', [
              { name: 'Approval flow', code1: 'Approval.workflow', code2: 'approval.bpmn' }]),
          ] },
          Data: { component: 'Data Schema & Payload', pattern: 'Canonical model', targetTech: 'Postgres', cats: [
            C('Schema', 'Canonical policy model.', 'Policy + ledger schema.', 'L', 'High', [
              { name: 'Policy schema', code1: 'dbo.Policy', code2: 'POLICY (Oracle)' }]),
            R('Logic in triggers', 'Business Service', 'Move reg-reporting logic out of triggers.', 'Hidden logic in DB triggers.', 'L', 'High', [
              { name: 'Reg-reporting trigger', code1: 'TR_PolicyReg', code2: 'TRG_REG (Oracle)' }]),
          ] },
          Infrastructure: { component: 'Infra Security Rules & Logs', pattern: 'Zero-trust', targetTech: 'OPA, mTLS', cats: [
            C('Security', 'OPA + field encryption.', 'PII access controls.', 'M', 'Medium', [
              { name: 'PII access controls', code1: 'PiiPolicy.config', code2: 'pii.xml' }]),
          ] },
        },
      },
      {
        key: 'FRM', name: 'Forms & Content Mgmt', order: 3, status: 'In Progress', base: 0.28,
        apps: [{ name: 'PolicyPro Forms', techStack: 'C# / .NET, OpenText' }, { name: 'DocGen', techStack: 'Java, OpenText' }],
        layers: {
          UI: { component: 'UI Components / Fields', pattern: 'Micro-frontend', targetTech: 'React 18', cats: [
            C('Rendering & layout', 'Rebuild as React.', 'Forms preview/selection UI.', 'M', 'Medium', [
              { name: 'Forms preview', code1: 'FormsPreview.aspx', code2: 'preview.jsp' }]),
            R('Formatting logic', 'Business Service', 'Move merge/clause assembly into the Content service.', 'Document assembly leaked into the UI.', 'M', 'Medium', [
              { name: 'Field-merge logic', code1: 'FormsPreview.aspx.cs : Merge()', code2: 'PreviewAction.java : merge()' }]),
          ] },
          Integration: { component: 'Integration Logic', pattern: 'APIs / events', targetTech: 'Kafka, REST', cats: [
            C('Content delivery', 'Delivery + e-sign via APIs.', 'Standardize delivery channels.', 'M', 'Medium', [
              { name: 'Delivery API', code1: 'DeliveryClient.cs', code2: 'DeliveryClient.java' }]),
          ] },
          'Business Service': { component: 'Business Service Logic', pattern: 'Template engine', targetTech: 'Spring Boot', cats: [
            C('Forms rules', 'Content service (template engine).', 'Template selection + generation.', 'L', 'High', [
              { name: 'Template selection', code1: 'TemplateSelector.cs', code2: 'TemplateSelector.java' },
              { name: 'Clause assembly', code1: 'ClauseEngine.cs', code2: 'ClauseEngine.java' }]),
            D('Document variants', 'Keep as template config.', 'State-specific form variants.', 'M', 'Medium', [
              { name: 'State form variants', code1: 'Templates/states/*', code2: 'templates/states/*' }]),
          ] },
          Data: { component: 'Data Schema & Payload', pattern: 'Canonical store', targetTech: 'Object storage + Postgres', cats: [
            C('Storage', 'Canonical content store.', 'Document storage schema.', 'M', 'Medium', [
              { name: 'Policy/forms storage', code1: 'OpenText : policies', code2: 'OpenText : docs' }]),
            E('Hard-coded config', 'Externalize to a template registry.', 'Template paths hard-coded.', 'S', 'Low', [
              { name: 'Hard-coded paths', code1: 'FormsConfig.cs', code2: 'forms.properties' }]),
          ] },
          Infrastructure: { component: 'Infra Security Rules & Logs', pattern: 'Zero-trust', targetTech: 'OPA', cats: [
            C('Security', 'OPA + document ACLs.', 'Document access controls.', 'M', 'Medium', [
              { name: 'Document access controls', code1: 'OpenText ACLs', code2: 'OpenText ACLs' }]),
          ] },
        },
      },
    ],
  },
  {
    app: 'Claims Platform',
    stages: [
      {
        key: 'CFNOL', name: 'FNOL Intake', order: 0, status: 'In Progress', base: 0.38,
        apps: [{ name: 'ClaimsLegacy', techStack: 'COBOL / CICS, DB2, 3270' }, { name: 'FNOL Portal', techStack: 'PHP, Laravel, MySQL' }],
        layers: {
          UI: { component: 'UI Components / Fields', pattern: 'Micro-frontend + mobile', targetTech: 'React + React Native', cats: [
            C('Loss capture forms', 'Rebuild as React/React Native.', 'Structured FNOL capture to keep.', 'M', 'Medium', [
              { name: 'Loss details form', code1: 'fnol.jsp', code2: 'LossForm.blade.php' }]),
            R('Business validations', 'Integration', 'Move to gateway validation.', 'Validation belongs at the boundary.', 'M', 'Medium', [
              { name: 'Coverage-in-force check', code1: 'FnolAction.java : coverageCheck()', code2: 'FnolController.php : coverage()' }]),
            E('Green-screen entry', 'Replace with web/mobile capture.', '3270 terminal entry is slow.', 'L', 'High', [
              { name: '3270 intake map', code1: 'CICS : FNOLMAP', code2: '—' }]),
          ] },
          Integration: { component: 'Integration Logic', pattern: 'Event-driven + ACL', targetTech: 'Kafka, NestJS', cats: [
            C('Coverage lookup', 'ACL to policy admin.', 'Coverage verification at intake.', 'M', 'Medium', [
              { name: 'Policy coverage lookup', code1: 'CICS coverage txn', code2: 'curl policy-api' }]),
            R('Routing logic', 'Business Service', 'Move assignment rules to the domain service.', 'Routing buried in the ESB.', 'L', 'High', [
              { name: 'Claim routing', code1: 'ESB : routeClaim', code2: 'FnolController.php : route()' }]),
          ] },
          'Business Service': { component: 'Business Service Logic', pattern: 'BPMN + DMN rules', targetTech: 'Camunda 8, Spring Boot', cats: [
            C('Triage rules', 'Externalize to DMN.', 'Fast-track vs complex routing.', 'L', 'High', [
              { name: 'Claim triage', code1: 'TriageCopybook', code2: 'TriageService.php' }]),
          ] },
          Data: { component: 'Data Schema & Payload', pattern: 'Canonical model + CDC', targetTech: 'Postgres, Debezium', cats: [
            C('Schema', 'Lift to canonical claim model.', 'Claim/loss event schema.', 'L', 'High', [
              { name: 'Claim tables', code1: 'DB2.CLAIM', code2: 'mysql.claim' }]),
            E('VSAM extracts', 'Replace with CDC.', 'Nightly flat-file extracts.', 'L', 'High', [
              { name: 'Nightly VSAM extract', code1: 'VSAM : CLMEXT', code2: '—' }]),
          ] },
          Infrastructure: { component: 'Infra Security Rules & Logs', pattern: 'Zero-trust', targetTech: 'OPA, field encryption', cats: [
            C('PII controls', 'OPA + field encryption.', 'Claimant PII protection.', 'M', 'Medium', [
              { name: 'PII access policy', code1: 'RACF rules', code2: 'pii.php' }]),
          ] },
        },
      },
      {
        key: 'CADJ', name: 'Adjudication & Payment', order: 1, status: 'In Progress', base: 0.3,
        apps: [{ name: 'ClaimCenter', techStack: 'Java, Oracle' }, { name: 'PayHub', techStack: 'C# / .NET, SQL Server' }],
        layers: {
          UI: { component: 'UI Components / Fields', pattern: 'Micro-frontend', targetTech: 'React 18', cats: [
            C('Adjuster workspace', 'Rebuild as React.', 'Adjuster review screens.', 'M', 'Medium', [
              { name: 'Claim review screen', code1: 'review.jsp', code2: 'Payment.aspx' }]),
          ] },
          Integration: { component: 'Integration Logic', pattern: 'Event-driven', targetTech: 'Kafka', cats: [
            C('Payment integration', 'Event-driven payments.', 'Decouple disbursement.', 'M', 'Medium', [
              { name: 'Disbursement API', code1: 'PayClient.java', code2: 'PayClient.cs' }]),
          ] },
          'Business Service': { component: 'Business Service Logic', pattern: 'Domain service + rules', targetTech: 'Spring Boot, Drools', cats: [
            C('Reserving rules', 'Externalize reserving logic.', 'Regulated reserving.', 'L', 'High', [
              { name: 'Reserve calc', code1: 'ReserveEngine.java', code2: 'ReserveCalc.cs' }]),
            D('Settlement workflow', 'Configurable settlement flow.', 'Settlement varies by claim type.', 'M', 'Medium', [
              { name: 'Settlement workflow', code1: 'settle.bpmn', code2: 'Settle.workflow' }]),
          ] },
          Data: { component: 'Data Schema & Payload', pattern: 'Canonical model', targetTech: 'Postgres', cats: [
            C('Claim ledger', 'Canonical ledger model.', 'Payment/reserve ledger.', 'L', 'High', [
              { name: 'Ledger schema', code1: 'CLAIM_TXN (Oracle)', code2: 'dbo.PayTxn' }]),
          ] },
          Infrastructure: { component: 'Infra Security Rules & Logs', pattern: 'Zero-trust', targetTech: 'OPA, OpenTelemetry', cats: [
            C('Audit logging', 'OpenTelemetry + SIEM.', 'Payment audit trail.', 'M', 'Medium', [
              { name: 'Payment audit log', code1: 'AuditLog.java', code2: 'AuditLog.cs' }]),
          ] },
        },
      },
    ],
  },
];

export async function seedRationalization(prisma: PrismaClient, ctx: { tenantId: string; companyId: string }) {
  const { tenantId, companyId } = ctx;
  await prisma.rationalizationWorkspace.deleteMany({ where: { companyId } });

  const wsRows: any[] = [], appRows: any[] = [], svcRows: any[] = [], compRows: any[] = [], capRows: any[] = [];

  for (const initiative of INITIATIVES) {
    for (const stage of initiative.stages) {
      const wsId = `rw_${stage.key}`;
      wsRows.push({ id: wsId, tenantId, companyId, name: stage.name, application: initiative.app, stageOrder: stage.order,
        businessProcess: stage.name, description: `Rationalize the "${stage.name}" stage of the ${initiative.app} value stream.`, status: stage.status, illustrative: true });

      const appIds = stage.apps.map((a, i) => { const id = `rapp_${stage.key}_${i}`; appRows.push({ id, tenantId, companyId, workspaceId: wsId, name: a.name, techStack: a.techStack, disposition: 'Replace', position: i, illustrative: true }); return id; });

      (Object.keys(stage.layers) as Layer[]).forEach((layer, li) => {
        const def = stage.layers[layer];
        const advance = clamp(stage.base + LAYER_OFFSET[layer]);
        // Green-field target — one per IT layer, named + teched for that layer.
        const gf = GF[layer];
        const svcId = `rms_${stage.key}_${li}`;
        const gfName = `${stage.name} ${gf.suffix}`;
        svcRows.push({ id: svcId, tenantId, companyId, workspaceId: wsId, name: gfName, kind: gf.kind, status: gfStatus(advance), techStack: gf.tech, ownerRole: gf.owner, position: li, illustrative: true });

        const compId = `rc_${stage.key}_${li}`;
        compRows.push({ id: compId, tenantId, companyId, workspaceId: wsId, layer, name: def.component,
          principle: 'Common As Possible, Different As Needed — merge the kept findings; keep only genuine variants as config.',
          pattern: def.pattern, targetTech: def.targetTech, destination: gfName, microserviceId: svcId,
          migrationStatus: statusFor(advance, 'Retain'), illustrative: true });

        def.cats.forEach((cat, ci) => {
          const treatment = cat.capdan === 'Eliminate' ? 'Eliminate' : 'Retain';
          appIds.forEach((appId, ai) => {
            cat.items.forEach((it, ii) => {
              if (ai === 1 && it.code2 === '—') return; // app-2 doesn't have this finding
              const jitter = ((hash(`${stage.key}:${layer}:${ai}:${cat.category}:${it.name}`) % 1000) / 1000 - 0.5) * 0.3;
              capRows.push({ id: `rcap_${stage.key}_${ai}_${li}_${ci}_${ii}`, tenantId, companyId, workspaceId: wsId, appId,
                layer, name: it.name, category: cat.category, capdan: cat.capdan, targetLayer: cat.targetLayer ?? null,
                treatment, migrationStatus: statusFor(advance + jitter - (treatment === 'Eliminate' ? 0.12 : 0), treatment),
                componentId: cat.capdan === 'Eliminate' || cat.capdan === 'Relocate' ? null : compId,
                codeRef: ai === 0 ? it.code1 : it.code2, migrationApproach: cat.approach, rationale: cat.rationale,
                effort: cat.effort, complexity: cat.complexity, illustrative: true });
            });
          });
        });
      });
    }
  }

  await prisma.rationalizationWorkspace.createMany({ data: wsRows });
  await prisma.rationalizationMicroservice.createMany({ data: svcRows });
  await prisma.rationalizationComponent.createMany({ data: compRows });
  await prisma.rationalizationApp.createMany({ data: appRows });
  await prisma.rationalizationCapability.createMany({ data: capRows });

  const inits = new Set(wsRows.map((w) => w.application)).size;
  console.log(`   + ${inits} initiatives, ${wsRows.length} stages, ${appRows.length} apps, ${compRows.length} CAPDAN components, ${svcRows.length} green-field (per layer), ${capRows.length} findings`);
}
