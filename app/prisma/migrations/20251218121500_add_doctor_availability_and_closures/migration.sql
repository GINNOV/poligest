-- CreateEnum
CREATE TYPE "PracticeClosureType" AS ENUM ('HOLIDAY', 'TIME_OFF');

-- CreateTable
CREATE TABLE "DoctorAvailabilityWindow" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeClosure" (
    "id" TEXT NOT NULL,
    "type" "PracticeClosureType" NOT NULL DEFAULT 'HOLIDAY',
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_availability_unique" ON "DoctorAvailabilityWindow"("doctorId", "dayOfWeek", "startMinute", "endMinute");

-- CreateIndex
CREATE INDEX "DoctorAvailabilityWindow_doctorId_idx" ON "DoctorAvailabilityWindow"("doctorId");

-- CreateIndex
CREATE INDEX "PracticeClosure_startsAt_idx" ON "PracticeClosure"("startsAt");

-- CreateIndex
CREATE INDEX "PracticeClosure_endsAt_idx" ON "PracticeClosure"("endsAt");

-- AddForeignKey
ALTER TABLE "DoctorAvailabilityWindow" ADD CONSTRAINT "DoctorAvailabilityWindow_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

