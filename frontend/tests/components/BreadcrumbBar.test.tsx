// BreadcrumbBar — the global header trail: crumb rendering, the middle
// collapse for long walks, and the always-visible back affordance (smart
// back: history when it exists, in-app fallback otherwise).
import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import BreadcrumbBar from '../../src/components/BreadcrumbBar';
import { BreadcrumbProvider, useRegisterCrumb } from '../../src/lib/breadcrumbs';

// canGoBack reads the entry index React Router stamps on window.history.state;
// MemoryRouter does not touch window.history, so the test stamps it directly.
function setHistoryIdx(idx: number | null) {
  window.history.replaceState(idx === null ? null : { idx }, '');
}
afterEach(() => setHistoryIdx(null));

// ── Harness ──────────────────────────────────────────────────────────────────
let navigateFn: (to: string | number) => void = () => {};

function Probe() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  navigateFn = navigate as (to: string | number) => void;
  return <div data-testid="loc">{pathname}</div>;
}

// Registers a crumb for every non-base location, labelled by its last segment,
// so imperative walks grow the trail exactly like drill-down pages do.
function AutoCrumb() {
  const { pathname } = useLocation();
  const label = pathname.split('/').filter(Boolean).pop() ?? '';
  useRegisterCrumb(label.toUpperCase());
  return null;
}

function mount(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BreadcrumbProvider>
        <BreadcrumbBar />
        <AutoCrumb />
        <Probe />
      </BreadcrumbProvider>
    </MemoryRouter>,
  );
}

const loc = () => screen.getByTestId('loc').textContent;

describe('BreadcrumbBar', () => {
  it('is hidden (but mounted) on Home where the trail is empty', () => {
    const { container } = mount('/');
    expect(container.firstElementChild?.className).toContain('hidden');
  });

  it('renders the walked trail with the current page as the active crumb', () => {
    mount('/');
    act(() => navigateFn('/roles'));
    act(() => navigateFn('/roles/r42'));
    expect(screen.getByRole('link', { name: 'Roles' }).getAttribute('href')).toBe('/roles');
    const active = screen.getByText('R42');
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(active.className).toBe('focus-crumb-active');
  });

  it('collapses the middle of a long walk to root › … › last crumbs', () => {
    mount('/');
    act(() => navigateFn('/roles'));
    for (const seg of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) act(() => navigateFn(`/roles/${seg}`));
    // 8 crumbs (Roles + 7 pages) > MAX 6 → root, ellipsis, last four.
    expect(screen.getByText('…')).toBeTruthy();
    expect(screen.getByText('Roles')).toBeTruthy();
    expect(screen.getByText('G')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
  });

  it('back button steps through real history when in-app history exists', () => {
    mount('/');
    act(() => navigateFn('/roles'));
    act(() => navigateFn('/roles/r42'));
    setHistoryIdx(2); // mirror what BrowserRouter would have stamped
    act(() => screen.getByRole('button', { name: 'Go back' }).click());
    expect(loc()).toBe('/roles');
  });

  it('back button falls back to home on a fresh deep link (no in-app history)', () => {
    mount('/roles/r42');
    setHistoryIdx(0);
    act(() => screen.getByRole('button', { name: 'Go back' }).click());
    expect(loc()).toBe('/');
  });
});
