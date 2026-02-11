-- organization_id di outlets boleh NULL agar insert dari app (tanpa kirim organization_id) tidak error
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outlets' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE outlets ALTER COLUMN organization_id DROP NOT NULL;
  END IF;
END $$;
