// Button / LinkButton — freeze the byte-identical class contract: variant class
// first with className APPENDED for Button, className PREPENDED for LinkButton,
// and no defaulted `type` attribute.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Button, LinkButton } from '../../../src/components/ui';

describe('Button', () => {
  it('renders a <button> with btn-primary by default', () => {
    const { container } = render(<Button>Save</Button>);
    const btn = container.firstElementChild as HTMLButtonElement;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('class')).toBe('btn-primary');
    expect(btn).toHaveTextContent('Save');
  });

  it('maps every variant onto its exact .btn-* class', () => {
    expect(render(<Button variant="primary" />).container.firstElementChild?.getAttribute('class')).toBe('btn-primary');
    expect(render(<Button variant="secondary" />).container.firstElementChild?.getAttribute('class')).toBe('btn-secondary');
    expect(render(<Button variant="ghost" />).container.firstElementChild?.getAttribute('class')).toBe('btn-ghost');
  });

  it('appends extra className verbatim AFTER the variant class', () => {
    const { container } = render(<Button variant="secondary" className="w-full mt-2" />);
    expect(container.firstElementChild?.getAttribute('class')).toBe('btn-secondary w-full mt-2');
  });

  it('does NOT default the type attribute (an un-typed Button submits forms)', () => {
    const { container } = render(<Button>Go</Button>);
    expect((container.firstElementChild as HTMLButtonElement).getAttribute('type')).toBeNull();
  });

  it('passes native button props through', () => {
    const onClick = vi.fn();
    const { container } = render(<Button type="submit" disabled onClick={onClick} data-testid="b" />);
    const btn = container.firstElementChild as HTMLButtonElement;
    expect(btn.getAttribute('type')).toBe('submit');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled(); // disabled

    const { container: c2 } = render(<Button onClick={onClick} />);
    fireEvent.click(c2.firstElementChild as HTMLButtonElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('LinkButton', () => {
  it('renders the bare link classes when no className is given', () => {
    const { container } = render(<LinkButton>Clear filters</LinkButton>);
    const btn = container.firstElementChild as HTMLButtonElement;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('class')).toBe('text-[#1d4ed8] hover:underline');
  });

  it('PREPENDS extra className (size/weight utilities come first)', () => {
    const { container } = render(<LinkButton className="text-xs font-medium" />);
    expect(container.firstElementChild?.getAttribute('class')).toBe(
      'text-xs font-medium text-[#1d4ed8] hover:underline',
    );
  });

  it('passes native props through', () => {
    const onClick = vi.fn();
    const { container } = render(<LinkButton onClick={onClick} />);
    fireEvent.click(container.firstElementChild as HTMLButtonElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
