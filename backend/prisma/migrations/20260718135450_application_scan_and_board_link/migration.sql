-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "appUrl" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "repoUrl" TEXT,
ADD COLUMN     "scanStatus" TEXT NOT NULL DEFAULT 'NOT_SCANNED',
ADD COLUMN     "scannedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RationalizationApp" ADD COLUMN     "applicationId" TEXT;

-- CreateIndex
CREATE INDEX "RationalizationApp_applicationId_idx" ON "RationalizationApp"("applicationId");

-- AddForeignKey
ALTER TABLE "RationalizationApp" ADD CONSTRAINT "RationalizationApp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
