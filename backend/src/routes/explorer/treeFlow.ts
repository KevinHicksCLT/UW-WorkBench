/**
 * Value-stream focus resolution, the L2 end-to-end process flow, and the fully-exploded list tree.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { processSubtree, processSubtrees } from '../../lib/resolvers/index.js';
import { activeCompany, processLevelMap } from './helpers.js';

/** Registers this feature's routes on the shared /explorer router (order preserved). */
export function registerTreeFlowRoutes(router: Router): void {
  router.get('/value-stream/:id/focus', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vs = await prisma.processNode.findFirst({
        where: {
          id: req.params.id,
          company: { tenantId: req.tenantId },
          processLevelType: { levelNumber: 2 },
        },
        select: { id: true, parentId: true, parent: { select: { displayValue: true } } },
      });
      if (!vs) return res.status(404).json({ error: 'No participating division' });
      res.json({
        valueStreamId: vs.id,
        divisionId: vs.id,
        category: vs.parent?.displayValue ?? 'Core Business',
      });
    } catch (e) {
      next(e);
    }
  });

  // End-to-end process flow for a value stream (process L2). Its `valueStreams`
  // are its L3 process areas; each L3's flow `steps` are its L4 sub-processes,
  // whose `subSteps` are the L5 tasks. The whole subtree is one closure read.
  router.get('/division/:id/flow', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const div = await prisma.processNode.findFirst({
        where: {
          id: req.params.id,
          company: { tenantId: req.tenantId },
          processLevelType: { levelNumber: 2 },
        },
        select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
      });
      if (!div) return res.status(404).json({ error: 'Not found' });
      const higherCategory = div.parent?.displayValue ?? null;

      // Depth 4 included: the L5 tasks' nested L6 tasks feed the map's vertical
      // task column under each horizontal L5 card.
      const { nodes } = await processSubtree(div.id, { excludeSelf: true, maxDepth: 4 });
      const byParent = new Map<string, typeof nodes>();
      for (const n of nodes) {
        const p = n.parentId ?? '';
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p)!.push(n);
      }
      const l3 = nodes.filter((n) => n.depth === 1); // process areas = the "valueStreams" row

      const wantVs = typeof req.query.vs === 'string' ? req.query.vs : undefined;
      const selectedVs = l3.find((s) => s.id === wantVs) ?? l3[0] ?? null;

      type FlowStep = {
        id: string;
        step: number;
        name: string;
        subSteps: {
          id: string;
          name: string;
          step: number;
          l5: { id: string; name: string; step: number }[];
        }[];
        inputs: null;
        outputs: null;
        upstream: null;
        downstream: null;
        roles: string[];
        categories: string[];
        primaryCategory: string | null;
        crossDomain: boolean;
        unowned: boolean;
      };
      let selected: { id: string; name: string; steps: FlowStep[] } | null = null;
      if (selectedVs) {
        const l4 = (byParent.get(selectedVs.id) ?? []).filter((n) => n.depth === 2);
        const steps = l4.map((s, i) => ({
          id: s.id,
          step: i + 1,
          name: s.displayValue,
          subSteps: (byParent.get(s.id) ?? [])
            .filter((n) => n.depth === 3)
            .map((x, k) => ({
              id: x.id,
              name: x.displayValue,
              step: k + 1,
              l5: (byParent.get(x.id) ?? [])
                .filter((n) => n.depth === 4)
                .map((c, m) => ({ id: c.id, name: c.displayValue, step: m + 1 })),
            })),
          inputs: null,
          outputs: null,
          upstream: null,
          downstream: null,
          roles: [] as string[],
          categories: [] as string[],
          primaryCategory: higherCategory,
          crossDomain: false,
          unowned: false,
        }));
        selected = { id: selectedVs.id, name: selectedVs.displayValue, steps };
      }
      res.json({
        division: { id: div.id, name: div.displayValue, higherCategory },
        valueStreams: l3.map((s) => ({
          id: s.id,
          name: s.displayValue,
          participationType: 'Lead',
        })),
        selectedId: selectedVs?.id ?? null,
        selected,
      });
    } catch (e) {
      next(e);
    }
  });

  // Fully-exploded tree for the List view: every division (L2) with its L3 → L4 →
  // L5 hierarchy. One closure-driven read per division.
  router.get('/tree', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });
      const { idOf } = await processLevelMap(company.id);
      const l2 = idOf(2);
      const divisions = l2
        ? await prisma.processNode.findMany({
            where: { companyId: company.id, processLevelTypeId: l2 },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, displayValue: true, parent: { select: { displayValue: true } } },
          })
        : [];

      // One batched closure read across all divisions (was two queries per division).
      // Only L3/L4/L5 (depths 1–3 below the division) are rendered, so bound the
      // read there instead of pulling every task/leaf node beneath each division.
      const subtrees = await processSubtrees(
        divisions.map((d) => d.id),
        { excludeSelf: true, maxDepth: 3 },
      );

      res.json({
        company: { id: company.id, name: company.name },
        divisions: divisions.map((d) => {
          const nodes = subtrees.get(d.id)?.nodes ?? [];
          const byParent = new Map<string, typeof nodes>();
          for (const n of nodes) {
            const p = n.parentId ?? '';
            if (!byParent.has(p)) byParent.set(p, []);
            byParent.get(p)!.push(n);
          }
          const l3 = nodes.filter((n) => n.depth === 1);
          return {
            id: d.id,
            name: d.displayValue,
            higherCategory: d.parent?.displayValue ?? null,
            roles: 0,
            valueStreams: l3.map((area) => ({
              id: area.id,
              name: area.displayValue,
              areas: (byParent.get(area.id) ?? [])
                .filter((n) => n.depth === 2)
                .map((l4, j) => ({
                  id: l4.id,
                  step: j + 1,
                  name: l4.displayValue,
                  subProcesses: (byParent.get(l4.id) ?? [])
                    .filter((n) => n.depth === 3)
                    .map((l5, k) => ({
                      id: l5.id,
                      step: k + 1,
                      name: l5.displayValue,
                      steps: [] as { id: string; step: number; name: string }[],
                    })),
                })),
            })),
          };
        }),
      });
    } catch (e) {
      next(e);
    }
  });

  // ── Testing templates ────────────────────────────────────────────────────────
  // For a focused ProcessNode (any level), the testing-template rows whose task
  // node is in this node's task subtree (isTask ids via the closure), UNION any
  // rows tied to the node's deliverables (NodeDeliverable → deliverableId).
  // Returned as flat key/value-friendly rows, ordered by the task's sortOrder.
  // Parse a workbook "Testing Plan" cell into its two structured sections so the
  // UI can render them as key/value pairs: a "Generic pattern" (numbered checklist)
}
