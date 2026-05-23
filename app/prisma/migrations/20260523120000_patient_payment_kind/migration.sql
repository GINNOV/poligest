CREATE TYPE "PatientPaymentKind" AS ENUM ('STANDARD', 'DOWNPAYMENT');

ALTER TABLE "PatientPayment"
ADD COLUMN "kind" "PatientPaymentKind" NOT NULL DEFAULT 'STANDARD';
