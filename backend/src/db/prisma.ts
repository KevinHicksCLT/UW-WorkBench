import { PrismaClient } from '@prisma/client';

// Serverless-safe singleton: a globalThis guard prevents a new client (and a
// new connection pool) on every warm function invocation.
const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
