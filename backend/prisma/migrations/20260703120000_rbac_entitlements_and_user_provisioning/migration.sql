-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "description" TEXT,
ADD COLUMN     "roleFamily" TEXT,
ADD COLUMN     "roleLevel" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "geography" TEXT,
ADD COLUMN     "isApprover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operatingRoleId" TEXT,
ADD COLUMN     "orgUnitId" TEXT,
ADD COLUMN     "reportsToId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "UserValueStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,

    CONSTRAINT "UserValueStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "permissionSetId" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canRead" BOOLEAN NOT NULL DEFAULT false,
    "canUpdate" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,
    "canCreate" BOOLEAN,
    "canRead" BOOLEAN,
    "canUpdate" BOOLEAN,
    "canDelete" BOOLEAN,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "scopes" TEXT NOT NULL DEFAULT 'provisioning',
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserValueStream_processNodeId_idx" ON "UserValueStream"("processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserValueStream_userId_processNodeId_key" ON "UserValueStream"("userId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionSet_tenantId_userType_key" ON "PermissionSet"("tenantId", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGrant_permissionSetId_menuKey_key" ON "PermissionGrant"("permissionSetId", "menuKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_menuKey_key" ON "UserPermissionOverride"("userId", "menuKey");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");

-- CreateIndex
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_createdAt_idx" ON "WebhookEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_tenantId_externalEventId_key" ON "WebhookEvent"("tenantId", "externalEventId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_orgUnitId_idx" ON "User"("orgUnitId");

-- CreateIndex
CREATE INDEX "User_reportsToId_idx" ON "User"("reportsToId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_externalId_key" ON "User"("tenantId", "externalId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_operatingRoleId_fkey" FOREIGN KEY ("operatingRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserValueStream" ADD CONSTRAINT "UserValueStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserValueStream" ADD CONSTRAINT "UserValueStream_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionSet" ADD CONSTRAINT "PermissionSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_permissionSetId_fkey" FOREIGN KEY ("permissionSetId") REFERENCES "PermissionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

