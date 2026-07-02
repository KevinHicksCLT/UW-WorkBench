// SkeletonLoader — block count, inline height style, item class override, and
// the wrapper vs wrapper-less DOM contract.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonLoader } from '../../../src/components/ui';

describe('SkeletonLoader', () => {
  it('renders one bare block by default (no wrapper element)', () => {
    const { container } = render(<SkeletonLoader height={40} />);
    expect(container.children).toHaveLength(1);
    const block = container.firstElementChild as HTMLElement;
    expect(block.getAttribute('class')).toBe('skeleton rounded-md');
    expect(block.style.height).toBe('40px');
  });

  it('renders `count` sibling blocks without a wrapper when className is omitted', () => {
    const { container } = render(<SkeletonLoader count={3} height={16} />);
    expect(container.children).toHaveLength(3);
    for (const el of Array.from(container.children)) {
      expect(el.getAttribute('class')).toBe('skeleton rounded-md');
      expect((el as HTMLElement).style.height).toBe('16px');
    }
  });

  it('wraps the blocks in a single <div class={className}> when given', () => {
    const { container } = render(<SkeletonLoader count={2} height={24} className="space-y-2" />);
    expect(container.children).toHaveLength(1);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.getAttribute('class')).toBe('space-y-2');
    expect(wrapper.children).toHaveLength(2);
  });

  it('lets itemClassName replace the per-block class entirely', () => {
    const { container } = render(<SkeletonLoader height={12} itemClassName="skeleton rounded-full" />);
    expect(container.firstElementChild?.getAttribute('class')).toBe('skeleton rounded-full');
  });
});
