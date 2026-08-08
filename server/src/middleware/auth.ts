import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const JWT_TTL = '7d';

export type TokenClaims = { sub: string; tenantId: string; email: string; role: string };

export function signToken(claims: TokenClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: JWT_TTL });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }
    const claims = jwt.verify(token, JWT_SECRET) as TokenClaims;
    const user = await prisma.user.findFirst({ where: { id: claims.sub, tenantId: claims.tenantId } });
    if (!user || user.status === 'DEACTIVATED') {
      res.status(401).json({ error: 'Invalid or deactivated principal' });
      return;
    }
    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
