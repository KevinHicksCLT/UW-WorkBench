// feedback/jira.ts — ADF description assembly and the two REST v3 calls
// (issue create, attachment upload) against a stubbed global fetch.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachScreenshot,
  buildDescriptionAdf,
  createJiraIssue,
  jiraIssueUrl,
} from '../../../src/lib/feedback/jira.js';

const settings = {
  enabled: true,
  baseUrl: 'https://acme.atlassian.net',
  projectKey: 'TB',
  issueType: 'Task',
  labels: ['feedback'],
};

const feedback = {
  text: 'Sidebar loses scroll position',
  category: 'FUNCTIONAL_DEFECT',
  name: 'Kevin',
  route: '/roles',
  commitSha: 'abc1234',
  userAgent: 'Mozilla/5.0',
  tenantId: 'ten1',
  userId: 'usr1',
};

const ticket = {
  title: 'Preserve sidebar scroll position',
  summary: 'Scroll resets on navigation.',
  story: 'Persist scrollTop across route changes.',
  acceptanceCriteria: ['Scroll position survives navigation', 'No console errors'],
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('JIRA_EMAIL', 'bot@acme.com');
  vi.stubEnv('JIRA_API_TOKEN', 'tok123');
});

describe('buildDescriptionAdf', () => {
  it('carries the verbatim feedback in a blockquote and the ACs as bullets', () => {
    const doc = buildDescriptionAdf(feedback, ticket);
    expect(doc.type).toBe('doc');
    const json = JSON.stringify(doc);
    expect(json).toContain(feedback.text);
    expect(json).toContain(ticket.story);
    const quote = doc.content.find((n) => n.type === 'blockquote');
    expect(JSON.stringify(quote)).toContain(feedback.text);
    const lists = doc.content.filter((n) => n.type === 'bulletList');
    expect(JSON.stringify(lists.at(-1))).toContain('No console errors');
  });

  it('records the captured context (category, route, commit, tenant, user)', () => {
    const json = JSON.stringify(buildDescriptionAdf(feedback, ticket));
    expect(json).toContain('Category: Functional Defect');
    expect(json).toContain('/roles');
    expect(json).toContain('abc1234');
    expect(json).toContain('ten1');
    expect(json).toContain('usr1');
  });

  it('labels a null category (legacy rows) as Unclassified', () => {
    const json = JSON.stringify(buildDescriptionAdf({ ...feedback, category: null }, ticket));
    expect(json).toContain('Category: Unclassified');
  });
});

describe('createJiraIssue', () => {
  it('POSTs the v3 issue payload with basic auth and returns the key', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ key: 'TB-42' }) });
    await expect(createJiraIssue(settings, feedback, ticket)).resolves.toBe('TB-42');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/issue');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('bot@acme.com:tok123').toString('base64')}`,
    );
    const body = JSON.parse(init.body);
    expect(body.fields.project.key).toBe('TB');
    expect(body.fields.labels).toEqual(['feedback']);
    expect(body.fields.summary).toBe(ticket.title);
    expect(body.fields.description.type).toBe('doc');
  });

  it('throws with status + body on a Jira error response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad project' });
    await expect(createJiraIssue(settings, feedback, ticket)).rejects.toThrow(/400.*bad project/);
  });

  it('throws when JIRA_EMAIL / JIRA_API_TOKEN are missing', async () => {
    vi.stubEnv('JIRA_API_TOKEN', '');
    await expect(createJiraIssue(settings, feedback, ticket)).rejects.toThrow(/JIRA_EMAIL/);
  });
});

describe('attachScreenshot', () => {
  it('uploads multipart with the XSRF-bypass header', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await attachScreenshot(settings, 'TB-42', new Uint8Array([1, 2, 3]), 'image/jpeg');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/issue/TB-42/attachments');
    expect(init.headers['X-Atlassian-Token']).toBe('no-check');
    expect(init.body).toBeInstanceOf(FormData);
    const file = init.body.get('file') as File;
    expect(file.type).toBe('image/jpeg');
  });

  it('throws on an upload failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 413, text: async () => 'too large' });
    await expect(
      attachScreenshot(settings, 'TB-42', new Uint8Array([1]), 'image/png'),
    ).rejects.toThrow(/413/);
  });
});

describe('jiraIssueUrl', () => {
  it('builds the browse URL', () => {
    expect(jiraIssueUrl(settings, 'TB-42')).toBe('https://acme.atlassian.net/browse/TB-42');
  });
});
