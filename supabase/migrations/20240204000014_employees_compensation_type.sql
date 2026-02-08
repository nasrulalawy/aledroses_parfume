-- Tipe kompensasi karyawan: gaji (tetap) atau bagi hasil
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS compensation_type TEXT NOT NULL DEFAULT 'gaji'
    CHECK (compensation_type IN ('gaji', 'bagi_hasil'));

COMMENT ON COLUMN employees.compensation_type IS 'gaji = gaji tetap, bagi_hasil = profit sharing';
