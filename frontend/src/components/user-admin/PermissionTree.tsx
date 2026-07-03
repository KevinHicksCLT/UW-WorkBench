import { useEffect, useRef, useState } from 'react';
import {
  MENU_TREE,
  type EffectivePermissions,
  type MenuAction,
  type MenuNode,
} from '@cascade/shared';
import { useDialogs } from '../../lib/dialogs';
import {
  ACTIONS,
  cycleOverride,
  parentDisplay,
  resolvedOverride,
  toggleGrant,
  type GrantState,
  type OverrideState,
} from './permissionTreeModel';

// The menu-tree permission editor. Two modes:
//  • grants — full CRUD checkboxes per key (user-type permission sets).
//    Parent toggles cascade to the subtree; parents show indeterminate when
//    children diverge; expanding a parent exposes subset carve-outs.
//  • overrides — tri-state cells (inherit → allow → deny) layered on a base
//    EffectivePermissions; inherited values render dimmed.
// State handling is controlled (value + onChange) — pure logic lives in
// permissionTreeModel.ts.

const ACTION_LABELS: Record<MenuAction, string> = {
  create: 'C',
  read: 'R',
  update: 'U',
  delete: 'D',
};
const ACTION_TITLES: Record<MenuAction, string> = {
  create: 'Create',
  read: 'Read',
  update: 'Update',
  delete: 'Delete',
};

function GrantCheckbox({
  display,
  onToggle,
  label,
}: {
  display: 'on' | 'off' | 'mixed';
  onToggle: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = display === 'mixed';
  }, [display]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={display === 'on'}
      onChange={onToggle}
      className="h-3.5 w-3.5 accent-[#171717] cursor-pointer"
    />
  );
}

function HeaderRow() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,44px)] items-center px-2 py-1.5 border-b border-[#eaeaea]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
        Menu item
      </span>
      {ACTIONS.map((a) => (
        <span
          key={a}
          title={ACTION_TITLES[a]}
          className="text-center text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]"
        >
          {ACTION_LABELS[a]}
        </span>
      ))}
    </div>
  );
}

export function GrantTree({
  value,
  onChange,
}: {
  value: GrantState;
  onChange: (next: GrantState) => void;
}) {
  const { confirm } = useDialogs();
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = async (key: MenuNode['key'], action: MenuAction) => {
    const next = toggleGrant(value, key, action);
    // Guard rail: read removed while C/U/D remain hides the page but leaves
    // writes possible via the API — flag it, don't forbid it.
    if (action === 'read' && !next[key].read && ACTIONS.some((a) => a !== 'read' && next[key][a])) {
      const ok = await confirm({
        title: 'Remove read access?',
        message:
          'This item keeps create/update/delete but loses read — the page disappears from the menu while writes stay allowed. Continue?',
        confirmLabel: 'Remove read',
      });
      if (!ok) return;
    }
    onChange(next);
  };

  const renderNode = (node: MenuNode, depth: number) => {
    const kids = node.children ?? [];
    const expanded = open.has(node.key);
    return (
      <div key={node.key}>
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,44px)] items-center px-2 py-1.5 border-b border-[#f5f5f5] hover:bg-[#fafafa]">
          <span className="flex items-center gap-1 min-w-0" style={{ paddingLeft: depth * 18 }}>
            {kids.length > 0 ? (
              <button
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (n.has(node.key)) {
                      n.delete(node.key);
                    } else {
                      n.add(node.key);
                    }
                    return n;
                  })
                }
                aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                className="p-0.5 text-[#a3a3a3] hover:text-[#171717] transition-colors duration-150"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={'transition-transform duration-150 ' + (expanded ? 'rotate-90' : '')}
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="text-sm text-[#171717] truncate">{node.label}</span>
          </span>
          {ACTIONS.map((a) => (
            <span key={a} className="text-center">
              <GrantCheckbox
                display={parentDisplay(value, node.key, a)}
                onToggle={() => void toggle(node.key, a)}
                label={`${node.label} — ${ACTION_TITLES[a]}`}
              />
            </span>
          ))}
        </div>
        {expanded && kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-[#eaeaea] overflow-hidden">
      <HeaderRow />
      {MENU_TREE.map((n) => renderNode(n, 0))}
    </div>
  );
}

export function OverrideTree({
  value,
  base,
  onChange,
}: {
  value: OverrideState;
  base: EffectivePermissions;
  onChange: (next: OverrideState) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const renderNode = (node: MenuNode, depth: number) => {
    const kids = node.children ?? [];
    const expanded = open.has(node.key);
    return (
      <div key={node.key}>
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,44px)] items-center px-2 py-1.5 border-b border-[#f5f5f5] hover:bg-[#fafafa]">
          <span className="flex items-center gap-1 min-w-0" style={{ paddingLeft: depth * 18 }}>
            {kids.length > 0 ? (
              <button
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (n.has(node.key)) {
                      n.delete(node.key);
                    } else {
                      n.add(node.key);
                    }
                    return n;
                  })
                }
                aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                className="p-0.5 text-[#a3a3a3] hover:text-[#171717] transition-colors duration-150"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={'transition-transform duration-150 ' + (expanded ? 'rotate-90' : '')}
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="text-sm text-[#171717] truncate">{node.label}</span>
          </span>
          {ACTIONS.map((a) => {
            const { value: v, explicit } = resolvedOverride(value, base, node.key, a);
            return (
              <span key={a} className="text-center">
                <button
                  onClick={() => onChange(cycleOverride(value, node.key, a))}
                  title={`${node.label} — ${ACTION_TITLES[a]}: ${explicit ? (v ? 'allowed (override)' : 'denied (override)') : `inherited (${v ? 'allowed' : 'denied'})`}. Click to cycle inherit → allow → deny.`}
                  className={
                    'inline-flex items-center justify-center h-5 w-8 rounded text-[11px] font-semibold border transition-colors duration-150 ' +
                    (explicit
                      ? v
                        ? 'bg-[#16a34a] text-white border-[#16a34a]'
                        : 'bg-[#be123c] text-white border-[#be123c]'
                      : v
                        ? 'bg-white text-[#16a34a]/60 border-[#eaeaea]'
                        : 'bg-white text-[#d4d4d4] border-[#eaeaea]')
                  }
                >
                  {v ? '✓' : '✕'}
                </button>
              </span>
            );
          })}
        </div>
        {expanded && kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <p className="text-[11px] text-[#a3a3a3] mb-1.5">
        Click a cell to cycle: <span className="text-[#525252]">inherit</span> →{' '}
        <span className="text-[#16a34a]">allow</span> → <span className="text-[#be123c]">deny</span>
        . Dimmed cells inherit from the user type.
      </p>
      <div className="rounded-lg border border-[#eaeaea] overflow-hidden">
        <HeaderRow />
        {MENU_TREE.map((n) => renderNode(n, 0))}
      </div>
    </div>
  );
}
