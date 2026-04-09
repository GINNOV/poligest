ALTER TABLE "QuoteItem"
ADD COLUMN "serviceDate" TIMESTAMP(3);

UPDATE "QuoteItem" qi
SET "serviceDate" = COALESCE(qi."serviceDate", q."serviceDate", qi."createdAt", q."createdAt")
FROM "Quote" q
WHERE qi."quoteId" = q."id"
  AND qi."serviceDate" IS NULL;

ALTER TABLE "QuoteItem"
ALTER COLUMN "serviceDate" SET NOT NULL;
