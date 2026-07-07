// feedback/generateTicket.ts — prompt assembly, zod validation of the model's
// tool input, and the forced-tool-call flow against a mocked Anthropic client.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = { create: createMock };
  },
}));

import {
  buildTicketPrompt,
  generateTicket,
  parseTicketContent,
} from '../../../src/lib/feedback/generateTicket.js';

const input = {
  text: 'The Tasks tab truncates long role names',
  category: 'FUNCTIONAL_DEFECT',
  name: 'Kevin',
  route: '/tasks?area=claims',
  commitSha: 'abc1234',
  userAgent: 'Mozilla/5.0',
};

const ticket = {
  title: 'Fix truncated role names on the Tasks tab',
  summary: 'Role names are cut off.',
  story: 'Widen the column.',
  acceptanceCriteria: ['Role names render in full'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
});

describe('buildTicketPrompt', () => {
  it('embeds the verbatim feedback and every captured context field', () => {
    const prompt = buildTicketPrompt(input);
    expect(prompt).toContain(input.text);
    expect(prompt).toContain('/tasks?area=claims');
    expect(prompt).toContain('abc1234');
    expect(prompt).toContain('Kevin');
    expect(prompt).toContain('Mozilla/5.0');
  });

  it('humanizes the submitter-chosen category', () => {
    expect(buildTicketPrompt(input)).toContain('Functional Defect');
    expect(buildTicketPrompt({ ...input, category: 'DATA_ISSUE' })).toContain('Data Issue');
  });

  it('labels a null category (legacy rows) as Unclassified', () => {
    expect(buildTicketPrompt({ ...input, category: null })).toContain('Unclassified');
  });

  it('labels a missing name as anonymous', () => {
    expect(buildTicketPrompt({ ...input, name: null })).toContain('anonymous');
  });

  it('lists the epic catalog when epics are configured, omits it when not', () => {
    const epics = [{ key: 'TB-100', name: 'Platform UX', hint: 'cross-cutting UI/UX' }];
    const prompt = buildTicketPrompt(input, epics);
    expect(prompt).toContain('TB-100');
    expect(prompt).toContain('cross-cutting UI/UX');
    expect(buildTicketPrompt(input)).not.toContain('epicKey');
  });
});

describe('parseTicketContent', () => {
  it('accepts a complete ticket', () => {
    expect(parseTicketContent(ticket)).toEqual(ticket);
  });

  it('accepts a ticket with an epicKey and one without (legacy checkpoint rows)', () => {
    expect(parseTicketContent({ ...ticket, epicKey: 'TB-100' }).epicKey).toBe('TB-100');
    expect(parseTicketContent(ticket).epicKey).toBeUndefined();
  });

  it('rejects empty acceptance criteria', () => {
    expect(() => parseTicketContent({ ...ticket, acceptanceCriteria: [] })).toThrow();
  });

  it('rejects a missing title', () => {
    expect(() => parseTicketContent({ ...ticket, title: undefined })).toThrow();
  });
});

describe('generateTicket', () => {
  it('forces the file_ticket tool and returns its validated input', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'file_ticket', id: 't1', input: ticket }],
    });
    await expect(generateTicket(input)).resolves.toEqual(ticket);
    const req = createMock.mock.calls[0][0];
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'file_ticket' });
    expect(req.messages[0].content).toContain(input.text);
  });

  it('adds a required epicKey enum to the tool when epics are configured', async () => {
    const epics = [
      { key: 'TB-100', name: 'Platform UX', hint: 'cross-cutting UI/UX' },
      { key: 'TB-200', name: 'Regulations', hint: 'compliance and requirements' },
    ];
    createMock.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'file_ticket',
          id: 't1',
          input: { ...ticket, epicKey: 'TB-100' },
        },
      ],
    });
    await expect(generateTicket(input, epics)).resolves.toMatchObject({ epicKey: 'TB-100' });
    const req = createMock.mock.calls[0][0];
    const schema = req.tools[0].input_schema;
    expect(schema.properties.epicKey.enum).toEqual(['TB-100', 'TB-200']);
    expect(schema.required).toContain('epicKey');
    expect(req.messages[0].content).toContain('TB-200');
  });

  it('omits epicKey from the tool schema when no epics are configured', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'file_ticket', id: 't1', input: ticket }],
    });
    await generateTicket(input);
    const schema = createMock.mock.calls[0][0].tools[0].input_schema;
    expect(schema.properties.epicKey).toBeUndefined();
    expect(schema.required).not.toContain('epicKey');
  });

  it('throws when the response has no tool_use block', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'nope' }] });
    await expect(generateTicket(input)).rejects.toThrow(/no structured output/);
  });

  it('throws a 503-shaped error when ANTHROPIC_API_KEY is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await expect(generateTicket(input)).rejects.toMatchObject({ status: 503 });
  });
});
