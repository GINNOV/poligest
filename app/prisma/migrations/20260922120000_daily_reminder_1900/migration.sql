ALTER TABLE "DailyReminderConfig" ALTER COLUMN "sendTimeMinutes" SET DEFAULT 1140;

UPDATE "DailyReminderConfig"
SET "sendTimeMinutes" = 1140
WHERE "id" = 'default' AND "sendTimeMinutes" IN (1200, 1230);
