-- AlterTable
ALTER TABLE "RegulatoryRequirement" ADD COLUMN     "complianceFlagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "RegulatoryRequirement_companyId_complianceFlagged_idx" ON "RegulatoryRequirement"("companyId", "complianceFlagged");
