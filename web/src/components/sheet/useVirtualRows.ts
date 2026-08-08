import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

// useVirtualRows — variable-height row virtualization for the Sheet.
// Sheets can be thousands of rows; rendering them all at once floods the DOM.
// Rows are NOT a fixed height (chips and long titles wrap), so each rendered
// row is measured by its stable key and the window is computed off a
// measured-offset model, padding above/below. The Sheet doesn't own its
// scroller (the sticky header pins to a parent with overflow-auto), so the
// hook finds that scroll ancestor and measures off rects. The single
// expandable row folds its measured panel height into the offsets.

const EST_ROW_H = 30; // estimate for not-yet-measured rows
const OVERSCAN = 12;

export type VirtualRows<R> = {
  rowsWrapRef: RefObject<HTMLDivElement>;
  /** The windowed slice of `visible` to render. */
  slice: R[];
  padTop: number;
  padBottom: number;
  /** Ref callback measuring one row by its stable key. */
  measureRow: (key: string) => (el: HTMLDivElement | null) => void;
  /** Ref callback measuring the single expansion panel. */
  measurePanel: (el: HTMLDivElement | null) => void;
};

export function useVirtualRows<R>({
  visible,
  rowKey,
  expanded,
  columnSignature,
  loading,
  scrollToKey,
}: {
  visible: R[];
  rowKey: (r: R) => string;
  /** Key of the currently expanded row (its panel height joins the offsets). */
  expanded: string | null;
  /** Changes when column visibility changes — invalidates every cached height. */
  columnSignature: string;
  loading?: boolean;
  scrollToKey?: string | null;
}): VirtualRows<R> {
  const rowsWrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [rel, setRel] = useState(0); // px the rows-area top is scrolled above the viewport
  const [viewH, setViewH] = useState(0);
  const [panelH, setPanelH] = useState(0);
  const heights = useRef<Map<string, number>>(new Map());
  const [measureTick, setMeasureTick] = useState(0);

  // Any change to the effective column signature (hidden set) changes how cell
  // content wraps, so every cached row height is stale — clear the cache and
  // bump the tick or the window misplaces rows.
  const colSigRef = useRef(columnSignature);
  useLayoutEffect(() => {
    if (colSigRef.current === columnSignature) return;
    colSigRef.current = columnSignature;
    heights.current.clear();
    setMeasureTick((t) => t + 1);
  }, [columnSignature]);

  // Measure each row by its stable key. A row's content is fixed, so its height
  // is stable once measured — the tick settles and there is no feedback loop.
  const measureRow = (key: string) => (el: HTMLDivElement | null) => {
    if (!el || !el.offsetHeight) return;
    const prev = heights.current.get(key);
    if (prev === undefined || Math.abs(prev - el.offsetHeight) > 0.5) {
      heights.current.set(key, el.offsetHeight);
      setMeasureTick((t) => t + 1);
    }
  };
  const measurePanel = (el: HTMLDivElement | null) => {
    if (el && el.offsetHeight && Math.abs(el.offsetHeight - panelH) > 0.5)
      setPanelH(el.offsetHeight);
  };

  const N = visible.length;
  // Cumulative top offset of each visible row (measured height where known,
  // else an estimate), with the expanded panel folded in after its row.
  const offsets = useMemo(() => {
    const off = new Array<number>(N + 1);
    off[0] = 0;
    for (let i = 0; i < N; i++) {
      const k = rowKey(visible[i]);
      off[i + 1] = off[i] + (heights.current.get(k) ?? EST_ROW_H) + (k === expanded ? panelH : 0);
    }
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, expanded, panelH, measureTick]);
  const total = offsets[N];

  useLayoutEffect(() => {
    const rw = rowsWrapRef.current;
    if (!rw) return;
    let p: HTMLElement | null = rw.parentElement;
    while (p) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      p = p.parentElement;
    }
    const scroller = p;
    scrollerRef.current = scroller;
    const recompute = () => {
      const rwTop = rowsWrapRef.current?.getBoundingClientRect().top ?? 0;
      if (scroller) {
        const c = scroller.getBoundingClientRect();
        setRel(Math.max(0, c.top - rwTop));
        setViewH(scroller.clientHeight);
      } else {
        setRel(Math.max(0, -rwTop));
        setViewH(window.innerHeight);
      }
    };
    recompute();
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        recompute();
      });
    };
    const target: Window | HTMLElement = scroller ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, visible.length === 0]);

  // Filtering/expanding changes total height while scrolled; the browser clamps
  // the scroller but no scroll event fires, leaving rel stale (→ a blank
  // window). Recompute rel/viewH off live rects whenever the list or total
  // height changes.
  useLayoutEffect(() => {
    const rw = rowsWrapRef.current;
    if (!rw) return;
    const scroller = scrollerRef.current;
    const rwTop = rw.getBoundingClientRect().top;
    if (scroller) {
      const c = scroller.getBoundingClientRect();
      setRel(Math.max(0, c.top - rwTop));
      setViewH(scroller.clientHeight);
    } else {
      setRel(Math.max(0, -rwTop));
      setViewH(window.innerHeight);
    }
  }, [N, expanded, panelH, total, loading]);

  // First visible index whose bottom passes `y` (binary search over offsets).
  const idxAt = (y: number) => {
    let lo = 0,
      hi = N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] <= y) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const vStart = Math.max(0, idxAt(rel) - OVERSCAN);
  const vEnd =
    viewH > 0 ? Math.min(N, idxAt(rel + viewH) + 1 + OVERSCAN) : Math.min(N, OVERSCAN * 4);

  // Deep-linked focus: jump the scroller to the target row (it may be
  // unmounted, so scroll by computed offset rather than scrollIntoView).
  const scrolledKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!scrollToKey || !N || scrolledKey.current === scrollToKey) return;
    const idx = visible.findIndex((r) => rowKey(r) === scrollToKey);
    const rw = rowsWrapRef.current;
    if (idx < 0 || !rw) return;
    const scroller = scrollerRef.current;
    const rwTop = rw.getBoundingClientRect().top;
    if (scroller)
      scroller.scrollTop +=
        rwTop - scroller.getBoundingClientRect().top + offsets[idx] - scroller.clientHeight / 2;
    else window.scrollBy(0, rwTop + offsets[idx] - window.innerHeight / 2);
    scrolledKey.current = scrollToKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToKey, visible, total]);

  return {
    rowsWrapRef,
    slice: visible.slice(vStart, vEnd),
    padTop: offsets[vStart],
    padBottom: Math.max(0, total - offsets[vEnd]),
    measureRow,
    measurePanel,
  };
}
