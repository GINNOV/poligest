-- Add gender to Patient with default.
ALTER TABLE "Patient" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'NOT_SPECIFIED';
