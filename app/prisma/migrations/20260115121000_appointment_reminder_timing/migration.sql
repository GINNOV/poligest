ALTER TABLE "AppointmentReminderRule"
ADD COLUMN     "timingType" TEXT NOT NULL DEFAULT 'DAYS_BEFORE',
ADD COLUMN     "timeOfDayMinutes" INTEGER;
