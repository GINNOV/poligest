-- CreateEnum
CREATE TYPE "PracticeWeeklyReportStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "PracticeWeeklyReportConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "recipientEmails" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeWeeklyReportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeWeeklyReportLog" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "status" "PracticeWeeklyReportStatus" NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'CRON',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeWeeklyReportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeWeeklyReportLog_dedupeKey_status_idx" ON "PracticeWeeklyReportLog"("dedupeKey", "status");

-- CreateIndex
CREATE INDEX "PracticeWeeklyReportLog_createdAt_idx" ON "PracticeWeeklyReportLog"("createdAt");
