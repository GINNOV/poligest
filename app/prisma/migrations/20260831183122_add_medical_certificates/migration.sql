-- AlterTable
ALTER TABLE "DailyReminderConfig" ALTER COLUMN "sendTimeMinutes" SET DEFAULT 1200,
ALTER COLUMN "targetRoles" SET DEFAULT ARRAY['MANAGER', 'ADMIN']::"Role"[];

-- CreateTable
CREATE TABLE "MedicalCertificate" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rootCertificateId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "doctorName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "diagnosis" TEXT,
    "prognosisDays" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "place" TEXT NOT NULL DEFAULT 'San Valentino Torio (SA)',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicalCertificate_patientId_idx" ON "MedicalCertificate"("patientId");

-- CreateIndex
CREATE INDEX "MedicalCertificate_certificateNumber_idx" ON "MedicalCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "MedicalCertificate_rootCertificateId_idx" ON "MedicalCertificate"("rootCertificateId");

-- CreateIndex
CREATE INDEX "MedicalCertificate_issuedAt_idx" ON "MedicalCertificate"("issuedAt");

-- AddForeignKey
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
