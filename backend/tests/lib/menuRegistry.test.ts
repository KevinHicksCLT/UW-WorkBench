// Shared menu registry — structural invariants both sides depend on: unique
// keys, dot-notation parentage matching the tree nesting, and path coverage of
// every navigable route.
import { describe, expect, it } from 'vitest';
import {
  MENU_TREE,
  allMenuKeys,
  flattenMenuTree,
  isMenuKey,
  parentKey,
  type MenuNode,
} from '@cascade/shared';

describe('menu registry invariants', () => {
  it('every key is unique', () => {
    const keys = flattenMenuTree().map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual([...allMenuKeys()].sort());
  });

  it('dot-notation parentage matches the tree nesting', () => {
    const walk = (nodes: readonly MenuNode[], parent: MenuNode | null) => {
      for (const n of nodes) {
        expect(parentKey(n.key)).toBe(parent ? parent.key : null);
        if (n.children) walk(n.children, n);
      }
    };
    walk(MENU_TREE, null);
  });

  it('isMenuKey accepts every registry key and rejects strangers', () => {
    for (const k of allMenuKeys()) expect(isMenuKey(k)).toBe(true);
    expect(isMenuKey('nonsense')).toBe(false);
    expect(isMenuKey('data-admin.nonsense')).toBe(false);
  });

  it('every top-level entry is navigable (has a path) and paths are unique', () => {
    const paths = MENU_TREE.map((n) => n.path);
    expect(paths.every((p) => typeof p === 'string' && p.startsWith('/'))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('covers the routes the app shell links to', () => {
    const paths = new Set(MENU_TREE.map((n) => n.path));
    for (const expected of [
      '/',
      '/organization',
      '/overview',
      '/roles',
      '/deliverables',
      '/standards',
      '/regulations',
      '/tasks',
      '/applications',
      '/external',
      '/portfolio',
      '/work-library',
      '/metrics',
      '/automatable',
      '/admin',
      '/user-admin',
    ]) {
      expect(paths.has(expected)).toBe(true);
    }
  });
});
