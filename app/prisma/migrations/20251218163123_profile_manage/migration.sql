/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `personalPin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `UserAward` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserAward" DROP CONSTRAINT "UserAward_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "UserAward" DROP CONSTRAINT "UserAward_userId_fkey";

-- DropIndex
DROP INDEX "User_personalPin_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
DROP COLUMN "gender",
DROP COLUMN "personalPin";

-- DropTable
DROP TABLE "UserAward";

-- DropEnum
DROP TYPE "Gender";

-- RenameIndex
ALTER INDEX "user_feature_update_unique" RENAME TO "FeatureUpdateDismissal_userId_featureUpdateId_key";
