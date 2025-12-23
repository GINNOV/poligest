-- CreateEnum
CREATE TYPE "RecurringMessageKind" AS ENUM ('HOLIDAY', 'CLOSURE', 'BIRTHDAY');

-- CreateEnum
CREATE TYPE "RecurringMessageStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "RecurringMessageConfig" (
    "id" TEXT NOT NULL,
    "kind" "RecurringMessageKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "daysBefore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringMessageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringMessageLog" (
    "id" TEXT NOT NULL,
    "kind" "RecurringMessageKind" NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "eventDate" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "status" "RecurringMessageStatus" NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringMessageConfig_kind_key" ON "RecurringMessageConfig"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringMessageLog_dedupeKey_key" ON "RecurringMessageLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "RecurringMessageLog_kind_scheduledFor_idx" ON "RecurringMessageLog"("kind", "scheduledFor");

-- CreateIndex
CREATE INDEX "RecurringMessageLog_patientId_idx" ON "RecurringMessageLog"("patientId");

-- AddForeignKey
ALTER TABLE "RecurringMessageLog" ADD CONSTRAINT "RecurringMessageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
