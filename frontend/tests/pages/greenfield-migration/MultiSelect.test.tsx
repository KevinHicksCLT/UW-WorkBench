// MultiSelect (WR-01 lens bar) — dropdown-with-checkboxes: trigger summary,
// option rendering, selection toggling via onChange, search filter, and the
// Escape / outside-click close contract.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  MultiSelect,
  type MultiSelectOption,
} from '../../../src/pages/greenfield-migration/MultiSelect';

const OPTIONS: MultiSelectOption[] = [
  { id: 'a', name: 'Alpha Platform' },
  { id: 'b', name: 'Billing Suite' },
  { id: 'c', name: 'Claims Core' },
];

function renderSelect(
  selected: string[] = [],
  extra: Partial<Parameters<typeof MultiSelect>[0]> = {},
) {
  const onChange = vi.fn();
  const utils = render(
    <MultiSelect
      label="Applications"
      options={OPTIONS}
      selected={selected}
      onChange={onChange}
      emptyLabel="All applications"
      {...extra}
    />,
  );
  return { onChange, ...utils };
}

const trigger = () => screen.getByRole('button', { name: 'Applications' });

describe('MultiSelect', () => {
  it('summarizes the selection on the trigger (empty / single name / N selected)', () => {
    const { rerender, onChange } = renderSelect([]);
    expect(trigger()).toHaveTextContent('All applications');
    rerender(
      <MultiSelect
        label="Applications"
        options={OPTIONS}
        selected={['b']}
        onChange={onChange}
        emptyLabel="All applications"
      />,
    );
    expect(trigger()).toHaveTextContent('Billing Suite');
    rerender(
      <MultiSelect
        label="Applications"
        options={OPTIONS}
        selected={['a', 'c']}
        onChange={onChange}
        emptyLabel="All applications"
      />,
    );
    expect(trigger()).toHaveTextContent('2 selected');
  });

  it('opens on click and renders every option as a checkbox', () => {
    renderSelect(['a']);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Applications' })).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Alpha Platform' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Billing Suite' })).not.toBeChecked();
  });

  it('reports additions and removals through onChange (controlled)', () => {
    const { onChange } = renderSelect(['a']);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Billing Suite' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha Platform' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('filters options through the search input when searchable', () => {
    renderSelect([], { searchable: true });
    fireEvent.click(trigger());
    const search = screen.getByRole('textbox', { name: 'Search applications' });
    fireEvent.change(search, { target: { value: 'bill' } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'Billing Suite' })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderSelect();
    fireEvent.click(trigger());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on an outside mousedown but stays open for inside clicks', () => {
    renderSelect();
    fireEvent.click(trigger());
    fireEvent.mouseDown(screen.getByRole('listbox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the loading placeholder instead of options while loading', () => {
    renderSelect([], { loading: true });
    fireEvent.click(trigger());
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
