-- AlterTable
ALTER TABLE "RationalizationApp" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'LEGACY';

-- AlterTable
ALTER TABLE "RationalizationCapability" ADD COLUMN     "sharedServiceId" TEXT;

-- CreateIndex
CREATE INDEX "RationalizationCapability_sharedServiceId_idx" ON "RationalizationCapability"("sharedServiceId");

-- AddForeignKey
ALTER TABLE "RationalizationCapability" ADD CONSTRAINT "RationalizationCapability_sharedServiceId_fkey" FOREIGN KEY ("sharedServiceId") REFERENCES "RationalizationApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
