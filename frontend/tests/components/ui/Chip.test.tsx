// Chip — inline chip: exact variant classes (default soft), className append
// order, and polymorphic rendering via as=Link.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { Chip } from '../../../src/components/ui';

describe('Chip', () => {
  it('renders a <span class="chip-soft"> by default', () => {
    const { container } = render(<Chip>Tag</Chip>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('SPAN');
    expect(el.getAttribute('class')).toBe('chip-soft');
    expect(el).toHaveTextContent('Tag');
  });

  it('maps every variant onto its exact class', () => {
    expect(render(<Chip variant="plain" />).container.firstElementChild?.getAttribute('class')).toBe('chip');
    expect(render(<Chip variant="soft" />).container.firstElementChild?.getAttribute('class')).toBe('chip-soft');
    expect(render(<Chip variant="domain-core" />).container.firstElementChild?.getAttribute('class')).toBe('chip-domain-core');
    expect(render(<Chip variant="domain-it" />).container.firstElementChild?.getAttribute('class')).toBe('chip-domain-it');
    expect(render(<Chip variant="domain-corp" />).container.firstElementChild?.getAttribute('class')).toBe('chip-domain-corp');
  });

  it('appends extra className verbatim after the variant class', () => {
    const { container } = render(<Chip variant="plain" className="tnum ml-1" />);
    expect(container.firstElementChild?.getAttribute('class')).toBe('chip tnum ml-1');
  });

  it('renders a clickable chip via as=Link', () => {
    const { container } = render(
      <MemoryRouter>
        <Chip as={Link} to="/standards" variant="domain-it">
          Standards
        </Chip>
      </MemoryRouter>,
    );
    const el = container.querySelector('a') as HTMLAnchorElement;
    expect(el.getAttribute('href')).toBe('/standards');
    expect(el.getAttribute('class')).toBe('chip-domain-it');
    expect(el).toHaveTextContent('Standards');
  });
});
