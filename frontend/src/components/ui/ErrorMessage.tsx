import type { ReactNode } from 'react';

/** Props for {@link ErrorMessage}. */
export interface ErrorMessageProps {
  /** The error text (usually the caught error message). */
  children: ReactNode;
  /**
   * Base class string. Call sites whose markup differs from the default
   * (`text-red-600`, `text-xs`, …) pass their exact original class string here
   * so the rendered DOM stays byte-identical.
   * @default 'text-sm text-[#be123c]'
   */
  baseClassName?: string;
  /** Extra classes appended verbatim after {@link ErrorMessageProps.baseClassName} (e.g. `'mb-3'`). */
  className?: string;
}

/**
 * Error text `<div>` — the repeated `text-sm text-[#be123c]` /
 * `text-red-600` inline error-message pattern.
 */
export function ErrorMessage({ children, baseClassName = 'text-sm text-[#be123c]', className }: ErrorMessageProps) {
  return <div className={className ? `${baseClassName} ${className}` : baseClassName}>{children}</div>;
}
