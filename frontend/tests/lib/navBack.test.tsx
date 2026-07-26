// navBack — the shared smart-back behavior: history back when React Router
// has stamped an in-app entry index, in-app fallback otherwise.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { canGoBack, useBackHandler, useSmartBack } from '../../src/lib/navBack';

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

describe('useBackHandler (in-page drill pop)', () => {
  function Drilled({ handler, enabled = true }: { handler: () => boolean; enabled?: boolean }) {
    useBackHandler(handler, enabled);
    return null;
  }
  let back: () => void = () => {};
  function Probe() {
    back = useSmartBack();
    return null;
  }
  const mountWith = (children: React.ReactNode) =>
    render(
      <MemoryRouter>
        <Probe />
        {children}
      </MemoryRouter>,
    );

  it('a consuming handler pops the drill instead of navigating', () => {
    setHistoryIdx(3);
    const pop = vi.fn(() => true);
    mountWith(<Drilled handler={pop} />);
    act(() => back());
    expect(pop).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a non-consuming handler (drill root) falls through to history', () => {
    setHistoryIdx(3);
    const root = vi.fn(() => false);
    mountWith(<Drilled handler={root} />);
    act(() => back());
    expect(root).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('runs handlers newest-first', () => {
    setHistoryIdx(3);
    const order: string[] = [];
    const first = () => {
      order.push('first');
      return false;
    };
    const second = () => {
      order.push('second');
      return true;
    };
    mountWith(
      <>
        <Drilled handler={first} />
        <Drilled handler={second} />
      </>,
    );
    act(() => back());
    expect(order).toEqual(['second']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('unregisters on unmount and when disabled', () => {
    setHistoryIdx(3);
    const pop = vi.fn(() => true);
    const view = mountWith(<Drilled handler={pop} />);
    view.unmount();
    setHistoryIdx(3);
    mountWith(<Drilled handler={pop} enabled={false} />);
    act(() => back());
    expect(pop).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});
