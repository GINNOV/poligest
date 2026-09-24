-- AlterTable
ALTER TABLE "User" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "demoPassword" TEXT;

-- The fictional clinic lives in schema demo. demo_app can use those tables and
-- cannot read or write the live clinic. Prisma SQL is rewritten onto demo
-- tables for that role; enum types stay in public.
CREATE OR REPLACE FUNCTION sync_demo_schema() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  col RECORD;
  def TEXT;
  table_has_rows BOOLEAN;
BEGIN
  CREATE SCHEMA IF NOT EXISTS demo;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demo_app') THEN
    CREATE ROLE demo_app NOLOGIN NOINHERIT;
  END IF;

  FOR rec IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'demo' AND tablename = rec.tablename
    ) THEN
      EXECUTE format(
        'CREATE TABLE demo.%I (LIKE public.%I INCLUDING ALL)',
        rec.tablename,
        rec.tablename
      );
    END IF;
  END LOOP;

  FOR col IN
    SELECT
      c.table_name,
      c.column_name,
      c.is_nullable,
      c.column_default,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS format_type
    FROM information_schema.columns c
    JOIN pg_class cls ON cls.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name AND NOT a.attisdropped
    WHERE c.table_schema = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns d
        WHERE d.table_schema = 'demo'
          AND d.table_name = c.table_name
          AND d.column_name = c.column_name
      )
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM demo.%I LIMIT 1)', col.table_name)
      INTO table_has_rows;
    IF col.is_nullable = 'NO' AND col.column_default IS NULL AND table_has_rows THEN
      EXECUTE format(
        'ALTER TABLE demo.%I ADD COLUMN %I %s NULL',
        col.table_name,
        col.column_name,
        col.format_type
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE demo.%I ADD COLUMN %I %s %s %s',
        col.table_name,
        col.column_name,
        col.format_type,
        CASE WHEN col.column_default IS NOT NULL THEN 'DEFAULT ' || col.column_default ELSE '' END,
        CASE WHEN col.is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END
      );
    END IF;
  END LOOP;

  FOR rec IN
    SELECT con.conname, src.relname AS table_name, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = src.relnamespace
    WHERE ns.nspname = 'public' AND con.contype = 'f'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class s ON s.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = s.relnamespace
      WHERE n.nspname = 'demo' AND c.conname = rec.conname
    ) THEN
      def := replace(rec.def, 'REFERENCES ', 'REFERENCES demo.');
      BEGIN
        EXECUTE format(
          'ALTER TABLE demo.%I ADD CONSTRAINT %I %s',
          rec.table_name,
          rec.conname,
          def
        );
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END IF;
  END LOOP;

  EXECUTE 'GRANT USAGE ON SCHEMA public TO demo_app';
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM demo_app';
  EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM demo_app';
  EXECUTE 'GRANT USAGE ON SCHEMA demo TO demo_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA demo TO demo_app';
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA demo TO demo_app';
  EXECUTE 'GRANT demo_app TO CURRENT_USER';
END;
$$;

SELECT sync_demo_schema();
