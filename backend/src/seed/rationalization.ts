import type { PrismaClient, Prisma } from '@prisma/client';
import { plainSummaryFor } from '../lib/rationalization.js';
import { resolveSpineRefs, type SpineRefs } from './resolveSpineRefs.js';

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

type Layer = 'UI' | 'Integration' | 'Business Service' | 'Data' | 'Infrastructure';
type Capdan = 'Common' | 'Different' | 'Relocate' | 'Eliminate';

// v3 board authored data: per-item normalization verdicts and per-category
// "WHY THIS MOVES" panels ({captured, sent, processed, validated, lands}).
type Why = {
  captured?: string;
  sent?: string;
  processed?: string;
  validated?: string;
  lands?: string;
};
type Norm = {
  status?: 'AUTO' | 'REVIEW' | 'HELD';
  basis?: string; // "all 14 fields match on name, type and order"
  note?: string; // difference note for REVIEW/HELD
  resolution?: string; // proposed resolution shown on HELD cards
  cards?: Card[]; // side-by-side source cards, index-aligned to stage.apps
};
// One Normalize comparison card (v3): itemized field lines or a "SOURCE DOES"
// narrative, rendered under that legacy source's column in the Normalize box.
type Card = { title: string; lines?: string[]; does?: string; moreNote?: string };

type Item = { name: string; code1: string; code2: string; norm?: Norm; dead?: boolean };
type Cat = {
  category: string;
  capdan: Capdan;
  targetLayer?: Layer;
  approach: string;
  rationale: string;
  effort: string;
  complexity: string;
  why?: Why;
  items: Item[];
};
type LayerDef = {
  component: string;
  pattern: string;
  targetTech: string;
  /** Row whose findings ALL leave it (relocate/dead) — no Normalize box, no green-field target. */
  noTarget?: boolean;
  cats: Cat[];
};
type Stage = {
  key: string;
  name: string;
  order: number;
  status: string;
  base: number;
  apps: { name: string; techStack: string }[];
  layers: Record<Layer, LayerDef>;
};
type Initiative = { app: string; stages: Stage[] };

// Per-IT-layer green-field profile — drives the layer-appropriate name + stack
// so a UI target is a web app, an Integration target is an API gateway, etc.
const GF: Record<Layer, { suffix: string; kind: string; tech: string; owner: string }> = {
  UI: {
    suffix: 'Web App',
    kind: 'Web App',
    tech: 'React 18 + TypeScript, Module Federation',
    owner: 'UX Engineering',
  },
  Integration: {
    suffix: 'API Gateway',
    kind: 'API Service',
    tech: 'Spring Cloud Gateway, Kafka, OpenAPI',
    owner: 'Integration Squad',
  },
  'Business Service': {
    suffix: 'Domain Service',
    kind: 'Microservice',
    tech: 'Java 21 / Spring Boot, Drools 8',
    owner: 'Domain Squad',
  },
  Data: {
    suffix: 'Data Store',
    kind: 'Data Platform',
    tech: 'Postgres 16, Debezium CDC, Snowflake',
    owner: 'Data Platform Team',
  },
  Infrastructure: {
    suffix: 'Platform & Security',
    kind: 'Platform',
    tech: 'OPA, mTLS, OpenTelemetry, Grafana',
    owner: 'Platform Security',
  },
};

const LAYER_OFFSET: Record<Layer, number> = {
  UI: 0.15,
  Integration: 0,
  'Business Service': -0.08,
  Data: 0.05,
  Infrastructure: -0.18,
};
const KEEP_LADDER = ['Identified', 'In Analysis', 'Normalized', 'In Migration', 'Migrated'];
const ELIM_LADDER = ['Identified', 'In Analysis', 'Normalized', 'In Migration', 'Retired'];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function statusFor(a: number, t: 'Retain' | 'Eliminate') {
  const i = Math.min(4, Math.max(0, Math.floor(clamp(a) * 5)));
  return (t === 'Retain' ? KEEP_LADDER : ELIM_LADDER)[i];
}
const gfStatus = (advance: number) =>
  advance > 0.66 ? 'Live' : advance > 0.4 ? 'Building' : 'Planned';

const C = (
  category: string,
  approach: string,
  rationale: string,
  effort: string,
  complexity: string,
  items: Item[],
): Cat => ({ category, capdan: 'Common', approach, rationale, effort, complexity, items });
const D = (
  category: string,
  approach: string,
  rationale: string,
  effort: string,
  complexity: string,
  items: Item[],
): Cat => ({ category, capdan: 'Different', approach, rationale, effort, complexity, items });
const R = (
  category: string,
  targetLayer: Layer,
  approach: string,
  rationale: string,
  effort: string,
  complexity: string,
  items: Item[],
  why?: Why,
): Cat => ({
  category,
  capdan: 'Relocate',
  targetLayer,
  approach,
  rationale,
  effort,
  complexity,
  why,
  items,
});
const E = (
  category: string,
  approach: string,
  rationale: string,
  effort: string,
  complexity: string,
  items: Item[],
): Cat => ({ category, capdan: 'Eliminate', approach, rationale, effort, complexity, items });

const INITIATIVES: Initiative[] = [
  {
    app: 'Underwriting Platform',
    stages: [
      {
        key: 'SUB',
        name: 'Submission',
        order: 0,
        status: 'Migrating',
        base: 0.62,
        apps: [
          { name: 'PolicyPro', techStack: 'C# / .NET 4.7, WebForms, WCF, SQL Server' },
          { name: 'QuoteMaster', techStack: 'Java 8, Struts, Oracle, jQuery' },
        ],
        layers: {
          UI: {
            component: 'UI Components / Fields',
            pattern: 'Micro-frontend',
            targetTech: 'React 18 + TypeScript',
            cats: [
              C(
                'Rendering & layout',
                'Rebuild as React components.',
                'Carrier-standard capture UI.',
                'M',
                'Medium',
                [
                  { name: 'ACORD 125 form', code1: 'SubmissionForm.aspx', code2: 'submission.jsp' },
                  {
                    name: 'Risk summary panel',
                    code1: 'RiskSummary.ascx',
                    code2: 'riskSummary.tag',
                  },
                ],
              ),
              R(
                'Business validations',
                'Integration',
                'Move to API-gateway request validation.',
                'Validation belongs at the service boundary.',
                'M',
                'Medium',
                [
                  {
                    name: 'Validate FEIN',
                    code1: 'SubmissionForm.aspx.cs : ValidateFein()',
                    code2: 'SubmitAction.java : validateFein()',
                    norm: {
                      basis:
                        'FEIN — text (9), checksum + IRS format — both implementations match on field, mask and error text.',
                    },
                  },
                  {
                    name: 'Validate effective dates',
                    code1: 'SubmissionForm.aspx.cs : ValidateDates()',
                    code2: 'SubmitAction.java : validateDates()',
                  },
                  {
                    name: 'Sanctions pre-check',
                    code1: 'SubmissionForm.aspx.cs : Sanctions()',
                    code2: 'SubmitAction.java : sanctions()',
                    norm: {
                      status: 'REVIEW',
                      note: 'Same OFAC list check — PolicyPro screens at submit, QuoteMaster screens on name change; retry semantics differ.',
                      resolution:
                        'Screen once at the gateway on submit, with delta re-screen on party change.',
                    },
                  },
                ],
                {
                  captured:
                    'FEIN, effective dates and prior-carrier details from the ACORD 125 screen.',
                  validated:
                    'Format checks and the sanctions pre-check run inline in screen code-behind.',
                  sent: 'The full form posts to the submission service only after client-side checks pass.',
                  lands:
                    'API-gateway request validation (Integration) — one rule set for both channels.',
                },
              ),
              E(
                'State management',
                'Replace with client state + stateless APIs.',
                'ViewState / session bloat blocks scale-out.',
                'M',
                'Medium',
                [
                  {
                    name: 'ViewState cache',
                    code1: 'SubmissionForm.aspx (ViewState)',
                    code2: 'HttpSession (wizard)',
                    dead: true,
                  },
                ],
              ),
            ],
          },
          Integration: {
            component: 'Integration Logic',
            pattern: 'API gateway + ACL',
            targetTech: 'Spring Cloud Gateway, Kafka',
            cats: [
              C(
                'Broker intake',
                'Mediate behind the gateway + canonical model.',
                'Broker channels must keep working.',
                'L',
                'High',
                [
                  {
                    name: 'Broker endpoint',
                    code1: 'BrokerService.svc',
                    code2: 'BrokerAction.java',
                  },
                  { name: 'ACORD XML parser', code1: 'AcordParser.cs', code2: 'AcordParser.java' },
                ],
              ),
              R(
                'Routing logic',
                'Business Service',
                'Move triage/decline rules to the domain service.',
                'Business rules buried in integration.',
                'L',
                'High',
                [
                  {
                    name: 'Triage routing',
                    code1: 'BrokerService.svc : Triage()',
                    code2: 'BrokerAction.java : triage()',
                  },
                ],
                {
                  processed:
                    'Appetite triage and auto-decline decisions execute inside the broker endpoint.',
                  sent: 'Declines are emailed from the integration tier, bypassing the audit trail.',
                  lands:
                    'Domain rules service (Business Service) — routed decisions with full audit.',
                },
              ),
            ],
          },
          'Business Service': {
            component: 'Business Service Logic',
            pattern: 'Externalized rules',
            targetTech: 'Drools 8, Spring Boot',
            cats: [
              C(
                'Submission rules',
                'Externalize to Drools.',
                'Core appetite/clearance logic.',
                'L',
                'High',
                [
                  {
                    name: 'Appetite check',
                    code1: 'AppetiteEngine.cs',
                    code2: 'AppetiteRules.java',
                    norm: {
                      status: 'HELD',
                      note: 'Both compute appetite from class + state + TIV — PolicyPro consults an embedded 2016 matrix, QuoteMaster reads a rules table; results disagree for 7 classes.',
                      resolution:
                        'Adopt the rules-table version; retire the embedded matrix after class-by-class sign-off.',
                    },
                  },
                  {
                    name: 'Clearance / dedup',
                    code1: 'Clearance.cs',
                    code2: 'Clearance.java',
                    norm: {
                      basis:
                        'Insured name — text (120); FEIN — text (9); Address hash — computed; Broker of record — FK — all 9 clearance fields match on name, type and order.',
                    },
                  },
                ],
              ),
              D(
                'Workflow',
                'Configurable workflow per LOB.',
                'Final-triage flow varies by line of business.',
                'M',
                'Medium',
                [
                  {
                    name: 'Final triage workflow',
                    code1: 'FinalTriage.workflow',
                    code2: 'triage.bpmn',
                  },
                ],
              ),
            ],
          },
          Data: {
            component: 'Data Schema & Payload',
            pattern: 'Canonical model + CDC',
            targetTech: 'Postgres + Snowflake, Debezium',
            cats: [
              C('Schema', 'Lift to canonical Postgres.', 'Clean 3NF core.', 'L', 'High', [
                {
                  name: 'Submission / risk tables',
                  code1: 'dbo.Submission',
                  code2: 'SUBMISSION (Oracle)',
                },
              ]),
              E(
                'Batch sync',
                'Replace with Debezium CDC.',
                'Nightly batch is too slow.',
                'M',
                'Medium',
                [
                  {
                    name: 'Nightly clearance batch',
                    code1: 'SSIS : ClearanceLoad.dtsx',
                    code2: 'cron : clearance.sh',
                  },
                ],
              ),
            ],
          },
          Infrastructure: {
            component: 'Infra Security Rules & Logs',
            pattern: 'Zero-trust',
            targetTech: 'OPA, mTLS, OpenTelemetry',
            cats: [
              C('Security', 'OPA policies + WAF.', 'Keep fine-grained access.', 'M', 'Medium', [
                { name: 'Role authorization', code1: 'web.config (AD)', code2: 'ldap.xml' },
              ]),
              E(
                'Over-provisioning',
                'Move to autoscaling.',
                'Idle static capacity.',
                'M',
                'Medium',
                [{ name: 'Static VMs', code1: 'vsphere : sub-pool', code2: 'vsphere : qm-pool' }],
              ),
            ],
          },
        },
      },
      {
        key: 'PQ',
        name: 'Pricing & Quote',
        order: 1,
        status: 'Migrating',
        base: 0.46,
        apps: [
          { name: 'PolicyPro Rating', techStack: 'C# / .NET rating engine, SQL Server' },
          { name: 'QuoteMaster', techStack: 'Java 8, Struts, Oracle, jQuery' },
        ],
        layers: {
          UI: {
            component: 'UI Components / Fields',
            pattern: 'Micro-frontend',
            targetTech: 'React 18',
            cats: [
              C(
                'Rendering & layout',
                'Rebuild as React.',
                'Broker-trusted quote presentation.',
                'M',
                'Medium',
                [
                  {
                    name: 'Rating worksheet',
                    code1: 'RatingWorksheet.ascx',
                    code2: 'RatingWorksheet.jsp',
                  },
                  {
                    name: 'Quote comparison grid',
                    code1: 'QuoteCompare.ascx',
                    code2: 'QuoteCompare.jsp',
                  },
                ],
              ),
              R(
                'Business validations',
                'Integration',
                'Move to gateway validation.',
                'Pricing validations belong at the boundary.',
                'M',
                'Medium',
                [
                  {
                    name: 'Validate rating factors',
                    code1: 'Rating.js : validateFactors()',
                    code2: 'rating.js : validateFactors()',
                    norm: {
                      basis:
                        'Territory — pick list; Class code — text (5); Limit — money; Deductible — pick list — all 11 factor inputs match on name, type and order.',
                    },
                  },
                  {
                    name: 'Min/max premium check',
                    code1: 'Rating.js : checkBounds()',
                    code2: 'rating.js : checkBounds()',
                    norm: {
                      status: 'REVIEW',
                      note: 'Same bounds check — PolicyPro applies a $500 floor client-side, QuoteMaster reads the filed minimum table; floors disagree in NY.',
                      resolution: 'Enforce the filed state minimum-premium table at the gateway.',
                    },
                  },
                ],
                {
                  captured: 'Rating factors and premium bounds entered on the rating worksheet.',
                  validated:
                    'Min/max premium and factor ranges checked in browser JavaScript only.',
                  sent: 'Unvalidated factor payloads reach the rating engine when JS is bypassed.',
                  lands:
                    'API-gateway request validation (Integration) — server-side, jurisdiction-aware.',
                },
              ),
            ],
          },
          Integration: {
            component: 'Integration Logic',
            pattern: 'Events + canonical API',
            targetTech: 'Kafka, Spring',
            cats: [
              C(
                'Rating data',
                'Events / canonical API.',
                'Exposure + bureau feeds.',
                'M',
                'Medium',
                [
                  {
                    name: 'Exposure load',
                    code1: 'ExposureLoader.cs',
                    code2: 'ExposureLoader.java',
                  },
                  { name: 'Bureau rate sync', code1: 'BureauSync.cs', code2: 'BureauSync.java' },
                ],
              ),
              E(
                'Direct DB access',
                'Go through the domain service.',
                'UI reaches into the DB.',
                'M',
                'Medium',
                [
                  {
                    name: 'Direct rate reads',
                    code1: 'RateDao.cs',
                    code2: 'RateDao.java',
                    dead: true,
                  },
                ],
              ),
            ],
          },
          'Business Service': {
            component: 'Business Service Logic',
            pattern: 'Externalized rules',
            targetTech: 'Drools 8',
            cats: [
              C(
                'Rating rules',
                'Externalize to Drools.',
                'Actuarially-validated pricing.',
                'L',
                'High',
                [
                  {
                    name: 'Base rate calc',
                    code1: 'RatingEngine.cs : CalcBaseRate()',
                    code2: 'RatingEngine.java : calcBase()',
                    norm: {
                      basis:
                        'Rate order of calculation — 12 steps match on sequence and rounding; factor tables keyed identically (territory, class, limit).',
                    },
                  },
                  {
                    name: 'Rating adjustments',
                    code1: 'RatingEngine.cs : Adjust()',
                    code2: 'RatingEngine.java : adjust()',
                  },
                  {
                    name: 'Classify risk',
                    code1: 'RiskClassifier.cs',
                    code2: 'RiskClassifier.java',
                  },
                ],
              ),
              D(
                'Pricing variants',
                'Keep as state/LOB config.',
                'Rates differ by state and line.',
                'M',
                'Medium',
                [
                  {
                    name: 'State rate tables',
                    code1: 'RateTables (per state)',
                    code2: 'RATE_TABLE (Oracle)',
                  },
                ],
              ),
            ],
          },
          Data: {
            component: 'Data Schema & Payload',
            pattern: 'Canonical model',
            targetTech: 'Postgres + Snowflake',
            cats: [
              C('Schema', 'Map to canonical model.', 'Quote/rate schema.', 'L', 'High', [
                { name: 'Quote schema', code1: 'dbo.Quote', code2: 'QUOTE (Oracle)' },
              ]),
              R(
                'Embedded logic',
                'Business Service',
                'Extract rules from PL/SQL into the decision service.',
                'Pricing logic hidden in the DB.',
                'L',
                'High',
                [
                  {
                    name: 'Rate logic in procs',
                    code1: 'usp_RateAdjust',
                    code2: 'PKG_RATING.calc',
                  },
                ],
                {
                  processed:
                    'Rate adjustment math executes in usp_RateAdjust / PKG_RATING at commit time.',
                  validated:
                    'No unit tests — stored-procedure changes ship straight to production data.',
                  lands:
                    'Decision service (Business Service) with versioned, testable rating steps.',
                },
              ),
            ],
          },
          Infrastructure: {
            component: 'Infra Security Rules & Logs',
            pattern: 'Zero-trust',
            targetTech: 'OPA, OpenTelemetry',
            cats: [
              C('Security', 'OPA policies.', 'Keep role-based access.', 'M', 'Medium', [
                { name: 'Role authorization', code1: 'web.config', code2: 'ldap.xml' },
              ]),
            ],
          },
        },
      },
      {
        key: 'POL',
        name: 'Policy',
        order: 2,
        status: 'In Progress',
        base: 0.36,
        apps: [
          { name: 'PolicyPro Policy', techStack: 'C# / .NET 4.7, WCF, SQL Server' },
          { name: 'BillCenter', techStack: 'Java, Oracle' },
        ],
        layers: {
          UI: {
            component: 'UI Components / Fields',
            pattern: 'Micro-frontend',
            targetTech: 'React 18',
            cats: [
              C(
                'Rendering & layout',
                'Rebuild as React.',
                'Bind/endorsement screens.',
                'M',
                'Medium',
                [{ name: 'Bind screen', code1: 'BindPolicy.aspx', code2: 'invoice.jsp' }],
              ),
              R(
                'Business validations',
                'Business Service',
                'Enforce pre-bind/reg checks server-side.',
                'Regulated checks must be server-side.',
                'M',
                'Medium',
                [
                  {
                    name: 'Pre-bind re-validation',
                    code1: 'BindPolicy.aspx.cs : PreBind()',
                    code2: 'BindAction.java : preBind()',
                  },
                  {
                    name: 'Reg-reporting completeness',
                    code1: 'BindPolicy.aspx.cs : RegCheck()',
                    code2: 'BillAction.java : regCheck()',
                    norm: {
                      status: 'REVIEW',
                      note: 'Same completeness fields — PolicyPro blocks bind on failure, BillCenter only warns; enforcement timing differs.',
                      resolution:
                        'Blocking server-side check in the policy domain service for both paths.',
                    },
                  },
                ],
                {
                  captured:
                    'Pre-bind confirmation and regulatory-reporting fields on the bind screen.',
                  validated:
                    'Regulated completeness checks run in screen code and can be skipped by API callers.',
                  lands:
                    'Policy domain service (Business Service) — checks enforced on every bind path.',
                },
              ),
            ],
          },
          Integration: {
            component: 'Integration Logic',
            pattern: 'Event-driven',
            targetTech: 'Kafka',
            cats: [
              C(
                'Billing integration',
                'Event-driven via Kafka.',
                'Decouple billing/payments.',
                'M',
                'Medium',
                [{ name: 'Billing API', code1: 'BillingClient.cs', code2: 'BillingClient.java' }],
              ),
              E(
                'Persistence in adapter',
                'Publish events instead.',
                'Adapter writes policy rows directly.',
                'M',
                'Medium',
                [
                  {
                    name: 'Direct policy writes',
                    code1: 'BillingClient.cs : WritePolicy()',
                    code2: 'BillDao.java : write()',
                  },
                ],
              ),
            ],
          },
          'Business Service': {
            component: 'Business Service Logic',
            pattern: 'Domain service',
            targetTech: 'Spring Boot',
            cats: [
              C(
                'Policy rules',
                'Policy domain service.',
                'Bind/collection/reporting logic.',
                'L',
                'High',
                [
                  { name: 'Bind logic', code1: 'BindEngine.cs', code2: 'BindEngine.java' },
                  {
                    name: 'Premium collection',
                    code1: 'Collections.cs',
                    code2: 'Collections.java',
                  },
                ],
              ),
              D(
                'Approval workflow',
                'Configurable approval/referral flow.',
                'Referral paths vary by authority.',
                'M',
                'Medium',
                [{ name: 'Approval flow', code1: 'Approval.workflow', code2: 'approval.bpmn' }],
              ),
            ],
          },
          Data: {
            component: 'Data Schema & Payload',
            pattern: 'Canonical model',
            targetTech: 'Postgres',
            cats: [
              C('Schema', 'Canonical policy model.', 'Policy + ledger schema.', 'L', 'High', [
                { name: 'Policy schema', code1: 'dbo.Policy', code2: 'POLICY (Oracle)' },
              ]),
              R(
                'Logic in triggers',
                'Business Service',
                'Move reg-reporting logic out of triggers.',
                'Hidden logic in DB triggers.',
                'L',
                'High',
                [
                  {
                    name: 'Reg-reporting trigger',
                    code1: 'TR_PolicyReg',
                    code2: 'TRG_REG (Oracle)',
                  },
                ],
                {
                  processed:
                    'Stat-code derivation and reg extracts fire from row-level DB triggers.',
                  validated:
                    'Trigger failures roll back unrelated policy writes with opaque errors.',
                  lands: 'Policy domain service (Business Service) emitting reg events explicitly.',
                },
              ),
            ],
          },
          Infrastructure: {
            component: 'Infra Security Rules & Logs',
            pattern: 'Zero-trust',
            targetTech: 'OPA, mTLS',
            cats: [
              C('Security', 'OPA + field encryption.', 'PII access controls.', 'M', 'Medium', [
                { name: 'PII access controls', code1: 'PiiPolicy.config', code2: 'pii.xml' },
              ]),
            ],
          },
        },
      },
      {
        key: 'FRM',
        name: 'Forms & Content Mgmt',
        order: 3,
        status: 'In Progress',
        base: 0.28,
        apps: [
          { name: 'PolicyPro Forms', techStack: 'C# / .NET, OpenText' },
          { name: 'DocGen', techStack: 'Java, OpenText' },
        ],
        layers: {
          UI: {
            component: 'UI Components / Fields',
            pattern: 'Micro-frontend',
            targetTech: 'React 18',
            cats: [
              C(
                'Rendering & layout',
                'Rebuild as React.',
                'Forms preview/selection UI.',
                'M',
                'Medium',
                [{ name: 'Forms preview', code1: 'FormsPreview.aspx', code2: 'preview.jsp' }],
              ),
              R(
                'Formatting logic',
                'Business Service',
                'Move merge/clause assembly into the Content service.',
                'Document assembly leaked into the UI.',
                'M',
                'Medium',
                [
                  {
                    name: 'Field-merge logic',
                    code1: 'FormsPreview.aspx.cs : Merge()',
                    code2: 'PreviewAction.java : merge()',
                  },
                ],
                {
                  captured: 'Merge variables resolved from the policy at preview time.',
                  processed: 'Clause assembly and field substitution run in the preview screen.',
                  lands:
                    'Content service (Business Service) — one assembly path for preview and issuance.',
                },
              ),
            ],
          },
          Integration: {
            component: 'Integration Logic',
            pattern: 'APIs / events',
            targetTech: 'Kafka, REST',
            cats: [
              C(
                'Content delivery',
                'Delivery + e-sign via APIs.',
                'Standardize delivery channels.',
                'M',
                'Medium',
                [
                  {
                    name: 'Delivery API',
                    code1: 'DeliveryClient.cs',
                    code2: 'DeliveryClient.java',
                  },
                ],
              ),
            ],
          },
          'Business Service': {
            component: 'Business Service Logic',
            pattern: 'Template engine',
            targetTech: 'Spring Boot',
            cats: [
              C(
                'Forms rules',
                'Content service (template engine).',
                'Template selection + generation.',
                'L',
                'High',
                [
                  {
                    name: 'Template selection',
                    code1: 'TemplateSelector.cs',
                    code2: 'TemplateSelector.java',
                  },
                  { name: 'Clause assembly', code1: 'ClauseEngine.cs', code2: 'ClauseEngine.java' },
                ],
              ),
              D(
                'Document variants',
                'Keep as template config.',
                'State-specific form variants.',
                'M',
                'Medium',
                [
                  {
                    name: 'State form variants',
                    code1: 'Templates/states/*',
                    code2: 'templates/states/*',
                  },
                ],
              ),
            ],
          },
          Data: {
            component: 'Data Schema & Payload',
            pattern: 'Canonical store',
            targetTech: 'Object storage + Postgres',
            cats: [
              C('Storage', 'Canonical content store.', 'Document storage schema.', 'M', 'Medium', [
                {
                  name: 'Policy/forms storage',
                  code1: 'OpenText : policies',
                  code2: 'OpenText : docs',
                },
              ]),
              E(
                'Hard-coded config',
                'Externalize to a template registry.',
                'Template paths hard-coded.',
                'S',
                'Low',
                [
                  {
                    name: 'Hard-coded paths',
                    code1: 'FormsConfig.cs',
                    code2: 'forms.properties',
                    dead: true,
                  },
                ],
              ),
            ],
          },
          Infrastructure: {
            component: 'Infra Security Rules & Logs',
            pattern: 'Zero-trust',
            targetTech: 'OPA',
            cats: [
              C('Security', 'OPA + document ACLs.', 'Document access controls.', 'M', 'Medium', [
                {
                  name: 'Document access controls',
                  code1: 'OpenText ACLs',
                  code2: 'OpenText ACLs',
                },
              ]),
            ],
          },
        },
      },
    ],
  },
  {
    app: 'Claims Platform',
    stages: [
      {
        key: 'CFNOL',
        name: 'FNOL Intake',
        order: 0,
        status: 'In Progress',
        base: 0.38,
        apps: [
          { name: 'ClaimsLegacy', techStack: 'COBOL / CICS, DB2, 3270' },
          { name: 'FNOL Portal', techStack: 'PHP, Laravel, MySQL' },
        ],
        // Workspace Board v3 reference board — mirrors the FNOL wireframe:
        // ClaimsLegacy 60 steps (UI 14 · Integration 9 · Business 18 · Data 15 ·
        // Infra 4; 43 correct · 17 move), FNOL Portal 42, 7 dead-code findings,
        // marquee Normalize comparisons (loss capture form, ACORD feed, annuity
        // eligibility, surrender charge, claimant schema).
        layers: {
          UI: {
            component: 'UI Components / Fields',
            pattern: 'Micro-frontend + mobile',
            targetTech: 'React + React Native',
            cats: [
              C(
                'Loss capture forms',
                'Rebuild as React/React Native.',
                'Structured FNOL capture to keep.',
                'M',
                'Medium',
                [
                  {
                    name: 'Loss capture form',
                    code1: 'CICS : FNOL01 map',
                    code2: 'LossForm.blade.php',
                    norm: {
                      basis: 'All 14 fields match on name, type and order.',
                      cards: [
                        {
                          title: 'Loss capture form',
                          lines: [
                            'Claim number — text (12)',
                            'Policy number — text (10)',
                            'Date of loss — date',
                            'Loss type — pick list, 11 options',
                            'Insured name — text (60)',
                          ],
                          moreNote: '+ 9 more fields — all matching',
                        },
                        {
                          title: 'Loss capture form',
                          lines: [
                            'Claim number — text (12)',
                            'Policy number — text (10)',
                            'Date of loss — date',
                            'Loss type — pick list, 11 options',
                            'Insured name — text (60)',
                          ],
                          moreNote: '+ 9 more fields — all matching',
                        },
                      ],
                    },
                  },
                  {
                    name: 'Claimant contact form',
                    code1: 'CICS : FNOL02 map',
                    code2: 'ContactForm.blade.php',
                  },
                  {
                    name: 'Incident location capture',
                    code1: 'CICS : FNOL03 map',
                    code2: 'LocationPicker.vue',
                  },
                  { name: 'Vehicle damage picker', code1: 'CICS : FNOL04 map', code2: '—' },
                  {
                    name: 'Injury severity picklist',
                    code1: 'FNOLINJ copybook values',
                    code2: 'InjurySelect.vue',
                  },
                ],
              ),
              C(
                'Beneficiary entry',
                'Rebuild as a shared React grid.',
                'Allocation capture to keep.',
                'M',
                'Medium',
                [
                  {
                    name: 'Beneficiary entry',
                    code1: 'CICS : BENE01 map',
                    code2: 'BeneficiaryForm.blade.php',
                    norm: {
                      basis: 'All 8 fields match in both applications.',
                      cards: [
                        {
                          title: 'Beneficiary entry',
                          lines: [
                            'Beneficiary name — text (60)',
                            'Allocation — must total 100%',
                            'Relationship — pick list',
                          ],
                          moreNote: '+ 5 more fields — all matching',
                        },
                        {
                          title: 'Beneficiary entry',
                          lines: [
                            'Beneficiary name — text (60)',
                            'Allocation — must total 100%',
                            'Relationship — pick list',
                          ],
                          moreNote: '+ 5 more fields — all matching',
                        },
                      ],
                    },
                  },
                  {
                    name: 'Allocation percentage grid',
                    code1: 'BENE02 map',
                    code2: 'AllocationGrid.vue',
                  },
                ],
              ),
              D(
                'Annuity wizard',
                'Converge on one progressive flow.',
                'Same 22 fields, two flow shapes.',
                'M',
                'Medium',
                [
                  {
                    name: 'Annuity intake wizard',
                    code1: 'ANNW01–05 maps',
                    code2: 'QuickForm.vue',
                    norm: {
                      status: 'HELD',
                      note: 'Same 22 fields — flow shape and validation timing differ.',
                      resolution: 'One progressive single-page flow.',
                      cards: [
                        {
                          title: '5-step guided wizard',
                          does: '22 fields across steps · save & resume · validates at each step',
                        },
                        {
                          title: 'Single-page quick form',
                          does: 'Same 22 fields at once · no resume · validates on submit',
                        },
                      ],
                    },
                  },
                ],
              ),
              R(
                'Business validations in UI',
                'Business Service',
                'Externalize rules to the domain service.',
                'Business rules live in screen code.',
                'M',
                'Medium',
                [
                  {
                    name: 'Eligibility rule on submit',
                    code1: 'ANNW05 : submit handler',
                    code2: 'QuickForm.vue : onSubmit()',
                    norm: {
                      status: 'REVIEW',
                      note: 'Validation living in the UI — decline timing differs between apps.',
                      resolution: 'One eligibility rule check in the domain service.',
                    },
                  },
                  {
                    name: '100% allocation check on keypress',
                    code1: 'BENE02 : field exit',
                    code2: 'AllocationGrid.vue : watch()',
                  },
                  {
                    name: 'NIGO reason codes assigned in UI',
                    code1: 'FNOL01 : edit routine',
                    code2: 'NigoBanner.vue',
                  },
                ],
                {
                  captured: 'age, state, product, premium',
                  sent: 'mainframe call to eligibility module',
                  processed: 'eligibility declined inline in screen code',
                  validated: 'business rule — belongs in the Business layer',
                  lands: 'FNOL Intake Domain Service',
                },
              ),
              R(
                'Lookups from screen code',
                'Integration',
                'Move calls behind the gateway.',
                'Screens call services directly.',
                'S',
                'Low',
                [
                  {
                    name: 'State approval lookup called from UI',
                    code1: 'FNOL01 : STAPPR call',
                    code2: '—',
                  },
                  {
                    name: 'Policy prefill screen scrape',
                    code1: 'FNOL01 : 3270 scrape',
                    code2: '—',
                  },
                ],
                {
                  sent: 'state product-approval inquiry fired from the intake screen',
                  lands: 'FNOL Intake API Gateway',
                },
              ),
              E(
                'Green-screen entry',
                'Replace with web/mobile capture.',
                '3270 terminal entry is slow.',
                'L',
                'High',
                [
                  {
                    name: 'Green-screen entry emulation',
                    code1: 'CICS : FNOLMAP',
                    code2: '—',
                    dead: true,
                  },
                ],
              ),
            ],
          },
          Integration: {
            component: 'Integration Logic',
            pattern: 'Event-driven + ACL',
            targetTech: 'Kafka, NestJS',
            cats: [
              C(
                'Coverage lookup',
                'ACL to policy admin.',
                'Coverage verification at intake.',
                'M',
                'Medium',
                [
                  {
                    name: 'Policy coverage lookup',
                    code1: 'CICS coverage txn',
                    code2: 'curl policy-api',
                  },
                  { name: 'VIN decode service call', code1: 'VINDEC batch', code2: 'vin-api call' },
                ],
              ),
              C(
                'Document upload feed',
                'Event-driven document intake.',
                'Attachments arrive with the loss.',
                'M',
                'Medium',
                [
                  {
                    name: 'FNOL document upload feed',
                    code1: 'MQ : DOC.IN',
                    code2: 'S3 presigned upload',
                  },
                  { name: 'Police report fetch', code1: 'NICB batch pull', code2: '—' },
                ],
              ),
              D(
                'Claim feed delivery',
                'Standardize on events.',
                'Same payload, two delivery models.',
                'M',
                'Medium',
                [
                  {
                    name: 'ACORD claim feed',
                    code1: 'JCL : CLMFEED nightly',
                    code2: 'Kafka : fnol.claim',
                    norm: {
                      status: 'HELD',
                      note: 'Same payload — delivery, format and timing differ.',
                      resolution: 'Real-time event; batch retired.',
                      cards: [
                        {
                          title: 'Nightly batch feed',
                          does: 'ACORD claim as XML · mainframe batch · runs 2:00 AM',
                        },
                        {
                          title: 'Real-time event stream',
                          does: 'ACORD claim as JSON · event stream · delivers instantly',
                        },
                      ],
                    },
                  },
                ],
              ),
              C(
                'Notifications & webhooks',
                'Move to the notification service.',
                'Claimant status notifications.',
                'S',
                'Low',
                [
                  {
                    name: 'Payment gateway webhook',
                    code1: 'MQ : PAY.EVT',
                    code2: 'routes/webhooks.php',
                  },
                  { name: 'SMS / email notification dispatch', code1: 'JCL : NOTIFY', code2: '—' },
                ],
              ),
              R(
                'Routing coded in gateway',
                'Business Service',
                'Move assignment rules to the domain service.',
                'Routing buried in gateway scripts.',
                'L',
                'High',
                [
                  {
                    name: 'Routing decisions coded in gateway script',
                    code1: 'ESB : routeClaim',
                    code2: 'FnolController.php : route()',
                  },
                ],
                {
                  processed:
                    'Adjuster assignment and fast-track selection execute inside ESB routing scripts.',
                  validated:
                    'Routing changes require an ESB deploy; no business-readable rule trace.',
                  lands: 'FNOL Intake Domain Service — DMN-managed assignment rules.',
                },
              ),
              R(
                'Audit written from ESB',
                'Data',
                'Audit belongs in the data platform.',
                'ESB writes portal audit rows.',
                'S',
                'Low',
                [{ name: 'Portal audit log written via ESB', code1: 'ESB : auditTap', code2: '—' }],
              ),
            ],
          },
          'Business Service': {
            component: 'Business Service Logic',
            pattern: 'BPMN + DMN rules',
            targetTech: 'Camunda 8, Spring Boot',
            cats: [
              C(
                'Triage & assignment rules',
                'Externalize to DMN.',
                'Fast-track vs complex routing.',
                'L',
                'High',
                [
                  {
                    name: 'Triage rules engine — assigns severity',
                    code1: 'TriageCopybook',
                    code2: 'TriageService.php',
                  },
                  {
                    name: 'Adjuster assignment rules',
                    code1: 'ASSIGN01 copybook',
                    code2: 'AssignService.php',
                  },
                  {
                    name: 'Fast-track eligibility rules',
                    code1: 'FASTTRK copybook',
                    code2: 'FastTrack.php',
                  },
                ],
              ),
              C(
                'Reserve calculation',
                'One reserving capability.',
                'Initial estimate at intake.',
                'L',
                'High',
                [
                  {
                    name: 'Reserve calculation — initial estimate',
                    code1: 'RESERVE1 pgm',
                    code2: 'ReserveCalc.php',
                  },
                  {
                    name: 'Reserve adjustment thresholds',
                    code1: 'RESERVE2 pgm',
                    code2: 'ReserveRules.php',
                  },
                ],
              ),
              C(
                'Fraud scoring',
                'Consolidate the indicator set.',
                'Both apps score at intake.',
                'M',
                'Medium',
                [
                  {
                    name: 'Fraud scoring rules — 12 indicators',
                    code1: 'FRAUD01 pgm',
                    code2: 'FraudScore.php',
                  },
                  {
                    name: 'SIU referral triggers',
                    code1: 'SIUREF copybook',
                    code2: 'SiuReferral.php',
                  },
                ],
              ),
              D(
                'Annuity eligibility',
                'Keep one rule; thresholds as config.',
                'Identical thresholds both sides.',
                'S',
                'Low',
                [
                  {
                    name: 'Annuity eligibility rule',
                    code1: 'ELIG01 pgm',
                    code2: 'EligibilityRule.php',
                    norm: {
                      basis: 'Thresholds and exclusions identical word-for-word.',
                      cards: [
                        {
                          title: 'Annuity eligibility rule',
                          lines: [
                            'Minimum issue age — 18',
                            'Maximum issue age — 85',
                            'Excluded states — NY, VT',
                            'Premium range — 5k to 2M',
                          ],
                        },
                        {
                          title: 'Annuity eligibility rule',
                          lines: [
                            'Minimum issue age — 18',
                            'Maximum issue age — 85',
                            'Excluded states — NY, VT',
                            'Premium range — 5k to 2M',
                          ],
                        },
                      ],
                    },
                  },
                ],
              ),
              D(
                'Surrender charge',
                'One capability; rates as settings.',
                'Same trigger, different schedules.',
                'M',
                'Medium',
                [
                  {
                    name: 'Surrender charge computation',
                    code1: 'SURRCHG pgm',
                    code2: 'SurrenderCharge.php',
                    norm: {
                      status: 'HELD',
                      note: 'Same trigger and free amount — rate schedule differs.',
                      resolution: 'One capability; rates as settings.',
                      cards: [
                        {
                          title: 'Surrender charge — tiered',
                          does: '7 / 6 / 5% by contract year · waived on death & long-term care · 10% free each year',
                        },
                        {
                          title: 'Surrender charge — flat',
                          does: '8% every year · waived on death only · 10% free each year',
                        },
                      ],
                    },
                  },
                ],
              ),
              C(
                'Claim orchestration',
                'Consolidate into the domain service.',
                'Intake orchestration steps.',
                'M',
                'Medium',
                [
                  {
                    name: 'Coverage verification orchestration',
                    code1: 'COVVER pgm',
                    code2: 'CoverageCheck.php',
                  },
                  {
                    name: 'Duplicate claim detection',
                    code1: 'DUPCHK pgm',
                    code2: 'DuplicateCheck.php',
                  },
                  { name: 'CAT event tagging', code1: 'CATTAG pgm', code2: '—' },
                  { name: 'Salvage & subrogation flags', code1: 'SALVSUB pgm', code2: '—' },
                  {
                    name: 'Medicare Section 111 eligibility check',
                    code1: 'MED111 pgm',
                    code2: '—',
                  },
                  { name: 'Total-loss threshold rule', code1: 'TOTLOSS pgm', code2: '—' },
                ],
              ),
              R(
                'Audit from rules',
                'Integration',
                'Session audit is an integration concern.',
                'Rules engine writes portal audit.',
                'S',
                'Low',
                [
                  {
                    name: 'Portal session audit written from rules',
                    code1: 'TriageCopybook : AUDIT para',
                    code2: 'TriageService.php : audit()',
                  },
                ],
                {
                  processed: 'session audit rows written from inside the rules engine',
                  lands: 'FNOL Intake API Gateway — audit tap at the boundary',
                },
              ),
              R(
                'Documents from rules',
                'Integration',
                'Letter generation is an integration concern.',
                'Rules engine calls the letter writer.',
                'S',
                'Low',
                [
                  {
                    name: 'Letter generation invoked from rules engine',
                    code1: 'LTRGEN call in TRIAGE',
                    code2: '—',
                  },
                ],
              ),
              E(
                'Obsolete rule packs',
                'Retire with sign-off.',
                'Superseded, unreachable rules.',
                'S',
                'Low',
                [
                  {
                    name: 'Y2K date-shim rule pack',
                    code1: 'Y2KSHIM copybook',
                    code2: 'legacy/y2k.php',
                    dead: true,
                  },
                ],
              ),
            ],
          },
          Data: {
            component: 'Data Schema & Payload',
            pattern: 'Canonical model + CDC',
            targetTech: 'Postgres, Debezium',
            cats: [
              C(
                'Claim & party model',
                'Lift to canonical claim model.',
                'Claim/loss event schema.',
                'L',
                'High',
                [
                  {
                    name: 'Claim & party tables — 34 entities',
                    code1: 'DB2 : CLM1_* tables',
                    code2: 'mysql : claims schema',
                    norm: {
                      basis: 'Entities, keys and types identical — naming auto-maps.',
                      cards: [
                        {
                          title: 'Claimant record',
                          lines: [
                            'Keys — claim + party id',
                            'Entities — 6, same types',
                            'Naming — CLM1_ prefix',
                          ],
                        },
                        {
                          title: 'Claimant record',
                          lines: [
                            'Keys — claim + party id',
                            'Entities — 6, same types',
                            'Naming — camelCase',
                          ],
                        },
                      ],
                    },
                  },
                  {
                    name: 'Policy snapshot store',
                    code1: 'DB2 : POLSNAP',
                    code2: 'mysql : policy_snapshot',
                  },
                  {
                    name: 'Loss event history table',
                    code1: 'DB2 : LOSSHIST',
                    code2: 'mysql : loss_events',
                  },
                  {
                    name: 'Payment ledger entries',
                    code1: 'DB2 : PAYLEDG',
                    code2: 'mysql : payments',
                  },
                  {
                    name: 'Document metadata index',
                    code1: 'DB2 : DOCIDX',
                    code2: 'mysql : documents',
                  },
                  {
                    name: 'Claimant contact records',
                    code1: 'DB2 : CLMCONT',
                    code2: 'mysql : contacts',
                  },
                ],
              ),
              C(
                'Reference & history stores',
                'Consolidate reference data.',
                'Lookup and history tables.',
                'M',
                'Medium',
                [
                  { name: 'Coverage snapshot cache', code1: 'DB2 : COVSNAP', code2: '—' },
                  {
                    name: 'Reserve history table',
                    code1: 'DB2 : RESHIST',
                    code2: 'mysql : reserve_history',
                  },
                  { name: 'Adjuster notes store', code1: 'DB2 : ADJNOTE', code2: 'mysql : notes' },
                  {
                    name: 'Fraud indicator flags table',
                    code1: 'DB2 : FRAUDFLG',
                    code2: 'mysql : fraud_flags',
                  },
                  { name: 'State compliance codes table', code1: 'DB2 : STCOMP', code2: '—' },
                  { name: 'Vehicle / VIN reference data', code1: 'DB2 : VINREF', code2: '—' },
                  { name: 'Reinsurance cession markers', code1: 'DB2 : REINCES', code2: '—' },
                ],
              ),
              R(
                'Rules stored as data',
                'Business Service',
                'Factors belong in the rules engine.',
                'A data table is executed as rules.',
                'M',
                'Medium',
                [
                  {
                    name: 'Premium factor table used as rules',
                    code1: 'DB2 : PREMFCT',
                    code2: 'mysql : premium_factors',
                    norm: {
                      status: 'REVIEW',
                      note: 'Same factors — one side joins at rating time, the other caches nightly.',
                      resolution: 'Externalize to the rules engine; retire both copies.',
                    },
                  },
                ],
                {
                  processed: 'premium factors read straight from a table and executed as rules',
                  lands: 'FNOL Intake Domain Service — factors as decision tables',
                },
              ),
              E(
                'Flat-file extracts',
                'Replace with CDC.',
                'Nightly flat-file extracts.',
                'L',
                'High',
                [
                  {
                    name: 'Nightly VSAM extract files',
                    code1: 'VSAM : CLMEXT',
                    code2: 'cron : csv_export.php',
                    dead: true,
                  },
                ],
              ),
            ],
          },
          Infrastructure: {
            component: 'Infra Security Rules & Logs',
            pattern: 'Zero-trust',
            targetTech: 'OPA, field encryption',
            // Every infra finding relocates or dies — no Normalize box, no
            // green-field target for this row (matches the v3 wireframe).
            noTarget: true,
            cats: [
              R(
                'Per-app security policies',
                'Integration',
                'Centralize at the gateway.',
                'Auth policies defined per app.',
                'M',
                'Medium',
                [
                  {
                    name: 'Gateway auth policies defined per app',
                    code1: 'RACF rules',
                    code2: 'auth.php middleware',
                  },
                  {
                    name: 'Per-app TLS certificate handling',
                    code1: 'CICS TLS config',
                    code2: '—',
                  },
                ],
                {
                  validated: 'each app enforces its own auth policy set',
                  lands: 'FNOL Intake API Gateway — one policy engine (OPA)',
                },
              ),
              R(
                'Ops scripts in cron',
                'Integration',
                'Move to managed schedulers.',
                'Purge jobs scheduled in cron.',
                'S',
                'Low',
                [
                  {
                    name: 'Claim purge scripts scheduled in cron',
                    code1: 'JCL : CLMPURGE',
                    code2: '—',
                  },
                ],
              ),
              E(
                'Retired schedulers',
                'Retire with sign-off.',
                'Scheduler flows no longer referenced.',
                'S',
                'Low',
                [
                  {
                    name: 'Job scheduler scripts — retired flows',
                    code1: 'CA-7 : FNOL* jobs',
                    code2: 'cron : legacy_jobs',
                    dead: true,
                  },
                ],
              ),
            ],
          },
        },
      },
      {
        key: 'CADJ',
        name: 'Adjudication & Payment',
        order: 1,
        status: 'In Progress',
        base: 0.3,
        apps: [
          { name: 'ClaimCenter', techStack: 'Java, Oracle' },
          { name: 'PayHub', techStack: 'C# / .NET, SQL Server' },
        ],
        layers: {
          UI: {
            component: 'UI Components / Fields',
            pattern: 'Micro-frontend',
            targetTech: 'React 18',
            cats: [
              C(
                'Adjuster workspace',
                'Rebuild as React.',
                'Adjuster review screens.',
                'M',
                'Medium',
                [{ name: 'Claim review screen', code1: 'review.jsp', code2: 'Payment.aspx' }],
              ),
            ],
          },
          Integration: {
            component: 'Integration Logic',
            pattern: 'Event-driven',
            targetTech: 'Kafka',
            cats: [
              C(
                'Payment integration',
                'Event-driven payments.',
                'Decouple disbursement.',
                'M',
                'Medium',
                [{ name: 'Disbursement API', code1: 'PayClient.java', code2: 'PayClient.cs' }],
              ),
            ],
          },
          'Business Service': {
            component: 'Business Service Logic',
            pattern: 'Domain service + rules',
            targetTech: 'Spring Boot, Drools',
            cats: [
              C(
                'Reserving rules',
                'Externalize reserving logic.',
                'Regulated reserving.',
                'L',
                'High',
                [
                  {
                    name: 'Reserve calc',
                    code1: 'ReserveEngine.java',
                    code2: 'ReserveCalc.cs',
                    norm: {
                      basis:
                        'Reserve class — pick list; Initial reserve — money; Review trigger — days — both reserving implementations match on inputs, steps and rounding.',
                    },
                  },
                ],
              ),
              D(
                'Settlement workflow',
                'Configurable settlement flow.',
                'Settlement varies by claim type.',
                'M',
                'Medium',
                [{ name: 'Settlement workflow', code1: 'settle.bpmn', code2: 'Settle.workflow' }],
              ),
            ],
          },
          Data: {
            component: 'Data Schema & Payload',
            pattern: 'Canonical model',
            targetTech: 'Postgres',
            cats: [
              C('Claim ledger', 'Canonical ledger model.', 'Payment/reserve ledger.', 'L', 'High', [
                { name: 'Ledger schema', code1: 'CLAIM_TXN (Oracle)', code2: 'dbo.PayTxn' },
              ]),
            ],
          },
          Infrastructure: {
            component: 'Infra Security Rules & Logs',
            pattern: 'Zero-trust',
            targetTech: 'OPA, OpenTelemetry',
            cats: [
              C('Audit logging', 'OpenTelemetry + SIEM.', 'Payment audit trail.', 'M', 'Medium', [
                { name: 'Payment audit log', code1: 'AuditLog.java', code2: 'AuditLog.cs' },
              ]),
            ],
          },
        },
      },
    ],
  },
];

// Exported for the seed unit tests (referential checks on the authored data).
export { INITIATIVES };

export async function seedRationalization(
  prisma: PrismaClient,
  ctx: { tenantId: string; companyId: string; refs?: SpineRefs },
) {
  const { tenantId, companyId } = ctx;
  const refs = ctx.refs ?? (await resolveSpineRefs(prisma, companyId));
  // Wholesale-replace the ILLUSTRATIVE seed boards only — user-authored boards
  // (illustrative=false, e.g. the Self Anatomy board) survive reseeds.
  await prisma.rationalizationWorkspace.deleteMany({ where: { companyId, illustrative: true } });

  const wsRows: Prisma.RationalizationWorkspaceCreateManyInput[] = [];
  const appRows: Prisma.RationalizationAppCreateManyInput[] = [];
  const svcRows: Prisma.RationalizationMicroserviceCreateManyInput[] = [];
  const compRows: Prisma.RationalizationComponentCreateManyInput[] = [];
  const capRows: Prisma.RationalizationCapabilityCreateManyInput[] = [];
  const normRows: Prisma.NormalizationEntryCreateManyInput[] = [];

  for (const initiative of INITIATIVES) {
    // The workspace's value stream = the initiative's platform mapped to a VS node
    // ("Underwriting Platform" → Underwriting, "Claims Platform" → Claims).
    // eslint-disable-next-line sonarjs/super-linear-regex -- behavior-frozen refactor; safe rewrite deferred (input is the short static app literals above)
    const vsNodeId = refs.nodeByName(initiative.app.replace(/\s*Platform$/i, ''));
    // WR-01: the platform is an estate Application — real FK, not just a label.
    const existingApp = await prisma.application.findFirst({
      where: { companyId, name: initiative.app },
      select: { id: true },
    });
    const estateApp =
      existingApp ??
      (await prisma.application.create({
        data: {
          companyId,
          name: initiative.app,
          kind: 'SystemOfRecord',
          isInternal: true,
          illustrative: true,
        },
        select: { id: true },
      }));
    for (const stage of initiative.stages) {
      const wsId = `rw_${stage.key}`;
      wsRows.push({
        id: wsId,
        tenantId,
        companyId,
        name: stage.name,
        application: initiative.app,
        applicationId: estateApp.id,
        stageOrder: stage.order,
        businessProcess: stage.name,
        description: `Rationalize the "${stage.name}" stage of the ${initiative.app} value stream.`,
        valueStreamNodeId: vsNodeId,
        status: stage.status,
        illustrative: true,
      });

      const appIds = stage.apps.map((a, i) => {
        const id = `rapp_${stage.key}_${i}`;
        appRows.push({
          id,
          tenantId,
          companyId,
          workspaceId: wsId,
          name: a.name,
          techStack: a.techStack,
          disposition: 'Replace',
          position: i,
          illustrative: true,
        });
        return id;
      });

      // Deterministic component id per layer row — needed up front so v3
      // Normalize entries (including relocations landing in another row) can
      // reference their box's component.
      const stageLayers = Object.keys(stage.layers) as Layer[];
      const compIdByLayer = new Map<Layer, string>(
        stageLayers
          .filter((layer) => !stage.layers[layer].noTarget)
          .map((layer) => [layer, `rc_${stage.key}_${stageLayers.indexOf(layer)}`]),
      );
      let normSeq = 101; // stable per-workspace notations: N-101, N-102, …

      // ONE greenfield platform per stage board — every layer is a slot inside
      // it (the Transformation Bridge pattern), never a service per layer.
      const svcId = `rms_${stage.key}`;
      const gfName = `${stage.name} — Greenfield`;
      svcRows.push({
        id: svcId,
        tenantId,
        companyId,
        workspaceId: wsId,
        name: gfName,
        kind: 'Platform',
        status: gfStatus(clamp(stage.base)),
        techStack: GF.Infrastructure.tech,
        ownerRoleId: refs.roleResolver(GF.Infrastructure.owner),
        position: 0,
        illustrative: true,
      });

      stageLayers.forEach((layer, li) => {
        const def = stage.layers[layer];
        const advance = clamp(stage.base + LAYER_OFFSET[layer]);
        // A noTarget row keeps its findings (they all relocate or die) but gets
        // no Normalize box and no green-field slot of its own.
        const compId = def.noTarget ? null : `rc_${stage.key}_${li}`;
        if (!def.noTarget && compId) {
          compRows.push({
            id: compId,
            tenantId,
            companyId,
            workspaceId: wsId,
            layer,
            name: def.component,
            principle:
              'Common As Possible, Different As Needed — merge the kept findings; keep only genuine variants as config.',
            pattern: def.pattern,
            targetTech: def.targetTech,
            destination: gfName,
            microserviceId: svcId,
            migrationStatus: statusFor(advance, 'Retain'),
            illustrative: true,
          });
        }

        def.cats.forEach((cat, ci) => {
          const treatment = cat.capdan === 'Eliminate' ? 'Eliminate' : 'Retain';

          // v3 Normalize entries — one normalized item per kept finding name;
          // the raw findings from both legacy apps roll up into it (2→1).
          // Relocations land in the Normalize box of their DESTINATION row.
          // Eliminated / dead-code findings do not normalize.
          const entryIdByItem = new Map<string, string>();
          if (cat.capdan !== 'Eliminate') {
            const entryLayer = cat.targetLayer ?? layer;
            cat.items.forEach((it, ii) => {
              if (it.dead) return;
              const id = `rn_${stage.key}_${li}_${ci}_${ii}`;
              entryIdByItem.set(it.name, id);
              const sources = it.code2 === '—' ? 1 : 2;
              normRows.push({
                id,
                tenantId,
                companyId,
                workspaceId: wsId,
                layer: entryLayer,
                notation: `N-${normSeq++}`,
                name: it.name,
                matchStatus: it.norm?.status ?? 'AUTO',
                matchBasis:
                  it.norm?.basis ??
                  (it.norm?.status && it.norm.status !== 'AUTO'
                    ? null
                    : sources === 2
                      ? `Both implementations expose "${it.name}" (${it.code1} / ${it.code2}) — matched on name, layer and category; 2→1.`
                      : `Single source (${it.code1}) — carried forward 1→1.`),
                differenceNote: it.norm?.note ?? null,
                proposedResolution: it.norm?.resolution ?? null,
                // Side-by-side comparison cards, labeled with the source app names.
                sourceCards: it.norm?.cards
                  ? it.norm.cards.map((card, ci) => ({
                      source: stage.apps[ci]?.name ?? `Source ${ci + 1}`,
                      ...card,
                    }))
                  : undefined,
                componentId: compIdByLayer.get(entryLayer) ?? null,
                sortOrder: normSeq,
                illustrative: true,
              });
            });
          }

          appIds.forEach((appId, ai) => {
            cat.items.forEach((it, ii) => {
              if (ai === 1 && it.code2 === '—') return; // app-2 doesn't have this finding
              const jitter =
                ((hash(`${stage.key}:${layer}:${ai}:${cat.category}:${it.name}`) % 1000) / 1000 -
                  0.5) *
                0.3;
              capRows.push({
                id: `rcap_${stage.key}_${ai}_${li}_${ci}_${ii}`,
                tenantId,
                companyId,
                workspaceId: wsId,
                appId,
                layer,
                name: it.name,
                category: cat.category,
                capdan: cat.capdan,
                targetLayer: cat.targetLayer ?? null,
                // Plain-language default so the board reads for a business
                // audience; the technical rationale/approach live on hover.
                plainSummary: plainSummaryFor({
                  name: it.name,
                  capdan: cat.capdan,
                  layer,
                  targetLayer: cat.targetLayer ?? null,
                }),
                treatment,
                migrationStatus: statusFor(
                  advance + jitter - (treatment === 'Eliminate' ? 0.12 : 0),
                  treatment,
                ),
                componentId:
                  cat.capdan === 'Eliminate' || cat.capdan === 'Relocate' ? null : compId,
                codeRef: ai === 0 ? it.code1 : it.code2,
                migrationApproach: cat.approach,
                rationale: cat.rationale,
                effort: cat.effort,
                complexity: cat.complexity,
                // v3 board fields
                normalizationEntryId: entryIdByItem.get(it.name) ?? null,
                deadCode: it.dead ?? false,
                whyThisMoves: cat.why ?? undefined,
                illustrative: true,
              });
            });
          });
        });
      });
    }
  }

  await prisma.rationalizationWorkspace.createMany({ data: wsRows });
  await prisma.rationalizationMicroservice.createMany({ data: svcRows });
  await prisma.rationalizationComponent.createMany({ data: compRows });
  await prisma.normalizationEntry.createMany({ data: normRows });
  await prisma.rationalizationApp.createMany({ data: appRows });
  await prisma.rationalizationCapability.createMany({ data: capRows });

  const inits = new Set(wsRows.map((w) => w.application)).size;
  const dead = capRows.filter((c) => c.deadCode).length;
  console.log(
    `   + ${inits} initiatives, ${wsRows.length} stages, ${appRows.length} apps, ${compRows.length} CAPDAN components, ${svcRows.length} green-field (per layer), ${capRows.length} findings, ${normRows.length} normalize entries (${dead} dead-code)`,
  );
}
