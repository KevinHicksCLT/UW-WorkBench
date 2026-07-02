// EmptyState / LoadingState / ErrorMessage — default base classes, the
// baseClassName override, and the className merge order.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyState, ErrorMessage, LoadingState } from '../../../src/components/ui';

describe('EmptyState', () => {
  it('renders a muted <div> with the default base class', () => {
    const { container } = render(<EmptyState message="No rows match the current filters." />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('class')).toBe('text-[11px] text-[#a3a3a3]');
    expect(el).toHaveTextContent('No rows match the current filters.');
  });

  it('lets baseClassName replace the base and appends className after it', () => {
    const { container } = render(
      <EmptyState message="Empty" baseClassName="text-sm text-[#a3a3a3] py-8 text-center" className="mt-2" />,
    );
    expect(container.firstElementChild?.getAttribute('class')).toBe('text-sm text-[#a3a3a3] py-8 text-center mt-2');
  });
});

describe('LoadingState', () => {
  it('defaults to "Loading…" with the default base class', () => {
    const { container } = render(<LoadingState />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('class')).toBe('text-sm text-[#a3a3a3]');
    expect(el).toHaveTextContent('Loading…');
  });

  it('accepts a custom message and merges baseClassName + className', () => {
    const { container } = render(
      <LoadingState message="Fetching roles…" baseClassName="text-xs text-[#a3a3a3]" className="p-4" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('class')).toBe('text-xs text-[#a3a3a3] p-4');
    expect(el).toHaveTextContent('Fetching roles…');
  });
});

describe('ErrorMessage', () => {
  it('renders the error text with the default base class', () => {
    const { container } = render(<ErrorMessage>Something broke</ErrorMessage>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('class')).toBe('text-sm text-[#be123c]');
    expect(el).toHaveTextContent('Something broke');
  });

  it('merges baseClassName override + appended className', () => {
    const { container } = render(
      <ErrorMessage baseClassName="text-red-600 text-xs" className="mb-3">
        Boom
      </ErrorMessage>,
    );
    expect(container.firstElementChild?.getAttribute('class')).toBe('text-red-600 text-xs mb-3');
  });
});
