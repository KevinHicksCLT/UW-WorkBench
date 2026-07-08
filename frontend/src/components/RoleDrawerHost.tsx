import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { emitRoleMutated } from '../lib/roleDrawer';

// The role drawer, lazy so it stays out of the main bundle until first use.
const RoleDrawer = lazy(() => import('./RoleDrawer'));

// RoleDrawerHost — mounted ONCE in Layout. Whenever `?role=<id>` is present on
// the URL it renders the role drawer as a viewport overlay, so every surface
// (value streams, organization, roles, standards, deliverables, …) drills into
// a role in place via `useOpenRole` — no per-page mount, no tab jump. See
// lib/roleDrawer.ts for the open/close/refresh plumbing.
export default function RoleDrawerHost() {
  const [params, setParams] = useSearchParams();
  const roleId = params.get('role');
  if (!roleId) return null;

  const close = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('role');
        return next;
      },
      { replace: true },
    );

  return (
    // Fixed viewport layer so DrawerShell's `absolute inset-0` covers the whole
    // screen regardless of the page underneath; z-50 clears the assistant /
    // feedback widgets (z-40). `key` remounts on role change to reset state.
    <div className="fixed inset-0 z-50">
      <Suspense fallback={null}>
        <RoleDrawer key={roleId} roleId={roleId} onClose={close} onMutated={emitRoleMutated} />
      </Suspense>
    </div>
  );
}
