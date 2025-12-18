-- CreateTable
CREATE TABLE "PracticeWeeklyClosure" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeWeeklyClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeWeeklyClosure_dayOfWeek_key" ON "PracticeWeeklyClosure"("dayOfWeek");

-- CreateIndex
CREATE INDEX "PracticeWeeklyClosure_isActive_idx" ON "PracticeWeeklyClosure"("isActive");

