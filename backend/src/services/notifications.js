import { prisma } from '../db/prisma.js';

export async function sendNotification({ tenantId, userId, subject, body, link }) {
  return prisma.notification.create({
    data: { tenantId, userId, subject, body, link },
  });
}

export async function listForUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markRead(id, userId) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}
