// roleDrawer — global role-drawer plumbing: useOpenRole sets `?role=` on the
// current location (preserving other params), and the mutation event bus lets
// role-listing surfaces refetch after the drawer amends/removes a role.
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { emitRoleMutated, useOpenRole, useRoleMutated } from '../../src/lib/roleDrawer';

function OpenRoleProbe() {
  const openRole = useOpenRole();
  const [params] = useSearchParams();
  return (
    <div>
      <div data-testid="params">{params.toString()}</div>
      <button onClick={() => openRole('r1')}>Open</button>
    </div>
  );
}

describe('useOpenRole', () => {
  it('sets ?role=<id> on the current location', async () => {
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <OpenRoleProbe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('params').textContent).toBe('');
    await act(async () => screen.getByText('Open').click());
    expect(screen.getByTestId('params').textContent).toBe('role=r1');
  });

  it('preserves other query params already on the URL', async () => {
    render(
      <MemoryRouter initialEntries={['/overview?view=list']}>
        <OpenRoleProbe />
      </MemoryRouter>,
    );
    await act(async () => screen.getByText('Open').click());
    const params = new URLSearchParams(screen.getByTestId('params').textContent ?? '');
    expect(params.get('view')).toBe('list');
    expect(params.get('role')).toBe('r1');
  });
});

describe('role-mutated event bus', () => {
  it('notifies subscribers when emitRoleMutated fires, and stops after unmount', () => {
    const onMutated = vi.fn();
    function Probe() {
      useRoleMutated(onMutated);
      return null;
    }
    const { unmount } = render(<Probe />);
    act(() => emitRoleMutated());
    expect(onMutated).toHaveBeenCalledTimes(1);
    unmount();
    act(() => emitRoleMutated());
    expect(onMutated).toHaveBeenCalledTimes(1);
  });
});
