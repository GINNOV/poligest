/*
  Warnings:

  - You are about to drop the column `doctorId` on the `CashAdvance` table. All the data in the column will be lost.
  - Added the required column `patientId` to the `CashAdvance` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CashAdvance" DROP CONSTRAINT "CashAdvance_doctorId_fkey";

-- DropIndex
DROP INDEX "CashAdvance_doctorId_idx";

-- AlterTable
ALTER TABLE "CashAdvance" DROP COLUMN "doctorId",
ADD COLUMN     "patientId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "CashAdvance_patientId_idx" ON "CashAdvance"("patientId");

-- AddForeignKey
ALTER TABLE "CashAdvance" ADD CONSTRAINT "CashAdvance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
