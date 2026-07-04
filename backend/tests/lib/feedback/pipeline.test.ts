// feedback/pipeline.ts — step orchestration against mocked prisma + step
// modules: checkpoint skipping (retry-safety / no duplicate Jira tickets),
// the GENERATED stop when Jira is disabled, and FAILED bookkeeping.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, configMock, generateMock, jiraMock, notifyMock } = vi.hoisted(() => ({
  prismaMock: {
    feedback: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
    },
  },
  configMock: { loadFeedbackConfig: vi.fn() },
  generateMock: { generateTicket: vi.fn() },
  jiraMock: {
    createJiraIssue: vi.fn(),
    attachScreenshot: vi.fn(),
    jiraIssueUrl: vi.fn(() => 'https://acme.atlassian.net/browse/TB-42'),
  },
  notifyMock: { sendNotification: vi.fn() },
}));

vi.mock('../../../src/db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../../src/lib/feedback/config.js', () => configMock);
vi.mock('../../../src/lib/feedback/generateTicket.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/lib/feedback/generateTicket.js')>();
  return { ...actual, generateTicket: generateMock.generateTicket };
});
vi.mock('../../../src/lib/feedback/jira.js', () => jiraMock);
vi.mock('../../../src/lib/feedback/notify.js', () => notifyMock);

import { runFeedbackPipeline } from '../../../src/lib/feedback/pipeline.js';

const ticket = {
  title: 'Fix sidebar scroll',
  summary: 'Scroll resets.',
  story: 'Persist scrollTop.',
  acceptanceCriteria: ['Scroll survives navigation'],
};

const baseRow = {
  id: 'fb1',
  tenantId: 'ten1',
  userId: 'usr1',
  name: 'Kevin',
  text: 'Sidebar loses scroll position',
  route: '/roles',
  commitSha: 'abc1234',
  userAgent: 'UA',
  screenshot: null as Uint8Array | null,
  screenshotMime: null as string | null,
  status: 'PENDING',
  ticket: null as unknown,
  jiraKey: null as string | null,
  screenshotAttachedAt: null as Date | null,
  notifiedAt: null as Date | null,
  error: null as string | null,
};

const config = {
  feedbackButtonEnabled: true,
  jira: {
    enabled: true,
    baseUrl: 'https://acme.atlassian.net',
    projectKey: 'TB',
    issueType: 'Task',
    labels: ['feedback'],
  },
  notifications: { enabled: true, emails: ['pm@acme.com'] },
};

function updates(): Record<string, unknown>[] {
  const calls = prismaMock.feedback.update.mock.calls as unknown as {
    data: Record<string, unknown>;
  }[][];
  return calls.map((c) => c[0].data);
}

beforeEach(() => {
  vi.clearAllMocks();
  configMock.loadFeedbackConfig.mockReturnValue(structuredClone(config));
  generateMock.generateTicket.mockResolvedValue(ticket);
  jiraMock.createJiraIssue.mockResolvedValue('TB-42');
  jiraMock.attachScreenshot.mockResolvedValue(undefined);
  jiraMock.jiraIssueUrl.mockReturnValue('https://acme.atlassian.net/browse/TB-42');
  notifyMock.sendNotification.mockResolvedValue(undefined);
  prismaMock.feedback.update.mockResolvedValue({});
});

describe('runFeedbackPipeline', () => {
  it('walks GENERATED → TICKETED → NOTIFIED on the happy path', async () => {
    prismaMock.feedback.findUnique.mockResolvedValue({ ...baseRow });
    await runFeedbackPipeline('fb1');

    expect(generateMock.generateTicket).toHaveBeenCalledOnce();
    expect(jiraMock.createJiraIssue).toHaveBeenCalledOnce();
    expect(notifyMock.sendNotification).toHaveBeenCalledWith(
      ['pm@acme.com'],
      expect.objectContaining({ jiraKey: 'TB-42' }),
    );
    const statuses = updates().map((d) => d.status);
    expect(statuses).toEqual(['GENERATED', 'TICKETED', 'NOTIFIED']);
  });

  it('stops at GENERATED when jira is disabled', async () => {
    configMock.loadFeedbackConfig.mockReturnValue({
      ...structuredClone(config),
      jira: { ...config.jira, enabled: false },
    });
    prismaMock.feedback.findUnique.mockResolvedValue({ ...baseRow });
    await runFeedbackPipeline('fb1');

    expect(generateMock.generateTicket).toHaveBeenCalledOnce();
    expect(jiraMock.createJiraIssue).not.toHaveBeenCalled();
    expect(updates().map((d) => d.status)).toEqual(['GENERATED']);
  });

  it('resumes from the failed step: existing ticket + jiraKey are never redone', async () => {
    prismaMock.feedback.findUnique.mockResolvedValue({
      ...baseRow,
      status: 'FAILED',
      ticket,
      jiraKey: 'TB-42',
      screenshot: new Uint8Array([1, 2]),
      screenshotMime: 'image/jpeg',
    });
    await runFeedbackPipeline('fb1');

    expect(generateMock.generateTicket).not.toHaveBeenCalled(); // no re-billing
    expect(jiraMock.createJiraIssue).not.toHaveBeenCalled(); // no duplicate ticket
    expect(jiraMock.attachScreenshot).toHaveBeenCalledWith(
      expect.anything(),
      'TB-42',
      expect.any(Uint8Array),
      'image/jpeg',
    );
    expect(notifyMock.sendNotification).toHaveBeenCalledOnce();
  });

  it('skips the attachment step when no screenshot was included', async () => {
    prismaMock.feedback.findUnique.mockResolvedValue({ ...baseRow });
    await runFeedbackPipeline('fb1');
    expect(jiraMock.attachScreenshot).not.toHaveBeenCalled();
  });

  it('skips notification (terminal TICKETED) when notifications are off', async () => {
    configMock.loadFeedbackConfig.mockReturnValue({
      ...structuredClone(config),
      notifications: { enabled: false, emails: [] },
    });
    prismaMock.feedback.findUnique.mockResolvedValue({ ...baseRow });
    await runFeedbackPipeline('fb1');
    expect(notifyMock.sendNotification).not.toHaveBeenCalled();
    expect(updates().map((d) => d.status)).toEqual(['GENERATED', 'TICKETED']);
  });

  it('marks the row FAILED with the step error message on a Jira outage', async () => {
    jiraMock.createJiraIssue.mockRejectedValue(new Error('Jira issue create failed: HTTP 503'));
    prismaMock.feedback.findUnique.mockResolvedValue({ ...baseRow });
    await runFeedbackPipeline('fb1');

    const last = updates().at(-1);
    expect(last?.status).toBe('FAILED');
    expect(String(last?.error)).toContain('HTTP 503');
  });

  it('does nothing when the row does not exist', async () => {
    prismaMock.feedback.findUnique.mockResolvedValue(null);
    await runFeedbackPipeline('missing');
    expect(generateMock.generateTicket).not.toHaveBeenCalled();
    expect(prismaMock.feedback.update).not.toHaveBeenCalled();
  });
});
