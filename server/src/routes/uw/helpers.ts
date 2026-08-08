/**
 * Shared helpers for the UW Workbench (/uw) API — active-company resolution,
 * the append-only governance-event emitter (the audit spine every human and
 * agent action lands on, LLR-13), and the AgentAction wrapper that gives the
 * agent plane no unaudited path to state (INV-5).
 */
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { sha256 } from '../../lib/uw/engine.js';

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

export type GovernanceEventInput = {
  tenantId: string;
  companyId: string;
  eventType: string; // one of the 13 event types + AgentControl
  actorKind: 'HUMAN' | 'AGENT' | 'SYSTEM';
  actorId: string;
  actorRole?: string | null;
  payload?: unknown;
  correlationId?: string;
  submissionId?: string | null;
};

// Append-only writer — there is deliberately no update/delete counterpart.
export async function emitGovernanceEvent(input: GovernanceEventInput) {
  return prisma.uwGovernanceEvent.create({
    data: {
      tenantId: input.tenantId,
      companyId: input.companyId,
      eventType: input.eventType,
      actorKind: input.actorKind,
      actorId: input.actorId,
      actorRole: input.actorRole ?? null,
      payloadHash: sha256(input.payload ?? null),
      payload: input.payload === undefined ? undefined : (input.payload as object),
      correlationId: input.correlationId ?? randomUUID(),
      submissionId: input.submissionId ?? null,
    },
  });
}

// Wrap one agent execution in its assurance envelope: the AgentAction row plus
// exactly one audited-by GovernanceEvent (INV-5). Output is a ProposalEnvelope
// — never a state transition (ADR-02).
export async function recordAgentAction(args: {
  tenantId: string;
  companyId: string;
  agentId: string;
  kind: 'EXTRACTION' | 'TRIAGE' | 'ENRICHMENT' | 'PROPOSAL' | 'QNA' | 'MCP_TOOL';
  modelRef: string;
  prompt: unknown;
  confidence?: number | null;
  proposal?: unknown;
  submissionId?: string | null;
  correlationId?: string;
}) {
  const event = await emitGovernanceEvent({
    tenantId: args.tenantId,
    companyId: args.companyId,
    eventType: 'ProposalIssued',
    actorKind: 'AGENT',
    actorId: args.agentId,
    payload: { kind: args.kind, proposal: args.proposal ?? null },
    correlationId: args.correlationId,
    submissionId: args.submissionId ?? null,
  });
  return prisma.uwAgentAction.create({
    data: {
      tenantId: args.tenantId,
      companyId: args.companyId,
      agentId: args.agentId,
      kind: args.kind,
      modelRef: args.modelRef,
      promptHash: sha256(args.prompt),
      confidence: args.confidence ?? null,
      proposal: args.proposal === undefined ? undefined : (args.proposal as object),
      submissionId: args.submissionId ?? null,
      governanceEventId: event.id,
    },
  });
}

// The acting principal's operating-role identity, used by dual-control (INV-4)
// and referral-chain checks. Falls back to the coarse User.role token when no
// operating role is linked.
export function actorRole(req: Request): string {
  return req.user.operatingRoleId ?? req.user.role;
}

// CUO gate (INV-6) — the rationalization approval seat. Site admins and users
// whose operating role's label contains "CUO" / "Chief Underwriting" qualify.
export async function isCuo(req: Request): Promise<boolean> {
  if (req.user.role === 'ADMIN') return true;
  if (!req.user.operatingRoleId) return false;
  const role = await prisma.role.findFirst({
    where: { id: req.user.operatingRoleId },
    select: { displayValue: true },
  });
  const label = role?.displayValue?.toLowerCase() ?? '';
  return label.includes('cuo') || label.includes('chief underwriting');
}

// Next sequential human ref for a prefix, e.g. SUB-88121 → SUB-88122.
export async function nextRef(
  companyId: string,
  model: 'submission' | 'divergence',
  prefix: string,
): Promise<string> {
  const last =
    model === 'submission'
      ? await prisma.uwSubmission.findFirst({
          where: { companyId },
          orderBy: { ref: 'desc' },
          select: { ref: true },
        })
      : await prisma.uwDivergencePair.findFirst({
          where: { companyId },
          orderBy: { ref: 'desc' },
          select: { ref: true },
        });
  const n = last ? parseInt(last.ref.replace(/^\D+/, ''), 10) + 1 : 1;
  return `${prefix}-${String(n).padStart(model === 'submission' ? 5 : 3, '0')}`;
}
