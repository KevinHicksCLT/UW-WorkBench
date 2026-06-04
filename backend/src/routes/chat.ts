import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';
import { runReadOnlySql, type SqlResult } from '../services/chatDb.js';
import { getSchemaSummary } from '../services/chatSchema.js';

// AI assistant API. The user asks a question; Claude answers by writing and
// running read-only SQL against the operating_model schema (via the run_sql
// tool) until it has the facts, then replies in prose. Every query is forced
// read-only at the database layer (see chatDb.ts). Mounted at /chat; the
// frontend calls it via the /api prefix.

const router = Router();
router.use(requireAuth);

const MODEL = process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOOL_ITERATIONS = 6; // bound the agentic loop per request

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('Assistant is not configured (ANTHROPIC_API_KEY missing)'), { status: 503 });
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const RUN_SQL_TOOL: Anthropic.Tool = {
  name: 'run_sql',
  description:
    'Run a single read-only Postgres SELECT against the operating_model schema and get the rows back. ' +
    'Use it for every factual question — never guess at data. The search_path is already operating_model, ' +
    'so reference tables unqualified (e.g. FROM role). Always include a LIMIT (max 500). ' +
    'Only SELECT/WITH is allowed; any write is rejected. Prefer joining on the documented foreign keys.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'A single Postgres SELECT statement.' } },
    required: ['query'],
  },
};

function buildSystemPrompt(schema: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'You are the analytics assistant embedded in the Capgemini Transformation Bridge — an operating-model',
    'platform describing a company as org units, roles, value streams, processes (L1–L5), I/O elements,',
    'checklists, and metrics. You answer questions about this data sharply and concisely for business users.',
    '',
    `Today is ${today}.`,
    '',
    'How to answer:',
    '- For ANY question about the data, call run_sql to get real numbers. Do not invent values.',
    '- You may call run_sql several times to explore, then synthesize a clear answer.',
    '- Keep SQL read-only (SELECT/WITH only) and always add a LIMIT (<= 500).',
    '- Text columns often hold free-text lists (e.g. typical_inputs); use ILIKE / pattern matching when helpful.',
    '- When you give counts or rankings, briefly say which tables/columns you used.',
    '- If a query errors, read the message, fix the SQL, and retry. If the data cannot answer the question, say so.',
    '- Format answers in concise Markdown. Use small tables for lists; bold the headline number.',
    '',
    `Database is Postgres. The schema (search_path = operating_model) is:`,
    schema,
  ].join('\n');
}

// Compact, model-friendly rendering of a result set for a tool_result.
function formatRows(r: SqlResult): string {
  if (r.rowCount === 0) return 'No rows.';
  const header = r.columns.join(' | ');
  const body = r.rows.map((row) => row.map((v) => (v === null ? '' : String(v))).join(' | ')).join('\n');
  let out = `${header}\n${body}`;
  if (r.truncated) out += `\n… (${r.rowCount} rows total; showing first ${r.rows.length})`;
  if (out.length > 12_000) out = out.slice(0, 12_000) + '\n… (output truncated)';
  return out;
}

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) }))
    .min(1)
    .max(50),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages } = bodySchema.parse(req.body);
    const schema = await getSchemaSummary();
    const system = buildSystemPrompt(schema);

    const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const executed: { query: string; rowCount: number; error?: string }[] = [];
    let answer = '';

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const resp = await anthropic().messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools: [RUN_SQL_TOOL],
        messages: convo,
      });

      if (resp.stop_reason === 'tool_use') {
        convo.push({ role: 'assistant', content: resp.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of resp.content) {
          if (block.type !== 'tool_use') continue;
          const query = String((block.input as { query?: unknown }).query ?? '');
          try {
            const r = await runReadOnlySql(query);
            executed.push({ query, rowCount: r.rowCount });
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: formatRows(r) });
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Query failed';
            executed.push({ query, rowCount: 0, error: msg });
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, is_error: true, content: `Error: ${msg}` });
          }
        }
        convo.push({ role: 'user', content: toolResults });
        continue;
      }

      answer = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    if (!answer) {
      answer = 'I couldn’t finish that within the query budget for one turn. Try narrowing the question.';
    }
    res.json({ answer, queries: executed });
  } catch (e) {
    next(e);
  }
});

export default router;
