-- Deliverables & Tasks (work tracker) — additive only.
-- New tables: Deliverable and Task (Task → Deliverable, ON DELETE SET NULL).
-- An optional link into the operating model (ValueStream) is enforced here as a
-- DB-level foreign key with ON DELETE SET NULL, even though it is not modeled as
-- a Prisma relation. No existing table is altered or dropped.

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Document',
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "valueStreamId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deliverableId" TEXT,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'To Do',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deliverable_companyId_idx" ON "Deliverable"("companyId");
CREATE INDEX "Deliverable_valueStreamId_idx" ON "Deliverable"("valueStreamId");
CREATE INDEX "Task_companyId_idx" ON "Task"("companyId");
CREATE INDEX "Task_deliverableId_idx" ON "Task"("deliverableId");
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- AddForeignKey (internal module relation — set null on delete)
ALTER TABLE "Task" ADD CONSTRAINT "Task_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (operating-model integration link — set null on delete)
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
