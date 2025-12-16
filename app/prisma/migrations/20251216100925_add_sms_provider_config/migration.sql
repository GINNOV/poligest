-- CreateTable
CREATE TABLE "SmsProviderConfig" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "from" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsProviderConfig_createdAt_idx" ON "SmsProviderConfig"("createdAt");
