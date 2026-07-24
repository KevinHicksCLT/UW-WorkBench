// RoleProfile page — description callout, review stats + filter, application
// roll-up chips, value-stream-grouped deliverable cards with numbered tasks,
// and the per-task checklist drill-down. All content is a task-level roll-up.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoleProfile from '../../../src/pages/role-profile/RoleProfile';
import type { RoleProfilePayload } from '../../../src/pages/role-profile/types';
import { UNREVIEWED } from '../../../src/components/TaskValidationControl';

const payload: RoleProfilePayload = {
  id: 'r1',
  name: 'Reserving Actuary',
  description: 'Owns the experience-study pipeline and books quarterly reserves.',
  roleFamily: 'Actuarial',
  roleLevel: 'Individual Contributor',
  company: { id: 'c1', name: 'ABC Insurance' },
  division: { id: 'div1', name: 'Actuarial' },
  department: { id: 'dept1', name: 'Reserving' },
  participation: [
    { valueStreamId: 'vs1', valueStreamName: 'Actuarial', participationType: 'Lead' },
    { valueStreamId: 'vs2', valueStreamName: 'Finance', participationType: 'Support' },
  ],
  applications: [
    { id: 'app1', name: 'Prophet', taskCount: 2 },
    { id: 'app2', name: 'SAP', taskCount: 1 },
  ],
  deliverables: [
    {
      id: 'd1',
      title: 'Mortality Study',
      role_: 'Owner',
      valueStreamName: 'Actuarial',
      tasks: [
        {
          name: 'Extract in-force data',
          nodeRoleId: 'nr1',
          relation: 'Lead',
          l3: 'Experience Studies',
          l4: 'Mortality Study',
          validation: UNREVIEWED,
        },
      ],
    },
  ],
  taskSummary: [
    {
      nodeId: 't1',
      nodeRoleId: 'nr1',
      name: 'Extract in-force data',
      relation: 'Lead',
      valueStreamId: 'vs1',
      valueStreamName: 'Actuarial',
      l3: 'Experience Studies',
      l4: 'Mortality Study',
      stepNumber: 1,
      deliverables: [{ id: 'd1', title: 'Mortality Study' }],
      apps: [{ id: 'app1', name: 'Prophet' }],
      checklist: [
        { id: 'ci1', text: 'Pull in-force extract' },
        { id: 'ci2', text: 'Validate record counts' },
      ],
      validation: UNREVIEWED,
    },
    {
      nodeId: 't2',
      nodeRoleId: 'nr2',
      name: 'Book quarterly reserves',
      relation: 'Support',
      valueStreamId: 'vs2',
      valueStreamName: 'Finance',
      l3: 'Close',
      l4: 'Reserve Close',
      stepNumber: 2,
      deliverables: [],
      apps: [],
      checklist: [],
      validation: {
        ...UNREVIEWED,
        status: 'CONFIRMED',
        validatedBy: 'kelly@abc.example',
        validatedAt: '2026-07-07T00:00:00Z',
      },
    },
  ],
  responsibilities: [],
};

vi.mock('../../../src/lib/useApi', () => ({
  useApi: () => ({ data: payload, error: '', loading: false, refetch: () => {} }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/roles/r1']}>
      <Routes>
        <Route path="/roles/:id" element={<RoleProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleProfile', () => {
  it('renders header, description callout, and review stats', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Reserving Actuary' })).toBeTruthy();
    expect(screen.getByText('Role description')).toBeTruthy();
    expect(screen.getByText(/Owns the experience-study pipeline/)).toBeTruthy();
    // 1 of 2 tasks reviewed → 50%.
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('tasks assigned')).toBeTruthy();
  });

  it('rolls applications up with per-app task counts', () => {
    renderPage();
    // Prophet appears in the roll-up callout and again as a task-row chip.
    expect(screen.getAllByText('Prophet').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 tasks')).toBeTruthy();
    expect(screen.getByText('SAP')).toBeTruthy();
  });

  it('groups deliverables under stream · L3 · L4 path headers, first card open', () => {
    renderPage();
    expect(screen.getByText('Actuarial · Experience Studies · Mortality Study')).toBeTruthy();
    expect(screen.getByText('Finance · Close · Reserve Close')).toBeTruthy();
    // First deliverable card is expanded by default → its task shows.
    expect(screen.getByText('Extract in-force data')).toBeTruthy();
    // Deliverable-less task sits in the fallback card under its stream.
    expect(screen.getByText('Tasks without a deliverable')).toBeTruthy();
  });

  it('expands a task to reveal its ordered checklist steps', () => {
    renderPage();
    expect(screen.queryByText('Pull in-force extract')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Extract in-force data/ }));
    expect(screen.getByText(/Sub-tasks · in order/i)).toBeTruthy();
    expect(screen.getByText('Pull in-force extract')).toBeTruthy();
    expect(screen.getByText('Validate record counts')).toBeTruthy();
  });

  it('filters tasks to needs-review and back to all', () => {
    renderPage();
    // Needs-review filter drops the confirmed Finance task's card.
    fireEvent.click(screen.getByRole('button', { name: /Needs review \(1\)/ }));
    expect(screen.queryByText('Tasks without a deliverable')).toBeNull();
    expect(screen.getByText('Extract in-force data')).toBeTruthy();
    // Back to all.
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Tasks without a deliverable')).toBeTruthy();
  });
});
