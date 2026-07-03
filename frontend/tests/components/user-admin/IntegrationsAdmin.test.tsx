// IntegrationsAdmin — the raw API key (and webhook secret) appear exactly once
// after creation and disappear on dismiss (reveal-once contract).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
  prefetch: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock('../../../src/lib/api', () => ({ api: apiMock, setForbiddenHandler: vi.fn() }));

import IntegrationsAdmin from '../../../src/components/user-admin/IntegrationsAdmin';
import { DialogProvider } from '../../../src/lib/dialogs';

const wrap = (ui: ReactNode) => <DialogProvider>{ui}</DialogProvider>;

const EXISTING_KEY = {
  id: 'k1',
  name: 'Okta provisioning',
  keyPrefix: 'tbk_abc123',
  scopes: [],
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-06-01T00:00:00Z',
  hasWebhookSecret: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.get.mockResolvedValue([EXISTING_KEY]);
});

describe('IntegrationsAdmin', () => {
  it('lists existing keys with prefix and status (never the raw key)', async () => {
    render(wrap(<IntegrationsAdmin />));
    expect(await screen.findByText('Okta provisioning')).toBeInTheDocument();
    expect(screen.getByText('tbk_abc123…')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith('/users/api-keys');
  });

  it('reveals the raw key + secret once after create, and hides them on dismiss', async () => {
    apiMock.post.mockResolvedValue({
      id: 'k2',
      name: 'SCIM sync',
      keyPrefix: 'tbk_new',
      key: 'tbk_new_RAW_SECRET_VALUE',
      webhookSecret: 'whsec_RAW_WEBHOOK_SECRET',
    });
    render(wrap(<IntegrationsAdmin />));
    await screen.findByText('Okta provisioning');

    // Nothing revealed before a create.
    expect(screen.queryByText('tbk_new_RAW_SECRET_VALUE')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'SCIM sync' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    // Reveal-once card shows the raw key and webhook secret with the warning.
    expect(await screen.findByText('tbk_new_RAW_SECRET_VALUE')).toBeInTheDocument();
    expect(screen.getByText('whsec_RAW_WEBHOOK_SECRET')).toBeInTheDocument();
    expect(screen.getByText('Store these now — they are not shown again.')).toBeInTheDocument();
    expect(apiMock.post).toHaveBeenCalledWith('/users/api-keys', {
      name: 'SCIM sync',
      withWebhookSecret: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(screen.queryByText('tbk_new_RAW_SECRET_VALUE')).not.toBeInTheDocument();
      expect(screen.queryByText('whsec_RAW_WEBHOOK_SECRET')).not.toBeInTheDocument();
    });
  });
});
