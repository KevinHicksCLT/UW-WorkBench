import type { ComponentPropsWithoutRef, ElementType } from 'react';

/**
 * Visual variant of {@link Chip} — maps 1:1 onto the chip CSS component
 * classes defined in `index.css`:
 * - `plain`       → `.chip` (bare inline chip layout)
 * - `soft`        → `.chip-soft` (neutral grey chip)
 * - `domain-core` → `.chip-domain-core` (teal)
 * - `domain-it`   → `.chip-domain-it` (indigo)
 * - `domain-corp` → `.chip-domain-corp` (violet)
 *
 * The visually distinct `.tag-*` classes are intentionally NOT covered.
 */
export type ChipVariant = 'plain' | 'soft' | 'domain-core' | 'domain-it' | 'domain-corp';

const VARIANT_CLASS: Record<ChipVariant, string> = {
  plain: 'chip',
  soft: 'chip-soft',
  'domain-core': 'chip-domain-core',
  'domain-it': 'chip-domain-it',
  'domain-corp': 'chip-domain-corp',
};

/**
 * Props for {@link Chip}. Polymorphic: pass `as` to render something other
 * than a `<span>` (e.g. `as={Link}` for clickable chips); all props of the
 * rendered element pass through.
 */
export type ChipProps<E extends ElementType = 'span'> = {
  /**
   * Element or component to render.
   * @default 'span'
   */
  as?: E;
  /**
   * Which chip class to emit.
   * @default 'soft'
   */
  variant?: ChipVariant;
  /** Extra classes appended verbatim after the variant class. */
  className?: string;
} & Omit<ComponentPropsWithoutRef<E>, 'as' | 'variant' | 'className'>;

/**
 * Inline chip (smaller than a pill — used inline in tables / nodes). Emits
 * `class="<variant-class> [className]"` — variant class first, extra
 * `className` appended verbatim — byte-identical to the raw
 * `className="chip-…"` call sites it replaces.
 */
export function Chip<E extends ElementType = 'span'>({ as, variant = 'soft', className, ...rest }: ChipProps<E>) {
  const Comp: ElementType = as ?? 'span';
  const base = VARIANT_CLASS[variant];
  return <Comp className={className ? `${base} ${className}` : base} {...rest} />;
}
