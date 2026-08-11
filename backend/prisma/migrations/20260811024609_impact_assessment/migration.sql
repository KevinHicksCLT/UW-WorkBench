-- CreateTable
CREATE TABLE "ImpactAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectRef" JSONB NOT NULL,
    "subjectName" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "intent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "recommendation" TEXT,
    "report" JSONB,
    "artifacts" JSONB,
    "createdBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpactAssessment_companyId_subjectKind_idx" ON "ImpactAssessment"("companyId", "subjectKind");

-- CreateIndex
CREATE INDEX "ImpactAssessment_companyId_createdAt_idx" ON "ImpactAssessment"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ImpactAssessment_companyId_status_idx" ON "ImpactAssessment"("companyId", "status");

-- AddForeignKey
ALTER TABLE "ImpactAssessment" ADD CONSTRAINT "ImpactAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
