import type { ButtonHTMLAttributes } from 'react';

/**
 * Visual variant of {@link Button} — maps 1:1 onto the CSS component classes
 * defined in `index.css` (`.btn-primary` / `.btn-secondary` / `.btn-ghost`).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

/** Props for {@link Button}. All native `<button>` props pass through. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Which `.btn-*` class to emit.
   * @default 'primary'
   */
  variant?: ButtonVariant;
}

/**
 * The platform button. Emits `<button class="btn-<variant> [className]">…</button>`
 * — the variant class first, then any extra `className` appended verbatim, so
 * the rendered markup is byte-identical to the raw `<button className="btn-…">`
 * call sites it replaces. `type` is not defaulted: like a raw `<button>`, an
 * un-typed Button submits its enclosing form.
 */
export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  const base = VARIANT_CLASS[variant];
  return <button className={className ? `${base} ${className}` : base} {...rest} />;
}

/** Props for {@link LinkButton}. All native `<button>` props pass through. */
export type LinkButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Inline link-styled button — the repeated `text-[#1d4ed8] hover:underline`
 * pattern ("Clear filters", drill links, …). Extra `className` is **prepended**
 * (size/weight utilities come first at every existing call site), so the final
 * class string matches the replaced markup exactly:
 * `class="[className] text-[#1d4ed8] hover:underline"`.
 */
export function LinkButton({ className, ...rest }: LinkButtonProps) {
  const base = 'text-[#1d4ed8] hover:underline';
  return <button className={className ? `${className} ${base}` : base} {...rest} />;
}
