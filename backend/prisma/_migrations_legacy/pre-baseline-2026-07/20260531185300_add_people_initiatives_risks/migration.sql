-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "stage" TEXT,
    "health" TEXT NOT NULL DEFAULT 'Green',
    "sponsorRoleId" TEXT,
    "budget" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeValueStream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "valueStreamId" TEXT NOT NULL,
    "impactType" TEXT NOT NULL DEFAULT 'Transforms',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitiativeValueStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeDivision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Sponsoring',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitiativeDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'badged',
    "vendor" TEXT,
    "location" TEXT,
    "region" TEXT,
    "title" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'badged',
    "allocationPct" INTEGER NOT NULL DEFAULT 100,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "roleTaskId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "dueDate" TIMESTAMP(3),
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "direction" TEXT NOT NULL DEFAULT 'up',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "valueStreamId" TEXT,
    "initiativeId" TEXT,
    "ownerRoleId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Operational',
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "likelihood" TEXT NOT NULL DEFAULT 'Possible',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "mitigation" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Initiative_companyId_idx" ON "Initiative"("companyId");

-- CreateIndex
CREATE INDEX "Initiative_sponsorRoleId_idx" ON "Initiative"("sponsorRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "Initiative_tenantId_companyId_name_key" ON "Initiative"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "InitiativeValueStream_initiativeId_idx" ON "InitiativeValueStream"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeValueStream_valueStreamId_idx" ON "InitiativeValueStream"("valueStreamId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeValueStream_initiativeId_valueStreamId_key" ON "InitiativeValueStream"("initiativeId", "valueStreamId");

-- CreateIndex
CREATE INDEX "InitiativeDivision_initiativeId_idx" ON "InitiativeDivision"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeDivision_divisionId_idx" ON "InitiativeDivision"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeDivision_initiativeId_divisionId_key" ON "InitiativeDivision"("initiativeId", "divisionId");

-- CreateIndex
CREATE INDEX "Person_companyId_idx" ON "Person"("companyId");

-- CreateIndex
CREATE INDEX "Person_companyId_employmentType_idx" ON "Person"("companyId", "employmentType");

-- CreateIndex
CREATE INDEX "Assignment_roleId_idx" ON "Assignment"("roleId");

-- CreateIndex
CREATE INDEX "Assignment_personId_idx" ON "Assignment"("personId");

-- CreateIndex
CREATE INDEX "Assignment_initiativeId_idx" ON "Assignment"("initiativeId");

-- CreateIndex
CREATE INDEX "Assignment_initiativeId_employmentType_idx" ON "Assignment"("initiativeId", "employmentType");

-- CreateIndex
CREATE INDEX "PersonTask_personId_idx" ON "PersonTask"("personId");

-- CreateIndex
CREATE INDEX "PersonTask_personId_status_idx" ON "PersonTask"("personId", "status");

-- CreateIndex
CREATE INDEX "PersonTask_assignmentId_idx" ON "PersonTask"("assignmentId");

-- CreateIndex
CREATE INDEX "PersonMetric_personId_idx" ON "PersonMetric"("personId");

-- CreateIndex
CREATE INDEX "PersonMetric_personId_period_idx" ON "PersonMetric"("personId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PersonMetric_personId_period_name_key" ON "PersonMetric"("personId", "period", "name");

-- CreateIndex
CREATE INDEX "Risk_companyId_idx" ON "Risk"("companyId");

-- CreateIndex
CREATE INDEX "Risk_valueStreamId_idx" ON "Risk"("valueStreamId");

-- CreateIndex
CREATE INDEX "Risk_initiativeId_idx" ON "Risk"("initiativeId");

-- CreateIndex
CREATE INDEX "Risk_ownerRoleId_idx" ON "Risk"("ownerRoleId");

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_sponsorRoleId_fkey" FOREIGN KEY ("sponsorRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeValueStream" ADD CONSTRAINT "InitiativeValueStream_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeValueStream" ADD CONSTRAINT "InitiativeValueStream_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeDivision" ADD CONSTRAINT "InitiativeDivision_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeDivision" ADD CONSTRAINT "InitiativeDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTask" ADD CONSTRAINT "PersonTask_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTask" ADD CONSTRAINT "PersonTask_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTask" ADD CONSTRAINT "PersonTask_roleTaskId_fkey" FOREIGN KEY ("roleTaskId") REFERENCES "RoleTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonMetric" ADD CONSTRAINT "PersonMetric_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerRoleId_fkey" FOREIGN KEY ("ownerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
