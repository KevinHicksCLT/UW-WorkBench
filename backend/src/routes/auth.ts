import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import {
  isMenuKey,
  loginSchema,
  type LoginResponse,
  type MeResponse,
  type MenuKey,
} from '@cascade/shared';
import { prisma } from '../db/prisma.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { getEffectivePermissions, hasPermission } from '../services/permissionService.js';

const router = Router();

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Deactivated accounts fail identically to unknown ones — no oracle.
    if (!user || user.status === 'DEACTIVATED')
      return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    const body: LoginResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
    res.json(body);
  } catch (e) {
    next(e);
  }
});

// The session bootstrap: identity + ABAC attributes + effective permissions +
// start page (already validated readable) in one payload. The frontend nav,
// route guards, and start-page routing all read from this.
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    const [permissions, valueStreams, ancestry, startPref] = await Promise.all([
      getEffectivePermissions(user),
      prisma.userValueStream.findMany({
        where: { userId: user.id },
        select: { processNodeId: true },
      }),
      user.orgUnitId
        ? prisma.orgUnitClosure.findMany({
            where: { descendantId: user.orgUnitId },
            orderBy: { depth: 'desc' }, // root first
            select: { ancestor: { select: { displayValue: true } } },
          })
        : Promise.resolve([]),
      prisma.userPreference.findUnique({
        where: { userId_key: { userId: user.id, key: 'startPage' } },
        select: { value: true },
      }),
    ]);

    // Fall back to 'home' when unset, unknown, or no longer readable — a
    // permission revoked after the preference was saved must not strand login.
    const saved = typeof startPref?.value === 'string' ? startPref.value : null;
    let startPage: MenuKey = 'home';
    if (saved && isMenuKey(saved) && hasPermission(permissions, saved, 'read')) startPage = saved;

    const body: MeResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        status: user.status,
      },
      attributes: {
        orgUnitId: user.orgUnitId,
        orgPath: ancestry.map((e) => e.ancestor.displayValue),
        geography: user.geography,
        operatingRoleId: user.operatingRoleId,
        isManager: user.isManager,
        reportsToId: user.reportsToId,
        isApprover: user.isApprover,
        valueStreamIds: valueStreams.map((v) => v.processNodeId),
      },
      permissions,
      startPage,
    };
    res.json(body);
  } catch (e) {
    next(e);
  }
});

export default router;
