// Taxonomy schemes over the operating-model graph — the single source for the
// SKOS export format (scripts/export-taxonomy.ts) and the live /taxonomy API.
// One scheme = one skos:ConceptScheme; flat nodes carry {id, label, notation,
// parentId, extra}; the compact viewer shape nests them as {l, n, e, c} trees
// (l = label, n = notation, e = extra, c = children — keys omitted when empty),
// byte-compatible with the uploaded taxonomyviewerdata.json trees.
import { prisma } from '../../db/prisma.js';

/** SKOS namespaces (plan §6.3). */
export const TB_NS = 'https://w3id.org/transformation-bridge/ontology#';
export const TBI_NS = 'https://w3id.org/transformation-bridge/id/';

export const SCHEMES = [
  'process',
  'organization',
  'standards',
  'applications',
  'roles',
  'product-model',
] as const;
export type SchemeId = (typeof SCHEMES)[number];

export const SCHEME_TITLES: Record<SchemeId, string> = {
  process: 'Process',
  organization: 'Organization',
  standards: 'Standards',
  applications: 'Applications',
  roles: 'Roles',
  'product-model': 'Product Model',
};

export interface TaxonomyNode {
  id: string;
  label: string;
  notation: string | null;
  parentId: string | null;
  extra: Record<string, unknown> | null;
}

/** Compact viewer node: l = label, n = notation, e = extra, c = children. */
export interface ViewerNode {
  l: string;
  n?: string;
  e?: Record<string, unknown>;
  c?: ViewerNode[];
}

/** `tbi:` concept URI for a scheme-scoped identifier. */
export const conceptUri = (scheme: string, id: string) => `${TBI_NS}${scheme}-${id}`;

/** Nest flat nodes into the compact viewer shape. Orphans surface as roots. */
export function toViewerTree(nodes: TaxonomyNode[]): ViewerNode[] {
  const byId = new Map<string, { node: TaxonomyNode; viewer: ViewerNode }>();
  for (const node of nodes) {
    const viewer: ViewerNode = { l: node.label };
    if (node.notation) viewer.n = node.notation;
    if (node.extra && Object.keys(node.extra).length > 0) viewer.e = node.extra;
    byId.set(node.id, { node, viewer });
  }
  const roots: ViewerNode[] = [];
  for (const { node, viewer } of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.viewer.c ??= [];
      parent.viewer.c.push(viewer);
    } else {
      roots.push(viewer);
    }
  }
  return roots;
}

// ── Scheme builders — one batched query family each, no per-row fan-out ──

async function processScheme(companyId: string): Promise<TaxonomyNode[]> {
  const nodes = await prisma.processNode.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
    select: {
      id: true,
      displayValue: true,
      code: true,
      parentId: true,
      isTask: true,
      processLevelType: { select: { levelNumber: true } },
    },
  });
  return nodes.map((n) => ({
    id: n.id,
    label: n.displayValue,
    notation: n.code,
    parentId: n.parentId,
    extra: { level: n.processLevelType.levelNumber, ...(n.isTask ? { task: true } : {}) },
  }));
}

async function organizationScheme(companyId: string): Promise<TaxonomyNode[]> {
  const units = await prisma.orgUnit.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
    select: {
      id: true,
      displayValue: true,
      parentId: true,
      orgLevelType: { select: { levelNumber: true } },
    },
  });
  return units.map((u) => ({
    id: u.id,
    label: u.displayValue,
    notation: null,
    parentId: u.parentId,
    extra: { level: u.orgLevelType.levelNumber },
  }));
}

async function standardsScheme(companyId: string): Promise<TaxonomyNode[]> {
  const standards = await prisma.standard.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      parentId: true,
      isArea: true,
      category: true,
      department: true,
    },
  });
  return standards.map((s) => ({
    id: s.id,
    label: s.name,
    notation: null,
    parentId: s.parentId,
    extra: {
      ...(s.isArea ? { area: true } : {}),
      ...(s.category ? { category: s.category } : {}),
      ...(s.department ? { department: s.department } : {}),
    },
  }));
}

async function applicationsScheme(companyId: string): Promise<TaxonomyNode[]> {
  const apps = await prisma.application.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true, kind: true, category: true, vendor: true },
  });
  // Top concepts are the catalog categories; apps hang under their category.
  const categories = [...new Set(apps.map((a) => a.category ?? 'Uncategorized'))].sort();
  const catId = (c: string) => `app-category:${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return [
    ...categories.map((c) => ({
      id: catId(c),
      label: c,
      notation: null,
      parentId: null,
      extra: null,
    })),
    ...apps.map((a) => ({
      id: a.id,
      label: a.name,
      notation: a.code,
      parentId: catId(a.category ?? 'Uncategorized'),
      extra: { kind: a.kind, ...(a.vendor ? { vendor: a.vendor } : {}) },
    })),
  ];
}

async function rolesScheme(companyId: string): Promise<TaxonomyNode[]> {
  const [roles, units] = await Promise.all([
    prisma.role.findMany({
      where: { companyId },
      orderBy: { displayValue: 'asc' },
      select: {
        id: true,
        displayValue: true,
        orgUnitId: true,
        roleFamily: true,
        roleLevel: true,
      },
    }),
    prisma.orgUnit.findMany({
      where: { companyId, roles: { some: {} } },
      orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
      select: { id: true, displayValue: true },
    }),
  ]);
  // Top concepts are the org units that home roles; unhomed roles are roots.
  return [
    ...units.map((u) => ({
      id: u.id,
      label: u.displayValue,
      notation: null,
      parentId: null,
      extra: null,
    })),
    ...roles.map((r) => ({
      id: r.id,
      label: r.displayValue,
      notation: null,
      parentId: r.orgUnitId,
      extra: {
        ...(r.roleFamily ? { family: r.roleFamily } : {}),
        ...(r.roleLevel ? { level: r.roleLevel } : {}),
      },
    })),
  ];
}

async function productModelScheme(companyId: string): Promise<TaxonomyNode[]> {
  // Top concepts = the 11 product components (tbi:pm-<slug>); children = the
  // anatomy sub-categories (tbi:pma-<slug>), scope carried as extra (§6.3 —
  // skos:scopeNote at export time).
  const rows = await prisma.productModelAnatomyCategory.findMany({
    where: { companyId },
    orderBy: [{ component: 'asc' }, { scope: 'asc' }, { view: 'asc' }, { sortOrder: 'asc' }],
    select: {
      component: true,
      scope: true,
      view: true,
      slug: true,
      name: true,
      recommendedComponent: true,
    },
  });
  const componentSlug = (c: string) => `pm-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const components = [...new Set(rows.map((r) => r.component))];
  return [
    ...components.map((c) => ({
      id: componentSlug(c),
      label: c,
      notation: null,
      parentId: null,
      extra: null,
    })),
    ...rows.map((r) => ({
      id: `pma-${r.slug}`,
      label: r.name,
      notation: null,
      parentId: componentSlug(r.component),
      extra: {
        scope: r.scope,
        ...(r.view !== 'COMPONENT' ? { view: r.view } : {}),
        ...(r.recommendedComponent ? { recommendedComponent: r.recommendedComponent } : {}),
      },
    })),
  ];
}

const BUILDERS: Record<SchemeId, (companyId: string) => Promise<TaxonomyNode[]>> = {
  process: processScheme,
  organization: organizationScheme,
  standards: standardsScheme,
  applications: applicationsScheme,
  roles: rolesScheme,
  'product-model': productModelScheme,
};

export function isScheme(value: string): value is SchemeId {
  return (SCHEMES as readonly string[]).includes(value);
}

/** Flat concept list for one scheme, scoped to a company. */
export function buildScheme(scheme: SchemeId, companyId: string): Promise<TaxonomyNode[]> {
  return BUILDERS[scheme](companyId);
}

/** Concept count per scheme (cheap — one count query each, in parallel). */
export async function schemeCounts(companyId: string): Promise<Record<SchemeId, number>> {
  const [process, organization, standards, applications, roles, productModel] = await Promise.all([
    prisma.processNode.count({ where: { companyId } }),
    prisma.orgUnit.count({ where: { companyId } }),
    prisma.standard.count({ where: { companyId } }),
    prisma.application.count({ where: { companyId } }),
    prisma.role.count({ where: { companyId } }),
    prisma.productModelAnatomyCategory.count({ where: { companyId } }),
  ]);
  return {
    process,
    organization,
    standards,
    applications,
    roles,
    'product-model': productModel,
  };
}
