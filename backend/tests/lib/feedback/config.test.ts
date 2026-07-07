// feedback/config.ts — schema validation for backend/config/feedback.config.json
// plus a smoke read of the real checked-in file (it must always parse).
import { describe, expect, it } from 'vitest';
import { loadFeedbackConfig, parseFeedbackConfig } from '../../../src/lib/feedback/config.js';

const valid = {
  feedbackButtonEnabled: true,
  jira: { enabled: false, baseUrl: 'https://x.atlassian.net', projectKey: 'TB' },
  notifications: { enabled: false, emails: [] },
};

describe('parseFeedbackConfig', () => {
  it('accepts a minimal config and applies jira defaults', () => {
    const cfg = parseFeedbackConfig(valid);
    expect(cfg.jira.issueType).toBe('Task');
    expect(cfg.jira.labels).toEqual(['feedback']);
    expect(cfg.jira.epics).toEqual([]);
    expect(cfg.feedbackButtonEnabled).toBe(true);
  });

  it('accepts an epic catalog and rejects an epic missing its hint', () => {
    const epic = { key: 'TB-100', name: 'Platform UX', hint: 'cross-cutting UI/UX' };
    const cfg = parseFeedbackConfig({ ...valid, jira: { ...valid.jira, epics: [epic] } });
    expect(cfg.jira.epics).toEqual([epic]);
    expect(() =>
      parseFeedbackConfig({
        ...valid,
        jira: { ...valid.jira, epics: [{ key: 'TB-100', name: 'Platform UX' }] },
      }),
    ).toThrow();
  });

  it('rejects a non-email notification recipient', () => {
    expect(() =>
      parseFeedbackConfig({
        ...valid,
        notifications: { enabled: true, emails: ['not-an-email'] },
      }),
    ).toThrow();
  });

  it('rejects a config missing the jira block', () => {
    expect(() => parseFeedbackConfig({ feedbackButtonEnabled: true })).toThrow();
  });

  it('rejects an empty jira baseUrl', () => {
    expect(() =>
      parseFeedbackConfig({ ...valid, jira: { enabled: true, baseUrl: '', projectKey: 'TB' } }),
    ).toThrow();
  });
});

describe('loadFeedbackConfig', () => {
  it('parses the checked-in backend/config/feedback.config.json', () => {
    const cfg = loadFeedbackConfig();
    expect(typeof cfg.feedbackButtonEnabled).toBe('boolean');
    expect(cfg.jira.projectKey.length).toBeGreaterThan(0);
  });
});
