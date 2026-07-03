// Pure state model for the permission tree editor — exported separately from
// the component so the cascade/indeterminate/tri-state rules are unit-testable.
//
// Set mode ("grants"): state is a full Crud per menu key (what a user type can
// do). Checking a parent action cascades to all children; a parent renders
// indeterminate when its children diverge (a subset carve-out).
//
// Override mode ("tri-state"): state is Crud|null per action per key; null =
// inherit from the user-type set. The component cycles inherit → allow → deny.
import {
  MENU_TREE,
  allMenuKeys,
  type Crud,
  type EffectivePermissions,
  type MenuAction,
  type MenuKey,
  type MenuNode,
} from '@cascade/shared';

export const ACTIONS: readonly MenuAction[] = ['create', 'read', 'update', 'delete'];

export type GrantState = Record<MenuKey, Crud>;

export const EMPTY_CRUD: Crud = { create: false, read: false, update: false, delete: false };

export function emptyGrantState(): GrantState {
  const out = {} as GrantState;
  for (const k of allMenuKeys()) out[k] = { ...EMPTY_CRUD };
  return out;
}

/** Server grant rows → full editor state (missing keys inherit their parent, matching the resolver). */
export function grantStateFromRows(
  rows: {
    menuKey: string;
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  }[],
): GrantState {
  const byKey = new Map(rows.map((r) => [r.menuKey, r]));
  const out = {} as GrantState;
  for (const k of allMenuKeys()) {
    const r = byKey.get(k);
    if (r) {
      out[k] = { create: r.canCreate, read: r.canRead, update: r.canUpdate, delete: r.canDelete };
    } else {
      const parent = parentOf(k);
      out[k] = parent ? { ...out[parent] } : { ...EMPTY_CRUD };
    }
  }
  return out;
}

/** Editor state → server grant rows (every key explicit — simplest round-trip). */
export function grantRowsFromState(state: GrantState) {
  return allMenuKeys().map((menuKey) => ({
    menuKey,
    canCreate: state[menuKey].create,
    canRead: state[menuKey].read,
    canUpdate: state[menuKey].update,
    canDelete: state[menuKey].delete,
  }));
}

function parentOf(key: MenuKey): MenuKey | null {
  const dot = key.lastIndexOf('.');
  if (dot === -1) return null;
  return key.slice(0, dot) as MenuKey;
}

function childrenOf(key: MenuKey): MenuKey[] {
  const find = (nodes: readonly MenuNode[]): MenuNode | null => {
    for (const n of nodes) {
      if (n.key === key) return n;
      const hit = n.children ? find(n.children) : null;
      if (hit) return hit;
    }
    return null;
  };
  const node = find(MENU_TREE);
  return node?.children?.map((c) => c.key) ?? [];
}

/** Toggle one action on one key; toggling a parent cascades to its subtree. */
export function toggleGrant(state: GrantState, key: MenuKey, action: MenuAction): GrantState {
  const nextValue = !state[key][action];
  const next: GrantState = { ...state, [key]: { ...state[key], [action]: nextValue } };
  for (const child of childrenOf(key)) {
    next[child] = { ...next[child], [action]: nextValue };
  }
  return next;
}

/** Parent checkbox display: 'on' | 'off' | 'mixed' from its children's values. */
export function parentDisplay(
  state: GrantState,
  key: MenuKey,
  action: MenuAction,
): 'on' | 'off' | 'mixed' {
  const kids = childrenOf(key);
  if (kids.length === 0) return state[key][action] ? 'on' : 'off';
  const values = [state[key][action], ...kids.map((k) => state[k][action])];
  if (values.every(Boolean)) return 'on';
  if (values.every((v) => !v)) return 'off';
  return 'mixed';
}

// ── Override (tri-state) mode ──────────────────────────────────────────

export type TriCrud = {
  create: boolean | null;
  read: boolean | null;
  update: boolean | null;
  delete: boolean | null;
};
export type OverrideState = Record<MenuKey, TriCrud>;

export const INHERIT_CRUD: TriCrud = { create: null, read: null, update: null, delete: null };

export function overrideStateFromRows(
  rows: {
    menuKey: string;
    canCreate: boolean | null;
    canRead: boolean | null;
    canUpdate: boolean | null;
    canDelete: boolean | null;
  }[],
): OverrideState {
  const byKey = new Map(rows.map((r) => [r.menuKey, r]));
  const out = {} as OverrideState;
  for (const k of allMenuKeys()) {
    const r = byKey.get(k);
    out[k] = r
      ? { create: r.canCreate, read: r.canRead, update: r.canUpdate, delete: r.canDelete }
      : { ...INHERIT_CRUD };
  }
  return out;
}

/** Editor state → server rows: only keys with at least one explicit action. */
export function overrideRowsFromState(state: OverrideState) {
  return allMenuKeys()
    .filter((k) => ACTIONS.some((a) => state[k][a] !== null))
    .map((menuKey) => ({
      menuKey,
      canCreate: state[menuKey].create,
      canRead: state[menuKey].read,
      canUpdate: state[menuKey].update,
      canDelete: state[menuKey].delete,
    }));
}

/** Cycle one override cell: inherit → allow → deny → inherit. */
export function cycleOverride(
  state: OverrideState,
  key: MenuKey,
  action: MenuAction,
): OverrideState {
  const cur = state[key][action];
  const next = cur === null ? true : cur === true ? false : null;
  return { ...state, [key]: { ...state[key], [action]: next } };
}

/** The value an override cell resolves to, for display (explicit or inherited). */
export function resolvedOverride(
  state: OverrideState,
  base: EffectivePermissions,
  key: MenuKey,
  action: MenuAction,
): { value: boolean; explicit: boolean } {
  const o = state[key][action];
  if (o !== null) return { value: o, explicit: true };
  return { value: base[key]?.[action] === true, explicit: false };
}
