// glossary.ts — the application's data dictionary, in plain language.
//
// This is NOT the database schema. Each entry defines a term the way it is used
// inside the Capgemini Transformation Bridge: what the concept means, why it
// exists in the operating model, and the values it can take where relevant.
// Authored content — edit definitions here to keep the dictionary accurate.

export type Term = {
  term: string;
  // Optional aliases / other names the same concept goes by in the app.
  aka?: string;
  definition: string;
  // Optional enumerated values this concept can take (rendered as tags).
  values?: string[];
};

export type GlossaryGroup = {
  group: string;
  blurb: string;
  terms: Term[];
};

// The group order below mirrors the Data Admin sidebar sections (see the GROUPS
// array in backend/src/lib/adminRegistry.ts) so the dictionary reads in the same
// order a user finds tables to edit. "Cross-cutting" is dictionary-only — those
// concepts have no editable table — and stays last.
export const GLOSSARY: GlossaryGroup[] = [
  {
    group: 'Organization',
    blurb: 'The "who" — how the enterprise is structured into units and positions.',
    terms: [
      {
        term: 'Company',
        definition:
          'The enterprise being modeled — the root of the operating model. Everything else (divisions, roles, value streams, applications, initiatives) belongs to a company.',
      },
      {
        term: 'Division',
        definition:
          'A top-level organizational unit under the company. Every division rolls up to exactly one of the three CEO domains, which is how the Explorer groups the org at the highest level.',
      },
      {
        term: 'Domain',
        aka: 'CEO Domain / Higher-Level Category',
        definition:
          'The highest-level grouping of the organization: every division is tagged into one of three domains so leadership can see the enterprise split into Core Business (the revenue-generating core), IT (the technology functions that build and run the systems), and Corporate Function (shared services such as Finance, HR, Legal, and Risk). Distinct from a value stream’s domain, which groups the work rather than the org.',
        values: ['Core Business', 'IT', 'Corporate Function'],
      },
      {
        term: 'Department',
        definition:
          'A sub-unit inside a division that groups related roles. The middle tier between a division and its roles.',
      },
      {
        term: 'Role',
        definition:
          'A defined position or job function — not a person. A role is the unit of accountability: it carries responsibilities, a reporting line, and the tasks and value-stream participation the work requires. People are assigned to roles.',
      },
      {
        term: 'Role Level',
        definition: 'The seniority tier of a role, used to read the reporting hierarchy.',
        values: ['Executive', 'Leadership', 'Manager', 'Individual Contributor'],
      },
      {
        term: 'Role Family',
        definition: 'A grouping of related roles that share a similar profile or skill set.',
      },
      {
        term: 'Manager / Reports',
        definition:
          'The reporting relationship between roles. A role may report to one manager role and have many roles reporting to it — together these form the org hierarchy.',
      },
    ],
  },
  {
    group: 'Value Streams',
    blurb: 'The "what the business actually does" — the work in motion, end to end.',
    terms: [
      {
        term: 'Value Stream',
        definition:
          'An end-to-end flow of work that delivers value (a business capability such as Underwriting or Claims). It is the spine of the "how the business operates" view and crosses org boundaries — many roles from different divisions participate in one value stream. In Data Admin every level of the value-stream tree is edited from one level-numbered "Process Levels" list.',
      },
      {
        term: 'Process Levels (0–6)',
        aka: 'Company · Domain · Division · Value Stream · Process Area · Sub-Process · Step',
        definition:
          'The operating model numbered by depth, so it reads the same across companies. Process Level 0 is the Company; Process Level 1 is a Domain (top grouping, e.g. Core Insurance); Process Level 2 is a Division; Process Level 3 is the Value Stream; Process Level 4 is a Process Area; Process Level 5 is a Sub-Process; Process Level 6 is a single ordered Process Step. In Data Admin the top tiers are the Process 0 / 1 / 2 tabs, and the value-stream tree (Process Levels 3–6) is edited as one level-numbered list.',
        values: ['Process Level 0 — Company', 'Process Level 1 — Domain', 'Process Level 2 — Division', 'Process Level 3 — Value Stream', 'Process Level 4 — Process Area', 'Process Level 5 — Sub-Process', 'Process Level 6 — Process Step'],
      },
      {
        term: 'Process Step',
        definition:
          'A single sequenced step in a value stream’s end-to-end flow — who leads it, who supports, and what flows in and out. Steps in order describe how the work actually moves. (The detailed L5 steps live in the value-stream tree above; this is the flow-level view.)',
      },
      {
        term: 'IO Item',
        aka: 'Input / Output / Deliverable',
        definition:
          'A thing that flows into or out of a value stream — an input consumed, an output produced, or a deliverable handed off — along with the key data elements it carries.',
        values: ['Input', 'Output', 'Deliverable'],
      },
    ],
  },
  {
    group: 'Role Work',
    blurb: 'How the work a role is accountable for is defined.',
    terms: [
      {
        term: 'Category',
        definition:
          'A theme used to classify a role’s checklist items and tasks (e.g. a functional area or activity type), so work can be grouped and compared across roles.',
      },
      {
        term: 'Checklist Item',
        definition:
          'A discrete accountability or control assigned to a role — something the role must ensure gets done. Can be cross-role when the same item is shared by several roles.',
      },
      {
        term: 'Role Task',
        definition:
          'A defined, recurring responsibility of a role. It is the template from which a real person’s live tasks are derived once someone is assigned to the role.',
      },
      {
        term: 'Role ↔ Value Stream',
        aka: 'Participation Type',
        definition:
          'The link recording that a role takes part in a value stream, and in what capacity — distinguishing who runs the work from who merely supports or controls it.',
        values: ['Lead', 'Core', 'Support', 'Oversight', 'Control'],
      },
    ],
  },
  {
    group: 'Applications & Metrics',
    blurb: 'The "where the work runs" and "how well it performs" lenses.',
    terms: [
      {
        term: 'Application',
        definition:
          'A software system that supports the work. Each application has a kind, a criticality, and (for real ones) a total cost of ownership.',
        values: ['Core', 'SaaS', 'Internal', 'External', 'Platform'],
      },
      {
        term: 'Application ↔ Value Stream',
        aka: 'System Role',
        definition:
          'The link recording that an application serves a value stream, and how — whether it is the authoritative system or a supporting / channel / analytics system.',
        values: ['System of Record', 'Supporting', 'Channel', 'Analytics'],
      },
      {
        term: 'Metric',
        aka: 'KPI',
        definition:
          'A measure attached to a value stream, with a formula, a target, and a direction (higher-is-better or lower-is-better). It answers "how well is this work performing?"',
      },
      {
        term: 'TCO',
        aka: 'Total Cost of Ownership',
        definition:
          'The full annual cost of an application — license, internal labor, vendor services, infrastructure, depreciation, and allocated overhead — summed to a total.',
      },
      {
        term: 'Standard',
        definition:
          'A department- or area-level governance standard (its count, whether a charter exists, and its owner) — a signal of how well-governed an area is.',
      },
      {
        term: 'Standard Item',
        definition:
          'A single guideline within a Standard — its title, description, the lifecycle phase it applies in (Build / Run), and the role accountable for it.',
        values: ['Build', 'Run', 'Build/Run'],
      },
    ],
  },
  {
    group: 'People',
    blurb: 'The real individuals who staff the roles.',
    terms: [
      {
        term: 'Person',
        definition:
          'An individual who staffs one or more roles — a badged employee, a contractor, or an SI (system-integrator) partner.',
      },
      {
        term: 'Employment Type',
        definition: 'How a person is engaged, used to separate internal staff from external labor.',
        values: ['badged', 'contractor', 'si_partner'],
      },
      {
        term: 'Region',
        definition: 'Where a person delivers from, used for onshore/offshore mix analysis.',
        values: ['Onshore', 'Nearshore', 'Offshore'],
      },
      {
        term: 'Assignment',
        definition:
          'The link that places a person into a role (and optionally onto an initiative), with an allocation percentage and whether it is their primary role.',
      },
      {
        term: 'Person Task',
        definition:
          'A live piece of work a person is doing — with a status, priority, and due date. Often instantiated from a Role Task.',
        values: ['To Do', 'In Progress', 'Blocked', 'Done'],
      },
      {
        term: 'Person Metric',
        definition:
          'A monthly performance reading for an individual (throughput, quality, utilization, cycle time) measured against a target.',
      },
      {
        term: 'Activity Signal',
        aka: 'Person Signal',
        definition:
          'A monthly behavioral reading for an individual — time online, code activity, messages, focus hours, meetings — used to characterize how a person spends their time. Illustrative.',
      },
      {
        term: 'App Usage',
        aka: 'Person App Usage',
        definition:
          'The mix of applications an individual spends active time in, ranked by share — the "most-used app" signal. Illustrative.',
        values: ['IDE', 'Comms', 'Analytics', 'Domain', 'Productivity'],
      },
    ],
  },
  {
    group: 'Change & Risk',
    blurb: 'Transformation in flight and the risks that come with it.',
    terms: [
      {
        term: 'Initiative',
        definition:
          'A transformation effort or project that changes the operating model. It has a sponsor, a budget, a health rating, and links to the value streams and divisions it affects — the "what is changing" axis.',
        values: ['Proposed', 'In Progress', 'On Hold', 'Delivered', 'Cancelled'],
      },
      {
        term: 'Initiative Stage',
        definition: 'Where an initiative sits in its delivery lifecycle.',
        values: ['Discovery', 'Build', 'Pilot', 'Rollout', 'BAU'],
      },
      {
        term: 'Health',
        definition: 'The current status signal of an initiative at a glance.',
        values: ['Green', 'Amber', 'Red'],
      },
      {
        term: 'Initiative ↔ Value Stream',
        aka: 'Impact Type',
        definition: 'The link recording which value stream an initiative touches, and how.',
        values: ['Transforms', 'Enables', 'Depends-on'],
      },
      {
        term: 'Initiative ↔ Division',
        definition: 'The link recording which divisions an initiative affects.',
      },
      {
        term: 'Scenario',
        definition:
          'A modeled operating-model change with its economics — one-time cost, annual benefit, annual added cost, net impact, and a confidence rating — linked to a division and value stream. Used for change-impact what-if analysis.',
        values: ['High confidence', 'Medium confidence', 'Low confidence'],
      },
      {
        term: 'Change Type',
        definition: 'The kind of change a scenario represents.',
        values: ['Automation', 'Application rationalization', 'Control uplift', 'SaaS replacement', 'Digital enablement'],
      },
      {
        term: 'Risk',
        definition:
          'A first-class risk tied to a value stream, an initiative, and an owning role — rated by severity and likelihood, and tracked through a status with a mitigation plan.',
        values: ['Operational', 'Compliance', 'Delivery', 'Security', 'Financial', 'Vendor'],
      },
    ],
  },
  {
    group: 'Deliverables & Tasks',
    blurb: 'A lightweight work tracker — tangible outputs and the work that produces them.',
    terms: [
      {
        term: 'Deliverable',
        definition:
          'A tangible output of the work — a document, system, report, process, or model — with an owner, a status, and an optional link to the value stream it belongs to.',
        values: ['Not Started', 'In Progress', 'At Risk', 'Done'],
      },
      {
        term: 'Task',
        definition:
          'A unit of work, optionally rolling up to a Deliverable, with an owner, a priority, and a status. A task originates from a value-stream process step or from a role responsibility.',
        values: ['To Do', 'In Progress', 'Blocked', 'Done'],
      },
    ],
  },
  {
    group: 'Application Rationalization',
    blurb: 'Decomposing legacy applications and re-constituting them on a green-field target.',
    terms: [
      {
        term: 'Rationalization Workspace',
        definition:
          'One rationalization exercise: a value-stream stage (business process) whose legacy applications are decomposed and migrated toward a green-field "Northstar" architecture. Workspaces chain into a chevron flow along the value stream.',
        values: ['Proposed', 'In Progress', 'Migrating', 'Complete'],
      },
      {
        term: 'Legacy Application',
        aka: 'Brown-field App',
        definition:
          'A legacy system inside a workspace being decomposed — profiled by tech stack, hosting, criticality, age, and run cost, and given a disposition for what happens to it.',
        values: ['Retain', 'Refactor', 'Replace', 'Retire'],
      },
      {
        term: 'Capability (Finding)',
        definition:
          'A single decomposed capability found inside a legacy app (e.g. "validate premium > 0"), pinned to an IT layer and the specific code, then classified with a CAPDAN tag and either kept (folded into a target component) or eliminated.',
        values: ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'],
      },
      {
        term: 'CAPDAN',
        definition:
          'The classification applied to each capability finding: Common (the same across apps — consolidate), Different (intentionally distinct — keep separate), Relocate (belongs in a different layer), or Eliminate (an anti-pattern to remove).',
        values: ['Common', 'Different', 'Relocate', 'Eliminate'],
      },
      {
        term: 'Target Component',
        definition:
          'A CAPDAN-normalized component for one IT layer where the kept capabilities re-constitute — carrying the target architecture pattern, technology, and the green-field microservice it lands in.',
        values: ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'],
      },
      {
        term: 'Microservice',
        aka: 'Green-field Target',
        definition:
          'A target microservice or application the normalized components land in — with its target stack, owner, and build status.',
        values: ['Planned', 'Building', 'Live'],
      },
      {
        term: 'Migration Plan Step',
        definition:
          'A sequenced wave/step in re-constituting the business process onto the green-field architecture — with deliverables, an owner, a target window, dependencies, and its own status.',
        values: ['Not Started', 'In Progress', 'Done', 'Blocked'],
      },
    ],
  },
  {
    group: 'External',
    blurb: 'Where the enterprise meets the outside world.',
    terms: [
      {
        term: 'External Interaction',
        definition:
          'An exchange between an internal role and an external party (vendor, regulator, customer, partner). It records what flows in and out, the type of dependency, and how often it happens.',
      },
    ],
  },
  {
    group: 'Cross-cutting',
    blurb: 'Concepts that apply everywhere in the platform (no editable table of their own).',
    terms: [
      {
        term: 'Tenant',
        definition:
          'The isolated workspace for one customer. All data is scoped to a tenant, so one organization can never see another’s operating model.',
      },
      {
        term: 'Illustrative',
        definition:
          'A flag marking data as synthesized / placeholder rather than real. Illustrative records let the Explorer show a complete picture before every real source is connected — treat them as examples, not facts.',
      },
      {
        term: 'Provenance',
        aka: 'Source Sheet / Source Row',
        definition:
          'The origin of a record — which sheet and row of the source workbook it was imported from — so any value can be traced back to where it came from.',
      },
      {
        term: 'Audit Trail',
        definition:
          'An append-only log of every create, edit, and delete made through Data Admin, capturing who changed what and when.',
      },
      {
        term: 'Explorer',
        definition:
          'The interactive drill-down map that is the application itself — start at the company and drill down through domains, divisions, value streams, and steps to see how the enterprise connects.',
      },
    ],
  },
];
