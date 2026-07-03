import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  cycleOverride,
  emptyGrantState,
  grantRowsFromState,
  grantStateFromRows,
  overrideRowsFromState,
  overrideStateFromRows,
  parentDisplay,
  resolvedOverride,
  toggleGrant,
} from '../../../src/components/user-admin/permissionTreeModel';
import { allMenuKeys, type EffectivePermissions } from '@cascade/shared';

function basePerms(read = false): EffectivePermissions {
  const out = {} as EffectivePermissions;
  for (const k of allMenuKeys()) out[k] = { create: false, read, update: false, delete: false };
  return out;
}

describe('grant mode', () => {
  it('checking a parent action cascades to all children', () => {
    const s = toggleGrant(emptyGrantState(), 'data-admin', 'read');
    expect(s['data-admin'].read).toBe(true);
    expect(s['data-admin.configure'].read).toBe(true);
    expect(s['data-admin.audit-log'].read).toBe(true);
    // Other actions untouched
    expect(s['data-admin.configure'].update).toBe(false);
  });

  it('unchecking a parent action clears the subtree', () => {
    let s = toggleGrant(emptyGrantState(), 'user-admin', 'update');
    s = toggleGrant(s, 'user-admin', 'update');
    expect(s['user-admin'].update).toBe(false);
    expect(s['user-admin.users'].update).toBe(false);
  });

  it('a child carve-out makes the parent indeterminate', () => {
    let s = toggleGrant(emptyGrantState(), 'data-admin', 'read'); // all on
    s = toggleGrant(s, 'data-admin.audit-log', 'read'); // one child off
    expect(parentDisplay(s, 'data-admin', 'read')).toBe('mixed');
    expect(parentDisplay(s, 'data-admin.configure', 'read')).toBe('on');
  });

  it('leaf keys display their own value', () => {
    const s = toggleGrant(emptyGrantState(), 'roles', 'delete');
    expect(parentDisplay(s, 'roles', 'delete')).toBe('on');
    expect(parentDisplay(s, 'tasks', 'delete')).toBe('off');
  });

  it('round-trips server rows, inheriting missing children from their parent', () => {
    const rows = [
      { menuKey: 'data-admin', canCreate: false, canRead: true, canUpdate: true, canDelete: false },
    ];
    const s = grantStateFromRows(rows);
    expect(s['data-admin.configure']).toEqual({
      create: false,
      read: true,
      update: true,
      delete: false,
    });
    const out = grantRowsFromState(s);
    expect(out).toHaveLength(allMenuKeys().length);
    expect(out.find((r) => r.menuKey === 'data-admin.trackable-metrics')).toMatchObject({
      canRead: true,
      canUpdate: true,
    });
  });
});

describe('override (tri-state) mode', () => {
  it('cycles inherit → allow → deny → inherit', () => {
    let s = overrideStateFromRows([]);
    s = cycleOverride(s, 'standards', 'update');
    expect(s.standards.update).toBe(true);
    s = cycleOverride(s, 'standards', 'update');
    expect(s.standards.update).toBe(false);
    s = cycleOverride(s, 'standards', 'update');
    expect(s.standards.update).toBeNull();
  });

  it('serializes only keys with at least one explicit action', () => {
    let s = overrideStateFromRows([]);
    s = cycleOverride(s, 'metrics', 'read');
    const rows = overrideRowsFromState(s);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ menuKey: 'metrics', canRead: true, canCreate: null });
  });

  it('resolves inherited cells from the base permissions', () => {
    const s = overrideStateFromRows([]);
    const base = basePerms(true);
    expect(resolvedOverride(s, base, 'home', 'read')).toEqual({ value: true, explicit: false });
    const denied = cycleOverride(cycleOverride(s, 'home', 'read'), 'home', 'read'); // → deny
    expect(resolvedOverride(denied, base, 'home', 'read')).toEqual({
      value: false,
      explicit: true,
    });
  });

  it('loads existing override rows', () => {
    const s = overrideStateFromRows([
      { menuKey: 'workspace', canCreate: null, canRead: false, canUpdate: null, canDelete: null },
    ]);
    expect(s.workspace.read).toBe(false);
    expect(ACTIONS.filter((a) => s.workspace[a] !== null)).toEqual(['read']);
  });
});
