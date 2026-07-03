import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { ENTITY_LIST, getEntity, companyWhere } from '../lib/adminRegistry.js';
import { LEVEL_HANDLERS } from '../lib/valueStreamAdmin.js';

// ─── Admin AI overlay (POST /admin/ai) ──────────────────────────────────────
// A write-capable planning assistant for the Data Admin console. The user
// describes what they want configured ("add three risk records for the claims
// value stream", "rename Level 3 'Underwriting' and give it a description").
// Claude grounds itself in the real, company-scoped data via the `list_records`
// tool, then returns a STRUCTURED PLAN of create/update/delete operations through
// the `propose_plan` tool. This route NEVER writes — it returns the plan, the
// frontend reviews it and applies each op via the existing audited /admin/:entity
// endpoints, so every change still flows through one validated, logged path.

const router = Router();
router.use(requireAuth);
// Planning assistant for the Data Admin studio — same gate as /admin. Always
// 'update' (the assistant proposes writes even from POSTed prompts).
router.use(requirePermission('data-admin.configure', 'update'));

const MODEL = process.env.ADMIN_AI_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOOL_ITERATIONS = 8;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('AI overlay is not configured (ANTHROPIC_API_KEY missing)'), {
      status: 503,
    });
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Compact catalog the model edits against: every editable entity and its fields.
function entityCatalog(): string {
  return ENTITY_LIST.map((e) => {
    const fields = e.fields
      .filter((f) => !f.readonly)
      .map((f) => {
        const tag = f.relation ? `${f.name}→${f.relation.entity}` : `${f.name}:${f.kind}`;
        return f.required ? `${tag}*` : tag;
      })
      .join(', ');
    return `- ${e.slug} ("${e.label}", ${e.group}): ${fields}`;
  }).join('\n');
}

/** Platform display name used in AI prompts — env-configurable per deployment (charter Task 1). */
const PLATFORM_NAME = process.env.PLATFORM_NAME ?? 'Capgemini Transformation Bridge';

function systemPrompt(companyName: string): string {
  return [
    `You are the configuration copilot inside the Data Admin console of the ${PLATFORM_NAME} —`,
    'an operating-model platform (companies → org units → roles → value streams → processes → metrics, plus',
    'initiatives, risks, standards, applications, deliverables and tasks). You help an administrator',
    `configure the data for the company "${companyName}". Every record you touch is scoped to this company.`,
    '',
    'How you work:',
    '1. Understand the request. If it refers to existing records (rename, update, "the claims value stream"),',
    '   call list_records to find their real ids and current values FIRST — never guess an id.',
    '2. To learn valid enum values for a field (status, severity, participationType, …), look at what existing',
    '   records use via list_records before inventing new ones.',
    '3. Produce the smallest correct set of operations and finish by calling propose_plan exactly once.',
    '',
    'Operation rules:',
    '- op "create": provide entity + data (all required fields). Do not provide id.',
    '- op "update": provide entity + id + only the changed fields in data.',
    '- op "delete": provide entity + id only.',
    '- entity must be one of the slugs below. data keys must be real field names. For relation fields',
    '  (name→entity) the value is the related record id — resolve it via list_records.',
    '- The two configurable trees use entity "valueStreams" (value-stream levels) and "organization" (org',
    '  levels). For those, to create a child node pass { name, parentId } where parentId is the parent node id;',
    '  level depth is derived automatically. They also accept description, leads, supporting, inputs, outputs,',
    '  externalParticipants, notes.',
    '- Never fabricate data the user did not ask for. When the user is vague, make a small, clearly-reasonable',
    '  proposal and explain your assumptions in the summary.',
    '',
    'Editable entities and their fields (slug ("label", group): fields; * = required, →entity = pick a related id):',
    entityCatalog(),
  ].join('\n');
}

const LIST_TOOL: Anthropic.Tool = {
  name: 'list_records',
  description:
    'List existing records of an entity for the active company, to find ids, current values, and the enum ' +
    'values fields use. Returns up to `limit` rows (default 30). Use before any update/delete or relation link.',
  input_schema: {
    type: 'object',
    properties: {
      entity: {
        type: 'string',
        description: 'Entity slug, e.g. risk, role, valueStreams, organization.',
      },
      search: {
        type: 'string',
        description: 'Optional case-insensitive substring match on the label field.',
      },
      limit: { type: 'number', description: 'Max rows (1–100, default 30).' },
    },
    required: ['entity'],
  },
};

const PLAN_TOOL: Anthropic.Tool = {
  name: 'propose_plan',
  description: 'Finalize and return the plan of changes for the administrator to review and apply.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'One short paragraph: what this plan does and any assumptions.',
      },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['create', 'update', 'delete'] },
            entity: { type: 'string' },
            id: { type: 'string', description: 'Required for update/delete.' },
            data: { type: 'object', description: 'Field values for create/update.' },
            reason: {
              type: 'string',
              description: 'Short human-readable description of this single change.',
            },
          },
          required: ['op', 'entity', 'reason'],
        },
      },
    },
    required: ['summary', 'operations'],
  },
};

// Read records the same way the admin GET route does (level trees + generic).
async function listRecords(
  tenantId: string,
  companyId: string,
  entitySlug: string,
  search: string,
  take: number,
) {
  const entity = getEntity(entitySlug);
  if (!entity) return { error: `Unknown entity "${entitySlug}".` };

  const lh = LEVEL_HANDLERS[entity.model];
  if (lh) {
    const r = (await lh.list(tenantId, companyId, search, Math.min(take, 100), 0)) as {
      rows: unknown[];
    };
    return { rows: r.rows };
  }

  const scope = entity.companyVia ? companyWhere(entity, companyId) : {};
  const where: Record<string, unknown> = { tenantId, ...scope };
  if (search && entity.labelField !== 'id')
    where[entity.labelField] = { contains: search, mode: 'insensitive' };
  const delegate = (
    prisma as unknown as Record<
      string,
      { findMany(args: unknown): Promise<Record<string, unknown>[]> }
    >
  )[entity.model];
  const rows = await delegate.findMany({ where, take: Math.min(take, 100) });
  return { rows };
}

// Trim a row to id + the editable fields so tool results stay compact.
function slimRow(entitySlug: string, row: Record<string, unknown>): Record<string, unknown> {
  const entity = getEntity(entitySlug);
  if (!entity) return row;
  const out: Record<string, unknown> = { id: row.id };
  for (const f of entity.fields) if (f.name in row) out[f.name] = row[f.name];
  return out;
}

// Shape of one create/update/delete operation as proposed by the model.
type ProposedOp = {
  op: string;
  entity: string;
  id?: string;
  data?: Record<string, unknown>;
  reason?: string;
};

// Annotate a proposed op: validate entity + fields against the registry so the UI
// can flag problems before the user applies it.
function annotateOp(op: ProposedOp) {
  const entity = getEntity(op.entity);
  const issues: string[] = [];
  if (!entity) issues.push(`Unknown entity "${op.entity}"`);
  if ((op.op === 'update' || op.op === 'delete') && !op.id) issues.push(`${op.op} requires an id`);
  if (entity && op.data) {
    const known = new Set(entity.fields.map((f) => f.name));
    for (const k of Object.keys(op.data)) if (!known.has(k)) issues.push(`Unknown field "${k}"`);
  }
  return {
    op: op.op,
    entity: op.entity,
    entityLabel: entity?.label ?? op.entity,
    id: op.id ?? null,
    data: op.data ?? {},
    reason: op.reason ?? '',
    issues,
  };
}

const bodySchema = z.object({
  companyId: z.string().min(1),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) }))
    .min(1)
    .max(30),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, messages } = bodySchema.parse(req.body);
    const company = await prisma.company.findFirst({
      where: { id: companyId, tenantId: req.tenantId },
      select: { name: true },
    });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const system = systemPrompt(company.name);
    const convo: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const tools: Anthropic.ToolUnion[] = [LIST_TOOL, PLAN_TOOL];

    let plan: { summary: string; operations: ReturnType<typeof annotateOp>[] } | null = null;
    let answer = '';

    for (let i = 0; i < MAX_TOOL_ITERATIONS && !plan; i++) {
      const resp = await anthropic().messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: convo,
      });

      if (resp.stop_reason !== 'tool_use') {
        answer = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        break;
      }

      convo.push({ role: 'assistant', content: resp.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== 'tool_use') continue;
        if (block.name === 'propose_plan') {
          const input = block.input as { summary?: string; operations?: ProposedOp[] };
          plan = {
            summary: String(input.summary ?? ''),
            operations: Array.isArray(input.operations) ? input.operations.map(annotateOp) : [],
          };
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'Plan received.',
          });
        } else if (block.name === 'list_records') {
          const input = block.input as { entity?: string; search?: string; limit?: number };
          const result = await listRecords(
            req.tenantId,
            companyId,
            String(input.entity ?? ''),
            String(input.search ?? ''),
            Number(input.limit) || 30,
          );
          const content =
            'rows' in result
              ? JSON.stringify(
                  (result.rows as Record<string, unknown>[]).map((r) =>
                    slimRow(String(input.entity), r),
                  ),
                ).slice(0, 9000)
              : JSON.stringify(result);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content });
        }
      }
      if (toolResults.length) convo.push({ role: 'user', content: toolResults });
    }

    if (!plan) {
      return res.json({
        summary:
          answer ||
          'I need a bit more detail to propose specific changes. What would you like to configure?',
        operations: [],
      });
    }
    res.json(plan);
  } catch (e) {
    if (e instanceof z.ZodError)
      return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid body' });
    next(e);
  }
});

export default router;
