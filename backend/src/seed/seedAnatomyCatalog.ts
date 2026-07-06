// ── Anatomy category catalog (WR-06) ──
// The dispositioned renovation taxonomy: per layer, what BELONGS (COMPONENT /
// BEHAVIOR views) and what must NOT be there (MISPLACED view, each with the
// layer it belongs in). UI lists are Kevin's verbatim; other layers follow
// his layer-mapping (business logic → domain, data & config → API/config
// layer, integrations → service layer, security → auth/identity layer).
// Idempotent: rows are replaced wholesale per company.
import type { PrismaClient } from '@prisma/client';

type Row = {
  view: 'COMPONENT' | 'BEHAVIOR' | 'MISPLACED';
  name: string;
  description: string;
  recommendedLayer?: string;
};

const CATALOG: Record<string, Row[]> = {
  UI: [
    {
      view: 'COMPONENT',
      name: 'Labels & Text Elements',
      description: 'Static or dynamic text, tooltips, helper text.',
    },
    {
      view: 'COMPONENT',
      name: 'Input Fields',
      description: 'Text boxes, numeric fields, masked inputs, date pickers.',
    },
    {
      view: 'COMPONENT',
      name: 'Dropdowns / Selectors',
      description: 'Searchable selects, multi-select, autocomplete.',
    },
    {
      view: 'COMPONENT',
      name: 'Buttons & CTAs',
      description: 'Primary, secondary, destructive, icon-only.',
    },
    {
      view: 'COMPONENT',
      name: 'Grids / Tables',
      description: 'Sortable, filterable, paginated, virtualized for performance.',
    },
    { view: 'COMPONENT', name: 'Cards & Panels', description: 'Modular containers for content.' },
    {
      view: 'COMPONENT',
      name: 'Modals / Dialogs / Drawers',
      description: 'Overlays for focused tasks.',
    },
    {
      view: 'COMPONENT',
      name: 'Navigation Elements',
      description: 'Sidebars, top nav, breadcrumbs, tabs.',
    },
    {
      view: 'COMPONENT',
      name: 'Lists & Repeaters',
      description: 'Dynamic collections with templated items.',
    },
    {
      view: 'COMPONENT',
      name: 'Charts & Visualizations',
      description: 'Bar, line, pie, heatmaps, dashboards.',
    },
    {
      view: 'COMPONENT',
      name: 'Status Indicators',
      description: 'Badges, chips, progress bars, skeleton loaders.',
    },
    {
      view: 'BEHAVIOR',
      name: 'Client-side validation',
      description: 'Format, required fields, basic constraints.',
    },
    {
      view: 'BEHAVIOR',
      name: 'Syntax enforcement',
      description: 'Email format, phone number mask, numeric-only.',
    },
    {
      view: 'BEHAVIOR',
      name: 'Real-time feedback',
      description: 'Inline errors, live previews, autosave indicators.',
    },
    {
      view: 'BEHAVIOR',
      name: 'Accessibility compliance',
      description: 'ARIA roles, keyboard navigation, contrast.',
    },
    { view: 'BEHAVIOR', name: 'Responsive design', description: 'Mobile-first, adaptive layouts.' },
    {
      view: 'BEHAVIOR',
      name: 'State management',
      description: 'View state only — React state, Redux, Vuex, etc.',
    },
    {
      view: 'BEHAVIOR',
      name: 'Local caching',
      description: 'Session storage, local storage, offline mode.',
    },
    {
      view: 'BEHAVIOR',
      name: 'Optimistic UI updates',
      description: 'Showing changes before server confirmation.',
    },
    {
      view: 'BEHAVIOR',
      name: 'Component reuse',
      description: 'Design systems, UI libraries, shared components.',
    },
    {
      view: 'MISPLACED',
      name: 'Business logic embedded in the UI',
      description:
        'Pricing, eligibility, workflows and calculations belong in the domain layer, not the screen.',
      recommendedLayer: 'Business Service',
    },
    {
      view: 'MISPLACED',
      name: 'Hard-coded values',
      description:
        'Dropdown options, reference data and settings should be read from an API/config layer.',
      recommendedLayer: 'Data',
    },
    {
      view: 'MISPLACED',
      name: 'Integration logic',
      description:
        'Calling systems directly, multi-step orchestration, retries — belongs at the service boundary.',
      recommendedLayer: 'Integration',
    },
    {
      view: 'MISPLACED',
      name: 'Data transformation',
      description: 'Mapping and reshaping data belongs in the integration/service layer.',
      recommendedLayer: 'Integration',
    },
    {
      view: 'MISPLACED',
      name: 'Security / permission enforcement',
      description:
        'The UI may hide or show; ENFORCING permissions belongs in the auth/identity layer.',
      recommendedLayer: 'Infrastructure',
    },
    {
      view: 'MISPLACED',
      name: 'Server-state management',
      description: 'Session and workflow state belong server-side; the UI keeps only view state.',
      recommendedLayer: 'Business Service',
    },
  ],
  'Business Service': [
    {
      view: 'COMPONENT',
      name: 'Validations',
      description: 'Business rules and eligibility checks — the real ones.',
    },
    { view: 'COMPONENT', name: 'Rules engines', description: 'Configurable decision logic.' },
    { view: 'COMPONENT', name: 'Pricing', description: 'Rating and pricing calculations.' },
    {
      view: 'COMPONENT',
      name: 'Eligibility',
      description: 'Who or what qualifies, decided once, used everywhere.',
    },
    {
      view: 'COMPONENT',
      name: 'Workflow orchestration',
      description: 'Multi-step business processes and their state.',
    },
    {
      view: 'COMPONENT',
      name: 'Derivations / resolvers',
      description: 'Computed answers derived from source data at read time.',
    },
    {
      view: 'MISPLACED',
      name: 'Presentation logic',
      description: 'Formatting for display belongs in the UI.',
      recommendedLayer: 'UI',
    },
    {
      view: 'MISPLACED',
      name: 'Hard-coded reference data',
      description: 'Lookup lists and constants belong in the data/config layer.',
      recommendedLayer: 'Data',
    },
    {
      view: 'MISPLACED',
      name: 'Direct external calls',
      description:
        'Talking to third parties without the integration layer skips error handling and retries.',
      recommendedLayer: 'Integration',
    },
  ],
  Data: [
    {
      view: 'COMPONENT',
      name: 'Dropdown values',
      description: 'Selectable option lists served as data.',
    },
    {
      view: 'COMPONENT',
      name: 'Reference data',
      description: 'Codes, categories and master data.',
    },
    {
      view: 'COMPONENT',
      name: 'Feature flags',
      description: 'Toggles controlling behavior per environment or audience.',
    },
    {
      view: 'COMPONENT',
      name: 'Environment-specific settings',
      description: 'Configuration that differs between dev, test and production.',
    },
    {
      view: 'COMPONENT',
      name: 'Schema & migrations',
      description: 'The structure of stored data and its version history.',
    },
    {
      view: 'COMPONENT',
      name: 'Derived caches',
      description: 'Precomputed rollups a service owns and refreshes.',
    },
    {
      view: 'MISPLACED',
      name: 'Business calculations in the database',
      description: 'Pricing or eligibility in stored procedures belongs in the domain layer.',
      recommendedLayer: 'Business Service',
    },
    {
      view: 'MISPLACED',
      name: 'Orchestration in stored procedures',
      description: 'Multi-step flows in the database belong in the service layer.',
      recommendedLayer: 'Integration',
    },
  ],
  Integration: [
    {
      view: 'COMPONENT',
      name: 'API orchestration',
      description: 'Coordinating calls across services.',
    },
    {
      view: 'COMPONENT',
      name: 'Error handling',
      description: 'Consistent failures with useful messages.',
    },
    {
      view: 'COMPONENT',
      name: 'Retries',
      description: 'Automatic recovery from transient failures.',
    },
    {
      view: 'COMPONENT',
      name: 'Data transformation',
      description: 'Mapping between one system’s shape and another’s.',
    },
    {
      view: 'COMPONENT',
      name: 'Request validation',
      description: 'Checking inputs at the service boundary.',
    },
    {
      view: 'COMPONENT',
      name: 'Caching',
      description: 'Short-lived response reuse at the boundary.',
    },
    {
      view: 'MISPLACED',
      name: 'Business rules in the gateway',
      description: 'Eligibility or pricing decisions belong in the domain layer, not the pipe.',
      recommendedLayer: 'Business Service',
    },
    {
      view: 'MISPLACED',
      name: 'Hard-coded endpoints & credentials',
      description: 'Connection details belong in configuration, secrets in the vault.',
      recommendedLayer: 'Data',
    },
  ],
  Infrastructure: [
    { view: 'COMPONENT', name: 'RBAC', description: 'Role-based access control.' },
    {
      view: 'COMPONENT',
      name: 'Permissions',
      description: 'Fine-grained entitlements and their enforcement.',
    },
    {
      view: 'COMPONENT',
      name: 'Policies',
      description: 'Security and governance policies applied platform-wide.',
    },
    {
      view: 'COMPONENT',
      name: 'Logging & observability',
      description: 'Structured logs, request tracing, audit trails.',
    },
    {
      view: 'COMPONENT',
      name: 'Secrets & config',
      description: 'Key material and environment configuration handling.',
    },
    {
      view: 'MISPLACED',
      name: 'Eligibility rules dressed as permissions',
      description:
        'Business qualification logic belongs in the domain layer, not the access layer.',
      recommendedLayer: 'Business Service',
    },
  ],
};

export async function seedAnatomyCatalog(
  p: PrismaClient,
  ctx: { tenantId: string; companyId: string },
) {
  await p.anatomyCategory.deleteMany({ where: { companyId: ctx.companyId } });
  const rows = Object.entries(CATALOG).flatMap(([layer, items]) =>
    items.map((r, i) => ({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      layer,
      view: r.view,
      name: r.name,
      description: r.description,
      recommendedLayer: r.recommendedLayer ?? null,
      sortOrder: i,
    })),
  );
  await p.anatomyCategory.createMany({ data: rows });
  console.log(`   + ${rows.length} anatomy categories (WR-06 taxonomy)`);
}
