// buildBoard — the ONE domain-generic board builder (v3 wireframe): a single
// legacy panel showing the selected source (app-switcher chips in its header),
// vocabulary-driven axis, Normalize comparison boxes, dead-code lane, and the
// green-stay / red-move count-badged edge model. Exercised against the §6.2
// product fixture and a synthetic 3-source application board.
import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  classificationFrom,
  layersFrom,
  matchMetaFrom,
  withV3Defaults,
  type Finding,
  type StageDetail,
} from '../../../src/lib/rationalization';
import {
  fixtureProductWorkspace,
  fixtureVocabulary,
} from '../../../src/pages/greenfield-migration/fixtures';
import {
  buildBoardBase,
  columnStatsLine,
} from '../../../src/pages/greenfield-migration/buildBoard';
import { EDGE_MOVE, EDGE_STAY } from '../../../src/pages/greenfield-migration/edges';
import type { NormalizeNodeData } from '../../../src/pages/greenfield-migration/normalizeNodes';
import type { DeadItem } from '../../../src/pages/greenfield-migration/boardNodes';

const noop = () => undefined;

function productBoard() {
  const rows = fixtureVocabulary('PRODUCT_MODEL');
  const classification = classificationFrom(rows);
  const detail = withV3Defaults(fixtureProductWorkspace(), classification);
  const board = buildBoardBase(detail, {
    view: null,
    expanded: {},
    onToggleCategory: noop,
    layers: layersFrom(rows),
    classification,
    matchMeta: matchMetaFrom(rows),
    domain: 'PRODUCT_MODEL',
  });
  return { detail, board };
}

const ofType = (nodes: Node[], type: string) => nodes.filter((n) => n.type === type);

describe('buildBoardBase — product domain (fixture)', () => {
  it('renders ONE legacy panel (the selected source) with a cell per layer', () => {
    const { board, detail } = productBoard();
    // 11 product components, one section cell each — for the first model only.
    expect(ofType(board.nodes, 'cell')).toHaveLength(11);
    // The wireframe's sections self-label — no far-left layer labels.
    expect(ofType(board.nodes, 'layerLabel')).toHaveLength(0);
    const first = detail.apps.filter((a) => a.kind !== 'SHARED_SERVICE')[0];
    for (const cell of ofType(board.nodes, 'cell'))
      expect((cell.data as { appId: string }).appId).toBe(first.id);
  });

  it('puts the source-switcher chips on the legacy header', () => {
    const { board, detail } = productBoard();
    const legacy = detail.apps.filter((a) => a.kind !== 'SHARED_SERVICE');
    const hdr = board.nodes.find((n) => n.id === `hdr:${legacy[0].id}`);
    const sources = (hdr?.data as { sources: { id: string }[] }).sources;
    expect(sources.map((s) => s.id)).toEqual(legacy.map((a) => a.id));
  });

  it('creates a Normalize box per layer with a component, carrying its entries', () => {
    const { board, detail } = productBoard();
    const caps = ofType(board.nodes, 'capdan');
    expect(caps).toHaveLength(detail.components.length);
    const rate = caps.find((n) => n.id === 'cap:Rating & Pricing');
    const data = rate?.data as NormalizeNodeData;
    expect(data.entries.map((e) => e.notation).sort()).toEqual(['P-401', 'P-402', 'P-403']);
    expect(data.rawCount).toBe(
      detail.findings.filter((f) => f.layer === 'Rating & Pricing' && !f.deadCode).length,
    );
  });

  it('renders the full-width dead-code lane with one row per dead finding', () => {
    const { board, detail } = productBoard();
    const lane = board.nodes.find((n) => n.type === 'deadLane');
    expect(lane).toBeDefined();
    const items = (lane?.data as { items: DeadItem[] }).items;
    expect(items).toHaveLength(detail.findings.filter((f) => f.deadCode).length);
    expect(items.every((i) => !i.retired)).toBe(true);
  });

  it('draws green stay-edges into Normalize and greenfield edges out of it', () => {
    const { board, detail } = productBoard();
    const stayEdges = board.edges.filter((e) => e.id.startsWith('c-'));
    expect(stayEdges.length).toBeGreaterThan(0);
    for (const e of stayEdges) expect(e.style?.stroke).toBe(EDGE_STAY);
    const gf = board.edges.filter((e) => e.id.startsWith('d-'));
    expect(gf).toHaveLength(detail.components.filter((c) => c.microserviceId).length);
  });

  it('puts the §6.2 roll-ups on the column headers', () => {
    const { board, detail } = productBoard();
    const hdr = board.nodes.find((n) => n.id === 'hdr:pm-policypro');
    const stats = (hdr?.data as { stats: string | null }).stats;
    expect(stats).toBe('10 steps · 9 correct · 0 move · 1 dead');
    const cap = board.nodes.find((n) => n.id === 'hdr:cap');
    const ns = detail.normalizeStats!;
    expect((cap?.data as { stats: string }).stats).toBe(
      `${ns.raw} raw steps · ${ns.normalized} normalized · ${ns.awaitingReview} awaiting review`,
    );
  });
});

// ── Application domain, 3 sources (source switcher + red move edges) ────────

let seq = 0;
const finding = (over: Partial<Finding>): Finding => ({
  id: `f-${seq++}`,
  appId: 'a1',
  layer: 'UI',
  category: 'Forms',
  view: 'COMPONENT',
  screenRef: null,
  plainSummary: null,
  recommendedLayer: null,
  capdan: 'Common',
  targetLayer: null,
  sharedServiceId: null,
  name: 'f',
  codeRef: null,
  migrationApproach: null,
  rationale: null,
  effort: null,
  complexity: null,
  migrationStatus: 'Identified',
  deadCode: false,
  normalizationEntryId: null,
  whyThisMoves: null,
  ...over,
});

function appDetail(): StageDetail {
  const apps = ['a1', 'a2', 'a3'].map((id, i) => ({
    id,
    name: `App ${id}`,
    kind: 'LEGACY',
    techStack: null,
    disposition: null,
    position: i,
  }));
  return {
    id: 'w1',
    name: 'Stage',
    application: 'App',
    stageOrder: 0,
    businessProcess: null,
    description: null,
    northstar: null,
    status: 'Active',
    illustrative: true,
    layout: null,
    progress: 0.5,
    counts: { findings: 4 },
    byLayer: [],
    apps,
    components: [
      {
        id: 'c-ui',
        layer: 'UI',
        name: 'UI Normalize',
        principle: null,
        pattern: null,
        targetTech: null,
        destination: null,
        microserviceId: null,
        migrationStatus: 'Identified',
      },
      {
        id: 'c-bs',
        layer: 'Business Service',
        name: 'BS Normalize',
        principle: null,
        pattern: null,
        targetTech: null,
        destination: null,
        microserviceId: null,
        migrationStatus: 'Identified',
      },
    ],
    microservices: [],
    screens: [],
    findings: [
      finding({ appId: 'a1' }),
      finding({ appId: 'a2' }),
      finding({ appId: 'a3', capdan: 'Relocate', targetLayer: 'Business Service' }),
      finding({ appId: 'a2', layer: 'Business Service' }),
    ],
  };
}

describe('buildBoardBase — application domain, 3 sources', () => {
  const rows = fixtureVocabulary('APPLICATION');
  const classification = classificationFrom(rows);
  const layers = layersFrom(rows);
  const build = (opts: { selectedSourceId?: string; comparePair?: [string, string] } = {}) =>
    buildBoardBase(withV3Defaults(appDetail(), classification), {
      view: 'COMPONENT',
      expanded: {},
      onToggleCategory: noop,
      layers,
      classification,
      matchMeta: matchMetaFrom(rows),
      domain: 'APPLICATION',
      comparePair: opts.comparePair ?? null,
      selectedSourceId: opts.selectedSourceId ?? null,
    });

  it('renders one cell per layer for the selected source only', () => {
    const board = build();
    expect(ofType(board.nodes, 'cell')).toHaveLength(layers.length);
    for (const cell of ofType(board.nodes, 'cell'))
      expect((cell.data as { appId: string }).appId).toBe('a1');
    const switched = build({ selectedSourceId: 'a3' });
    for (const cell of ofType(switched.nodes, 'cell'))
      expect((cell.data as { appId: string }).appId).toBe('a3');
  });

  it('draws the relocation as a count-badged red move-edge from the selected source', () => {
    const board = build({ selectedSourceId: 'a3' });
    const move = board.edges.find((e) => e.id === 'r-UI-Business Service');
    expect(move).toBeDefined();
    expect(move?.style?.stroke).toBe(EDGE_MOVE);
    expect(move?.source).toBe('cell:a3:UI');
    expect(move?.target).toBe('cap:Business Service');
    expect((move?.data as { label: string }).label).toBe('1');
  });

  it('carries the stay count on the green edge', () => {
    const board = build();
    const stay = board.edges.find((e) => e.id === 'c-UI');
    expect(stay).toBeDefined();
    expect((stay?.data as { label: string }).label).toBe('1');
  });

  it('frames Normalize comparisons with the selected pair when > 2 sources', () => {
    const board = build({ comparePair: ['a1', 'a3'] });
    const cap = board.nodes.find((n) => n.id === 'cap:UI');
    expect((cap?.data as NormalizeNodeData).sourceNames).toEqual(['App a1', 'App a3']);
  });
});

describe('columnStatsLine', () => {
  it('renders the wireframe roll-up, omitting empty screen/dead segments', () => {
    expect(
      columnStatsLine({ sourceId: 'x', rawSteps: 80, correct: 43, move: 17, deadCode: 7 }, 12),
    ).toBe('12 screens · 80 steps · 43 correct · 17 move · 7 dead');
    expect(
      columnStatsLine({ sourceId: 'x', rawSteps: 4, correct: 4, move: 0, deadCode: 0 }, 0),
    ).toBe('4 steps · 4 correct · 0 move');
    expect(columnStatsLine(undefined, 3)).toBeNull();
  });
});
