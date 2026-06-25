-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "RecallRule" ALTER COLUMN "channel" SET DEFAULT 'WHATSAPP';
ALTER TABLE "AppointmentReminderRule" ALTER COLUMN "channel" SET DEFAULT 'WHATSAPP';