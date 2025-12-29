-- Ensure enum exists for shadow DBs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN
        CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'BOTH');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecallStatus') THEN
        CREATE TYPE "RecallStatus" AS ENUM ('PENDING', 'CONTACTED', 'COMPLETED', 'SKIPPED');
    END IF;
END $$;

-- Create appointment reminder rules
CREATE TABLE "AppointmentReminderRule" (
    "id" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "emailSubject" TEXT,
    "message" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminderRule_pkey" PRIMARY KEY ("id")
);

-- Create appointment reminders
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "RecallStatus" NOT NULL DEFAULT 'PENDING',
    "lastContactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_ruleId_key" ON "AppointmentReminder"("appointmentId", "ruleId");
CREATE INDEX "AppointmentReminder_dueAt_idx" ON "AppointmentReminder"("dueAt");
CREATE INDEX "AppointmentReminder_status_idx" ON "AppointmentReminder"("status");

-- Foreign keys
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "AppointmentReminderRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
