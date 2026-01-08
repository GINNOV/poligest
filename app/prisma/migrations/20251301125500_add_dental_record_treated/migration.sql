-- Add treated flag to DentalRecord
ALTER TABLE "DentalRecord" ADD COLUMN "treated" BOOLEAN NOT NULL DEFAULT false;
