/**
 * Board routes for the Workspace Products lens — the server side of the
 * performance redesign. The client no longer receives the whole spine with
 * every element; it receives:
 *
 *   GET /product-spine/board    — render-ready aggregates for the grid face:
 *       lean spine (filter bar), column axis (folded to one per product past
 *       48 versions), per-component heat rows and the forms register — all
 *       WITHOUT element-level review rows.
 *   GET /product-spine/review   — ONE drill's review rows (component, form or
 *       all), scope- and search-filtered server-side, capped at 400 rows.
 *   GET /product-spine/compare  — full element payloads for ≤12 named
 *       versions — the detail board face only.
 *
 * All three are registered BEFORE the response cache: the spine loader keeps
 * its own short memo (lib/resolvers/productBoard), decisions are merged live
 * per request, so a sign-off is visible on the next fetch instead of a cached
 * count going stale.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { activeCompany } from '../explorer/helpers.js';
import {
  buildHeatmap,
  loadDecisions,
  loadSpine,
  scopeLobs,
  type HeatCell,
  type Heatmap,
  type ReviewRow,
  type SpineFilters,
  type SpineLob,
  type SpineComponent,
} from '../../lib/resolvers/productBoard.js';
import { prisma } from '../../db/prisma.js';
import {
  buildFormsModel,
  classifyForm,
  CONTENT_LABEL,
  FORMS_COMPONENT,
  ROLLED_UP_COMPONENTS,
  splitProductModel,
  type FormsModel,
} from '../../lib/resolvers/productForms.js';
import {
  parseElements,
  parseStates,
  stateOf,
  versionTokenOf,
  NO_STATE,
} from '../../lib/resolvers/productBoard.js';

const REVIEW_ROW_CAP = 400;

const scopeSchema = z.object({
  segments: z.string().optional(),
  lobs: z.string().optional(),
  offerings: z.string().optional(),
  states: z.string().optional(),
  tokens: z.string().optional(),
  versions: z.string().optional(),
});

/** Multi-select params arrive '|'-joined (names can contain commas). */
function parseScope(query: unknown): SpineFilters {
  const q = scopeSchema.parse(query);
  const split = (s?: string) => (s ? s.split('|').filter(Boolean) : []);
  return {
    segments: split(q.segments),
    lobIds: split(q.lobs),
    offerings: split(q.offerings),
    states: split(q.states),
    versionTokens: split(q.tokens),
    versionIds: split(q.versions),
  };
}

/** Cells go over the wire SPARSE — only non-empty columns, keyed by column
 *  index. A register row typically carries 1 of 77 columns; shipping the
 *  dense matrix put a 6 MB payload on a 300 KB board. The client re-expands
 *  against the column axis (boardApi.denseCells). */
interface SparseCell {
  i: number;
  total: number;
  auto: number;
  need: number;
  decided: number;
  common: number;
  similar: number;
  unique: number;
}

function sparse(cells: HeatCell[]): SparseCell[] {
  const out: SparseCell[] = [];
  cells.forEach((c, i) => {
    if (c.na) return;
    out.push({
      i,
      total: c.total,
      auto: c.auto,
      need: c.need,
      decided: c.decided,
      common: c.common,
      similar: c.similar,
      unique: c.unique,
    });
  });
  return out;
}

/** Heat rows ship without their element-level review rows, cells sparse. */
function stripHeat(heat: Heatmap) {
  return heat.rows.map(({ reviewRows: _reviewRows, cells, ...row }) => ({
    ...row,
    cells: sparse(cells),
  }));
}

function stripForms(forms: FormsModel | null) {
  if (!forms) return null;
  return {
    counts: forms.counts,
    sections: forms.sections.map((s) => ({
      layer: s.layer,
      rows: s.rows.map(({ cells, contents: _contents, ...row }) => ({
        ...row,
        cells: sparse(cells),
      })),
    })),
  };
}

async function boardInputs(req: Request) {
  const company = await activeCompany(req);
  if (!company) return null;
  const [spine, decisions] = await Promise.all([loadSpine(company.id), loadDecisions(company.id)]);
  const filters = parseScope(req.query);
  const scoped = scopeLobs(spine.lobs, filters);
  return { company, spine, decisions, filters, scoped };
}

export function registerProductBoardRoutes(router: Router): void {
  router.get('/board', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inputs = await boardInputs(req);
      if (!inputs) return res.status(404).json({ error: 'No company' });
      const { spine, decisions, scoped } = inputs;

      const heat = buildHeatmap(scoped, decisions);
      const forms = buildFormsModel(heat, scoped);

      // Lean spine for the cascading filter bar — names and ids only.
      const lean = spine.lobs.map((l) => ({
        id: l.id,
        name: l.name,
        segmentName: l.segmentName,
        versions: l.versions.map((v) => ({
          id: v.id,
          name: v.name,
          status: v.status,
          productName: v.productName,
          lobId: v.lobId,
          lobName: v.lobName,
          segmentName: v.segmentName,
          states: v.states,
        })),
      }));

      res.json({
        levels: spine.levels,
        spine: lean,
        columnMode: heat.columnMode,
        columns: heat.columns,
        heat: { rows: stripHeat(heat), totals: heat.totals },
        forms: stripForms(forms),
        rolledUp: [FORMS_COMPONENT, ...ROLLED_UP_COMPONENTS],
        scopedVersions: scoped.reduce((n, l) => n + l.versions.length, 0),
      });
    } catch (e) {
      next(e);
    }
  });

  router.get('/review', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inputs = await boardInputs(req);
      if (!inputs) return res.status(404).json({ error: 'No company' });
      const { decisions, scoped } = inputs;
      const { drill, q } = z
        .object({ drill: z.string().min(1), q: z.string().optional() })
        .parse({ drill: req.query.drill, q: req.query.q });

      const heat = buildHeatmap(scoped, decisions);

      let rows: ReviewRow[];
      let groupOf: Record<string, string> | undefined;
      let selfRow: ReviewRow | null = null;
      let pct = heat.totals.pct;
      if (drill === '__all__') {
        rows = heat.rows.flatMap((r) => r.reviewRows);
      } else if (drill.startsWith('forms:')) {
        const forms = buildFormsModel(heat, scoped);
        const payload = forms?.byKey.get(drill.slice('forms:'.length));
        if (!payload) return res.status(404).json({ error: 'Unknown form drill' });
        rows = payload.reviewRows;
        groupOf = payload.groupOf;
        selfRow = payload.self;
        pct = payload.pct;
      } else {
        const row = heat.rows.find((r) => r.component === drill);
        if (!row) return res.status(404).json({ error: 'Unknown component drill' });
        rows = row.reviewRows;
        pct = row.pct;
      }

      const needle = (q ?? '').trim().toLowerCase();
      if (needle) {
        rows = rows.filter((r) => {
          const el = Object.values(r.group.perVersion)[0];
          return `${r.group.name} ${el?.description ?? ''} ${r.lobName}`
            .toLowerCase()
            .includes(needle);
        });
      }

      const total = rows.length;
      const capped = rows.slice(0, REVIEW_ROW_CAP);
      res.json({
        columns: heat.columns,
        columnMode: heat.columnMode,
        rows: capped,
        total,
        truncated: Math.max(0, total - capped.length),
        pct,
        self: selfRow,
        groupOf,
        groupOrder: ['Form', ...Object.values(CONTENT_LABEL)],
      });
    } catch (e) {
      next(e);
    }
  });

  // The Product Models TOC's product page: the model read the way the
  // rationalization document reads it — FORMS decomposed into coverages /
  // terms / endorsements / clauses, then Rating · Pricing · Underwriting
  // Rules · Filings · Lifecycle Behavior — for the countrywide version, plus
  // per-state overlays (the components a state's own form actually deviates
  // on). Versions and jurisdictions surface as FILTERS here, never as levels.
  router.get('/product/:id/model', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const { id, version: versionParam } = z
        .object({ id: z.string().min(1), version: z.string().optional() })
        .parse({ ...req.params, version: req.query.version });

      const product = await prisma.productNode.findFirst({
        where: { id, companyId: company.id },
        select: {
          id: true,
          displayValue: true,
          description: true,
          code: true,
          parentId: true,
          attributes: true,
          productLevelType: { select: { levelNumber: true } },
        },
      });
      if (!product || product.productLevelType.levelNumber !== 3)
        return res.status(404).json({ error: 'Product not found' });

      // Ancestry (LOB, segment) + the version/component subtree — batched.
      const [versions, lobNode] = await Promise.all([
        prisma.productNode.findMany({
          where: { parentId: product.id, companyId: company.id },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, displayValue: true, status: true, attributes: true },
        }),
        product.parentId
          ? prisma.productNode.findFirst({
              where: { id: product.parentId, companyId: company.id },
              select: { id: true, displayValue: true, parentId: true },
            })
          : Promise.resolve(null),
      ]);
      const [components, segNode] = await Promise.all([
        prisma.productNode.findMany({
          where: { parentId: { in: versions.map((v) => v.id) }, companyId: company.id },
          orderBy: { sortOrder: 'asc' },
          select: { parentId: true, displayValue: true, sortOrder: true, attributes: true },
        }),
        lobNode?.parentId
          ? prisma.productNode.findFirst({
              where: { id: lobNode.parentId, companyId: company.id },
              select: { id: true, displayValue: true },
            })
          : Promise.resolve(null),
      ]);

      const compsOf = (versionId: string): Map<string, SpineComponent> => {
        const map = new Map<string, SpineComponent>();
        for (const c of components) {
          if (c.parentId !== versionId) continue;
          map.set(c.displayValue, {
            name: c.displayValue,
            sortOrder: c.sortOrder,
            elements: parseElements(c.attributes),
          });
        }
        return map;
      };

      const enriched = versions.map((v) => ({
        id: v.id,
        name: v.displayValue,
        status: v.status,
        state: stateOf(v.displayValue),
        version: versionTokenOf(v.displayValue),
        states: parseStates(v.attributes, v.displayValue),
        components: compsOf(v.id),
      }));

      // Versions are GENERATIONS (v1, v2, …) — each is a complete edition of
      // the product (countrywide core + its own-form states), and the page
      // filters to exactly one. Default: the latest generation.
      const generationNo = (t: string) => Number(/^v(\d+)$/.exec(t)?.[1] ?? 0);
      const tokens = [...new Set(enriched.map((v) => v.version))].sort(
        (a, b) => generationNo(a) - generationNo(b),
      );
      const generations = tokens.map((t) => {
        const members = enriched.filter((v) => v.version === t);
        const core = members.find((v) => v.state === NO_STATE) ?? null;
        return {
          version: t,
          status: core?.status ?? members[0]?.status ?? null,
          countrywideStates: core?.states ?? [],
          ownFormStates: members
            .filter((v) => v.state !== NO_STATE)
            .map((v) => v.state)
            .sort(),
        };
      });
      const selectedVersion =
        versionParam && tokens.includes(versionParam) ? versionParam : (tokens.at(-1) ?? null);
      const inGeneration = enriched.filter((v) => v.version === selectedVersion);

      const countrywide = inGeneration.find((v) => v.state === NO_STATE) ?? inGeneration[0] ?? null;
      if (!countrywide) return res.status(404).json({ error: 'Product has no versions' });

      const stateOverlays = inGeneration
        .filter((v) => v.id !== countrywide.id && v.state !== NO_STATE)
        .map((v) => ({
          state: v.state,
          versionId: v.id,
          status: v.status,
          forms: (v.components.get(FORMS_COMPONENT)?.elements ?? []).map((e) => ({
            ...e,
            layer: classifyForm(e.element, e, false).layer,
          })),
          filings: v.components.get('Filings')?.elements ?? [],
        }));

      const attrs = (product.attributes ?? {}) as { runsIn?: unknown };
      res.json({
        product: {
          id: product.id,
          name: product.displayValue,
          code: product.code,
          description: product.description,
          runsIn: typeof attrs.runsIn === 'string' ? attrs.runsIn : null,
        },
        ancestors: [
          ...(segNode ? [{ id: segNode.id, name: segNode.displayValue, levelNumber: 1 }] : []),
          ...(lobNode ? [{ id: lobNode.id, name: lobNode.displayValue, levelNumber: 2 }] : []),
        ],
        countrywide: {
          versionId: countrywide.id,
          name: countrywide.name,
          status: countrywide.status,
          states: countrywide.states,
        },
        model: splitProductModel(countrywide.components),
        stateOverlays,
        generations,
        selectedVersion,
      });
    } catch (e) {
      next(e);
    }
  });

  router.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const { ids } = z.object({ ids: z.string().min(1) }).parse({ ids: req.query.ids });
      const versionIds = ids.split(',').filter(Boolean).slice(0, 12);

      const spine = await loadSpine(company.id);
      const wanted = new Set(versionIds);
      const versions = spine.lobs
        .flatMap((l: SpineLob) => l.versions)
        .filter((v) => wanted.has(v.id))
        .map((v) => ({
          id: v.id,
          name: v.name,
          status: v.status,
          productName: v.productName,
          lobId: v.lobId,
          lobName: v.lobName,
          segmentName: v.segmentName,
          components: [...v.components.values()].map((c) => ({
            name: c.name,
            sortOrder: c.sortOrder,
            elements: c.elements,
          })),
        }));
      // The comparison itself stays client-side for this face (≤12 versions is
      // cheap); the server just guarantees the payload is bounded.
      res.json({ versions });
    } catch (e) {
      next(e);
    }
  });
}
