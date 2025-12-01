-- Set PATIENT as default role for new users
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PATIENT';
