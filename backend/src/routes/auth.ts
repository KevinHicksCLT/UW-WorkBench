import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema, type LoginResponse } from '@cascade/shared';
import { prisma } from '../db/prisma.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    const body: LoginResponse = {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    };
    res.json(body);
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { id, email, name, role, tenantId } = req.user;
  res.json({ id, email, name, role, tenantId });
});

export default router;
