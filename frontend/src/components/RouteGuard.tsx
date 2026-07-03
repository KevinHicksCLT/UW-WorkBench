import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { MenuKey } from '@cascade/shared';
import { useAuth } from '../lib/auth';
import { canRead, defaultRoute } from '../lib/permissions';

// Client-side route gate mirroring the backend's requirePermission — a deep
// link to a tab the user can't read redirects to their start page (or the
// first readable tab). The server remains the real enforcement; this only
// prevents dead-on-arrival pages.
export default function RouteGuard({
  menuKey,
  children,
}: {
  menuKey: MenuKey;
  children: ReactNode;
}) {
  const { permissions, startPage } = useAuth();
  if (canRead(permissions, menuKey)) return <>{children}</>;
  const fallback = defaultRoute(permissions, startPage);
  if (fallback) return <Navigate to={fallback} replace />;
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-base font-semibold text-[#171717]">No access</h1>
      <p className="mt-1 text-sm text-[#666666] max-w-sm">
        Your account has no pages enabled. Ask your administrator to grant you access.
      </p>
    </div>
  );
}
