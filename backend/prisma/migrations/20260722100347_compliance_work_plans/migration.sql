-- CreateTable
CREATE TABLE "ComplianceItemWorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "complianceItemId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "ComplianceItemWorkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceItemTemplateAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "complianceItemId" TEXT NOT NULL,
    "templateKeyId" TEXT,
    "customKey" TEXT,
    "kind" TEXT,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceItemTemplateAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceItemWorkTemplate_complianceItemId_idx" ON "ComplianceItemWorkTemplate"("complianceItemId");

-- CreateIndex
CREATE INDEX "ComplianceItemWorkTemplate_templateId_idx" ON "ComplianceItemWorkTemplate"("templateId");

-- CreateIndex
CREATE INDEX "ComplianceItemWorkTemplate_companyId_complianceItemId_idx" ON "ComplianceItemWorkTemplate"("companyId", "complianceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItemWorkTemplate_complianceItemId_templateId_key" ON "ComplianceItemWorkTemplate"("complianceItemId", "templateId");

-- CreateIndex
CREATE INDEX "ComplianceItemTemplateAnswer_complianceItemId_idx" ON "ComplianceItemTemplateAnswer"("complianceItemId");

-- CreateIndex
CREATE INDEX "ComplianceItemTemplateAnswer_templateKeyId_idx" ON "ComplianceItemTemplateAnswer"("templateKeyId");

-- CreateIndex
CREATE INDEX "ComplianceItemTemplateAnswer_companyId_complianceItemId_idx" ON "ComplianceItemTemplateAnswer"("companyId", "complianceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItemTemplateAnswer_complianceItemId_templateKeyId_key" ON "ComplianceItemTemplateAnswer"("complianceItemId", "templateKeyId");

-- AddForeignKey
ALTER TABLE "ComplianceItemWorkTemplate" ADD CONSTRAINT "ComplianceItemWorkTemplate_complianceItemId_fkey" FOREIGN KEY ("complianceItemId") REFERENCES "ComplianceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemWorkTemplate" ADD CONSTRAINT "ComplianceItemWorkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemTemplateAnswer" ADD CONSTRAINT "ComplianceItemTemplateAnswer_complianceItemId_fkey" FOREIGN KEY ("complianceItemId") REFERENCES "ComplianceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemTemplateAnswer" ADD CONSTRAINT "ComplianceItemTemplateAnswer_templateKeyId_fkey" FOREIGN KEY ("templateKeyId") REFERENCES "WorkTemplateKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemTemplateAnswer" ADD CONSTRAINT "ComplianceItemTemplateAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemTemplateAnswer" ADD CONSTRAINT "ComplianceItemTemplateAnswer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItemTemplateAnswer" ADD CONSTRAINT "ComplianceItemTemplateAnswer_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
