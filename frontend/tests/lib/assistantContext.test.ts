import { describe, expect, it, vi } from 'vitest';
import { assistantDetail, openAssistant, setAssistantDetail } from '../../src/lib/assistantContext';

describe('assistantContext', () => {
  it('publishes and clears the context detail', () => {
    expect(assistantDetail()).toBeNull();
    setAssistantDetail('Viewing form PA-101-CA');
    expect(assistantDetail()).toBe('Viewing form PA-101-CA');
    setAssistantDetail(null);
    expect(assistantDetail()).toBeNull();
  });

  it('openAssistant dispatches the assistant:open window event', () => {
    const handler = vi.fn();
    window.addEventListener('assistant:open', handler);
    openAssistant();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('assistant:open', handler);
  });
});
