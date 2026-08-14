import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';

// Shared pieces of the /work feature module (list + detail grains).

export const DEFAULT_TAKE = 5000;

// ProcessNode.automatability → 1-5 agent-automatability score. Scale: 1 Autonomous
// Agent (AI does it end-to-end) … 5 Human-only; "automatable" = score ≤ 2. Lower =
// more AI-automatable. Legacy aliases kept for safety.
export const SCORE_OF: Record<string, number> = {
  autonomous: 1,
  workflow: 2,
  augmented: 3,
  assist: 4,
  manual: 5,
  automated: 1,
  assisted: 4, // legacy aliases
};

// executive/senior roles are not surfaced as task-level contributors.
// (Two regexes — same union as the old single one, kept under the lint
// complexity budget.)
const EXEC_TITLES = /\b(chief|officer|c-?suite|cxo|ceo|cfo|coo|cto|cio|ciso|chro|cro|cdo|caio)\b/i;
const EXEC_RANKS = /\b(president|vice[- ]president|vp|head of|head,|director|board)\b/i;
export const isExec = (name: string): boolean => EXEC_TITLES.test(name) || EXEC_RANKS.test(name);
export const TOP_CONTRIB = 5;

export type PageArgs = { take: number; skip?: number; cursor?: { id: string } };

export async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) {
    res.status(404).json({ error: 'No company found' });
    return null;
  }
  return company.id;
}
