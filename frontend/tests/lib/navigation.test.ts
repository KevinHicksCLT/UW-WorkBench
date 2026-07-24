// navigation — the central tab return-point rule: every location is recorded
// under its owning group/sub-tab, and a nav click returns to it unless the
// user is already inside that tab (explicit reset to base).
import { beforeEach, describe, expect, it } from 'vitest';
import { rememberTabLocation, tabReturnTo } from '../../src/lib/navigation';
import { loadViewState } from '../../src/lib/viewState';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('rememberTabLocation', () => {
  it('records pathname+search under the owning group tab', () => {
    rememberTabLocation('/product-models/nodes/n1', '?x=1');
    expect(loadViewState('nav.tab./product-models')).toBe('/product-models/nodes/n1?x=1');
  });

  it('records under BOTH the group and the sub-tab when they differ', () => {
    rememberTabLocation('/work-library', '');
    // Workspace group lands on /portfolio; /work-library is its sub-tab.
    expect(loadViewState('nav.tab./portfolio')).toBe('/work-library');
    expect(loadViewState('nav.tab./work-library')).toBe('/work-library');
  });

  it('strips the role drawer overlay param from the return point', () => {
    rememberTabLocation('/organization', '?view=list&role=r1');
    expect(loadViewState('nav.tab./organization')).toBe('/organization?view=list');
  });

  it('ignores locations that belong to no nav tab', () => {
    rememberTabLocation('/settings', '');
    expect(window.sessionStorage).toHaveLength(0);
  });
});

describe('tabReturnTo', () => {
  it('returns the recorded location when coming from another tab', () => {
    rememberTabLocation('/product-models/nodes/n1', '');
    expect(tabReturnTo('/product-models', '/portfolio')).toBe('/product-models/nodes/n1');
  });

  it('falls back to the base path when nothing is recorded', () => {
    expect(tabReturnTo('/roles', '/portfolio')).toBe('/roles');
  });

  it('clicking the tab you are already on resets to its base (exact path)', () => {
    rememberTabLocation('/applications/app1', '');
    expect(tabReturnTo('/applications', '/applications')).toBe('/applications');
  });

  it('clicking the owning tab from one of its drill pages resets to its base', () => {
    rememberTabLocation('/applications/app1', '');
    expect(tabReturnTo('/applications', '/applications/app1')).toBe('/applications');
  });

  it('clicking the group tab from a sibling sub-tab resets to the group base', () => {
    rememberTabLocation('/portfolio', '');
    // On Work Library (same Workspace group) → Workspace tab goes to base Maps.
    expect(tabReturnTo('/portfolio', '/work-library')).toBe('/portfolio');
  });

  it('Home (/) restores its recorded drill and resets from inside the group', () => {
    rememberTabLocation('/programs/p1', '?tab=RAID');
    expect(tabReturnTo('/', '/roles')).toBe('/programs/p1?tab=RAID');
    expect(tabReturnTo('/', '/programs/p1')).toBe('/');
  });

  it('passes non-tab paths through unchanged (mobile drill rows)', () => {
    expect(tabReturnTo('/n/domain:abc', '/roles')).toBe('/n/domain:abc');
  });
});
