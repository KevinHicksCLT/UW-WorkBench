import type { HTMLAttributes } from 'react';

/**
 * Tone of {@link StatusPill} — maps 1:1 onto the `.pill-*` CSS component
 * classes defined in `index.css` (`.pill-green` / `.pill-amber` / `.pill-red`
 * / `.pill-slate` / `.pill-blue`).
 */
export type PillTone = 'green' | 'amber' | 'red' | 'slate' | 'blue';

const TONE_CLASS: Record<PillTone, string> = {
  green: 'pill-green',
  amber: 'pill-amber',
  red: 'pill-red',
  slate: 'pill-slate',
  blue: 'pill-blue',
};

/** Props for {@link StatusPill}. All native `<span>` props pass through. */
export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  /** Which `.pill-*` class to emit. */
  tone: PillTone;
}

/**
 * Status pill. Emits `<span class="pill-<tone> [className]">…</span>` — tone
 * class first, extra `className` appended verbatim — byte-identical to the raw
 * `className="pill-…"` call sites it replaces.
 */
export function StatusPill({ tone, className, ...rest }: StatusPillProps) {
  const base = TONE_CLASS[tone];
  return <span className={className ? `${base} ${className}` : base} {...rest} />;
}
