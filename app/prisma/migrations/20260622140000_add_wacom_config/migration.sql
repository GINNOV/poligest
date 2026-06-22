-- CreateTable
CREATE TABLE "WacomConfig" (
    "id" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "licenseSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WacomConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WacomConfig_createdAt_idx" ON "WacomConfig"("createdAt");