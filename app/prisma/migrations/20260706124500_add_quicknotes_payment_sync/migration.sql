CREATE TABLE "QuickNotesPaymentSync" (
    "id" TEXT NOT NULL,
    "quickNotesTransactionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientPaymentId" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickNotesPaymentSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuickNotesPaymentSync_quickNotesTransactionId_key"
  ON "QuickNotesPaymentSync"("quickNotesTransactionId");

CREATE INDEX "QuickNotesPaymentSync_patientId_idx"
  ON "QuickNotesPaymentSync"("patientId");

CREATE INDEX "QuickNotesPaymentSync_patientPaymentId_idx"
  ON "QuickNotesPaymentSync"("patientPaymentId");

CREATE INDEX "QuickNotesPaymentSync_financeEntryId_idx"
  ON "QuickNotesPaymentSync"("financeEntryId");
