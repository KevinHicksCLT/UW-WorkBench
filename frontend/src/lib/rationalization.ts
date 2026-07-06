// Types + vocabulary for the Application Rationalization board. An application's
// value stream is split into business-process STAGES (chevrons); each stage's
// code is decomposed by IT layer into findings, grouped into CAPDAN categories.

export const LAYERS = ['UI', 'Integration', 'Business Service', 'Data', 'Infrastructure'] as const;
export type Layer = (typeof LAYERS)[number];

export type Capdan = 'Common' | 'Different' | 'Relocate' | 'Eliminate';
export const CAPDAN_ORDER: Capdan[] = ['Common', 'Different', 'Relocate', 'Eliminate'];

// CAPDAN class → label, chip classes, and a solid accent for dots / lines.
export const CAPDAN_META: Record<Capdan, { label: string; chip: string; dot: string }> = {
  Common: { label: 'Common', chip: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]', dot: '#10b981' },
  Different: {
    label: 'Different',
    chip: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
    dot: '#2563eb',
  },
  Relocate: {
    label: 'Relocate',
    chip: 'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]',
    dot: '#7c3aed',
  },
  Eliminate: {
    label: 'Eliminate',
    chip: 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]',
    dot: '#e11d48',
  },
};

export type ByCapdan = Record<Capdan, number>;

// Anatomy lens (WR-06): findings are viewed either as UI COMPONENTS or as
// BEHAVIOR (logic/rules); the catalog adds a MISPLACED view for taxonomy rows
// describing what must NOT live in a layer.
export type FindingView = 'COMPONENT' | 'BEHAVIOR';
export type AnatomyView = FindingView | 'MISPLACED';

// GET /rationalization/anatomy-catalog — the reference taxonomy row.
export type AnatomyCategory = {
  layer: string;
  view: AnatomyView;
  name: string;
  description: string;
  recommendedLayer: string | null;
};

// A screen or modal of a legacy app (WR-06: clickable screen chips).
export type ScreenAsset = {
  id: string;
  appId: string | null;
  name: string;
  kind: 'SCREEN' | 'MODAL';
  url: string | null;
  processNodeId: string | null;
};

export type StageListItem = {
  id: string;
  name: string;
  application: string | null;
  stageOrder: number;
  businessProcess: string | null;
  status: string;
  illustrative: boolean;
  findings: number;
  byCapdan: ByCapdan;
  progress: number;
};

export type LayerRollup = {
  layer: Layer;
  findings: number;
  progress: number;
  byCapdan: ByCapdan;
  relocateOut: number;
};

export type Finding = {
  id: string;
  appId: string;
  layer: Layer;
  category: string | null;
  view: FindingView | null; // null/missing → treated as COMPONENT
  screenRef: string | null; // UI findings: screen/modal name it lives on
  plainSummary: string | null; // one-sentence non-technical explanation
  recommendedLayer: string | null; // misplaced items: where this belongs
  capdan: Capdan;
  targetLayer: Layer | null;
  name: string;
  codeRef: string | null;
  migrationApproach: string | null;
  rationale: string | null;
  effort: string | null;
  complexity: string | null;
  migrationStatus: string;
};

// Normalize a finding's anatomy view (older rows may omit it).
export const findingView = (f: Finding): FindingView => f.view ?? 'COMPONENT';

export type AppCol = {
  id: string;
  name: string;
  techStack: string | null;
  disposition: string | null;
  position: number;
};
export type Component = {
  id: string;
  layer: Layer;
  name: string;
  principle: string | null;
  pattern: string | null;
  targetTech: string | null;
  destination: string | null;
  microserviceId: string | null;
  migrationStatus: string;
};
export type Microservice = {
  id: string;
  name: string;
  kind: string;
  status: string;
  techStack: string | null;
  ownerRole: string | null;
};

// User-curated board overlay persisted on the workspace. Positions override the
// derived layout; addedEdges/removedEdges layer on top of the derived arrows.
export type BoardLayout = {
  positions?: Record<string, { x: number; y: number }>;
  addedEdges?: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }[];
  removedEdges?: string[];
};

export type StageDetail = {
  id: string;
  name: string;
  application: string | null;
  stageOrder: number;
  businessProcess: string | null;
  description: string | null;
  northstar: string | null;
  status: string;
  illustrative: boolean;
  layout: BoardLayout | null;
  progress: number;
  counts: { findings: number } & ByCapdan;
  byLayer: LayerRollup[];
  apps: AppCol[];
  components: Component[];
  microservices: Microservice[];
  screens: ScreenAsset[];
  findings: Finding[];
};

// Migration lifecycle (drives the status dot on each finding).
export const STATUS_META: Record<string, { label: string; dot: string }> = {
  Identified: { label: 'Identified', dot: '#d4d4d4' },
  'In Analysis': { label: 'In Analysis', dot: '#f59e0b' },
  Normalized: { label: 'Normalized', dot: '#6366f1' },
  'In Migration': { label: 'In Migration', dot: '#0ea5e9' },
  Migrated: { label: 'Migrated', dot: '#10b981' },
  Retired: { label: 'Retired', dot: '#64748b' },
};
export const STATUS_ORDER = [
  'Identified',
  'In Analysis',
  'Normalized',
  'In Migration',
  'Migrated',
  'Retired',
];

export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const statusDot = (s: string) => STATUS_META[s]?.dot ?? '#d4d4d4';

// A category tag aggregates findings of one (app, layer, category) cell.
export type CategoryTag = {
  appId: string;
  layer: Layer;
  category: string;
  capdan: Capdan;
  targetLayer: Layer | null;
  count: number;
  findings: Finding[];
};

// Group one cell's findings (app × layer) into category tags. When `view` is
// given, only findings of that anatomy view feed the tags (WR-06); findings
// with a missing view count as COMPONENT.
export function categoryTags(
  findings: Finding[],
  layer: Layer,
  appId?: string,
  view?: FindingView,
): CategoryTag[] {
  const byKey = new Map<string, CategoryTag>();
  for (const f of findings) {
    if (f.layer !== layer) continue;
    if (appId && f.appId !== appId) continue;
    if (view && findingView(f) !== view) continue;
    const cat = f.category ?? 'Other';
    const key = `${cat}␟${f.capdan}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count++;
      existing.findings.push(f);
    } else
      byKey.set(key, {
        appId: f.appId,
        layer,
        category: cat,
        capdan: f.capdan,
        targetLayer: f.targetLayer,
        count: 1,
        findings: [f],
      });
  }
  return [...byKey.values()].sort(
    (a, b) => CAPDAN_ORDER.indexOf(a.capdan) - CAPDAN_ORDER.indexOf(b.capdan) || b.count - a.count,
  );
}
