// feedback/notify.ts — email assembly (subject, HTML escaping) and the Resend
// HTTP call against a stubbed global fetch.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNotificationEmail, sendNotification } from '../../../src/lib/feedback/notify.js';

const input = {
  jiraKey: 'TB-42',
  jiraUrl: 'https://acme.atlassian.net/browse/TB-42',
  ticket: {
    title: 'Fix <script> injection in titles',
    summary: 'Summary & details',
    story: 'story',
    acceptanceCriteria: ['ok'],
  },
  submittedBy: null,
  route: '/roles',
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('FEEDBACK_FROM_EMAIL', '');
});

describe('buildNotificationEmail', () => {
  it('puts the Jira key in the subject and the link in the body', () => {
    const { subject, html } = buildNotificationEmail(input);
    expect(subject).toContain('TB-42');
    expect(html).toContain(input.jiraUrl);
  });

  it('escapes HTML in model-generated text', () => {
    const { html } = buildNotificationEmail(input);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Summary &amp; details');
    expect(html).not.toContain('<script>');
  });

  it('labels a missing submitter as anonymous', () => {
    expect(buildNotificationEmail(input).html).toContain('anonymous');
  });
});

describe('sendNotification', () => {
  it('POSTs to Resend with the bearer key and recipient list', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await sendNotification(['a@x.com', 'b@x.com'], input);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['a@x.com', 'b@x.com']);
    expect(body.subject).toContain('TB-42');
    expect(body.from).toContain('onboarding@resend.dev');
  });

  it('throws when RESEND_API_KEY is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendNotification(['a@x.com'], input)).rejects.toThrow(/RESEND_API_KEY/);
  });

  it('throws with status on a Resend error response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'invalid from' });
    await expect(sendNotification(['a@x.com'], input)).rejects.toThrow(/422/);
  });
});
