ALTER TABLE "Quote"
ADD COLUMN "serviceDate" TIMESTAMP(3);

UPDATE "Quote"
SET "serviceDate" = COALESCE("signedAt", "createdAt")
WHERE "serviceDate" IS NULL;

ALTER TABLE "Quote"
ALTER COLUMN "serviceDate" SET NOT NULL;
