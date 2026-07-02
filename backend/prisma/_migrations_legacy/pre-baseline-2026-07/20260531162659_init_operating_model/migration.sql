-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "divisionId" TEXT,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "itemRole" TEXT,
    "roleFamily" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValueStream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValueStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubValueStream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "valueStreamId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" TEXT,
    "outputs" TEXT,
    "upstream" TEXT,
    "downstream" TEXT,
    "notes" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubValueStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "categoryId" TEXT,
    "text" TEXT NOT NULL,
    "crossRole" BOOLEAN NOT NULL DEFAULT false,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "categoryId" TEXT,
    "text" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleValueStream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "valueStreamId" TEXT NOT NULL,
    "subStream" TEXT,
    "participationType" TEXT NOT NULL,
    "inputs" TEXT,
    "outputs" TEXT,
    "upstream" TEXT,
    "downstream" TEXT,
    "notes" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleValueStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalInteraction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "externalRole" TEXT NOT NULL,
    "internalRoleId" TEXT,
    "internalRoleOwner" TEXT,
    "divisionFunction" TEXT,
    "interactionType" TEXT,
    "inputs" TEXT,
    "outputs" TEXT,
    "relatedValueStream" TEXT,
    "dependencyType" TEXT,
    "frequency" TEXT,
    "notes" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "diff" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_tenantId_slug_key" ON "Company"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Division_companyId_idx" ON "Division"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Division_tenantId_companyId_name_key" ON "Division"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "Department_divisionId_idx" ON "Department"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_divisionId_name_key" ON "Department"("divisionId", "name");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE INDEX "Role_departmentId_idx" ON "Role"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_companyId_name_key" ON "Role"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "Category_companyId_idx" ON "Category"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_companyId_name_key" ON "Category"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "ValueStream_companyId_idx" ON "ValueStream"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ValueStream_tenantId_companyId_name_key" ON "ValueStream"("tenantId", "companyId", "name");

-- CreateIndex
CREATE INDEX "SubValueStream_valueStreamId_idx" ON "SubValueStream"("valueStreamId");

-- CreateIndex
CREATE INDEX "SubValueStream_parentId_idx" ON "SubValueStream"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubValueStream_valueStreamId_parentId_name_key" ON "SubValueStream"("valueStreamId", "parentId", "name");

-- CreateIndex
CREATE INDEX "ChecklistItem_roleId_idx" ON "ChecklistItem"("roleId");

-- CreateIndex
CREATE INDEX "ChecklistItem_categoryId_idx" ON "ChecklistItem"("categoryId");

-- CreateIndex
CREATE INDEX "RoleTask_roleId_idx" ON "RoleTask"("roleId");

-- CreateIndex
CREATE INDEX "RoleTask_categoryId_idx" ON "RoleTask"("categoryId");

-- CreateIndex
CREATE INDEX "RoleValueStream_roleId_idx" ON "RoleValueStream"("roleId");

-- CreateIndex
CREATE INDEX "RoleValueStream_valueStreamId_idx" ON "RoleValueStream"("valueStreamId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleValueStream_roleId_valueStreamId_subStream_key" ON "RoleValueStream"("roleId", "valueStreamId", "subStream");

-- CreateIndex
CREATE INDEX "ExternalInteraction_companyId_idx" ON "ExternalInteraction"("companyId");

-- CreateIndex
CREATE INDEX "ExternalInteraction_internalRoleId_idx" ON "ExternalInteraction"("internalRoleId");

-- CreateIndex
CREATE INDEX "AuditEntry_entityType_entityId_idx" ON "AuditEntry"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueStream" ADD CONSTRAINT "ValueStream_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubValueStream" ADD CONSTRAINT "SubValueStream_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubValueStream" ADD CONSTRAINT "SubValueStream_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SubValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTask" ADD CONSTRAINT "RoleTask_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTask" ADD CONSTRAINT "RoleTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleValueStream" ADD CONSTRAINT "RoleValueStream_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleValueStream" ADD CONSTRAINT "RoleValueStream_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalInteraction" ADD CONSTRAINT "ExternalInteraction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalInteraction" ADD CONSTRAINT "ExternalInteraction_internalRoleId_fkey" FOREIGN KEY ("internalRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
