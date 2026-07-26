// viewState — the reusable navigation-state layer: storage round-trips (with
// the in-memory fallback when sessionStorage throws), the useViewState hook's
// restore/skip/persist semantics, and useScrollRestore's save + deferred
// restore behavior.
import { useRef, type Dispatch, type SetStateAction } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  clearViewState,
  loadViewState,
  saveViewState,
  useOnChange,
  useScrollRestore,
  useViewState,
} from '../../src/lib/viewState';

const NS = 'nav.view.';

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── Storage primitives ───────────────────────────────────────────────────────

describe('save/load/clearViewState', () => {
  it('round-trips JSON values under the namespaced key', () => {
    saveViewState('k', { a: [1, 2], b: 'x' });
    expect(window.sessionStorage.getItem(`${NS}k`)).toBe('{"a":[1,2],"b":"x"}');
    expect(loadViewState('k')).toEqual({ a: [1, 2], b: 'x' });
  });

  it('returns undefined for absent keys', () => {
    expect(loadViewState('missing')).toBeUndefined();
  });

  it('drops a corrupted entry and returns undefined', () => {
    window.sessionStorage.setItem(`${NS}bad`, '{not json');
    expect(loadViewState('bad')).toBeUndefined();
    expect(window.sessionStorage.getItem(`${NS}bad`)).toBeNull();
  });

  it('clearViewState removes the entry', () => {
    saveViewState('k', 1);
    clearViewState('k');
    expect(loadViewState('k')).toBeUndefined();
  });

  it('falls back to in-memory storage when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('quota');
    });
    saveViewState('mem', 42);
    expect(loadViewState('mem')).toBe(42);
    clearViewState('mem');
    expect(loadViewState('mem')).toBeUndefined();
  });
});

// ── useViewState ─────────────────────────────────────────────────────────────

let lastSet: Dispatch<SetStateAction<string>> = () => {};

function Probe({ k, initial, restore }: { k: string | null; initial: string; restore?: boolean }) {
  const [value, setValue] = useViewState<string>(k, initial, restore);
  lastSet = setValue;
  return <div data-testid="value">{value}</div>;
}

const value = () => screen.getByTestId('value').textContent;

describe('useViewState', () => {
  it('seeds from initial when nothing is saved and does not save the mount value', () => {
    render(<Probe k="v" initial="a" />);
    expect(value()).toBe('a');
    // Mount value is never written — only user changes are.
    expect(window.sessionStorage.getItem(`${NS}v`)).toBeNull();
  });

  it('persists changes and restores them on remount (the back-nav contract)', () => {
    const view = render(<Probe k="v" initial="a" />);
    act(() => lastSet('changed'));
    expect(loadViewState('v')).toBe('changed');
    view.unmount();
    render(<Probe k="v" initial="a" />);
    expect(value()).toBe('changed');
  });

  it('supports functional updates', () => {
    render(<Probe k="v" initial="a" />);
    act(() => lastSet((p) => p + '+'));
    expect(value()).toBe('a+');
    expect(loadViewState('v')).toBe('a+');
  });

  it('restore: false ignores the saved value but keeps recording new changes', () => {
    saveViewState('v', 'stale');
    render(<Probe k="v" initial="fresh" restore={false} />);
    expect(value()).toBe('fresh');
    // The deliberately skipped saved value must not be clobbered by the mount.
    expect(loadViewState('v')).toBe('stale');
    act(() => lastSet('typed'));
    expect(loadViewState('v')).toBe('typed');
  });

  it('key null behaves as plain state (no persistence)', () => {
    render(<Probe k={null} initial="a" />);
    act(() => lastSet('b'));
    expect(value()).toBe('b');
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('accepts a lazy initializer', () => {
    function Lazy() {
      const [v] = useViewState<string>('lazy', () => 'computed');
      return <div data-testid="value">{v}</div>;
    }
    render(<Lazy />);
    expect(value()).toBe('computed');
  });
});

// ── useOnChange ──────────────────────────────────────────────────────────────

describe('useOnChange', () => {
  function ChangeProbe({ value, effect }: { value: string; effect: () => void }) {
    useOnChange(value, effect);
    return null;
  }

  it('does not fire on mount (must not wipe state useViewState just restored)', () => {
    const effect = vi.fn();
    render(<ChangeProbe value="a" effect={effect} />);
    expect(effect).not.toHaveBeenCalled();
  });

  it('fires when the value changes, once per change', () => {
    const effect = vi.fn();
    const view = render(<ChangeProbe value="a" effect={effect} />);
    view.rerender(<ChangeProbe value="b" effect={effect} />);
    expect(effect).toHaveBeenCalledTimes(1);
    view.rerender(<ChangeProbe value="b" effect={effect} />); // no change
    expect(effect).toHaveBeenCalledTimes(1);
    view.rerender(<ChangeProbe value="c" effect={effect} />);
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('stays unarmed while undefined; the first settled value arms silently', () => {
    // The loading→loaded transition of a data-derived key must not read as a
    // change (it would wipe state useViewState just restored).
    const effect = vi.fn();
    function Settling({ value }: { value: string | undefined }) {
      useOnChange(value, effect);
      return null;
    }
    const view = render(<Settling value={undefined} />);
    view.rerender(<Settling value="loaded-key" />); // arming, not a change
    expect(effect).not.toHaveBeenCalled();
    view.rerender(<Settling value="other-key" />); // a real change
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('always runs the LATEST effect callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<ChangeProbe value="a" effect={first} />);
    view.rerender(<ChangeProbe value="b" effect={second} />);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

// ── useScrollRestore ─────────────────────────────────────────────────────────

// jsdom has no layout: scroll geometry is stubbed per element; the timer-based
// restore loop is stepped with fake timers.
function stubScrollBox(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
}

function ScrollProbe({ k, restore }: { k: string | null; restore?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useScrollRestore(ref, k, restore);
  return <div data-testid="box" ref={ref} />;
}

describe('useScrollRestore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function renderBox(k: string | null, restore?: boolean) {
    let view!: ReturnType<typeof render>;
    act(() => {
      view = render(<ScrollProbe k={k} restore={restore} />);
    });
    const box = screen.getByTestId('box');
    return { view, box };
  }

  it('restores the saved offset once the content is tall enough', () => {
    saveViewState('s', 500);
    const { box } = renderBox('s');
    stubScrollBox(box, 2000, 400);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(box.scrollTop).toBe(500);
  });

  it('waits for async content to grow before restoring', () => {
    saveViewState('s', 500);
    const { box } = renderBox('s');
    stubScrollBox(box, 100, 400); // content not loaded yet — cannot scroll
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(box.scrollTop).toBe(0);
    stubScrollBox(box, 3000, 400); // rows arrived
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(box.scrollTop).toBe(500);
  });

  it('clamps to the bottom when the content ends up shorter than the saved offset', () => {
    saveViewState('s', 5000);
    const { box } = renderBox('s');
    stubScrollBox(box, 700, 400);
    act(() => {
      vi.advanceTimersByTime(16 * 200); // exhaust the retry budget
    });
    expect(box.scrollTop).toBe(300); // scrollHeight - clientHeight
  });

  it('ignores clamp scroll events while a restore is pending', () => {
    // Swapping page content in shrinks the scroller; the browser clamps
    // scrollTop to 0 and fires scroll — that must not clobber the saved
    // offset before the restore has applied it.
    saveViewState('s', 500);
    const { box } = renderBox('s');
    stubScrollBox(box, 100, 400); // restore still waiting for content
    box.scrollTop = 0;
    act(() => {
      box.dispatchEvent(new Event('scroll')); // the clamp event
    });
    expect(loadViewState('s')).toBe(500); // untouched
    stubScrollBox(box, 3000, 400);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(box.scrollTop).toBe(500); // restore still lands
  });

  it('a user wheel cancels a pending restore', () => {
    saveViewState('s', 500);
    const { box } = renderBox('s');
    stubScrollBox(box, 100, 400); // keeps the restore loop waiting
    act(() => {
      box.dispatchEvent(new Event('wheel'));
    });
    stubScrollBox(box, 3000, 400);
    act(() => {
      vi.advanceTimersByTime(16 * 200);
    });
    expect(box.scrollTop).toBe(0); // restore never fired
  });

  it('on key change keeps the old key and resets a fresh key to the top', () => {
    // The Layout scenario: one persistent <main> element, key = the route.
    const { view, box } = renderBox('page1');
    stubScrollBox(box, 2000, 400);
    box.scrollTop = 250;
    act(() => {
      box.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      view.rerender(<ScrollProbe k="page2" />);
    });
    expect(loadViewState('page1')).toBe(250); // captured for the return trip
    expect(box.scrollTop).toBe(0); // a fresh page never inherits scroll
  });

  it('restore: false skips the saved offset', () => {
    saveViewState('s', 500);
    const { box } = renderBox('s', false);
    stubScrollBox(box, 2000, 400);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(box.scrollTop).toBe(0);
  });

  it('records scroll positions synchronously as the user scrolls', () => {
    const { box } = renderBox('s');
    stubScrollBox(box, 2000, 400);
    box.scrollTop = 321;
    act(() => {
      box.dispatchEvent(new Event('scroll'));
    });
    expect(loadViewState('s')).toBe(321);
  });

  it('unmount does not clobber the offset with the browser-clamped 0', () => {
    // Navigating swaps the page content BEFORE effects clean up: the scroller
    // collapses and the browser clamps scrollTop to 0. The saved offset must
    // survive that — only real scroll events write.
    const { view, box } = renderBox('s');
    stubScrollBox(box, 2000, 400);
    box.scrollTop = 777;
    act(() => {
      box.dispatchEvent(new Event('scroll'));
    });
    box.scrollTop = 0; // the clamp (no scroll event yet when cleanup runs)
    act(() => {
      view.unmount();
    });
    expect(loadViewState('s')).toBe(777);
  });

  it('key null is a no-op', () => {
    const { view, box } = renderBox(null);
    box.scrollTop = 5;
    act(() => {
      box.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(50);
      view.unmount();
    });
    expect(window.sessionStorage).toHaveLength(0);
  });
});
