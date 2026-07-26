// breadcrumbs — the visited-path trail: tab appends, page registration,
// back-nav truncation, deep-link seeding, and resetToTab.
import { useEffect, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import {
  BreadcrumbProvider,
  useBreadcrumbHeader,
  useRegisterCrumb,
} from '../../src/lib/breadcrumbs';

// ── Harness ──────────────────────────────────────────────────────────────────
// Renders the provider inside a MemoryRouter and exposes the trail + controls.
let navigateFn: (to: string) => void = () => {};
let resetFn: (to: string) => void = () => {};

function Probe() {
  const { trail, resetToTab } = useBreadcrumbHeader();
  const navigate = useNavigate();
  navigateFn = navigate;
  resetFn = resetToTab;
  return (
    <div>
      <div data-testid="trail">{trail.map((c) => `${c.label}@${c.to}`).join(' | ')}</div>
    </div>
  );
}

function RegisterCrumb({ label }: { label: string }) {
  useRegisterCrumb(label);
  return null;
}

function tree(initialPath: string, children?: ReactNode) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <BreadcrumbProvider>
        <Probe />
        {children}
      </BreadcrumbProvider>
    </MemoryRouter>
  );
}

function renderTrail(initialPath = '/', children?: ReactNode) {
  return render(tree(initialPath, children));
}

const trail = () => screen.getByTestId('trail').textContent;

describe('trail building', () => {
  it('starts empty on Home', () => {
    renderTrail('/');
    expect(trail()).toBe('');
  });

  it('roots at the owning group when a tab base is reached by link navigation', () => {
    renderTrail('/');
    act(() => navigateFn('/roles'));
    expect(trail()).toBe('Roles@/roles');
  });

  it('keeps walking across tab boundaries (cross-tab links append)', () => {
    renderTrail('/');
    act(() => navigateFn('/roles'));
    act(() => navigateFn('/standards'));
    expect(trail()).toBe('Roles@/roles | Standards@/standards');
  });

  it('navigating to a URL already in the trail truncates back to it and keeps the fresh search', () => {
    renderTrail('/');
    act(() => navigateFn('/roles'));
    act(() => navigateFn('/standards'));
    act(() => navigateFn('/roles?f=claims'));
    expect(trail()).toBe('Roles@/roles?f=claims');
  });

  it('returning to Home clears the trail', () => {
    renderTrail('/');
    act(() => navigateFn('/roles'));
    act(() => navigateFn('/'));
    expect(trail()).toBe('');
  });
});

describe('resetToTab', () => {
  it('re-roots the trail to the owning group for a top-nav click', () => {
    renderTrail('/');
    act(() => navigateFn('/roles'));
    act(() => navigateFn('/standards'));
    act(() => resetFn('/standards'));
    expect(trail()).toBe('Standards@/standards');
  });

  it('re-roots a grouped destination to [group, sub-tab]', () => {
    renderTrail('/');
    act(() => resetFn('/work-library'));
    expect(trail()).toBe('Workspace@/portfolio | Work Library@/work-library');
  });

  it('clears the trail for the wordmark (/) and ignores non-tab URLs', () => {
    renderTrail('/');
    act(() => navigateFn('/roles'));
    act(() => resetFn('/'));
    expect(trail()).toBe('');

    // Location is still /roles, so walk to a different tab to rebuild a trail.
    act(() => navigateFn('/standards'));
    act(() => resetFn('/not-a-tab'));
    expect(trail()).toBe('Standards@/standards'); // unchanged by the no-op reset
  });
});

describe('useRegisterCrumb', () => {
  it('appends the page crumb after the owning group on a deep link (seeded root)', () => {
    renderTrail('/roles/r42', <RegisterCrumb label="Claims Manager" />);
    expect(trail()).toBe('Roles@/roles | Claims Manager@/roles/r42');
  });

  it('roots at Home for a Home-owned drill page (/programs)', () => {
    renderTrail('/programs/p1', <RegisterCrumb label="Program One" />);
    expect(trail()).toBe('Home@/ | Program One@/programs/p1');
  });

  it('is a no-op on a tab base path', () => {
    renderTrail('/roles', <RegisterCrumb label="Should not appear" />);
    expect(trail()).toBe('Roles@/roles');
  });

  it('replaces the label when the same path re-registers (state preserved across rerender)', () => {
    const view = renderTrail('/roles/r42', <RegisterCrumb label="Loading…" />);
    expect(trail()).toContain('Loading…@/roles/r42');
    view.rerender(tree('/roles/r42', <RegisterCrumb label="Claims Manager" />));
    expect(trail()).toContain('Claims Manager@/roles/r42');
    expect(trail()).not.toContain('Loading…');
  });
});

describe('useBreadcrumbHeader outside the provider', () => {
  it('returns safe defaults', () => {
    function Naked() {
      const { trail: t, resetToTab } = useBreadcrumbHeader();
      useEffect(() => {
        resetToTab('/roles'); // no-op fallback must be callable
      }, [resetToTab]);
      return <div data-testid="naked">{`${t.length}`}</div>;
    }
    render(<Naked />);
    expect(screen.getByTestId('naked').textContent).toBe('0');
  });
});
