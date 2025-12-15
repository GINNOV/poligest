-- CreateTable
CREATE TABLE "RoleFeatureAccess" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "feature" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoleFeatureAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleFeatureAccess_role_feature_unique" ON "RoleFeatureAccess"("role", "feature");
