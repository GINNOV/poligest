CREATE TABLE "PracticeSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSetting_pkey" PRIMARY KEY ("id")
);
