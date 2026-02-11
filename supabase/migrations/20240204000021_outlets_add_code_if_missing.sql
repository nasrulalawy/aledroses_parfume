-- Pastikan kolom yang dipakai app ada di outlets (bisa hilang jika DB dibuat tanpa migrasi penuh)
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE outlets
  ADD COLUMN IF NOT EXISTS outlet_type TEXT NOT NULL DEFAULT 'parfume';
-- Constraint hanya tambah kalau belum ada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outlets_outlet_type_check'
  ) THEN
    ALTER TABLE outlets ADD CONSTRAINT outlets_outlet_type_check
      CHECK (outlet_type IN ('barbershop', 'parfume'));
  END IF;
END $$;
