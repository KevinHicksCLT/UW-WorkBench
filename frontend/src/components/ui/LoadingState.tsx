import type { ReactNode } from 'react';

/** Props for {@link LoadingState}. */
export interface LoadingStateProps {
  /**
   * The loading text.
   * @default 'Loading…'
   */
  message?: ReactNode;
  /**
   * Base class string. Call sites whose markup differs from the default pass
   * their exact original class string here so the rendered DOM stays
   * byte-identical.
   * @default 'text-sm text-[#a3a3a3]'
   */
  baseClassName?: string;
  /** Extra classes appended verbatim after {@link LoadingStateProps.baseClassName}. */
  className?: string;
}

/**
 * Muted "Loading…" message `<div>` — the repeated `text-… text-[#a3a3a3]`
 * loading placeholder pattern.
 */
export function LoadingState({ message = 'Loading…', baseClassName = 'text-sm text-[#a3a3a3]', className }: LoadingStateProps) {
  return <div className={className ? `${baseClassName} ${className}` : baseClassName}>{message}</div>;
}
