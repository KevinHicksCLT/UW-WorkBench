import type { ReactNode } from 'react';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** The empty-state text (e.g. "No rows match the current filters."). */
  message: ReactNode;
  /**
   * Base class string. Call sites whose markup differs from the default pass
   * their exact original class string here so the rendered DOM stays
   * byte-identical.
   * @default 'text-[11px] text-[#a3a3a3]'
   */
  baseClassName?: string;
  /** Extra classes appended verbatim after {@link EmptyStateProps.baseClassName}. */
  className?: string;
}

/**
 * Muted "nothing here" message `<div>` — the repeated
 * `text-[11px] text-[#a3a3a3]` "No rows match…" pattern.
 */
export function EmptyState({ message, baseClassName = 'text-[11px] text-[#a3a3a3]', className }: EmptyStateProps) {
  return <div className={className ? `${baseClassName} ${className}` : baseClassName}>{message}</div>;
}
