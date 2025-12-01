-- Add optional photo URL to patients
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
