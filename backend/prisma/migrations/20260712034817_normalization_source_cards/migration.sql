-- AlterTable
ALTER TABLE "NormalizationEntry" ADD COLUMN     "sourceCards" JSONB;

-- AlterTable
ALTER TABLE "ProductModelNormalizationEntry" ADD COLUMN     "sourceCards" JSONB;
