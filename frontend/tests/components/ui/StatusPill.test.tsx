// StatusPill — exact .pill-* tone classes + className append order.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StatusPill } from '../../../src/components/ui';

describe('StatusPill', () => {
  it('maps every tone onto its exact .pill-* class', () => {
    expect(render(<StatusPill tone="green" />).container.firstElementChild?.getAttribute('class')).toBe('pill-green');
    expect(render(<StatusPill tone="amber" />).container.firstElementChild?.getAttribute('class')).toBe('pill-amber');
    expect(render(<StatusPill tone="red" />).container.firstElementChild?.getAttribute('class')).toBe('pill-red');
    expect(render(<StatusPill tone="slate" />).container.firstElementChild?.getAttribute('class')).toBe('pill-slate');
    expect(render(<StatusPill tone="blue" />).container.firstElementChild?.getAttribute('class')).toBe('pill-blue');
  });

  it('renders a <span> with children and appends className verbatim', () => {
    const { container } = render(
      <StatusPill tone="green" className="tnum">
        On Track
      </StatusPill>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('SPAN');
    expect(el.getAttribute('class')).toBe('pill-green tnum');
    expect(el).toHaveTextContent('On Track');
  });

  it('passes native span props through', () => {
    const { container } = render(<StatusPill tone="red" title="Off track" />);
    expect(container.firstElementChild?.getAttribute('title')).toBe('Off track');
  });
});
