// ── Workspace board vocabulary (DB as source of truth) ──
// One reference table replaces every hardcoded frontend vocabulary constant
// (LAYERS, CAPDAN_META/CAPDAN_ORDER, STATUS_META/STATUS_ORDER, LensBar MODES/
// VIEWS) and adds the PRODUCT_MODEL domain's 11-component axis, scopes, modes
// and dispositions, plus the scaffold templates formerly hardcoded in
// routes/rationalization.ts (GF_NEW / COMP_NEW) as kind SCAFFOLD rows.
//
// The token sets here ARE the frozen contract (plan §6.4) — Agents 2/3 render
// the board axis, chips, legend and status colors from these rows.
// Idempotent: rows are replaced wholesale per company.
import type { PrismaClient, Prisma } from '@prisma/client';

export type VocabDomain = 'APPLICATION' | 'PRODUCT_MODEL';
export type VocabKind =
  | 'LAYER'
  | 'CLASSIFICATION'
  | 'STATUS'
  | 'MODE'
  | 'VIEW'
  | 'DISPOSITION'
  | 'MATCH_STATUS'
  | 'SCAFFOLD';

export type VocabRow = {
  domain: VocabDomain;
  kind: VocabKind;
  token: string;
  label: string;
  color: string | null;
  sortOrder: number;
  meta: Prisma.InputJsonValue | null;
};

const row = (
  domain: VocabDomain,
  kind: VocabKind,
  token: string,
  label: string,
  color: string | null,
  sortOrder: number,
  meta: Prisma.InputJsonValue | null = null,
): VocabRow => ({ domain, kind, token, label, color, sortOrder, meta });

// The 11 product-model components — the PRODUCT_MODEL row axis (plan §6.4).
export const PRODUCT_COMPONENTS = [
  'Party & Roles',
  'Product Hierarchy',
  'Coverage & Perils',
  'Limits & Deductibles',
  'Rating & Pricing',
  'Forms & Wordings',
  'Eligibility & UW Rules',
  'Exposures & Schedules',
  'Reinsurance & Layering',
  'Regulatory & Filings',
  'Distribution',
] as const;
export type ProductComponent = (typeof PRODUCT_COMPONENTS)[number];

// Migration-status ladder — shared by both domains (mirrors STATUS_META).
const STATUSES: [string, string, string][] = [
  ['Identified', 'neutral', '#d4d4d4'],
  ['In Analysis', 'amber', '#f59e0b'],
  ['Normalized', 'indigo', '#6366f1'],
  ['In Migration', 'sky', '#0ea5e9'],
  ['Migrated', 'emerald', '#10b981'],
  ['Retired', 'slate', '#64748b'],
];

// Retain | Refactor | Replace | Retire — RationalizationApp.disposition and
// LegacyProductModel.disposition share the vocabulary.
const DISPOSITIONS: [string, string][] = [
  ['Retain', 'emerald'],
  ['Refactor', 'sky'],
  ['Replace', 'amber'],
  ['Retire', 'rose'],
];

// v3 Normalize verdicts + the board legend text (wireframe top bar).
const MATCH_STATUSES: [string, string, string][] = [
  ['AUTO', 'emerald', '2→1 semantically same · auto'],
  ['REVIEW', 'amber', 'REVIEW semantically different'],
  ['HELD', 'rose', 'HELD — proposed resolution awaiting sign-off'],
];

// Scaffold templates for POST /rationalization/initiatives — formerly the
// GF_NEW / COMP_NEW literals in routes/rationalization.ts:129-167. meta =
// { suffix, kind, tech, owner } (green-field target) + { component } (the
// per-layer CAPDAN component name).
const APP_SCAFFOLDS: Record<
  string,
  { suffix: string; kind: string; tech: string; owner: string; component: string }
> = {
  UI: {
    suffix: 'Web App',
    kind: 'Web App',
    tech: 'React 18 + TypeScript',
    owner: 'UX Engineering',
    component: 'UI Components / Fields',
  },
  Integration: {
    suffix: 'API Gateway',
    kind: 'API Service',
    tech: 'Spring Cloud Gateway, Kafka',
    owner: 'Integration Squad',
    component: 'Integration Logic',
  },
  'Business Service': {
    suffix: 'Domain Service',
    kind: 'Microservice',
    tech: 'Java 21 / Spring Boot',
    owner: 'Domain Squad',
    component: 'Business Service Logic',
  },
  Data: {
    suffix: 'Data Store',
    kind: 'Data Platform',
    tech: 'Postgres, Debezium CDC',
    owner: 'Data Platform Team',
    component: 'Data Schema & Payload',
  },
  Infrastructure: {
    suffix: 'Platform & Security',
    kind: 'Platform',
    tech: 'OPA, mTLS, OpenTelemetry',
    owner: 'Platform Security',
    component: 'Infra Security Rules & Logs',
  },
};

export function buildVocabularyRows(): VocabRow[] {
  const rows: VocabRow[] = [];

  // ── APPLICATION domain ──
  const appLayers: [string, string][] = [
    ['UI', 'sky'],
    ['Integration', 'violet'],
    ['Business Service', 'amber'],
    ['Data', 'emerald'],
    ['Infrastructure', 'slate'],
  ];
  appLayers.forEach(([t, c], i) => rows.push(row('APPLICATION', 'LAYER', t, t, c, i)));

  // CAPDAN classes — meta carries the exact chip/dot presentation the board
  // renders today (moved verbatim from frontend CAPDAN_META).
  const capdan: [string, string, string, string, string | null][] = [
    [
      'Common',
      'emerald',
      '#10b981',
      'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]',
      'correct — stays',
    ],
    ['Different', 'blue', '#2563eb', 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]', null],
    [
      'Relocate',
      'violet',
      '#7c3aed',
      'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]',
      'needs to move',
    ],
    [
      'Eliminate',
      'rose',
      '#e11d48',
      'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]',
      'retire with sign-off',
    ],
  ];
  capdan.forEach(([t, c, dot, chip, legend], i) =>
    rows.push(
      row(
        'APPLICATION',
        'CLASSIFICATION',
        t,
        t,
        c,
        i,
        legend ? { dot, chip, legend } : { dot, chip },
      ),
    ),
  );

  STATUSES.forEach(([t, c, dot], i) =>
    rows.push(row('APPLICATION', 'STATUS', t, t, c, i, { dot })),
  );

  // Lens modes (LensBar MODES) — tokens match the frontend LensMode values.
  const appModes: [string, string][] = [
    ['applications', 'Applications'],
    ['valueStreams', 'Value streams'],
    ['roles', 'Roles'],
  ];
  appModes.forEach(([t, l], i) => rows.push(row('APPLICATION', 'MODE', t, l, null, i)));

  // Anatomy lens views (LensBar VIEWS, WR-06).
  const views: [string, string][] = [
    ['COMPONENT', 'Components'],
    ['BEHAVIOR', 'Behavior'],
  ];
  views.forEach(([t, l], i) => rows.push(row('APPLICATION', 'VIEW', t, l, null, i)));

  DISPOSITIONS.forEach(([t, c], i) => rows.push(row('APPLICATION', 'DISPOSITION', t, t, c, i)));
  MATCH_STATUSES.forEach(([t, c, legend], i) =>
    rows.push(row('APPLICATION', 'MATCH_STATUS', t, t, c, i, { legend })),
  );
  Object.entries(APP_SCAFFOLDS).forEach(([layer, meta], i) =>
    rows.push(row('APPLICATION', 'SCAFFOLD', layer, `${layer} scaffold`, null, i, meta)),
  );

  // ── PRODUCT_MODEL domain ──
  PRODUCT_COMPONENTS.forEach((c, i) => rows.push(row('PRODUCT_MODEL', 'LAYER', c, c, null, i)));

  // Scope classification with the v3 wireframe card colors: Common = blue,
  // Segment = tan/orange, Geography = grey, Eliminate = red/dead lane.
  const scopes: [string, string, string, string | null][] = [
    ['Common', 'blue', '#2563eb', 'correct — stays'],
    ['Segment', 'amber', '#d97706', null],
    ['Geography', 'slate', '#64748b', null],
    ['Eliminate', 'rose', '#e11d48', 'retire with sign-off'],
  ];
  scopes.forEach(([t, c, dot, legend], i) =>
    rows.push(
      row('PRODUCT_MODEL', 'CLASSIFICATION', t, t, c, i, legend ? { dot, legend } : { dot }),
    ),
  );

  STATUSES.forEach(([t, c, dot], i) =>
    rows.push(row('PRODUCT_MODEL', 'STATUS', t, t, c, i, { dot })),
  );

  // Products inspection modes (PM-05): board scoped by legacy model, segment
  // or geography. Tokens are stable keys; labels per plan §6.4.
  const pmModes: [string, string][] = [
    ['legacyModels', 'Legacy Product Models'],
    ['segment', 'Segment'],
    ['geography', 'Geography'],
  ];
  pmModes.forEach(([t, l], i) => rows.push(row('PRODUCT_MODEL', 'MODE', t, l, null, i)));

  views.forEach(([t, l], i) => rows.push(row('PRODUCT_MODEL', 'VIEW', t, l, null, i)));
  DISPOSITIONS.forEach(([t, c], i) => rows.push(row('PRODUCT_MODEL', 'DISPOSITION', t, t, c, i)));
  MATCH_STATUSES.forEach(([t, c, legend], i) =>
    rows.push(row('PRODUCT_MODEL', 'MATCH_STATUS', t, t, c, i, { legend })),
  );
  // Scaffold for a new product-model workspace: one starter target component
  // per axis row (the product twin of GF_NEW/COMP_NEW).
  PRODUCT_COMPONENTS.forEach((c, i) =>
    rows.push(
      row('PRODUCT_MODEL', 'SCAFFOLD', c, `${c} scaffold`, null, i, {
        component: `${c} Model`,
        principle:
          'Common As Possible, Different As Needed — one canonical definition; genuine segment/geography variants stay as configuration.',
      }),
    ),
  );

  return rows;
}

export async function seedWorkspaceVocabulary(
  p: PrismaClient,
  ctx: { tenantId: string; companyId: string },
) {
  await p.workspaceVocabulary.deleteMany({ where: { companyId: ctx.companyId } });
  const rows = buildVocabularyRows().map((r) => ({
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    domain: r.domain,
    kind: r.kind,
    token: r.token,
    label: r.label,
    color: r.color,
    sortOrder: r.sortOrder,
    meta: r.meta ?? undefined,
  }));
  await p.workspaceVocabulary.createMany({ data: rows });
  console.log(`   + ${rows.length} workspace vocabulary rows (APPLICATION + PRODUCT_MODEL)`);
}
