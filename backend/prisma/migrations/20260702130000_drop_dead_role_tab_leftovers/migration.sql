-- DropForeignKey
ALTER TABLE "RoleDottedLine" DROP CONSTRAINT "RoleDottedLine_managerRoleId_fkey";

-- DropForeignKey
ALTER TABLE "RoleDottedLine" DROP CONSTRAINT "RoleDottedLine_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserPreference" DROP CONSTRAINT "UserPreference_roleId_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "jobDescription";

-- DropTable
DROP TABLE "RoleDottedLine";

-- DropTable
DROP TABLE "UserPreference";

