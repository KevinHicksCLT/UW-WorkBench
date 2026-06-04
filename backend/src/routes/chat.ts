import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';
import { runReadOnlySql, type SqlResult } from '../services/chatDb.js';
import { getSchemaSummary } from '../services/chatSchema.js';

// AI assistant API. The user asks a question; Claude answers by writing and
// running read-only SQL against the operating_model schema (via the run_sql
// tool) to ground itself in real data, but it is also free to reason, make
// clearly-labelled assumptions, and — when asked — pull in outside knowledge via
// web search. It replies in rich Markdown (tables, charts). Every query is forced
// read-only at the database layer (see chatDb.ts). Mounted at /chat; the
// frontend calls it via the /api prefix.

const router = Router();
router.use(requireAuth);

const MODEL = process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOOL_ITERATIONS = 6; // bound the agentic loop per request
// Web search lets the assistant do outside research; opt-out via CHATBOT_WEB_SEARCH=0.
// If the account doesn't have it enabled, we transparently fall back (see below).
const WEB_SEARCH_ENABLED = process.env.CHATBOT_WEB_SEARCH !== '0';
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as const;

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
    'checklists, and metrics. You are a sharp, business-savvy advisor for leaders working through this',
    'transformation — not just a SQL runner.',
    '',
    `Today is ${today}.`,
    '',
    'Grounding & reasoning:',
    '- The operating-model data is your source of truth for facts ABOUT this company. For any question that',
    '  the data can answer (counts, names, rankings, relationships), call run_sql and use the real numbers —',
    '  never fabricate a value that lives in the database.',
    '- But you are NOT limited to the database. You may reason, interpret, draw conclusions, and offer',
    '  recommendations, frameworks, benchmarks, and industry context from your own expertise.',
    '- When a question goes beyond the stored data, answer it anyway using sound reasoning. State your',
    '  assumptions explicitly (e.g. "Assuming X…") and clearly separate what the data shows from what you',
    '  are inferring or estimating.',
    '- If the user asks you to research something, or the question needs current/outside information not in',
    '  the database, use the web_search tool, then cite what you found.',
    '- Combine sources freely: ground the facts in SQL, enrich the analysis with reasoning and research.',
    '',
    'SQL rules:',
    '- Keep SQL read-only (SELECT/WITH only) and always add a LIMIT (<= 500).',
    '- The search_path is operating_model, so reference tables unqualified (e.g. FROM role).',
    '- Text columns often hold free-text lists (e.g. typical_inputs); use ILIKE / pattern matching when helpful.',
    '- If a query errors, read the message, fix the SQL, and retry. Only name source tables if the user asks how you know.',
    '',
    'Formatting — clean, minimal, executive style. Aim for a sharp consulting memo, NOT a decorated report:',
    '- Lead with the direct answer in one or two sentences, the key figure in **bold**. Then only the detail that earns its place.',
    '- NEVER use emojis. NEVER use horizontal rules (---) to fence off sections. Do not over-structure.',
    '- Use headings only when the answer truly has multiple distinct sections; a short answer needs none.',
    '- Put tabular / multi-column data in ONE Markdown table. Use a short bullet list for simple lists. Keep prose tight.',
    '- Do not add filler sections (e.g. a generic "What this means") unless you have a genuinely non-obvious insight.',
    '- When a ranking, distribution, or trend reads better as a picture, add ONE chart via a fenced ```chart block:',
    '    { "type": "bar" | "line" | "pie", "title": "Short title", "unit": "optional",',
    '      "data": [ { "label": "Sales", "value": 12 }, { "label": "Ops", "value": 7 } ] }',
    '  bar = rankings/counts, line = trend over an ordered sequence, pie = shares of a whole. 3–10 points.',
    '  Do not repeat the same numbers in both a chart AND a table — pick the single clearest representation.',
    '- Default to brevity. A good answer is often three sentences and one table or chart, nothing more.',
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

// Runs the agentic loop. `withWebSearch` toggles the web_search server tool so we
// can retry without it if the account hasn't enabled it.
async function converse(
  system: string,
  messages: Anthropic.MessageParam[],
  withWebSearch: boolean,
): Promise<{ answer: string; queries: { query: string; rowCount: number; error?: string }[] }> {
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const executed: { query: string; rowCount: number; error?: string }[] = [];
  const tools: Anthropic.ToolUnion[] = withWebSearch ? [RUN_SQL_TOOL, WEB_SEARCH_TOOL] : [RUN_SQL_TOOL];
  let answer = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools,
      messages: convo,
    });

    if (resp.stop_reason === 'tool_use') {
      convo.push({ role: 'assistant', content: resp.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        // web_search is a server tool — the API runs it and returns results inline,
        // so we only handle our own run_sql client tool here.
        if (block.type !== 'tool_use' || block.name !== 'run_sql') continue;
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
      // Nothing to feed back (model only used server tools) → let it continue answering.
      if (toolResults.length === 0) continue;
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

  return { answer, queries: executed };
}

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages } = bodySchema.parse(req.body);
    const schema = await getSchemaSummary();
    const system = buildSystemPrompt(schema);

    let result: Awaited<ReturnType<typeof converse>>;
    try {
      result = await converse(system, messages, WEB_SEARCH_ENABLED);
    } catch (e) {
      // If web search isn't available on this account, retry once without it.
      const msg = e instanceof Error ? e.message : '';
      if (WEB_SEARCH_ENABLED && /web_search|server tool|not.*(enabled|allowed|support)/i.test(msg)) {
        result = await converse(system, messages, false);
      } else {
        throw e;
      }
    }

    let answer = result.answer;
    if (!answer) {
      answer = 'I couldn’t finish that within the query budget for one turn. Try narrowing the question.';
    }
    res.json({ answer, queries: result.queries });
  } catch (e) {
    next(e);
  }
});

export default router;
