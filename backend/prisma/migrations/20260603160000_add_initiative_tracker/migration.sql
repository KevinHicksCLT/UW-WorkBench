-- Initiative Tracker (strategic-portfolio management) — additive only.
-- New tables: Program → Workstream → PortfolioInitiative, plus BenefitLine /
-- CostLine / MetricValue / Milestone / RaidItem. Optional links into the
-- operating model (ValueStream / Division / Role) are enforced here as DB-level
-- foreign keys with ON DELETE SET NULL, even though they are not modeled as
-- Prisma relations. No existing table is altered or dropped.

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "statusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workstream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "statusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workstream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioInitiative" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'IDEA',
    "workflowAction" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PLANNING',
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "statusNote" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "valueStreamId" TEXT,
    "divisionId" TEXT,
    "ownerRoleId" TEXT,
    "sponsorRoleId" TEXT,
    "cumulativeBenefit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cumulativeCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cumulativeNetBenefit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioInitiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitLine" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BenefitLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostLine" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricValue" (
    "id" TEXT NOT NULL,
    "benefitLineId" TEXT,
    "costLineId" TEXT,
    "dataset" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "MetricValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "isGate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidItem" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "severity" INTEGER NOT NULL DEFAULT 9,
    "mitigation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerRoleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Program_companyId_idx" ON "Program"("companyId");
CREATE INDEX "Workstream_companyId_idx" ON "Workstream"("companyId");
CREATE INDEX "Workstream_programId_idx" ON "Workstream"("programId");
CREATE INDEX "PortfolioInitiative_companyId_idx" ON "PortfolioInitiative"("companyId");
CREATE INDEX "PortfolioInitiative_workstreamId_idx" ON "PortfolioInitiative"("workstreamId");
CREATE INDEX "PortfolioInitiative_valueStreamId_idx" ON "PortfolioInitiative"("valueStreamId");
CREATE INDEX "PortfolioInitiative_divisionId_idx" ON "PortfolioInitiative"("divisionId");
CREATE INDEX "BenefitLine_initiativeId_idx" ON "BenefitLine"("initiativeId");
CREATE INDEX "CostLine_initiativeId_idx" ON "CostLine"("initiativeId");
CREATE INDEX "MetricValue_benefitLineId_dataset_periodStart_idx" ON "MetricValue"("benefitLineId", "dataset", "periodStart");
CREATE INDEX "MetricValue_costLineId_dataset_periodStart_idx" ON "MetricValue"("costLineId", "dataset", "periodStart");
CREATE INDEX "Milestone_initiativeId_idx" ON "Milestone"("initiativeId");
CREATE INDEX "RaidItem_initiativeId_idx" ON "RaidItem"("initiativeId");

-- AddForeignKey (internal module relations — cascade)
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenefitLine" ADD CONSTRAINT "BenefitLine_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_benefitLineId_fkey" FOREIGN KEY ("benefitLineId") REFERENCES "BenefitLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_costLineId_fkey" FOREIGN KEY ("costLineId") REFERENCES "CostLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidItem" ADD CONSTRAINT "RaidItem_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "PortfolioInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (operating-model integration links — set null on delete)
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioInitiative" ADD CONSTRAINT "PortfolioInitiative_sponsorRoleId_fkey" FOREIGN KEY ("sponsorRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RaidItem" ADD CONSTRAINT "RaidItem_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
