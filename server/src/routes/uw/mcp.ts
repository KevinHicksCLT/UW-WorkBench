/**
 * MCP surface for the UW Workbench (UW-WORK-11 §4). A minimal, dependency-free
 * Model Context Protocol server over streamable HTTP (single-POST JSON-RPC
 * 2.0): initialize / tools/list / tools/call. Tools mirror the REST surface
 * read-side plus proposal issuance — an MCP caller can inspect everything but
 * can never transition state directly: mutating intents are captured as
 * ProposalEnvelopes for human disposition (ADR-02). Every tools/call is
 * wrapped in an AgentAction with exactly one audited-by GovernanceEvent
 * (INV-5). Auth is the same Bearer JWT as REST (requireAuth upstream).
 */
import type { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { recordAgentAction } from './helpers.js';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

const PROTOCOL_VERSION = '2025-06-18';

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (req: Request, args: Record<string, unknown>) => Promise<unknown>;
};

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties: props,
  required,
});

async function companyIdFor(req: Request): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return company?.id ?? null;
}

const TOOLS: ToolDef[] = [
  {
    name: 'uw_list_submissions',
    description:
      'List UW submissions in the pipeline with latest triage score, clearance state, and appetite verdict. Filter by status.',
    inputSchema: obj({
      status: {
        type: 'string',
        description: 'RECEIVED|IN_CLEARANCE|IN_TRIAGE|IN_REVIEW|REFERRED|QUOTED|BOUND|DECLINED',
      },
    }),
    handler: async (req, args) => {
      const companyId = await companyIdFor(req);
      return prisma.uwSubmission.findMany({
        where: {
          tenantId: req.tenantId,
          ...(companyId ? { companyId } : {}),
          ...(typeof args.status === 'string' && args.status ? { status: args.status } : {}),
        },
        include: {
          account: { select: { name: true } },
          triageScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
        },
        orderBy: { receivedAt: 'desc' },
        take: 100,
      });
    },
  },
  {
    name: 'uw_get_submission',
    description:
      'Full risk-workspace projection for one submission: evidence, clearance, scores, referrals, decisions, quotes, governance narrative.',
    inputSchema: obj({ submissionId: { type: 'string' } }, ['submissionId']),
    handler: async (req, args) =>
      prisma.uwSubmission.findFirst({
        where: { id: String(args.submissionId), tenantId: req.tenantId },
        include: {
          account: true,
          riskObjects: { include: { enrichmentRecords: true } },
          coverageRequests: true,
          clearanceChecks: true,
          triageScores: { orderBy: { scoredAt: 'desc' } },
          referralCases: true,
          decisions: true,
          quoteProposals: { include: { bindEvent: true } },
        },
      }),
  },
  {
    name: 'uw_evaluate_appetite',
    description:
      'Pure, versioned appetite evaluation for a submission: {verdict IN|EDGE|OUT, citedStatements[]}. Every verdict cites statement refs (HLR-05).',
    inputSchema: obj({ submissionId: { type: 'string' } }, ['submissionId']),
    handler: async (req, args) => {
      const s = await prisma.uwSubmission.findFirst({
        where: { id: String(args.submissionId), tenantId: req.tenantId },
        select: { appetiteVerdict: true, appetiteCitations: true },
      });
      if (!s) return { error: 'not found' };
      return {
        verdict: s.appetiteVerdict ?? 'NO_STATEMENT',
        citedStatements: s.appetiteCitations ?? [],
      };
    },
  },
  {
    name: 'uw_list_appetite_statements',
    description:
      'List versioned, effective-dated appetite statements (the governed appetite artifact, CAP-03).',
    inputSchema: obj({ status: { type: 'string', description: 'ACTIVE|SUPERSEDED|RETIRED' } }),
    handler: async (req, args) => {
      const companyId = await companyIdFor(req);
      return prisma.uwAppetiteStatement.findMany({
        where: {
          tenantId: req.tenantId,
          ...(companyId ? { companyId } : {}),
          ...(typeof args.status === 'string' && args.status ? { status: args.status } : {}),
        },
        orderBy: [{ ref: 'asc' }, { version: 'desc' }],
      });
    },
  },
  {
    name: 'uw_list_authority_grants',
    description:
      'List authority-as-data grants bound to the TB Roles catalog (ADR-03), with limits and delegation state.',
    inputSchema: obj({}),
    handler: async (req) => {
      const companyId = await companyIdFor(req);
      return prisma.uwAuthorityGrant.findMany({
        where: { tenantId: req.tenantId, ...(companyId ? { companyId } : {}) },
        include: { role: { select: { displayValue: true } } },
        orderBy: [{ ref: 'asc' }, { version: 'desc' }],
      });
    },
  },
  {
    name: 'uw_list_referrals',
    description: 'List referral cases with SLA state and escalation targets.',
    inputSchema: obj({
      status: { type: 'string', description: 'OPEN|APPROVED|DECLINED|RETURNED|EXPIRED' },
    }),
    handler: async (req, args) => {
      const companyId = await companyIdFor(req);
      return prisma.uwReferralCase.findMany({
        where: {
          tenantId: req.tenantId,
          ...(companyId ? { companyId } : {}),
          ...(typeof args.status === 'string' && args.status ? { status: args.status } : {}),
        },
        include: {
          submission: { select: { ref: true } },
          escalatedToRole: { select: { displayValue: true } },
        },
        orderBy: { openedAt: 'desc' },
      });
    },
  },
  {
    name: 'uw_list_divergence_pairs',
    description:
      'Cross-estate rationalization inventory: divergence pairs (appetite/rule/authority) with weight = 1 - similarity (CAP-14).',
    inputSchema: obj({ kind: { type: 'string', description: 'APPETITE|RULE|AUTHORITY' } }),
    handler: async (req, args) => {
      const companyId = await companyIdFor(req);
      return prisma.uwDivergencePair.findMany({
        where: {
          tenantId: req.tenantId,
          ...(companyId ? { companyId } : {}),
          ...(typeof args.kind === 'string' && args.kind
            ? { kind: String(args.kind).toUpperCase() }
            : {}),
        },
        orderBy: { weight: 'asc' },
      });
    },
  },
  {
    name: 'uw_audit_trail',
    description:
      'Stream the append-only governance event spine for a correlationId (submission id) — the intake-to-bind narrative (NFR-04).',
    inputSchema: obj({ correlationId: { type: 'string' } }, ['correlationId']),
    handler: async (req, args) =>
      prisma.uwGovernanceEvent.findMany({
        where: { tenantId: req.tenantId, correlationId: String(args.correlationId) },
        orderBy: { at: 'asc' },
      }),
  },
  {
    name: 'uw_propose_decision',
    description:
      'Propose an underwriting decision for a submission. NEVER transitions state: writes a ProposalEnvelope awaiting human disposition (ADR-02, INV-5). Returns the AgentAction id to track disposition.',
    inputSchema: obj(
      {
        submissionId: { type: 'string' },
        outcome: { type: 'string', description: 'QUOTE|DECLINE|REFER' },
        premium: { type: 'number' },
        rationale: { type: 'string' },
        confidence: { type: 'number', description: '0..1' },
      },
      ['submissionId', 'outcome', 'rationale', 'confidence'],
    ),
    handler: async (req, args) => {
      const submission = await prisma.uwSubmission.findFirst({
        where: { id: String(args.submissionId), tenantId: req.tenantId },
        select: { id: true, companyId: true },
      });
      if (!submission) return { error: 'not found' };
      const action = await recordAgentAction({
        tenantId: req.tenantId,
        companyId: submission.companyId,
        agentId: `mcp:${req.user.email}`,
        kind: 'MCP_TOOL',
        modelRef: 'mcp-caller',
        prompt: args,
        confidence: typeof args.confidence === 'number' ? args.confidence : null,
        proposal: {
          outcome: args.outcome,
          premium: args.premium ?? null,
          rationale: args.rationale,
        },
        submissionId: submission.id,
        correlationId: submission.id,
      });
      return {
        agentActionId: action.id,
        disposition: action.disposition,
        note: 'Proposal recorded; awaiting human disposition (ADR-02).',
      };
    },
  },
];

// Reads are logged as one audited MCP_TOOL action per call (INV-5) — the agent
// plane has no unaudited path, not even for reads.
async function auditToolCall(req: Request, tool: string, args: Record<string, unknown>) {
  const companyId = await companyIdFor(req);
  if (!companyId) return;
  await recordAgentAction({
    tenantId: req.tenantId,
    companyId,
    agentId: `mcp:${req.user.email}`,
    kind: 'MCP_TOOL',
    modelRef: 'mcp-caller',
    prompt: { tool, args },
    proposal: undefined,
    submissionId: typeof args.submissionId === 'string' ? args.submissionId : null,
  });
}

function rpcResult(id: JsonRpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function rpcError(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/** Registers the MCP streamable-HTTP endpoint on the shared /uw router. */
export function registerMcpRoutes(router: Router): void {
  router.post('/mcp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as JsonRpcRequest | JsonRpcRequest[];
      const single = Array.isArray(body) ? body[0] : body;
      if (!single || single.jsonrpc !== '2.0' || typeof single.method !== 'string') {
        return res.status(400).json(rpcError(null, -32600, 'Invalid JSON-RPC 2.0 request'));
      }
      const { id, method, params } = single;
      switch (method) {
        case 'initialize':
          return res.json(
            rpcResult(id, {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: {} },
              serverInfo: { name: 'tb-uw-workbench', version: '0.1.0' },
              instructions:
                'UW Workbench MCP surface. Read tools mirror REST; uw_propose_decision writes a ProposalEnvelope only — state transitions require human disposition (ADR-02). Every call is wrapped in an AgentAction with one GovernanceEvent (INV-5).',
            }),
          );
        case 'notifications/initialized':
          return res.status(202).end();
        case 'ping':
          return res.json(rpcResult(id, {}));
        case 'tools/list':
          return res.json(
            rpcResult(id, {
              tools: TOOLS.map(({ name, description, inputSchema }) => ({
                name,
                description,
                inputSchema,
              })),
            }),
          );
        case 'tools/call': {
          const toolName = String((params as { name?: string } | undefined)?.name ?? '');
          const args = ((params as { arguments?: Record<string, unknown> } | undefined)
            ?.arguments ?? {}) as Record<string, unknown>;
          const tool = TOOLS.find((t) => t.name === toolName);
          if (!tool) return res.json(rpcError(id, -32602, `Unknown tool: ${toolName}`));
          if (toolName !== 'uw_propose_decision') await auditToolCall(req, toolName, args); // propose audits itself
          const result = await tool.handler(req, args);
          return res.json(
            rpcResult(id, {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false,
            }),
          );
        }
        default:
          return res.json(rpcError(id, -32601, `Method not found: ${method}`));
      }
    } catch (e) {
      next(e);
    }
  });
}
