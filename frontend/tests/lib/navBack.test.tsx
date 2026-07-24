// navBack — the shared smart-back behavior: history back when React Router
// has stamped an in-app entry index, in-app fallback otherwise.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { canGoBack, useSmartBack } from '../../src/lib/navBack';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => navigate };
});

// window.history.state is what React Router's BrowserRouter writes ({ idx }).
function setHistoryIdx(idx: number | null) {
  window.history.replaceState(idx === null ? null : { idx }, '');
}

beforeEach(() => {
  navigate.mockClear();
});
afterEach(() => {
  setHistoryIdx(null);
});

describe('canGoBack', () => {
  it('is false with no router-stamped state (fresh entry)', () => {
    setHistoryIdx(null);
    expect(canGoBack()).toBe(false);
  });

  it('is false at the first in-app entry (idx 0)', () => {
    setHistoryIdx(0);
    expect(canGoBack()).toBe(false);
  });

  it('is true when an in-app entry is behind us (idx > 0)', () => {
    setHistoryIdx(3);
    expect(canGoBack()).toBe(true);
  });
});

describe('useSmartBack', () => {
  let back: () => void = () => {};
  function Probe({ fallback }: { fallback?: string }) {
    back = useSmartBack(fallback);
    return null;
  }
  const mount = (fallback?: string) =>
    render(
      <MemoryRouter>
        <Probe fallback={fallback} />
      </MemoryRouter>,
    );

  it('goes one history entry back when in-app history exists', () => {
    setHistoryIdx(2);
    mount();
    act(() => back());
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('falls back to the given destination when the app was entered here', () => {
    setHistoryIdx(0);
    mount('/regulations');
    act(() => back());
    expect(navigate).toHaveBeenCalledWith('/regulations');
  });

  it('defaults the fallback to home', () => {
    setHistoryIdx(null);
    mount();
    act(() => back());
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
