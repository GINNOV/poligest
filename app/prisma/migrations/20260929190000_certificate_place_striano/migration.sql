ALTER TABLE "MedicalCertificate" ALTER COLUMN "place" SET DEFAULT 'STRIANO (SA)';

UPDATE "MedicalCertificate"
SET "place" = 'STRIANO (SA)'
WHERE "place" IN ('San Valentino Torio (SA)', 'STRIANO');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'demo' AND table_name = 'MedicalCertificate'
  ) THEN
    ALTER TABLE demo."MedicalCertificate" ALTER COLUMN "place" SET DEFAULT 'STRIANO (SA)';
    UPDATE demo."MedicalCertificate"
    SET "place" = 'STRIANO (SA)'
    WHERE "place" IN ('San Valentino Torio (SA)', 'STRIANO');
  END IF;
END $$;
