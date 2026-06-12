// Add three more Application Rationalization workspaces (CAPDAN boards),
// aligned to the current portfolio initiatives:
//   1. "Claims Reporting & Analytics"  (Claims Data Platform)        → Unified Claims Data Platform / Claims Modernization
//   2. "Broker Submission Channels"    (Broker Distribution Platform) → Straight-Through Submission Intake / Digital Underwriting Transformation
//   3. "Data Ingestion & Governance"   (Enterprise Data & AI Platform) → Enterprise AI Assistant Rollout / Data & AI Enablement
//
// Mirrors the shape of the existing seed (src/seed/rationalization.ts): one
// workspace per business-process stage, two brown-field apps, one CAPDAN
// component per IT layer landing on a layer-appropriate green-field target,
// findings classified Common | Different | Relocate→targetLayer | Eliminate,
// plus an ordered migration plan. All illustrative=true.
//
// Idempotent: a workspace is skipped if one with the same name already exists
// for the tenant/company. Safe to re-run. Never touches existing workspaces.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LAYERS = ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'] as const;
type Layer = (typeof LAYERS)[number];
type Capdan = 'Common' | 'Different' | 'Relocate' | 'Eliminate';

// Per-IT-layer green-field profile — same vocabulary as the existing seed so
// the new boards render identically (layer-appropriate target boxes).
const GF: Record<Layer, { suffix: string; kind: string; tech: string; owner: string }> = {
  UI: { suffix: 'Web App', kind: 'Web App', tech: 'React 18 + TypeScript, Module Federation', owner: 'UX Engineering' },
  Integration: { suffix: 'API Gateway', kind: 'API Service', tech: 'Spring Cloud Gateway, Kafka, OpenAPI', owner: 'Integration Squad' },
  'Business Service': { suffix: 'Domain Service', kind: 'Microservice', tech: 'Java 21 / Spring Boot, Drools 8', owner: 'Domain Squad' },
  Data: { suffix: 'Data Store', kind: 'Data Platform', tech: 'Postgres 16, Debezium CDC, Snowflake', owner: 'Data Platform Team' },
  Infrastructure: { suffix: 'Platform & Security', kind: 'Platform', tech: 'OPA, mTLS, OpenTelemetry, Grafana', owner: 'Platform Security' },
};
const COMP_NAME: Record<Layer, string> = {
  UI: 'UI Components / Fields',
  Integration: 'Integration Logic',
  'Business Service': 'Business Service Logic',
  Data: 'Data Schema & Payload',
  Infrastructure: 'Infra Security Rules & Logs',
};
const PRINCIPLE = 'Common As Possible, Different As Needed — merge the kept findings; keep only genuine variants as config.';

type Item = { name: string; code1: string; code2: string };
type Cat = {
  category: string; capdan: Capdan; targetLayer?: Layer;
  status: string; // migration status for the findings in this category (Identified | In Analysis | Normalized | In Migration | Migrated | Retired)
  approach: string; rationale: string; effort: string; complexity: string; items: Item[];
};
type LayerDef = { pattern: string; targetTech: string; status: string; gfStatus: string; gfTech?: string; cats: Cat[] };
type AppDef = { name: string; techStack: string; vendor: string; hosting: string; criticality: string; ageYears: number; annualCost: number };
type PlanDef = { wave: number; name: string; description: string; layer?: Layer; status: string; ownerRole: string; targetWindow: string; effortWeeks: number; dependsOn?: string; deliverables: string };
type Workspace = {
  key: string; name: string; application: string; status: string; description: string; northstar: string;
  apps: [AppDef, AppDef]; layers: Record<Layer, LayerDef>; plan: PlanDef[];
};

const C = (category: string, status: string, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat =>
  ({ category, capdan: 'Common', status, approach, rationale, effort, complexity, items });
const D = (category: string, status: string, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat =>
  ({ category, capdan: 'Different', status, approach, rationale, effort, complexity, items });
const R = (category: string, targetLayer: Layer, status: string, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat =>
  ({ category, capdan: 'Relocate', targetLayer, status, approach, rationale, effort, complexity, items });
const E = (category: string, status: string, approach: string, rationale: string, effort: string, complexity: string, items: Item[]): Cat =>
  ({ category, capdan: 'Eliminate', status, approach, rationale, effort, complexity, items });

const WORKSPACES: Workspace[] = [
  // ── 1. Claims Data Platform — aligned to "Unified Claims Data Platform" (Claims Modernization) ──
  {
    key: 'CRA', name: 'Claims Reporting & Analytics', application: 'Claims Data Platform', status: 'In Progress',
    description: 'Consolidate the overlapping claims data mart and loss-run reporting estate feeding the Unified Claims Data Platform initiative.',
    northstar: 'One governed claims lakehouse with a semantic layer — every loss-run, KPI dashboard and regulatory extract served from the same conformed claim facts.',
    apps: [
      { name: 'ClaimsDataMart', techStack: 'Informatica PowerCenter 9, Oracle 11g EDW, PL/SQL', vendor: 'In-house', hosting: 'On-prem', criticality: 'High', ageYears: 14, annualCost: 1850000 },
      { name: 'LossRunReporter', techStack: 'SAP BusinessObjects 4.2, Crystal Reports, MS Access extracts', vendor: 'SAP', hosting: 'On-prem', criticality: 'Medium', ageYears: 11, annualCost: 940000 },
    ],
    layers: {
      UI: {
        pattern: 'Micro-frontend + embedded analytics', targetTech: 'React 18, embedded BI components', status: 'In Analysis', gfStatus: 'Building',
        cats: [
          C('Dashboards & reports', 'In Analysis', 'Rebuild on the shared analytics UI with embedded BI components.', 'Adjusters and actuaries rely on these views daily.', 'M', 'Medium', [
            { name: 'Claims KPI dashboard', code1: 'OBIEE : ClaimsKpi.dashboard', code2: 'WebI : ClaimsKpi.wid' },
            { name: 'Loss-run statement', code1: 'OBIEE : LossRunStd.rpt', code2: 'Crystal : lossrun.rpt' }]),
          R('Embedded calculations', 'Business Service', 'In Analysis', 'Move developed-loss and trend factors into the analytics domain service.', 'Actuarial math hidden in report formulas drifts between tools.', 'M', 'High', [
            { name: 'Developed-loss factors', code1: 'OBIEE formula : DLF calc', code2: 'Crystal formula : @DevLoss' }]),
          E('Manual exports', 'In Analysis', 'Replace with governed self-service extracts from the semantic layer.', 'Excel/Access spreadmarts fork the numbers and leak PII.', 'S', 'Low', [
            { name: 'Ad-hoc Excel/Access extracts', code1: 'sqlplus spool : claims_extract.sql', code2: 'Access : LossRunExtract.mdb' }]),
        ],
      },
      Integration: {
        pattern: 'Streaming ingestion + canonical events', targetTech: 'Kafka, Debezium CDC', status: 'Normalized', gfStatus: 'Building',
        cats: [
          C('Source ingestion', 'Normalized', 'Re-platform onto CDC streams into the lakehouse landing zone.', 'Claims admin and policy snapshots are the system of record feeds.', 'L', 'High', [
            { name: 'Claims admin daily feed', code1: 'PowerCenter : wf_claims_daily', code2: 'BODS : JOB_CLM_LOAD' },
            { name: 'Policy snapshot load', code1: 'PowerCenter : wf_policy_snap', code2: 'BODS : JOB_POL_SNAP' }]),
          E('Point-to-point extracts', 'In Analysis', 'Retire direct links; consume the published canonical topics instead.', 'Direct DB links to the claim system bypass governance.', 'M', 'Medium', [
            { name: 'Direct claim-system DB links', code1: 'DBLINK : CLMPROD', code2: 'ODBC : ClaimDirect' }]),
        ],
      },
      'Business Service': {
        pattern: 'Analytics domain service', targetTech: 'Python / dbt models, Spring Boot API', status: 'In Analysis', gfStatus: 'Planned',
        gfTech: 'dbt + Snowpark, Spring Boot serving API',
        cats: [
          C('Reserve & severity analytics', 'In Analysis', 'Externalize into versioned dbt/Snowpark models behind one API.', 'IBNR and severity logic must produce one answer enterprise-wide.', 'L', 'High', [
            { name: 'IBNR triangle prep', code1: 'PLSQL : PKG_IBNR.build', code2: 'BO universe : IBNR derived' },
            { name: 'Severity banding', code1: 'PLSQL : PKG_SEV.band', code2: 'Crystal formula : @SevBand' }]),
          D('Regulatory reporting variants', 'In Analysis', 'Keep state stat-plan formats as configuration over the same facts.', 'Stat reporting genuinely differs by state and bureau.', 'M', 'Medium', [
            { name: 'State stat-plan formats', code1: 'PLSQL : STAT_PLAN tables', code2: 'Crystal : stat_*.rpt' }]),
        ],
      },
      Data: {
        pattern: 'Lakehouse + semantic layer', targetTech: 'Snowflake, dbt conformed marts', status: 'Normalized', gfStatus: 'Building',
        gfTech: 'Snowflake lakehouse, dbt, Debezium CDC',
        cats: [
          C('Claims star schema', 'Normalized', 'Conform both schemas into one governed claim-fact model.', 'The star schema core is sound — it just exists twice.', 'L', 'High', [
            { name: 'Claim fact & dimensions', code1: 'EDW : CLM_FACT / DIM_*', code2: 'LRDB : LOSSRUN, CLAIM_SUM' }]),
          R('Logic in ETL', 'Business Service', 'In Analysis', 'Extract business rules from ETL mappings into the analytics service.', 'Recovery and coverage rules buried in PowerCenter transforms.', 'L', 'High', [
            { name: 'Rules inside ETL mappings', code1: 'PowerCenter : exp_CLM_RULES', code2: 'BODS : CLM_RULES script' }]),
          E('Redundant marts', 'In Analysis', 'Decommission once the conformed mart is certified.', 'Duplicate department marts disagree with the EDW.', 'M', 'Medium', [
            { name: 'Department shadow marts', code1: 'EDW : CLMS_DEPT_MART', code2: 'LRDB : ADHOC_*' }]),
        ],
      },
      Infrastructure: {
        pattern: 'Zero-trust data platform', targetTech: 'OPA, dynamic masking, OpenTelemetry', status: 'In Analysis', gfStatus: 'Planned',
        cats: [
          C('Access controls', 'In Analysis', 'Re-express as policy-based row/column security in the lakehouse.', 'Claim-office row-level security is a regulatory requirement.', 'M', 'Medium', [
            { name: 'Claim-office row security', code1: 'Oracle VPD : CLM_OFFICE', code2: 'BO : row-level restrictions' }]),
          E('Serial batch windows', 'Identified', 'Replace Control-M chains with event-driven orchestration.', 'The 6-hour nightly window already overruns month-end.', 'M', 'Medium', [
            { name: 'Nightly batch chain', code1: 'Control-M : CLM_NIGHTLY', code2: 'Control-M : LR_NIGHTLY' }]),
        ],
      },
    },
    plan: [
      { wave: 1, name: 'Certify the conformed claim-fact model', description: 'Profile both schemas, agree the canonical claim facts and dimensions with actuarial and claims ops.', layer: 'Data', status: 'Done', ownerRole: 'Data Platform Team', targetWindow: 'Q2 2026', effortWeeks: 6, deliverables: 'Signed-off conformed model + source-to-target mapping' },
      { wave: 1, name: 'Stand up CDC ingestion', description: 'Replace the PowerCenter/BODS nightly loads with Debezium CDC streams into the lakehouse landing zone.', layer: 'Integration', status: 'In Progress', ownerRole: 'Integration Squad', targetWindow: 'Q3 2026', effortWeeks: 8, dependsOn: 'Certify the conformed claim-fact model', deliverables: 'Claims + policy CDC topics live in parallel run' },
      { wave: 2, name: 'Externalize actuarial logic', description: 'Move IBNR, severity and developed-loss logic from PL/SQL and report formulas into versioned dbt/Snowpark models.', layer: 'Business Service', status: 'In Progress', ownerRole: 'Domain Squad', targetWindow: 'Q3 2026', effortWeeks: 10, dependsOn: 'Certify the conformed claim-fact model', deliverables: 'Analytics service v1 reconciling to the legacy marts' },
      { wave: 2, name: 'Rebuild dashboards & loss-runs', description: 'Re-point the claims KPI dashboard and loss-run statements at the semantic layer; retire ad-hoc Excel/Access extracts.', layer: 'UI', status: 'Not Started', ownerRole: 'UX Engineering', targetWindow: 'Q4 2026', effortWeeks: 8, dependsOn: 'Externalize actuarial logic', deliverables: 'New dashboards live; spreadmart exports disabled' },
      { wave: 3, name: 'Decommission legacy marts', description: 'Parallel-run sign-off, then retire ClaimsDataMart ETL, the BO universe and the department shadow marts.', status: 'Not Started', ownerRole: 'Data Platform Team', targetWindow: 'Q1 2027', effortWeeks: 6, dependsOn: 'Rebuild dashboards & loss-runs', deliverables: 'Both legacy platforms switched off; run-cost saving banked' },
    ],
  },

  // ── 2. Broker Distribution Platform — aligned to "Straight-Through Submission Intake" (Digital Underwriting Transformation) ──
  {
    key: 'BSC', name: 'Broker Submission Channels', application: 'Broker Distribution Platform', status: 'In Progress',
    description: 'Rationalize the two overlapping broker/agent portals that feed underwriting, enabling straight-through submission intake.',
    northstar: 'A single broker experience and API channel — every submission, regardless of channel, arrives as the same canonical ACORD payload ready for straight-through processing.',
    apps: [
      { name: 'AgentConnect', techStack: 'Classic ASP / VB6 COM+, SQL Server 2008', vendor: 'In-house', hosting: 'On-prem', criticality: 'High', ageYears: 18, annualCost: 1240000 },
      { name: 'BrokerDirect', techStack: 'Java 6 / JSF, WebSphere 8, DB2', vendor: 'IBM (customized)', hosting: 'Private cloud', criticality: 'High', ageYears: 12, annualCost: 1610000 },
    ],
    layers: {
      UI: {
        pattern: 'Micro-frontend', targetTech: 'React 18 + TypeScript', status: 'In Analysis', gfStatus: 'Building',
        cats: [
          C('Submission capture', 'In Analysis', 'Rebuild as one React submission experience for agents and brokers.', 'Both portals capture the same new-business data.', 'L', 'High', [
            { name: 'New-business wizard', code1: 'newbus.asp', code2: 'NewBusWizard.xhtml' },
            { name: 'Document upload', code1: 'upload.asp', code2: 'UploadBean.java' }]),
          R('Business validations', 'Business Service', 'In Analysis', 'Enforce licensing and appetite checks in the producer domain service.', 'Regulated channel checks must live server-side in the domain service.', 'M', 'Medium', [
            { name: 'License & appointment check', code1: 'newbus.asp : CheckLicense()', code2: 'AgentValidator.java : license()' },
            { name: 'Appetite pre-screen', code1: 'newbus.asp : PreScreen()', code2: 'SubmitBean.java : preScreen()' }]),
          R('Session state', 'Integration', 'Identified', 'Move wizard state behind the gateway as resumable submission sessions.', 'Server-session wizard state blocks scale-out — it belongs in the integration tier.', 'M', 'Medium', [
            { name: 'Server-side wizard state', code1: 'Session("wizard")', code2: 'HttpSession : wizardState' }]),
        ],
      },
      Integration: {
        pattern: 'API gateway + canonical ACORD', targetTech: 'Spring Cloud Gateway, Kafka', status: 'In Analysis', gfStatus: 'Building',
        cats: [
          C('Agency upload channels', 'In Analysis', 'Mediate behind the gateway with one canonical ACORD model.', 'AL3/XML ingest and AMS sync must keep working for every agency.', 'L', 'High', [
            { name: 'ACORD AL3/XML ingest', code1: 'Al3Parser.cls', code2: 'AcordImport.java' },
            { name: 'Agency management sync', code1: 'AmsSync.dll', code2: 'AmsSyncJob.java' }]),
          E('FTP batch drops', 'In Analysis', 'Retire in favour of the real-time submission API.', 'Overnight FTP submissions defeat straight-through intake.', 'M', 'Medium', [
            { name: 'Overnight FTP submissions', code1: 'ftp script : agc_inbound.bat', code2: 'cron : sftp_poll.sh' }]),
        ],
      },
      'Business Service': {
        pattern: 'Producer domain service + rules', targetTech: 'Spring Boot, Drools 8', status: 'In Analysis', gfStatus: 'Planned',
        cats: [
          C('Producer rules', 'In Analysis', 'Consolidate into one producer domain service.', 'Commission and hierarchy logic is duplicated and diverging.', 'L', 'High', [
            { name: 'Commission schedule resolution', code1: 'Commission.cls', code2: 'CommissionService.java' },
            { name: 'Producer hierarchy', code1: 'AgentTree.cls', code2: 'ProducerHierarchy.java' }]),
          D('Channel workflow', 'Identified', 'Keep wholesale vs retail intake flows as workflow configuration.', 'Distribution genuinely works differently by channel.', 'M', 'Medium', [
            { name: 'Wholesale vs retail intake flow', code1: 'IntakeFlow.cls', code2: 'intake.bpmn' }]),
        ],
      },
      Data: {
        pattern: 'Canonical producer model', targetTech: 'Postgres 16', status: 'In Analysis', gfStatus: 'Planned',
        cats: [
          C('Producer & submission schema', 'In Analysis', 'Conform to one canonical producer/submission model.', 'Producer master data is the backbone of distribution.', 'L', 'High', [
            { name: 'Producer master tables', code1: 'dbo.Producer', code2: 'PRODUCER (DB2)' }]),
          R('Logic in procs', 'Business Service', 'Identified', 'Extract assignment logic from stored procedures into the domain service.', 'Territory assignment hidden in stored procs.', 'M', 'High', [
            { name: 'Territory assignment procs', code1: 'usp_AssignAgent', code2: 'SP_ASSIGN_PRODUCER' }]),
        ],
      },
      Infrastructure: {
        pattern: 'Zero-trust edge', targetTech: 'OIDC, WAF, OPA', status: 'Identified', gfStatus: 'Planned',
        cats: [
          C('Identity & access', 'In Analysis', 'Migrate broker identities to OIDC SSO with policy-based access.', 'Broker credentials must carry over without re-registration.', 'M', 'Medium', [
            { name: 'Broker portal accounts', code1: 'IIS forms auth', code2: 'WebSphere LTPA realm' }]),
          E('Legacy DMZ stack', 'Identified', 'Decommission the unpatched DMZ web tier after cutover.', 'Win2008/WAS8 tier is past end-of-support — security risk.', 'M', 'Medium', [
            { name: 'End-of-life DMZ web tier', code1: 'IIS 7 pool : AGC_DMZ', code2: 'WAS node : BRKDMZ01' }]),
        ],
      },
    },
    plan: [
      { wave: 1, name: 'Canonical ACORD submission model', description: 'Define the canonical submission payload covering AL3, XML and portal capture across both legacy channels.', layer: 'Integration', status: 'Done', ownerRole: 'Integration Squad', targetWindow: 'Q2 2026', effortWeeks: 5, deliverables: 'Canonical ACORD schema + channel mapping matrix' },
      { wave: 1, name: 'Broker identity migration', description: 'Move AgentConnect and BrokerDirect accounts onto OIDC SSO without forcing re-registration.', layer: 'Infrastructure', status: 'In Progress', ownerRole: 'Platform Security', targetWindow: 'Q3 2026', effortWeeks: 6, deliverables: 'All active broker identities on the new IdP' },
      { wave: 2, name: 'Unified submission experience', description: 'Ship the React new-business wizard with document upload, behind the gateway with server-side validation.', layer: 'UI', status: 'In Progress', ownerRole: 'UX Engineering', targetWindow: 'Q3 2026', effortWeeks: 10, dependsOn: 'Canonical ACORD submission model', deliverables: 'New portal in pilot with 20 agencies' },
      { wave: 2, name: 'Producer domain service', description: 'Consolidate commission and hierarchy logic into the producer service; extract territory assignment from stored procs.', layer: 'Business Service', status: 'Not Started', ownerRole: 'Domain Squad', targetWindow: 'Q4 2026', effortWeeks: 8, dependsOn: 'Canonical ACORD submission model', deliverables: 'Producer service serving both portals' },
      { wave: 3, name: 'Channel cutover & DMZ retirement', description: 'Cut remaining agencies over to the unified channel, retire FTP drops and decommission the legacy DMZ tier.', status: 'Not Started', ownerRole: 'Integration Squad', targetWindow: 'Q1 2027', effortWeeks: 6, dependsOn: 'Unified submission experience', deliverables: 'AgentConnect & BrokerDirect retired from the edge' },
    ],
  },

  // ── 3. Enterprise Data & AI Platform — aligned to "Enterprise AI Assistant Rollout" (Data & AI Enablement) ──
  {
    key: 'DIG', name: 'Data Ingestion & Governance', application: 'Enterprise Data & AI Platform', status: 'Proposed',
    description: 'Consolidate the legacy EDW ingestion estate and shadow MI extracts into one governed platform that can safely feed AI workloads.',
    northstar: 'A single governed ingestion and stewardship plane — cataloged, quality-scored, PII-tagged data products that the enterprise AI assistant can consume without bespoke wrangling.',
    apps: [
      { name: 'InfoHub EDW', techStack: 'Informatica 10, Teradata, Unix shell orchestration', vendor: 'Teradata', hosting: 'On-prem', criticality: 'High', ageYears: 15, annualCost: 2400000 },
      { name: 'MI Extract Suite', techStack: 'SSIS, SQL Server, Excel/SharePoint distribution', vendor: 'In-house', hosting: 'Hybrid', criticality: 'Medium', ageYears: 9, annualCost: 680000 },
    ],
    layers: {
      UI: {
        pattern: 'Data product catalog', targetTech: 'React 18, catalog UI', status: 'Identified', gfStatus: 'Planned',
        cats: [
          C('Catalog & lineage views', 'Identified', 'Rebuild as a searchable data-product catalog with lineage.', 'Analysts need to find and trust datasets before AI can.', 'M', 'Medium', [
            { name: 'Dataset search & lineage', code1: 'InfoHub wiki : dataset index', code2: 'SharePoint : MI catalog list' }]),
          E('Spreadmart distribution', 'Identified', 'Replace emailed packs with governed subscriptions.', 'Emailed Excel packs are ungoverned and unauditable.', 'S', 'Low', [
            { name: 'Emailed Excel packs', code1: 'shell : mail_extract.sh', code2: 'SSIS : SendMail tasks' }]),
        ],
      },
      Integration: {
        pattern: 'Declarative ELT + streaming', targetTech: 'Kafka, Airflow, dbt', status: 'In Analysis', gfStatus: 'Planned',
        cats: [
          C('Ingestion pipelines', 'In Analysis', 'Re-platform onto declarative ELT with orchestrated contracts.', 'Core-system and external feeds are the platform inputs.', 'L', 'High', [
            { name: 'Core-system batch feeds', code1: 'Informatica : wf_core_*', code2: 'SSIS : CoreLoad.dtsx' },
            { name: 'External data feeds (ISO, credit)', code1: 'Informatica : wf_ext_iso', code2: 'SSIS : ExtFeeds.dtsx' }]),
          R('Quality rules in pipelines', 'Business Service', 'Identified', 'Lift DQ checks out of ETL jobs into the stewardship service.', 'Quality logic embedded per-pipeline is inconsistent.', 'M', 'High', [
            { name: 'Embedded DQ checks', code1: 'Informatica : mplt_DQ_*', code2: 'SSIS : DQ script tasks' }]),
        ],
      },
      'Business Service': {
        pattern: 'Stewardship & quality service', targetTech: 'Great Expectations, matching service', status: 'Identified', gfStatus: 'Planned',
        gfTech: 'Great Expectations, Spring Boot stewardship API',
        cats: [
          C('Data quality & stewardship', 'In Analysis', 'Centralize as a rule-driven quality and matching service.', 'One quality score per dataset is a precondition for AI use.', 'L', 'High', [
            { name: 'DQ rule engine', code1: 'Teradata : DQ_RULES macros', code2: 'SQL : usp_DQ_checks' },
            { name: 'Golden-record matching', code1: 'Informatica MDM : match rules', code2: 'SSIS : fuzzy lookup chain' }]),
          D('Domain-specific transforms', 'Identified', 'Keep LOB conformance rules as per-domain model config.', 'Line-of-business conformance genuinely differs.', 'M', 'Medium', [
            { name: 'LOB conformance rules', code1: 'Informatica : mplt_LOB_*', code2: 'SSIS : LOB transforms' }]),
        ],
      },
      Data: {
        pattern: 'Lakehouse data products', targetTech: 'Snowflake, dbt, Iceberg', status: 'In Analysis', gfStatus: 'Planned',
        gfTech: 'Snowflake lakehouse, dbt, data contracts',
        cats: [
          C('Conformed dimensions', 'In Analysis', 'Publish as versioned data products with contracts.', 'Conformed party/product/geography dimensions are the crown jewels.', 'L', 'High', [
            { name: 'Conformed dimensions', code1: 'Teradata : DIM_PARTY / DIM_PROD', code2: 'SQL : dim tables (copy)' }]),
          E('Untracked copies', 'Identified', 'Deprecate ad-hoc copies; redirect consumers to data products.', 'Hundreds of untracked table copies bloat storage and confuse AI grounding.', 'M', 'Medium', [
            { name: 'Ad-hoc table copies', code1: 'Teradata : SANDBOX_* dbs', code2: 'SQL : tmp_/bak_ tables' }]),
        ],
      },
      Infrastructure: {
        pattern: 'Policy-based governance', targetTech: 'OPA, masking, audit lake', status: 'Identified', gfStatus: 'Planned',
        cats: [
          C('Governance & PII controls', 'In Analysis', 'Re-express as central PII tagging with dynamic masking.', 'AI workloads must never see unmasked PII.', 'M', 'High', [
            { name: 'PII tagging & masking', code1: 'Teradata : masked views', code2: 'SQL : DDM + manual redaction' }]),
          E('Static capacity', 'Identified', 'Retire fixed appliances for elastic compute.', 'Fixed Teradata capacity is sized for month-end peak.', 'L', 'Medium', [
            { name: 'Fixed warehouse appliances', code1: 'Teradata : 2-node appliance', code2: 'SQL VM cluster : MIPROD' }]),
        ],
      },
    },
    plan: [
      { wave: 1, name: 'Data product inventory & PII scan', description: 'Catalog every InfoHub and MI Extract dataset, tag PII, and rank candidate data products by AI-assistant demand.', layer: 'Data', status: 'In Progress', ownerRole: 'Data Platform Team', targetWindow: 'Q3 2026', effortWeeks: 6, deliverables: 'Cataloged inventory with PII classification' },
      { wave: 1, name: 'Stewardship service foundations', description: 'Stand up the central DQ rule engine and golden-record matching service; baseline quality scores.', layer: 'Business Service', status: 'Not Started', ownerRole: 'Domain Squad', targetWindow: 'Q4 2026', effortWeeks: 8, dependsOn: 'Data product inventory & PII scan', deliverables: 'Quality scores published for the top 20 datasets' },
      { wave: 2, name: 'Re-platform priority pipelines', description: 'Migrate the core-system and external feeds to declarative ELT with data contracts; run in parallel.', layer: 'Integration', status: 'Not Started', ownerRole: 'Integration Squad', targetWindow: 'Q1 2027', effortWeeks: 12, dependsOn: 'Stewardship service foundations', deliverables: 'Priority feeds live on the new platform' },
      { wave: 2, name: 'Governed AI consumption layer', description: 'Expose PII-masked, quality-scored data products to the enterprise AI assistant via the catalog.', layer: 'Infrastructure', status: 'Not Started', ownerRole: 'Platform Security', targetWindow: 'Q1 2027', effortWeeks: 6, dependsOn: 'Stewardship service foundations', deliverables: 'AI assistant grounded only on governed products' },
      { wave: 3, name: 'Shadow-extract decommission', description: 'Retire the MI Extract Suite emailed packs and sandbox copies; reclaim Teradata capacity.', status: 'Not Started', ownerRole: 'Data Platform Team', targetWindow: 'Q2 2027', effortWeeks: 5, dependsOn: 'Re-platform priority pipelines', deliverables: 'Extract suite switched off; appliance contract lapsed' },
    ],
  },
];

async function main() {
  // Tenant/company come from the existing workspaces so the new ones land in
  // exactly the same scope.
  const ref = await prisma.rationalizationWorkspace.findFirst({ select: { tenantId: true, companyId: true } });
  if (!ref) throw new Error('No existing rationalization workspace found — seed the base data first.');
  const { tenantId, companyId } = ref;

  let added = 0;
  for (const ws of WORKSPACES) {
    const exists = await prisma.rationalizationWorkspace.findFirst({
      where: { tenantId, companyId, name: ws.name }, select: { id: true },
    });
    if (exists) { console.log(`= "${ws.name}" already exists — skipped`); continue; }

    const wsId = `rwx_${ws.key}`;
    await prisma.rationalizationWorkspace.create({
      data: {
        id: wsId, tenantId, companyId, name: ws.name, application: ws.application, stageOrder: 0,
        businessProcess: ws.name, description: ws.description, northstar: ws.northstar,
        status: ws.status, illustrative: true,
      },
    });

    const appIds = ws.apps.map((a, i) => {
      const id = `rxapp_${ws.key}_${i}`;
      return { id, app: a, position: i };
    });
    await prisma.rationalizationApp.createMany({
      data: appIds.map(({ id, app, position }) => ({
        id, tenantId, companyId, workspaceId: wsId, name: app.name, disposition: 'Replace',
        techStack: app.techStack, vendor: app.vendor, hosting: app.hosting, criticality: app.criticality,
        ageYears: app.ageYears, annualCost: app.annualCost, position, illustrative: true,
      })),
    });

    const svcRows: any[] = [], compRows: any[] = [], capRows: any[] = [];
    LAYERS.forEach((layer, li) => {
      const def = ws.layers[layer];
      const gf = GF[layer];
      const svcId = `rxms_${ws.key}_${li}`;
      const gfName = `${ws.name} ${gf.suffix}`;
      svcRows.push({
        id: svcId, tenantId, companyId, workspaceId: wsId, name: gfName, kind: gf.kind,
        status: def.gfStatus, techStack: def.gfTech ?? gf.tech, ownerRole: gf.owner, position: li, illustrative: true,
      });

      const compId = `rxc_${ws.key}_${li}`;
      compRows.push({
        id: compId, tenantId, companyId, workspaceId: wsId, layer, name: COMP_NAME[layer],
        principle: PRINCIPLE, pattern: def.pattern, targetTech: def.targetTech, destination: gfName,
        microserviceId: svcId, migrationStatus: def.status, illustrative: true,
      });

      def.cats.forEach((cat, ci) => {
        const treatment = cat.capdan === 'Eliminate' ? 'Eliminate' : 'Retain';
        appIds.forEach(({ id: appId }, ai) => {
          cat.items.forEach((it, ii) => {
            capRows.push({
              id: `rxcap_${ws.key}_${ai}_${li}_${ci}_${ii}`, tenantId, companyId, workspaceId: wsId, appId,
              layer, name: it.name, category: cat.category, capdan: cat.capdan, targetLayer: cat.targetLayer ?? null,
              treatment, migrationStatus: cat.status,
              componentId: cat.capdan === 'Eliminate' || cat.capdan === 'Relocate' ? null : compId,
              codeRef: ai === 0 ? it.code1 : it.code2, migrationApproach: cat.approach, rationale: cat.rationale,
              effort: cat.effort, complexity: cat.complexity, illustrative: true,
            });
          });
        });
      });
    });

    await prisma.rationalizationMicroservice.createMany({ data: svcRows });
    await prisma.rationalizationComponent.createMany({ data: compRows });
    await prisma.rationalizationCapability.createMany({ data: capRows });
    await prisma.rationalizationPlanStep.createMany({
      data: ws.plan.map((p, i) => ({
        id: `rxps_${ws.key}_${i}`, tenantId, companyId, workspaceId: wsId, wave: p.wave, sequence: i,
        name: p.name, description: p.description, layer: p.layer ?? null, status: p.status,
        ownerRole: p.ownerRole, targetWindow: p.targetWindow, effortWeeks: p.effortWeeks,
        dependsOn: p.dependsOn ?? null, deliverables: p.deliverables, illustrative: true,
      })),
    });

    added++;
    console.log(`+ "${ws.name}" (${ws.application}): ${appIds.length} apps, ${compRows.length} components, ${svcRows.length} green-field targets, ${capRows.length} findings, ${ws.plan.length} plan steps`);
  }
  console.log(`Done — ${added} workspace(s) added.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); return prisma.$disconnect().then(() => process.exit(1)); });
