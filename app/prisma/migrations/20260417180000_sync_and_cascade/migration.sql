-- AlterTable
-- We wrap these in a sub-block to avoid failure if they already exist, 
-- but Prisma needs them in the migration history to match the schema.
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "method" "PatientPaymentMethod";
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "patientId" TEXT;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "isManualAdjustment" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
-- Prisma doesn't support CREATE INDEX IF NOT EXISTS in all versions but we can try
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'FinanceEntry_patientId_idx' AND n.nspname = 'public') THEN
        CREATE INDEX "FinanceEntry_patientId_idx" ON "FinanceEntry"("patientId");
    END IF;
END$$;

-- Update foreign keys to use Cascade Delete
-- We use a DO block to safely drop constraints only if they exist

DO $$
BEGIN
    -- SmsLog
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SmsLog_patientId_fkey') THEN
        ALTER TABLE "SmsLog" DROP CONSTRAINT "SmsLog_patientId_fkey";
    END IF;
    -- RecurringMessageLog
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'RecurringMessageLog_patientId_fkey') THEN
        ALTER TABLE "RecurringMessageLog" DROP CONSTRAINT "RecurringMessageLog_patientId_fkey";
    END IF;
    -- PatientConsent
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PatientConsent_patientId_fkey') THEN
        ALTER TABLE "PatientConsent" DROP CONSTRAINT "PatientConsent_patientId_fkey";
    END IF;
    -- Appointment
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Appointment_patientId_fkey') THEN
        ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";
    END IF;
    -- ClinicalNote
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ClinicalNote_patientId_fkey') THEN
        ALTER TABLE "ClinicalNote" DROP CONSTRAINT "ClinicalNote_patientId_fkey";
    END IF;
    -- DentalRecord
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DentalRecord_patientId_fkey') THEN
        ALTER TABLE "DentalRecord" DROP CONSTRAINT "DentalRecord_patientId_fkey";
    END IF;
    -- StockMovement
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'StockMovement_patientId_fkey') THEN
        ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_patientId_fkey";
    END IF;
    -- FinanceEntry
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FinanceEntry_patientId_fkey') THEN
        ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_patientId_fkey";
    END IF;
    -- CashAdvance
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CashAdvance_patientId_fkey') THEN
        ALTER TABLE "CashAdvance" DROP CONSTRAINT "CashAdvance_patientId_fkey";
    END IF;
    -- Recall
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Recall_patientId_fkey') THEN
        ALTER TABLE "Recall" DROP CONSTRAINT "Recall_patientId_fkey";
    END IF;
    -- Quote
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Quote_patientId_fkey') THEN
        ALTER TABLE "Quote" DROP CONSTRAINT "Quote_patientId_fkey";
    END IF;
    -- QuoteItem
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'QuoteItem_quoteId_fkey') THEN
        ALTER TABLE "QuoteItem" DROP CONSTRAINT "QuoteItem_quoteId_fkey";
    END IF;
    -- PatientPayment
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PatientPayment_patientId_fkey') THEN
        ALTER TABLE "PatientPayment" DROP CONSTRAINT "PatientPayment_patientId_fkey";
    END IF;
END$$;

-- Re-add constraints with ON DELETE CASCADE
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringMessageLog" ADD CONSTRAINT "RecurringMessageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DentalRecord" ADD CONSTRAINT "DentalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashAdvance" ADD CONSTRAINT "CashAdvance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientPayment" ADD CONSTRAINT "PatientPayment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
