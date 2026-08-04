// Entitlement middleware — standalone-app edition. The Transformation Bridge
// platform gates each router behind a menu-key permission matrix; this app IS
// the UW Workbench, so every active authenticated user holds its one menu key.
// The signature is kept identical so routes ported from the platform (e.g.
// routes/uw/index.ts) mount unchanged, and a real matrix can be re-introduced
// here without touching call sites.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type MenuAction = 'read' | 'create' | 'update' | 'delete';

export function requirePermission(_menuKey: string, _action?: MenuAction): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user.status === 'DEACTIVATED') {
      return res.status(401).json({ error: 'Account deactivated' });
    }
    next();
  };
}
