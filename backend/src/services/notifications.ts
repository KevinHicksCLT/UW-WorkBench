import { prisma } from '../db/prisma.js';

type NotificationInput = {
  tenantId: string;
  userId: string;
  subject: string;
  body: string;
  link?: string | null;
};

export async function sendNotification({ tenantId, userId, subject, body, link }: NotificationInput) {
  return prisma.notification.create({
    data: { tenantId, userId, subject, body, link },
  });
}

export async function listForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}
