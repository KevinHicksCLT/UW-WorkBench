import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Global role-drawer plumbing. A role's detail is opened IN PLACE from any
// surface (value streams, organization, roles, standards, deliverables, …) by
// setting `?role=<id>` on the current URL — the single RoleDrawerHost mounted
// in Layout renders it as a viewport overlay. Nothing navigates to another tab,
// so the user never loses their spot. Import `useOpenRole` anywhere a role can
// be drilled into; never mount RoleDrawer directly.

const ROLE_MUTATED_EVENT = 'cascade:role-mutated';

/**
 * Returns `openRole(id)` — opens the role drawer over whatever the user is
 * looking at by pushing `?role=<id>` onto the current location (other params
 * preserved). A history entry is pushed so the browser Back button closes the
 * drawer and returns to exactly where they were.
 */
export function useOpenRole(): (roleId: string) => void {
  const [, setParams] = useSearchParams();
  return useCallback(
    (roleId: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('role', roleId);
        return next;
      });
    },
    [setParams],
  );
}

/** Fired by the host after a role is amended/removed so open lists refresh. */
export function emitRoleMutated(): void {
  window.dispatchEvent(new CustomEvent(ROLE_MUTATED_EVENT));
}

/** Subscribe a role-listing surface to refetch when a role is mutated. */
export function useRoleMutated(onMutated: () => void): void {
  useEffect(() => {
    const handler = () => onMutated();
    window.addEventListener(ROLE_MUTATED_EVENT, handler);
    return () => window.removeEventListener(ROLE_MUTATED_EVENT, handler);
  }, [onMutated]);
}
