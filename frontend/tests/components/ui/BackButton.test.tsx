import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BackButton } from '../../../src/components/ui/BackButton';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => navigate };
});

const BASE =
  'rounded-full bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#404040] transition-colors duration-150';

function setHistoryIdx(idx: number | null) {
  window.history.replaceState(idx === null ? null : { idx }, '');
}

beforeEach(() => {
  navigate.mockClear();
});
afterEach(() => {
  setHistoryIdx(null);
});

describe('BackButton', () => {
  it('emits the base class contract and appends className verbatim', () => {
    render(
      <MemoryRouter>
        <BackButton className="extra" />
      </MemoryRouter>,
    );
    const btn = screen.getByRole('button', { name: '← Back' });
    expect(btn.className).toBe(`${BASE} extra`);
  });

  it('emits only the base class without className', () => {
    render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '← Back' }).className).toBe(BASE);
  });

  it('renders a custom label after the arrow', () => {
    render(
      <MemoryRouter>
        <BackButton label="Back to Regulations" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '← Back to Regulations' })).toBeTruthy();
  });

  it('navigates one history entry back when in-app history exists', () => {
    setHistoryIdx(2);
    render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );
    screen.getByRole('button', { name: '← Back' }).click();
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('falls back to the given destination on a fresh deep link (no in-app history)', () => {
    setHistoryIdx(0);
    render(
      <MemoryRouter>
        <BackButton fallback="/metrics" />
      </MemoryRouter>,
    );
    screen.getByRole('button', { name: '← Back' }).click();
    expect(navigate).toHaveBeenCalledWith('/metrics');
  });

  it('defaults the fallback to home', () => {
    setHistoryIdx(null);
    render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );
    screen.getByRole('button', { name: '← Back' }).click();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
