-- Persentase bagi hasil per karyawan (dari keuntungan penjualan yang diatribusikan ke mereka)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS profit_share_percent NUMERIC(5,2) CHECK (profit_share_percent IS NULL OR (profit_share_percent >= 0 AND profit_share_percent <= 100));

COMMENT ON COLUMN employees.profit_share_percent IS 'Persen dari keuntungan (profit) penjualan yang jadi hak karyawan; dipakai bila compensation_type = bagi_hasil. Contoh: 30 = 30%.';
