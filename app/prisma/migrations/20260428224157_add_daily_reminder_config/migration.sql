-- CreateTable
CREATE TABLE "DailyReminderConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sendTimeMinutes" INTEGER NOT NULL DEFAULT 1230,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReminderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReminderLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "RecurringMessageStatus" NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReminderLog_userId_date_idx" ON "DailyReminderLog"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyReminderLog_createdAt_idx" ON "DailyReminderLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DailyReminderLog" ADD CONSTRAINT "DailyReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
