// Sheet × viewState — the restorable-list contract: with a sheetKey the
// filters/sort/search survive unmount and restore on return; a ?focus deep
// link (scrollToKey) shows its own state instead; forceFilters (drill/deep-
// link intent) overlay whatever was restored.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Sheet, type SheetCol } from '../../../src/components/Sheet';
import { loadViewState, saveViewState } from '../../../src/lib/viewState';

// Sheet pulls per-user column personalization through the preferences
// context; the view-state contract under test is independent of it.
vi.mock('../../../src/lib/preferences', () => ({
  usePreferences: () => ({ prefs: {}, update: vi.fn() }),
}));

type Row = { id: string; name: string; kind: string };
const rows: Row[] = [
  { id: '1', name: 'Alpha', kind: 'Core' },
  { id: '2', name: 'Beta', kind: 'Core' },
  { id: '3', name: 'Gamma', kind: 'Edge' },
];
const cols: SheetCol<Row>[] = [
  { key: 'name', label: 'Name', width: 'minmax(0,1fr)', value: (r) => r.name },
  { key: 'kind', label: 'Kind', width: '120px', value: (r) => r.kind },
];

function mount(props: Partial<Parameters<typeof Sheet<Row>>[0]> = {}) {
  return render(
    <Sheet<Row> sheetKey="test" rows={rows} cols={cols} rowKey={(r) => r.id} {...props} />,
  );
}

const visibleNames = () => ['Alpha', 'Beta', 'Gamma'].filter((n) => screen.queryByText(n) !== null);

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('Sheet view-state persistence', () => {
  it('shows all rows on a fresh visit (nothing saved)', () => {
    mount();
    expect(visibleNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('restores a saved column filter on mount', () => {
    saveViewState('sheet.test.sel', { kind: ['Edge'] });
    mount();
    expect(visibleNames()).toEqual(['Gamma']);
  });

  it('persists the free-text search and restores it on remount', () => {
    const view = mount();
    fireEvent.change(screen.getByLabelText('Search list'), { target: { value: 'bet' } });
    expect(visibleNames()).toEqual(['Beta']);
    expect(loadViewState('sheet.test.search')).toBe('bet');
    view.unmount();
    mount();
    expect(visibleNames()).toEqual(['Beta']);
    expect((screen.getByLabelText('Search list') as HTMLInputElement).value).toBe('bet');
  });

  it('restores a saved sort order', () => {
    saveViewState('sheet.test.sort', { col: 'name', dir: -1 });
    const { container } = mount();
    const text = container.textContent ?? '';
    expect(text.indexOf('Gamma')).toBeLessThan(text.indexOf('Alpha'));
  });

  it('a ?focus deep link (scrollToKey) ignores saved filters and search', () => {
    saveViewState('sheet.test.sel', { kind: ['Edge'] });
    saveViewState('sheet.test.search', 'gam');
    mount({ scrollToKey: '2' });
    // The focused row must be reachable — restored narrowing would hide it.
    expect(visibleNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
    // …and the deliberately skipped saved state is not clobbered by the mount.
    expect(loadViewState('sheet.test.sel')).toEqual({ kind: ['Edge'] });
  });

  it('forceFilters overlay restored state (explicit intent wins)', () => {
    saveViewState('sheet.test.sel', { kind: ['Edge'] });
    mount({ forceFilters: { kind: 'Core' } });
    expect(visibleNames()).toEqual(['Alpha', 'Beta']);
  });

  it('defaultFilters seed only a fresh view; saved state wins on return', () => {
    const first = mount({ defaultFilters: { kind: 'Edge' } });
    expect(visibleNames()).toEqual(['Gamma']);
    first.unmount();

    window.sessionStorage.clear();
    saveViewState('sheet.test.sel', { kind: ['Core'] });
    mount({ defaultFilters: { kind: 'Edge' } });
    expect(visibleNames()).toEqual(['Alpha', 'Beta']);
  });

  it('without a sheetKey nothing is persisted', () => {
    const view = render(<Sheet<Row> rows={rows} cols={cols} rowKey={(r) => r.id} />);
    fireEvent.change(screen.getByLabelText('Search list'), { target: { value: 'bet' } });
    view.unmount();
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('Clear filters resets and persists the cleared state', () => {
    saveViewState('sheet.test.sel', { kind: ['Edge'] });
    saveViewState('sheet.test.search', 'gam');
    mount();
    fireEvent.click(screen.getByText('Clear filters'));
    expect(visibleNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(loadViewState('sheet.test.sel')).toEqual({ name: [], kind: [] });
    expect(loadViewState('sheet.test.search')).toBe('');
  });
});
