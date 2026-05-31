-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "formula" TEXT,
ADD COLUMN     "framework" TEXT,
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "l3" TEXT,
ADD COLUMN     "measurementLevel" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "ownerRole" TEXT,
ADD COLUMN     "targetText" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "description" TEXT,
ADD COLUMN     "managerRoleId" TEXT,
ADD COLUMN     "primaryDomain" TEXT,
ADD COLUMN     "primaryValueStream" TEXT,
ADD COLUMN     "responsibilities" TEXT,
ADD COLUMN     "roleLevel" TEXT,
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "ValueStream" ADD COLUMN     "domainId" TEXT;

-- CreateTable
CREATE TABLE "ValueStreamDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "illustrative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValueStreamDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "valueStreamId" TEXT NOT NULL,
    "l3" TEXT,
    "l4" TEXT,
    "stepNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leads" TEXT,
    "supporting" TEXT,
    "inputs" TEXT,
    "outputs" TEXT,
    "notes" TEXT,
    "externalParticipants" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IoItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "valueStreamId" TEXT NOT NULL,
    "l3" TEXT,
    "l4" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyRoles" TEXT,
    "dataElements" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "charterIncluded" BOOLEAN NOT NULL DEFAULT false,
    "owner" TEXT,
    "link" TEXT,
    "illustrative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValueStreamDomain_companyId_idx" ON "ValueStreamDomain"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ValueStreamDomain_companyId_name_key" ON "ValueStreamDomain"("companyId", "name");

-- CreateIndex
CREATE INDEX "ProcessStep_valueStreamId_idx" ON "ProcessStep"("valueStreamId");

-- CreateIndex
CREATE INDEX "ProcessStep_valueStreamId_stepNumber_idx" ON "ProcessStep"("valueStreamId", "stepNumber");

-- CreateIndex
CREATE INDEX "IoItem_valueStreamId_idx" ON "IoItem"("valueStreamId");

-- CreateIndex
CREATE INDEX "IoItem_valueStreamId_type_idx" ON "IoItem"("valueStreamId", "type");

-- CreateIndex
CREATE INDEX "Standard_companyId_idx" ON "Standard"("companyId");

-- CreateIndex
CREATE INDEX "Role_managerRoleId_idx" ON "Role"("managerRoleId");

-- CreateIndex
CREATE INDEX "ValueStream_domainId_idx" ON "ValueStream"("domainId");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_managerRoleId_fkey" FOREIGN KEY ("managerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueStream" ADD CONSTRAINT "ValueStream_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ValueStreamDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueStreamDomain" ADD CONSTRAINT "ValueStreamDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStep" ADD CONSTRAINT "ProcessStep_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoItem" ADD CONSTRAINT "IoItem_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standard" ADD CONSTRAINT "Standard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
