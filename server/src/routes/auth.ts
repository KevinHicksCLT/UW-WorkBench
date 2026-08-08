/**
 * Public auth surface: self-service signup (anyone can create a company) and
 * login. Signup provisions a full underwriting operation and applies the
 * bundled starter pack so the new company is decision-ready immediately.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { signToken } from '../middleware/auth.js';
import { provisionCompany } from '../services/provisioning.js';
import { loadBundledPacks } from '../lib/packStore.js';

const router = Router();

const signupSchema = z.object({
  companyName: z.string().min(2).max(80),
  adminName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  starterPackSlug: z.string().regex(/^[a-z0-9-]+$/).optional(), // defaults to the commercial-property starter
});

router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = signupSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { email: data.email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

    const packs = await loadBundledPacks();
    const starterPack = packs.find((p) => p.slug === (data.starterPackSlug ?? 'commercial-property-starter')) ?? packs[0];

    const result = await provisionCompany(prisma, {
      companyName: data.companyName,
      adminEmail: data.email,
      adminName: data.adminName,
      password: data.password,
      starterPack,
    });
    const token = signToken({ sub: result.userId, tenantId: result.tenantId, email: data.email.toLowerCase(), role: 'ADMIN' });
    res.status(201).json({
      token,
      companyId: result.companyId,
      starterPack: starterPack ? { slug: starterPack.slug, version: starterPack.version, applied: result.packResult } : null,
    });
  } catch (e) { next(e); }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: data.email.toLowerCase() } });
    if (!user || user.status === 'DEACTIVATED' || !(await bcrypt.compare(data.password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role });
    res.json({ token, user: { email: user.email, name: user.name, role: user.role } });
  } catch (e) { next(e); }
});

export default router;
