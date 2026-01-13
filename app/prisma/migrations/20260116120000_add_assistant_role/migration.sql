-- Add Assistant role to existing Role enum.
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ASSISTANT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
