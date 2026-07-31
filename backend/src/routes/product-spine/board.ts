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
} from '../../lib/resolvers/productBoard.js';
import {
  buildFormsModel,
  CONTENT_LABEL,
  FORMS_COMPONENT,
  ROLLED_UP_COMPONENTS,
  type FormsModel,
} from '../../lib/resolvers/productForms.js';

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
      let pct = heat.totals.pct;
      if (drill === '__all__') {
        rows = heat.rows.flatMap((r) => r.reviewRows);
      } else if (drill.startsWith('forms:')) {
        const forms = buildFormsModel(heat, scoped);
        const payload = forms?.byKey.get(drill.slice('forms:'.length));
        if (!payload) return res.status(404).json({ error: 'Unknown form drill' });
        rows = payload.reviewRows;
        groupOf = payload.groupOf;
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
        groupOf,
        groupOrder: ['Form', ...Object.values(CONTENT_LABEL)],
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
