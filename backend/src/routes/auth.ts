import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Deactivated accounts fail identically to unknown ones — no oracle.
    if (!user || user.status === 'DEACTIVATED')
      return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      token: signToken(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Session bootstrap: identity + the acting operating role (the UW authority /
// referral chain and the CUO gate all key off it).
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    const operatingRole = user.operatingRoleId
      ? await prisma.role.findFirst({
          where: { id: user.operatingRoleId },
          select: { id: true, displayValue: true },
        })
      : null;
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      operatingRole,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
