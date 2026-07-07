-- AlterTable
ALTER TABLE "RationalizationWorkspace" ADD COLUMN     "applicationId" TEXT;

-- CreateIndex
CREATE INDEX "RationalizationWorkspace_applicationId_idx" ON "RationalizationWorkspace"("applicationId");

-- AddForeignKey
ALTER TABLE "RationalizationWorkspace" ADD CONSTRAINT "RationalizationWorkspace_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
