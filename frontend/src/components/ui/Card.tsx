import type { ComponentPropsWithoutRef, ElementType } from 'react';

/**
 * Visual variant of {@link Card} — maps 1:1 onto the CSS component classes
 * defined in `index.css`:
 * - `base`     → `.card` (white bg, hairline border, card shadow)
 * - `elevated` → `.card-elevated` (float shadow)
 * - `lens`     → `.lens-card` (tighter Inspector/sidebar sub-card)
 */
export type CardVariant = 'base' | 'elevated' | 'lens';

const VARIANT_CLASS: Record<CardVariant, string> = {
  base: 'card',
  elevated: 'card-elevated',
  lens: 'lens-card',
};

/**
 * Props for {@link Card}. Polymorphic: pass `as` to render something other
 * than a `<div>` (e.g. `as={Link}`); all props of the rendered element pass
 * through.
 */
export type CardProps<E extends ElementType = 'div'> = {
  /**
   * Element or component to render.
   * @default 'div'
   */
  as?: E;
  /**
   * Which card class to emit.
   * @default 'base'
   */
  variant?: CardVariant;
  /** Extra classes appended verbatim after the variant class. */
  className?: string;
} & Omit<ComponentPropsWithoutRef<E>, 'as' | 'variant' | 'className'>;

/**
 * The platform card wrapper. Emits `class="<variant-class> [className]"` —
 * variant class first, extra `className` appended verbatim — so the rendered
 * markup is byte-identical to the raw `className="card …"` call sites it
 * replaces.
 */
export function Card<E extends ElementType = 'div'>({ as, variant = 'base', className, ...rest }: CardProps<E>) {
  const Comp: ElementType = as ?? 'div';
  const base = VARIANT_CLASS[variant];
  return <Comp className={className ? `${base} ${className}` : base} {...rest} />;
}
