ALTER TABLE "QuoteItem"
ADD COLUMN "dentalRecordId" TEXT;

CREATE UNIQUE INDEX "QuoteItem_dentalRecordId_key"
ON "QuoteItem"("dentalRecordId");

ALTER TABLE "QuoteItem"
ADD CONSTRAINT "QuoteItem_dentalRecordId_fkey"
FOREIGN KEY ("dentalRecordId") REFERENCES "DentalRecord"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
