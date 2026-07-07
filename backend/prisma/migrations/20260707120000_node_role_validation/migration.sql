-- AlterTable
ALTER TABLE "NodeRole" ADD COLUMN     "reassignedToApplicationId" TEXT,
ADD COLUMN     "reassignedToExternalPartyId" TEXT,
ADD COLUMN     "reassignedToRoleId" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedByEmail" TEXT,
ADD COLUMN     "validationNote" TEXT,
ADD COLUMN     "validationStatus" TEXT NOT NULL DEFAULT 'UNREVIEWED';

-- CreateIndex
CREATE INDEX "NodeRole_companyId_validationStatus_idx" ON "NodeRole"("companyId", "validationStatus");

-- CreateIndex
CREATE INDEX "NodeRole_reassignedToRoleId_idx" ON "NodeRole"("reassignedToRoleId");

-- CreateIndex
CREATE INDEX "NodeRole_reassignedToApplicationId_idx" ON "NodeRole"("reassignedToApplicationId");

-- CreateIndex
CREATE INDEX "NodeRole_reassignedToExternalPartyId_idx" ON "NodeRole"("reassignedToExternalPartyId");

-- AddForeignKey
ALTER TABLE "NodeRole" ADD CONSTRAINT "NodeRole_reassignedToRoleId_fkey" FOREIGN KEY ("reassignedToRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRole" ADD CONSTRAINT "NodeRole_reassignedToApplicationId_fkey" FOREIGN KEY ("reassignedToApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeRole" ADD CONSTRAINT "NodeRole_reassignedToExternalPartyId_fkey" FOREIGN KEY ("reassignedToExternalPartyId") REFERENCES "ExternalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

