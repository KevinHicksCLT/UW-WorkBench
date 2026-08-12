/**
 * GET /product-spine/table — one bootstrap payload for every product-model
 * view (TOC / Map / List), mirroring /explorer/org-table: the company's
 * ProductLevelType names plus the full nested product tree
 * (L1 segment → L2 LOB family → L3 product → L4 version → L5 model component).
 * The tree is small (a few hundred nodes) so it ships whole; node `attributes`
 * carry the level-specific facts (systems of record, jurisdiction, effective
 * dates, owner, element source locations).
 */
import type { Router, Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { activeCompany } from '../explorer/helpers.js';
import {
  FORMS_COMPONENT_NAME,
  loadFormElementsByVersionNode,
} from '../../lib/resolvers/productBoard.js';
import { isHiddenComponent, sanitizeAttributes } from './helpers.js';

interface ProductTreeNode {
  id: string;
  name: string;
  levelNumber: number;
  description: string | null;
  status: string | null;
  sortOrder: number;
  attributes: Prisma.JsonValue;
  /** Total descendant count per level number (e.g. products/versions under a segment). */
  rollup: Record<number, number>;
  children: ProductTreeNode[];
}

export function registerProductTableRoutes(router: Router): void {
  router.get('/table', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req);
      if (!company) return res.status(404).json({ error: 'No company' });

      const [levelTypes, allNodes, formsByVersionNode] = await Promise.all([
        prisma.productLevelType.findMany({
          where: { companyId: company.id },
          orderBy: { levelNumber: 'asc' },
          select: { levelNumber: true, dbValue: true, displayValue: true },
        }),
        prisma.productNode.findMany({
          where: { companyId: company.id },
          orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
          select: {
            id: true,
            parentId: true,
            displayValue: true,
            description: true,
            status: true,
            sortOrder: true,
            attributes: true,
            productLevelType: { select: { levelNumber: true } },
          },
        }),
        // Forms components render the PolicyForm library (FormProductNode) —
        // node attributes carry no form lists.
        loadFormElementsByVersionNode(company.id),
      ]);

      // The 'Product Taxonomy' model component is hidden from every product
      // view (workspace board + Products tab); the rows stay in the DB.
      const nodes = allNodes.filter(
        (n) => !isHiddenComponent(n.productLevelType.levelNumber, n.displayValue),
      );

      const byParent = new Map<string | null, typeof nodes>();
      for (const n of nodes) {
        const key = n.parentId ?? null;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(n);
      }

      const build = (parentId: string | null): ProductTreeNode[] =>
        (byParent.get(parentId) ?? []).map((n) => {
          const children = build(n.id);
          const rollup: Record<number, number> = {};
          for (const c of children) {
            rollup[c.levelNumber] = (rollup[c.levelNumber] ?? 0) + 1;
            for (const [lvl, cnt] of Object.entries(c.rollup)) {
              rollup[Number(lvl)] = (rollup[Number(lvl)] ?? 0) + cnt;
            }
          }
          const sanitized = sanitizeAttributes(n.attributes);
          const isFormsComponent =
            n.productLevelType.levelNumber === 5 &&
            n.displayValue === FORMS_COMPONENT_NAME &&
            n.parentId;
          const attributes: Prisma.JsonValue = isFormsComponent
            ? ({
                ...(sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
                  ? sanitized
                  : {}),
                elements: (formsByVersionNode.get(n.parentId!) ??
                  []) as unknown as Prisma.JsonValue[],
              } as Prisma.JsonValue)
            : sanitized;
          return {
            id: n.id,
            name: n.displayValue,
            levelNumber: n.productLevelType.levelNumber,
            description: n.description,
            status: n.status,
            sortOrder: n.sortOrder,
            attributes,
            rollup,
            children,
          };
        });

      const roots = build(null);

      const totals: Record<number, number> = {};
      for (const n of nodes) {
        const lvl = n.productLevelType.levelNumber;
        totals[lvl] = (totals[lvl] ?? 0) + 1;
      }

      res.json({
        company,
        levels: levelTypes.map((l) => ({
          levelNumber: l.levelNumber,
          dbValue: l.dbValue,
          name: l.displayValue,
        })),
        totals,
        roots,
      });
    } catch (e) {
      next(e);
    }
  });
}
