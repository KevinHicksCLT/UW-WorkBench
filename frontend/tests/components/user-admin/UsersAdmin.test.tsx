// UsersAdmin — the Users sheet renders rows from GET /users with the derived
// display columns (type label, geography label, status pill, stream chips).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

import UsersAdmin from '../../../src/components/user-admin/UsersAdmin';
import { PreferencesProvider } from '../../../src/lib/preferences';
import { DialogProvider } from '../../../src/lib/dialogs';

const wrap = (ui: ReactNode) => (
  <DialogProvider>
    <PreferencesProvider>{ui}</PreferencesProvider>
  </DialogProvider>
);

const USERS = [
  {
    id: 'u1',
    email: 'ada@acme.io',
    name: 'Ada Lovelace',
    role: 'SITE_ADMIN',
    status: 'ACTIVE',
    externalId: null,
    orgUnitId: 'o1',
    geography: 'UK_EUROPE',
    operatingRoleId: null,
    isManager: true,
    reportsToId: null,
    isApprover: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    orgUnit: { id: 'o1', displayValue: 'Technology' },
    operatingRole: null,
    valueStreams: [{ processNode: { id: 'vs1', displayValue: 'Claims' } }],
  },
  {
    id: 'u2',
    email: 'bob@acme.io',
    name: 'Bob Deactivated',
    role: 'MEMBER',
    status: 'DEACTIVATED',
    externalId: null,
    orgUnitId: null,
    geography: null,
    operatingRoleId: null,
    isManager: false,
    reportsToId: null,
    isApprover: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    orgUnit: null,
    operatingRole: null,
    valueStreams: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.get.mockImplementation((path: string) => {
    if (path === '/users') return Promise.resolve(USERS);
    if (path === '/me/preferences') return Promise.resolve({});
    return Promise.resolve([]);
  });
});

describe('UsersAdmin', () => {
  it('renders a row per user with derived display columns', async () => {
    render(wrap(<UsersAdmin />));

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Bob Deactivated')).toBeInTheDocument();
    expect(screen.getByText('ada@acme.io')).toBeInTheDocument();

    // Derived labels, not raw enum tokens.
    expect(screen.getByText('Site Admin')).toBeInTheDocument();
    expect(screen.getByText('UK/Europe')).toBeInTheDocument();

    // Status pills and value-stream chip.
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(screen.getByText('Claims')).toBeInTheDocument();

    // Totals strip counts the rows.
    expect(screen.getByText(/2 users/)).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith('/users');
  });

  it('offers the Add user action', async () => {
    render(wrap(<UsersAdmin />));
    await screen.findByText('Ada Lovelace');
    expect(screen.getByRole('button', { name: 'Add user' })).toBeInTheDocument();
  });
});
