import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

/**
 * Ticket-content generation — the single LLM step of the feedback pipeline.
 * One forced tool call (no loop, no agent): raw user feedback + auto-captured
 * context in, a structured backlog ticket out. Everything downstream (Jira,
 * email) is deterministic.
 */

const ticketContentSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  story: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
});

export type TicketContent = z.infer<typeof ticketContentSchema>;

export type FeedbackInput = {
  text: string;
  name: string | null;
  route: string;
  commitSha: string;
  userAgent: string;
};

const MODEL = process.env.FEEDBACK_MODEL ?? 'claude-opus-4-8';

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(
      new Error('Feedback pipeline is not configured (ANTHROPIC_API_KEY missing)'),
      {
        status: 503,
      },
    );
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Forcing this tool (tool_choice type:"tool") guarantees structured output —
// no prose to parse, and zod re-validates the shape the model produced.
const TICKET_TOOL: Anthropic.Tool = {
  name: 'file_ticket',
  description: 'File the triaged user feedback as a well-formed backlog ticket.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'Concise imperative ticket title (max ~90 chars), e.g. "Fix truncated role names on the Tasks tab".',
      },
      summary: {
        type: 'string',
        description: '1-2 sentence summary of what the user reported and why it matters.',
      },
      story: {
        type: 'string',
        description:
          'Implementation story for a developer: what to change, where to look (use the route/commit context), and the expected behavior. Plain prose, a few sentences.',
      },
      acceptanceCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'Verifiable acceptance criteria, each a single testable statement.',
      },
    },
    required: ['title', 'summary', 'story', 'acceptanceCriteria'],
  },
};

/** Prompt assembly (exported for tests). */
export function buildTicketPrompt(input: FeedbackInput): string {
  return [
    'A user of the Transformation Bridge web application submitted in-app feedback.',
    'Triage it into a backlog ticket using the file_ticket tool. Classify implicitly',
    '(bug vs enhancement) through the wording of the title and story — do not invent',
    'details that are not supported by the feedback or the captured context.',
    '',
    `Feedback text (verbatim): """${input.text}"""`,
    `Submitted by: ${input.name ?? 'anonymous'}`,
    `Screen (client route): ${input.route}`,
    `App commit SHA: ${input.commitSha}`,
    `Browser: ${input.userAgent}`,
  ].join('\n');
}

/** Validate a candidate ticket payload (exported for tests + retry resume). */
export function parseTicketContent(raw: unknown): TicketContent {
  return ticketContentSchema.parse(raw);
}

/** One structured-output call → validated ticket content. */
export async function generateTicket(input: FeedbackInput): Promise<TicketContent> {
  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2000,
    tools: [TICKET_TOOL],
    tool_choice: { type: 'tool', name: 'file_ticket' },
    messages: [{ role: 'user', content: buildTicketPrompt(input) }],
  });
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'file_ticket',
  );
  if (!block) throw new Error('Ticket generation returned no structured output');
  return parseTicketContent(block.input);
}
