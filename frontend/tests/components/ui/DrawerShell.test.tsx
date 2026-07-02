// DrawerShell — shared slide-over chrome: dialog root, click-to-dismiss
// backdrop, close button, width/maxWidth inline styles, header/body/after slots.
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DrawerShell } from '../../../src/components/ui';

function renderShell(onClose = vi.fn(), after?: ReactNode) {
  const utils = render(
    <DrawerShell
      onClose={onClose}
      width={720}
      maxWidth="94vw"
      header={<div data-testid="hdr">Role details</div>}
      after={after}
    >
      <p>Body content</p>
    </DrawerShell>,
  );
  return { onClose, ...utils };
}

describe('DrawerShell', () => {
  it('renders an aria-modal dialog root', () => {
    renderShell();
    const root = screen.getByRole('dialog');
    expect(root).toHaveAttribute('aria-modal', 'true');
    expect(root.getAttribute('class')).toBe('absolute inset-0 z-30 flex justify-end');
  });

  it('applies width (px) and maxWidth as inline styles on the panel', () => {
    const { container } = renderShell();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.style.width).toBe('720px');
    expect(aside.style.maxWidth).toBe('94vw');
    expect(aside.getAttribute('class')).toBe(
      'relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col',
    );
  });

  it('renders the header slot verbatim next to the close button', () => {
    renderShell();
    expect(screen.getByTestId('hdr')).toHaveTextContent('Role details');
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('renders children inside the scrollable body div', () => {
    const { container } = renderShell();
    const body = container.querySelector('.flex-1.overflow-y-auto.p-5') as HTMLElement;
    expect(body).toHaveTextContent('Body content');
  });

  it('calls onClose from the backdrop click', () => {
    const { container, onClose } = renderShell();
    const backdrop = container.querySelector('.absolute.inset-0.bg-black\\/20') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from the close button', () => {
    const { onClose } = renderShell();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the `after` node inside the dialog root, after the panel', () => {
    renderShell(vi.fn(), <div data-testid="overlay">Skill viewer</div>);
    const root = screen.getByRole('dialog');
    const overlay = screen.getByTestId('overlay');
    expect(root.contains(overlay)).toBe(true);
    expect(root.lastElementChild).toBe(overlay);
  });
});
