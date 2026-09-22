-- AlterTable
ALTER TABLE "FeatureInstruction" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENERALE';
ALTER TABLE "FeatureInstruction" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FeatureInstructionStep" ADD COLUMN "youtubeUrl" TEXT;

-- CreateIndex
CREATE INDEX "FeatureInstructionStep_instructionId_sortOrder_idx" ON "FeatureInstructionStep"("instructionId", "sortOrder");
