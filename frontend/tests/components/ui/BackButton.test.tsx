import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BackButton } from '../../../src/components/ui/BackButton';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => navigate };
});

const BASE =
  'rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150';

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

  it('navigates one history entry back on click', () => {
    render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );
    screen.getByRole('button', { name: '← Back' }).click();
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});
