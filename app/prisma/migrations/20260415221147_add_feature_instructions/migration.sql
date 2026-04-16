-- CreateTable
CREATE TABLE "FeatureInstruction" (
    "id" TEXT NOT NULL,
    "pathPattern" TEXT NOT NULL,
    "role" "Role",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureInstructionStep" (
    "id" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureInstructionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstructionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "lastStepId" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInstructionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureInstruction_pathPattern_idx" ON "FeatureInstruction"("pathPattern");

-- CreateIndex
CREATE INDEX "FeatureInstructionStep_instructionId_idx" ON "FeatureInstructionStep"("instructionId");

-- CreateIndex
CREATE INDEX "UserInstructionProgress_userId_idx" ON "UserInstructionProgress"("userId");

-- CreateIndex
CREATE INDEX "UserInstructionProgress_instructionId_idx" ON "UserInstructionProgress"("instructionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInstructionProgress_userId_instructionId_key" ON "UserInstructionProgress"("userId", "instructionId");

-- AddForeignKey
ALTER TABLE "FeatureInstructionStep" ADD CONSTRAINT "FeatureInstructionStep_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "FeatureInstruction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstructionProgress" ADD CONSTRAINT "UserInstructionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstructionProgress" ADD CONSTRAINT "UserInstructionProgress_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "FeatureInstruction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstructionProgress" ADD CONSTRAINT "UserInstructionProgress_lastStepId_fkey" FOREIGN KEY ("lastStepId") REFERENCES "FeatureInstructionStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
