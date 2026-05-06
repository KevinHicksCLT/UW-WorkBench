import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Restrict to specific roles
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${allowed.join(' | ')}` });
    }
    next();
  };
}
