-- Practice setting for opt-in auto-merge of empty-shell duplicates
ALTER TABLE "PracticeSetting" ADD COLUMN IF NOT EXISTS "autoMergeEmptyDuplicates" BOOLEAN NOT NULL DEFAULT false;

-- First-class codice fiscale on Patient
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "taxId" TEXT;

-- Backfill from structured notes when present
UPDATE "Patient"
SET "taxId" = UPPER(substring(notes from 'Codice Fiscale:\s*([A-Za-z0-9]{16})'))
WHERE "taxId" IS NULL
  AND notes ~* 'Codice Fiscale:\s*[A-Za-z0-9]{16}';

-- Keep oldest patient per taxId; clear others so unique index can apply
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "taxId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Patient"
  WHERE "taxId" IS NOT NULL
)
UPDATE "Patient" p
SET "taxId" = NULL
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Patient_taxId_key" ON "Patient"("taxId");
CREATE INDEX IF NOT EXISTS "Patient_taxId_idx" ON "Patient"("taxId");
