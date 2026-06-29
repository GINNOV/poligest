ALTER TABLE "DailyReminderConfig"
ADD COLUMN "bccEmail" TEXT DEFAULT 'studio.agovino.angrisano@gmail.com';

UPDATE "DailyReminderConfig"
SET "bccEmail" = 'studio.agovino.angrisano@gmail.com'
WHERE "bccEmail" IS NULL;