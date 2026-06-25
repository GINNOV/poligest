-- CreateTable
CREATE TABLE "DoctorTimeOff" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorTimeOff_doctorId_idx" ON "DoctorTimeOff"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorTimeOff_startsAt_idx" ON "DoctorTimeOff"("startsAt");

-- CreateIndex
CREATE INDEX "DoctorTimeOff_endsAt_idx" ON "DoctorTimeOff"("endsAt");

-- AddForeignKey
ALTER TABLE "DoctorTimeOff" ADD CONSTRAINT "DoctorTimeOff_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;