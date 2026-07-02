/**
 * Testing templates for a focused ProcessNode, incl. workbook Testing Plan parsing.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { processSubtree } from '../../lib/resolvers/index.js';
import { activeCompany } from './helpers.js';

/** Registers this feature's routes on the shared /explorer router (order preserved). */
export function registerTestingTemplateRoutes(router: Router): void {
function numberedItems(block: string): string[] {
  const out: string[] = [];
  // These parsing regexes shape the testing-template response body — a rewrite
  // risks changing parsed output, so the pattern is kept as-is.
  // eslint-disable-next-line sonarjs/super-linear-regex -- behavior-frozen refactor; safe rewrite deferred
  const re = /(\d+)\.\s*([\s\S]*?)(?=\s*\d+\.\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const t = m[2].replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}
function parseTestingPlan(text: string | null): {
  genericPattern: string[];
  specificTests: { system: string | null; directive: string; pass: string | null }[];
} {
  if (!text) return { genericPattern: [], specificTests: [] };
  const norm = text.replace(/\r/g, '');
  const gi = norm.search(/generic pattern\s*:/i);
  const si = norm.search(/specific tests\s*:/i);
  let genericBlock: string;
  let specificBlock = '';
  if (si >= 0) { genericBlock = gi >= 0 ? norm.slice(gi, si) : ''; specificBlock = norm.slice(si); }
  else { genericBlock = gi >= 0 ? norm.slice(gi) : norm; }
  const genericPattern = numberedItems(genericBlock);
  const specificTests = numberedItems(specificBlock).map((s) => {
    let system: string | null = null, directive = s, pass: string | null = null;
    const pIdx = s.search(/pass\s*=/i);
    // eslint-disable-next-line sonarjs/super-linear-regex -- behavior-frozen refactor; safe rewrite deferred
    if (pIdx >= 0) { directive = s.slice(0, pIdx).trim().replace(/[.;:\s]+$/, ''); pass = s.slice(pIdx).trim(); }
    // eslint-disable-next-line sonarjs/super-linear-regex -- behavior-frozen refactor; safe rewrite deferred
    const vm = directive.match(/^in\s+(.+?),\s*verify\s*:?\s*(.+)$/i);
    if (vm) { system = vm[1].trim(); directive = vm[2].trim(); }
    return { system, directive, pass };
  });
  return { genericPattern, specificTests };
}

router.get('/testing-templates/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await activeCompany(req, { id: true });
    if (!company) return res.status(404).json({ error: 'No company' });

    const node = await prisma.processNode.findFirst({
      where: { id: req.params.nodeId, companyId: company.id },
      select: { id: true, displayValue: true },
    });
    if (!node) return res.status(404).json({ error: 'Not found' });

    // Task subtree (isTask L5 ids) + their sortOrder for ordering.
    const { nodes } = await processSubtree(node.id);
    const taskNodes = nodes.filter((n) => n.isTask);
    const taskIds = taskNodes.map((n) => n.id);
    const sortOf = new Map(taskNodes.map((n) => [n.id, n.sortOrder]));

    // Deliverables linked anywhere in this node's subtree.
    const delivLinks = await prisma.nodeDeliverable.findMany({
      where: { processNodeId: { in: nodes.map((n) => n.id) } },
      select: { deliverableId: true },
    });
    const deliverableIds = [...new Set(delivLinks.map((d) => d.deliverableId))];

    // Rows tied EITHER by task node OR by a subtree deliverable.
    const or: ({ taskNodeId: { in: string[] } } | { deliverableId: { in: string[] } })[] = [];
    if (taskIds.length) or.push({ taskNodeId: { in: taskIds } });
    if (deliverableIds.length) or.push({ deliverableId: { in: deliverableIds } });
    const CAP = 500;
    const rows = or.length
      ? await prisma.testingTemplate.findMany({
          where: { OR: or },
          select: {
            id: true, system: true, location: true, checkType: true, expected: true, taskNodeId: true,
            deliverable: { select: { title: true } },
            taskNode: { select: { displayValue: true } },
          },
        })
      : [];

    const templates = rows
      .map((r) => ({
        id: r.id,
        deliverable: r.deliverable?.title ?? null,
        task: r.taskNode?.displayValue ?? null,
        system: r.system ?? null,
        location: r.location ?? null,
        checkType: r.checkType ?? null,
        expected: r.expected ?? null,
        parsed: parseTestingPlan(r.expected ?? null),
        _order: r.taskNodeId ? (sortOf.get(r.taskNodeId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a._order - b._order || (a.deliverable ?? '').localeCompare(b.deliverable ?? ''));

    res.json({
      node: { id: node.id, name: node.displayValue },
      total: templates.length,
      templates: templates.slice(0, CAP).map(({ _order, ...t }) => t),
    });
  } catch (e) { next(e); }
});

}
