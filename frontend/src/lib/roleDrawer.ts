import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Global role-navigation plumbing. Clicking a role anywhere in the app takes
// the user to the full role profile page (`/roles/:id`) via `useOpenRole`.
// The lighter quick-peek drawer (rendered by the single RoleDrawerHost in
// Layout whenever `?role=<id>` is on the URL) remains for sidebar surfaces
// that must not navigate away — open it with `useOpenRoleDrawer`. Never
// mount RoleDrawer directly.

const ROLE_MUTATED_EVENT = 'cascade:role-mutated';

/**
 * Returns `openRole(id)` — navigates to the role's full profile page
 * (`/roles/:id`). The default drill-in from every tab; the browser Back
 * button returns the user to where they were.
 */
export function useOpenRole(): (roleId: string) => void {
  const navigate = useNavigate();
  return useCallback(
    (roleId: string) => navigate(`/roles/${encodeURIComponent(roleId)}`),
    [navigate],
  );
}

/**
 * Returns `openRoleDrawer(id)` — opens the quick-peek role drawer over
 * whatever the user is looking at by pushing `?role=<id>` onto the current
 * location (other params preserved). For sidebar/explorer surfaces where
 * losing the surrounding context would hurt; the drawer links on to the
 * full profile page.
 */
export function useOpenRoleDrawer(): (roleId: string) => void {
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
