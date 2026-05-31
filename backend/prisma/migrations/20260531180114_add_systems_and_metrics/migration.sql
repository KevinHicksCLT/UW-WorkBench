-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'Internal',
    "category" TEXT,
    "vendor" TEXT,
    "criticality" TEXT NOT NULL DEFAULT 'Medium',
    "description" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationValueStream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "valueStreamId" TEXT NOT NULL,
    "systemRole" TEXT NOT NULL DEFAULT 'Supporting',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationValueStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "valueStreamId" TEXT,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "direction" TEXT NOT NULL DEFAULT 'up',
    "illustrative" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Application_companyId_idx" ON "Application"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_tenantId_companyId_name_key" ON "Application"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "ApplicationValueStream_applicationId_idx" ON "ApplicationValueStream"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationValueStream_valueStreamId_idx" ON "ApplicationValueStream"("valueStreamId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationValueStream_applicationId_valueStreamId_key" ON "ApplicationValueStream"("applicationId", "valueStreamId");

-- CreateIndex
CREATE INDEX "Metric_companyId_idx" ON "Metric"("companyId");

-- CreateIndex
CREATE INDEX "Metric_valueStreamId_idx" ON "Metric"("valueStreamId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationValueStream" ADD CONSTRAINT "ApplicationValueStream_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationValueStream" ADD CONSTRAINT "ApplicationValueStream_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
