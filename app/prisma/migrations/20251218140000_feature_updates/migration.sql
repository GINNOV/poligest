-- CreateTable
CREATE TABLE "FeatureUpdate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureUpdateDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureUpdateId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureUpdateDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureUpdate_isActive_createdAt_idx" ON "FeatureUpdate"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_feature_update_unique" ON "FeatureUpdateDismissal"("userId", "featureUpdateId");

-- CreateIndex
CREATE INDEX "FeatureUpdateDismissal_featureUpdateId_idx" ON "FeatureUpdateDismissal"("featureUpdateId");

-- CreateIndex
CREATE INDEX "FeatureUpdateDismissal_userId_idx" ON "FeatureUpdateDismissal"("userId");

-- AddForeignKey
ALTER TABLE "FeatureUpdateDismissal" ADD CONSTRAINT "FeatureUpdateDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureUpdateDismissal" ADD CONSTRAINT "FeatureUpdateDismissal_featureUpdateId_fkey" FOREIGN KEY ("featureUpdateId") REFERENCES "FeatureUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

