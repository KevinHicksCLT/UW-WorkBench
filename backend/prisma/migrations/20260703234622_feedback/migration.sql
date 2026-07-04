-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "text" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "screenshot" BYTEA,
    "screenshotMime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ticket" JSONB,
    "jiraKey" TEXT,
    "screenshotAttachedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_tenantId_createdAt_idx" ON "Feedback"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");
