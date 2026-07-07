// RoleProfile page — header/description render, deliverable rows expand to the
// role's tasks, task rows expand to the process path + deliverable chips.
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
      validation: UNREVIEWED,
    },
  ],
  responsibilities: [{ category: 'Quarterly Close', items: ['Review reserves'] }],
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
  it('renders the header, description, family/level chips, and value streams', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Reserving Actuary' })).toBeTruthy();
    expect(screen.getByText(/Owns the experience-study pipeline/)).toBeTruthy();
    // 'Actuarial' appears as the family chip, VS link, and division link.
    expect(screen.getAllByText('Actuarial').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Individual Contributor')).toBeTruthy();
    // The retired Lead/Support participation tags must NOT render.
    expect(screen.queryByText('Lead / Owner')).toBeNull();
    expect(screen.queryByText('Supporting')).toBeNull();
    expect(screen.getByText('Finance')).toBeTruthy();
  });

  it("expands a deliverable row to reveal the role's tasks under it", () => {
    renderPage();
    expect(screen.queryAllByText('Extract in-force data')).toHaveLength(1); // task summary row only
    fireEvent.click(screen.getByRole('button', { name: /Mortality Study/ }));
    expect(screen.queryAllByText('Extract in-force data')).toHaveLength(2); // + expanded deliverable
  });

  it('expands a task row to reveal the process path and deliverable chips', () => {
    renderPage();
    expect(screen.queryByText(/Experience Studies → Mortality Study/)).toBeNull();
    // 'Mortality Study' initially appears once (the deliverable row title).
    expect(screen.getAllByText(/Mortality Study/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Extract in-force data/ }));
    expect(screen.getByText(/Actuarial → Experience Studies → Mortality Study/)).toBeTruthy();
    // + the location path + the deliverable chip in the expanded panel.
    expect(screen.getAllByText(/Mortality Study/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders responsibilities groups', () => {
    renderPage();
    expect(screen.getByText('Quarterly Close')).toBeTruthy();
    expect(screen.getByText('Review reserves')).toBeTruthy();
  });
});
