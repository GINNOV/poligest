/*
  Warnings:

  - You are about to drop the `Consent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Consent" DROP CONSTRAINT "Consent_patientId_fkey";

-- DropTable
DROP TABLE "Consent";

-- DropEnum
DROP TYPE "ConsentType";

-- CreateTable
CREATE TABLE "ConsentModule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientConsent" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "channel" TEXT,
    "signatureUrl" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedOn" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "place" TEXT,
    "patientName" TEXT,
    "doctorName" TEXT,
    "patientId" TEXT NOT NULL,

    CONSTRAINT "PatientConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsentModule_name_key" ON "ConsentModule"("name");

-- CreateIndex
CREATE INDEX "PatientConsent_patientId_moduleId_idx" ON "PatientConsent"("patientId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientConsent_patientId_moduleId_key" ON "PatientConsent"("patientId", "moduleId");

-- AddForeignKey
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ConsentModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
