// Approvals page — the inbox ("My queue") renders rows from
// GET /approvals/requests?box=inbox, and opening a request where the signed-in
// user holds a pending assignment on the current stage offers Approve/Reject.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

const ME = { id: 'me', email: 'me@acme.io', name: 'Mia Approver', role: 'MEMBER', tenantId: 't1' };
vi.mock('../../../src/lib/auth', () => ({
  useAuth: () => ({
    user: ME,
    permissions: null,
    attributes: null,
    startPage: 'home',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
  }),
}));

import Approvals from '../../../src/pages/approvals/Approvals';
import { PreferencesProvider } from '../../../src/lib/preferences';
import { DialogProvider } from '../../../src/lib/dialogs';
import { BreadcrumbProvider } from '../../../src/lib/breadcrumbs';

const wrap = (ui: ReactNode) => (
  <MemoryRouter initialEntries={['/approvals']}>
    <DialogProvider>
      <PreferencesProvider>
        <BreadcrumbProvider>{ui}</BreadcrumbProvider>
      </PreferencesProvider>
    </DialogProvider>
  </MemoryRouter>
);

const REQUESTS = [
  {
    id: 'ar1',
    summary: 'Advance "Claims Modernization" to Execute',
    status: 'PENDING',
    currentStage: 1,
    dueAt: '2099-01-01T00:00:00Z',
    createdAt: '2026-07-01T00:00:00Z',
    applyError: null,
    entityType: 'PortfolioInitiative',
    entityId: 'i1',
    action: 'workflow.APPROVE',
    payload: { action: 'APPROVE' },
    policy: {
      decisionKey: 'portfolio.initiative.stage-gate',
      name: 'Stage-gate approval',
      slaHours: 48,
    },
    requestedBy: { id: 'u9', name: 'Rex Requester', email: 'rex@acme.io' },
    assignments: [
      {
        id: 'as1',
        stageOrder: 1,
        seatKey: 'sponsor',
        assigneeId: 'me',
        escalated: false,
        status: 'PENDING',
        assignedAt: '2026-07-01T00:00:00Z',
        decidedAt: null,
        method: null,
        comment: null,
        assignee: { id: 'me', name: 'Mia Approver', email: 'me@acme.io' },
      },
    ],
  },
  {
    id: 'ar2',
    summary: 'Replace ANALYST permission set',
    status: 'PENDING',
    currentStage: 1,
    dueAt: '2026-07-02T00:00:00Z', // in the past → overdue highlight
    createdAt: '2026-06-30T00:00:00Z',
    applyError: null,
    entityType: 'PermissionSet',
    entityId: 'ps1',
    action: 'replace',
    payload: { grants: [] },
    policy: {
      decisionKey: 'user-admin.permission-sets.replace',
      name: 'Permission-set change',
      slaHours: 24,
    },
    requestedBy: { id: 'u9', name: 'Rex Requester', email: 'rex@acme.io' },
    assignments: [
      {
        id: 'as2',
        stageOrder: 1,
        seatKey: 'site-admins',
        assigneeId: 'other',
        escalated: false,
        status: 'PENDING',
        assignedAt: '2026-06-30T00:00:00Z',
        decidedAt: null,
        method: null,
        comment: null,
        assignee: { id: 'other', name: 'Otto Other', email: 'otto@acme.io' },
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  // The page persists mailbox/selection via lib/viewState (sessionStorage) —
  // clear it so state never leaks between tests.
  sessionStorage.clear();
  apiMock.get.mockImplementation((path: string) => {
    if (path === '/approvals/requests?box=inbox') return Promise.resolve(REQUESTS);
    if (path === '/me/preferences') return Promise.resolve({});
    return Promise.resolve([]);
  });
});

describe('Approvals', () => {
  it('renders the inbox rows with policy, requester, and status pill', async () => {
    render(wrap(<Approvals />));

    expect(
      await screen.findByText('Advance "Claims Modernization" to Execute'),
    ).toBeInTheDocument();
    expect(screen.getByText('Replace ANALYST permission set')).toBeInTheDocument();
    expect(screen.getByText('Stage-gate approval')).toBeInTheDocument();
    expect(screen.getAllByText('Rex Requester')).toHaveLength(2);
    expect(screen.getAllByText('Pending')).toHaveLength(2);

    // Totals strip counts the rows; the mailbox came from the inbox box.
    expect(screen.getByText(/2 requests/)).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith('/approvals/requests?box=inbox');
  });

  it('opens the drawer and offers Approve/Reject when I hold a pending assignment', async () => {
    render(wrap(<Approvals />));

    fireEvent.click(await screen.findByText('Advance "Claims Modernization" to Execute'));

    expect(await screen.findByText('Approval request')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    // Not my request → no cancel action.
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
  });

  it('hides Approve/Reject when the pending assignment belongs to someone else', async () => {
    render(wrap(<Approvals />));

    fireEvent.click(await screen.findByText('Replace ANALYST permission set'));

    expect(await screen.findByText('Approval request')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });
});
