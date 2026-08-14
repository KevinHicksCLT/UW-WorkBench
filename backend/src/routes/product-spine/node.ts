/**
 * GET /product-spine/node/:id — one product node's full detail for the
 * dedicated drill page: the node itself, its ancestor chain (root first, via
 * the closure), its direct children (with child counts), and the company's
 * level names. Tenant-scoped through the company walk; cross-tenant → 404.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { activeCompany } from '../explorer/helpers.js';
import {
  FORMS_COMPONENT_NAME,
  loadFormElementsByVersionNode,
} from '../../lib/resolvers/productBoard.js';
import { isHiddenComponent, sanitizeAttributes } from './helpers.js';

const NODE_SELECT = {
  id: true,
  parentId: true,
  displayValue: true,
  description: true,
  status: true,
  sortOrder: true,
  attributes: true,
  productLevelType: { select: { levelNumber: true } },
} as const;

export function registerProductNodeRoutes(router: Router): void {
  router.get('/node/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });

      const node = await prisma.productNode.findFirst({
        where: { id: req.params.id, companyId: company.id },
        select: NODE_SELECT,
      });
      if (!node) return res.status(404).json({ error: 'Not found' });

      const [levels, ancestorEdges, children] = await Promise.all([
        prisma.productLevelType.findMany({
          where: { companyId: company.id },
          orderBy: { levelNumber: 'asc' },
          select: { levelNumber: true, dbValue: true, displayValue: true },
        }),
        prisma.productNodeClosure.findMany({
          where: { descendantId: node.id, depth: { gt: 0 } },
          orderBy: { depth: 'desc' }, // deepest depth = the root → root-first
          select: {
            depth: true,
            ancestor: {
              select: {
                id: true,
                displayValue: true,
                productLevelType: { select: { levelNumber: true } },
              },
            },
          },
        }),
        prisma.productNode.findMany({
          where: { companyId: company.id, parentId: node.id },
          orderBy: [{ sortOrder: 'asc' }, { displayValue: 'asc' }],
          select: { ...NODE_SELECT, _count: { select: { children: true } } },
        }),
      ]);

      // A Forms component (or a version node's Forms child) renders the
      // PolicyForm library, never attribute payloads.
      const needsForms =
        (node.productLevelType.levelNumber === 5 && node.displayValue === FORMS_COMPONENT_NAME) ||
        children.some(
          (c) => c.productLevelType.levelNumber === 5 && c.displayValue === FORMS_COMPONENT_NAME,
        );
      const formsByVersionNode = needsForms
        ? await loadFormElementsByVersionNode(company.id)
        : new Map<string, never[]>();

      const shape = (n: typeof node) => {
        const sanitized = sanitizeAttributes(n.attributes);
        const isFormsComponent =
          n.productLevelType.levelNumber === 5 &&
          n.displayValue === FORMS_COMPONENT_NAME &&
          n.parentId;
        const attributes = isFormsComponent
          ? {
              ...(sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
                ? sanitized
                : {}),
              elements: formsByVersionNode.get(n.parentId!) ?? [],
            }
          : sanitized;
        return {
          id: n.id,
          name: n.displayValue,
          levelNumber: n.productLevelType.levelNumber,
          description: n.description,
          status: n.status,
          sortOrder: n.sortOrder,
          attributes,
        };
      };

      res.json({
        node: shape(node),
        ancestors: ancestorEdges.map((e) => ({
          id: e.ancestor.id,
          name: e.ancestor.displayValue,
          levelNumber: e.ancestor.productLevelType.levelNumber,
        })),
        children: children
          .filter((c) => !isHiddenComponent(c.productLevelType.levelNumber, c.displayValue))
          .map((c) => ({ ...shape(c), childCount: c._count.children })),
        levels: levels.map((l) => ({
          levelNumber: l.levelNumber,
          dbValue: l.dbValue,
          name: l.displayValue,
        })),
      });
    } catch (e) {
      next(e);
    }
  });
}
