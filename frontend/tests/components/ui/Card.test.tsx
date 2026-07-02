// Card — polymorphic card wrapper: exact variant class emission, className
// append order, and the `as=` escape hatch.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { Card } from '../../../src/components/ui';

describe('Card', () => {
  it('renders a <div class="card"> by default', () => {
    const { container } = render(<Card>Body</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('class')).toBe('card');
    expect(el).toHaveTextContent('Body');
  });

  it('maps every variant onto its exact class', () => {
    expect(render(<Card variant="base" />).container.firstElementChild?.getAttribute('class')).toBe('card');
    expect(render(<Card variant="elevated" />).container.firstElementChild?.getAttribute('class')).toBe('card-elevated');
    expect(render(<Card variant="lens" />).container.firstElementChild?.getAttribute('class')).toBe('lens-card');
  });

  it('appends extra className verbatim after the variant class', () => {
    const { container } = render(<Card variant="elevated" className="p-4 mt-2" />);
    expect(container.firstElementChild?.getAttribute('class')).toBe('card-elevated p-4 mt-2');
  });

  it('renders another intrinsic element via as=', () => {
    const { container } = render(
      <Card as="section" variant="lens" aria-label="panel">
        x
      </Card>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('SECTION');
    expect(el.getAttribute('class')).toBe('lens-card');
    expect(el.getAttribute('aria-label')).toBe('panel');
  });

  it('renders a component via as= (e.g. router Link)', () => {
    const { container } = render(
      <MemoryRouter>
        <Card as={Link} to="/roles" className="block">
          Roles
        </Card>
      </MemoryRouter>,
    );
    const el = container.querySelector('a') as HTMLAnchorElement;
    expect(el.getAttribute('href')).toBe('/roles');
    expect(el.getAttribute('class')).toBe('card block');
  });
});
