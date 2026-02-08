-- Tipe outlet: barbershop (wajib pilih barber di POS) vs parfume (biasa)
ALTER TABLE outlets
  ADD COLUMN IF NOT EXISTS outlet_type TEXT NOT NULL DEFAULT 'parfume'
  CHECK (outlet_type IN ('barbershop', 'parfume'));

COMMENT ON COLUMN outlets.outlet_type IS 'barbershop = penjualan dicatat ke barber yang dipilih di POS; parfume = tidak perlu barber';

-- Tipe karyawan: barber (untuk outlet barbershop, dipilih di POS) vs staff (kasir/manager)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_type TEXT NOT NULL DEFAULT 'staff'
  CHECK (employee_type IN ('barber', 'staff'));

COMMENT ON COLUMN employees.employee_type IS 'barber = bisa dipilih di POS outlet barbershop untuk atribusi penjualan; staff = kasir/manager';

-- Transaksi: barber_id = karyawan (barber) yang dapat kredit penjualan (hanya untuk outlet barbershop)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_barber_id ON transactions(barber_id);

COMMENT ON COLUMN transactions.barber_id IS 'Untuk outlet barbershop: barber yang melayani/mendapat kredit penjualan; NULL untuk parfume atau transaksi lama';
