-- CreateTable
CREATE TABLE "KapsoWhatsAppConfig" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KapsoWhatsAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KapsoWhatsAppConfig_updatedAt_idx" ON "KapsoWhatsAppConfig"("updatedAt");