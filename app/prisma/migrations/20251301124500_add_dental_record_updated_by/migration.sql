-- Add updatedById to DentalRecord
ALTER TABLE "DentalRecord" ADD COLUMN "updatedById" TEXT;

-- Index
CREATE INDEX "DentalRecord_updatedById_idx" ON "DentalRecord"("updatedById");

-- Foreign key
ALTER TABLE "DentalRecord" ADD CONSTRAINT "DentalRecord_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
