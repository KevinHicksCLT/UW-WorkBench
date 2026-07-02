// Field primitives — Input/Select/Textarea/Label: exact `.input`/`.label`
// class emission, className append order, and ref forwarding on all four.
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Input, Label, Select, Textarea } from '../../../src/components/ui';

describe('Input', () => {
  it('renders <input class="input"> and appends className verbatim', () => {
    const { container } = render(<Input />);
    expect(container.firstElementChild?.tagName).toBe('INPUT');
    expect(container.firstElementChild?.getAttribute('class')).toBe('input');

    const { container: c2 } = render(<Input className="w-64" />);
    expect(c2.firstElementChild?.getAttribute('class')).toBe('input w-64');
  });

  it('forwards its ref and native props', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="Name" defaultValue="x" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.placeholder).toBe('Name');
    expect(ref.current?.value).toBe('x');
  });
});

describe('Select', () => {
  it('renders <select class="input"> and appends className verbatim', () => {
    const { container } = render(
      <Select className="text-xs">
        <option value="a">A</option>
      </Select>,
    );
    expect(container.firstElementChild?.tagName).toBe('SELECT');
    expect(container.firstElementChild?.getAttribute('class')).toBe('input text-xs');
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref}>
        <option value="a">A</option>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});

describe('Textarea', () => {
  it('renders <textarea class="input"> and appends className verbatim', () => {
    const { container } = render(<Textarea className="h-24" />);
    expect(container.firstElementChild?.tagName).toBe('TEXTAREA');
    expect(container.firstElementChild?.getAttribute('class')).toBe('input h-24');
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} defaultValue="notes" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current?.value).toBe('notes');
  });
});

describe('Label', () => {
  it('renders <label class="label"> and appends className verbatim', () => {
    const { container } = render(<Label>Name</Label>);
    expect(container.firstElementChild?.tagName).toBe('LABEL');
    expect(container.firstElementChild?.getAttribute('class')).toBe('label');
    expect(container.firstElementChild).toHaveTextContent('Name');

    const { container: c2 } = render(<Label className="mt-3">X</Label>);
    expect(c2.firstElementChild?.getAttribute('class')).toBe('label mt-3');
  });

  it('forwards its ref', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Name</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });
});
