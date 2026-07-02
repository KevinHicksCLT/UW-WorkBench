import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';
import { runReadOnlySql, SCHEMA, type SqlResult } from '../services/chatDb.js';
import { getSchemaSummary } from '../services/chatSchema.js';

// AI assistant API. The user asks a question; Claude answers by writing and
// running read-only SQL against the app's database (via the run_sql
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
    `Run a single read-only Postgres SELECT against the ${SCHEMA} schema and get the rows back. ` +
    `Use it for every factual question — never guess at data. The search_path is already ${SCHEMA}, ` +
    'so reference tables unqualified, but mixed-case table names must be double-quoted exactly as listed ' +
    '(e.g. FROM "Role"). Always include a LIMIT (max 500). ' +
    'Only SELECT/WITH is allowed; any write is rejected. Prefer joining on the documented foreign keys.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'A single Postgres SELECT statement.' } },
    required: ['query'],
  },
};

/** Platform display name used in AI prompts — env-configurable per deployment (charter Task 1). */
const PLATFORM_NAME = process.env.PLATFORM_NAME ?? 'Capgemini Transformation Bridge';

function buildSystemPrompt(schema: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `You are the analytics assistant embedded in the ${PLATFORM_NAME} — an operating-model`,
    'platform describing a company as org units, roles, value streams, processes (L1–L5), I/O elements,',
    'checklists, and metrics. You are a sharp, business-savvy advisor for leaders working through this',
    'transformation — not just a SQL runner.',
    '',
    `Today is ${today}.`,
    '',
    'Grounding — the database comes FIRST, always:',
    '- This company\'s database is your single source of truth. Treat EVERY question as being about THIS',
    '  company\'s data unless it is unmistakably a general-knowledge question. Your FIRST action for any',
    '  question is to call run_sql and look — never answer from memory or general knowledge when the data',
    '  could hold the answer, and never fabricate or estimate a value that lives in the database.',
    '- If you are unsure whether the data covers a topic, CHECK: search likely tables and text columns',
    '  (ILIKE) before concluding it is not in the data. Only say "the data doesn\'t cover this" after',
    '  actually querying for it.',
    '- Answer with the app\'s specific records — real names, counts, and rows from the queries — not with',
    '  generic industry descriptions of what such data typically looks like.',
    '- Reasoning, recommendations, benchmarks, and industry context are welcome ON TOP of the queried data,',
    '  clearly separated from it (e.g. "The data shows X; in my assessment Y…"). They never replace it.',
    '- Use web_search only when the user explicitly asks for outside research, or the question clearly needs',
    '  current external information the database cannot hold — and even then, query the database first so',
    '  the answer stays anchored to this company\'s records. Cite what you found.',
    '',
    'Domain semantics — how users phrase questions about this data:',
    '- "Standards" means the INDIVIDUAL standard/guideline items ("StandardItem" rows) — each one is',
    '  effectively a single validation that must be tested — NOT the "Standard" documents/areas that group',
    '  them. "How many actuarial standards are there?" → count the "StandardItem" rows of the matching',
    '  "Standard" (match its name/department with ILIKE) and, when the list is reasonably short, list them.',
    '  Mention the parent document only as context, never as the headline answer.',
    '- Likewise "checklists" usually means the individual "ChecklistItem" rows, not their categories.',
    '',
    'SQL rules:',
    '- Keep SQL read-only (SELECT/WITH only) and always add a LIMIT (<= 500).',
    `- The search_path is ${SCHEMA}, so reference tables unqualified — but mixed-case table names must be`,
    '  double-quoted exactly as listed in the schema (e.g. FROM "Role", JOIN "ChecklistItem").',
    '- Text columns often hold free-text "; "-joined lists (e.g. "IoItem"."keyRoles", "ProcessStep".leads);',
    '  use ILIKE / pattern matching when helpful. Mixed-case column names also need double quotes.',
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
    `Database is Postgres. The schema (search_path = ${SCHEMA}) is:`,
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
  // The screen the user is currently viewing (sent by the widget) so the
  // assistant is page-aware — "this", "here", "current" resolve to the right view.
  pageContext: z.object({ path: z.string(), label: z.string() }).optional(),
});

// A short, uncached system block describing where the user is, so the assistant
// can ground vague references and proactively surface page-relevant insight.
function pageContextNote(ctx: { path: string; label: string }): string {
  return [
    `The user is currently viewing ${ctx.label} (route ${ctx.path}).`,
    'When their question uses "this", "here", "current" or is otherwise unscoped, interpret it against',
    'that view. After answering, you may add one short, relevant suggestion tied to this page if it helps.',
    'If a record id appears in the route, query that specific record before answering.',
  ].join(' ');
}

// Runs the agentic loop. `withWebSearch` toggles the web_search server tool so we
// can retry without it if the account hasn't enabled it.
async function converse(
  system: string,
  messages: Anthropic.MessageParam[],
  withWebSearch: boolean,
  contextNote?: string,
): Promise<{ answer: string; queries: { query: string; rowCount: number; error?: string }[] }> {
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const executed: { query: string; rowCount: number; error?: string }[] = [];
  const tools: Anthropic.ToolUnion[] = withWebSearch ? [RUN_SQL_TOOL, WEB_SEARCH_TOOL] : [RUN_SQL_TOOL];
  // The big schema prompt is cached; the page-context note is a small, uncached
  // block so per-page variation doesn't bust the prompt cache.
  const systemBlocks: Anthropic.TextBlockParam[] = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  if (contextNote) systemBlocks.push({ type: 'text', text: contextNote });
  let answer = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemBlocks,
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
    const { messages, pageContext } = bodySchema.parse(req.body);
    const schema = await getSchemaSummary();
    const system = buildSystemPrompt(schema);
    const contextNote = pageContext ? pageContextNote(pageContext) : undefined;

    let result: Awaited<ReturnType<typeof converse>>;
    try {
      result = await converse(system, messages, WEB_SEARCH_ENABLED, contextNote);
    } catch (e) {
      // If web search isn't available on this account, retry once without it.
      const msg = e instanceof Error ? e.message : '';
      if (WEB_SEARCH_ENABLED && /web_search|server tool|not.*(enabled|allowed|support)/i.test(msg)) {
        result = await converse(system, messages, false, contextNote);
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
