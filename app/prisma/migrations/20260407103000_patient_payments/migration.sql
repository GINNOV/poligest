CREATE TYPE "PatientPaymentMethod" AS ENUM ('CASH', 'ELECTRONIC', 'BANK_TRANSFER', 'OTHER');

CREATE TABLE "PatientPayment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "quoteId" TEXT,
    "quoteItemId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "PatientPaymentMethod" NOT NULL DEFAULT 'ELECTRONIC',
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientPayment_patientId_paidAt_idx" ON "PatientPayment"("patientId", "paidAt");
CREATE INDEX "PatientPayment_quoteId_idx" ON "PatientPayment"("quoteId");
CREATE INDEX "PatientPayment_quoteItemId_idx" ON "PatientPayment"("quoteItemId");
CREATE INDEX "PatientPayment_userId_idx" ON "PatientPayment"("userId");

ALTER TABLE "PatientPayment"
  ADD CONSTRAINT "PatientPayment_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PatientPayment"
  ADD CONSTRAINT "PatientPayment_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientPayment"
  ADD CONSTRAINT "PatientPayment_quoteItemId_fkey"
  FOREIGN KEY ("quoteItemId") REFERENCES "QuoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientPayment"
  ADD CONSTRAINT "PatientPayment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
