-- AlterTable
ALTER TABLE "DailyReminderConfig" ADD COLUMN     "targetRoles" "Role"[] DEFAULT ARRAY['ADMIN', 'MANAGER', 'ASSISTANT', 'SECRETARY']::"Role"[];
