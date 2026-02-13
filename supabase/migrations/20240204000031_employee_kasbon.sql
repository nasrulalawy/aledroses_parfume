-- Kasbon karyawan: pinjaman/uang muka gaji untuk karyawan
-- Tambah kategori kasbon_karyawan ke cash_flow_category
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'cash_flow_category' AND e.enumlabel = 'kasbon_karyawan') THEN
    ALTER TYPE cash_flow_category ADD VALUE 'kasbon_karyawan';
  END IF;
END $$;

-- Tabel kasbon karyawan
CREATE TABLE IF NOT EXISTS employee_kasbon (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_kasbon_outlet_id ON employee_kasbon(outlet_id);
CREATE INDEX IF NOT EXISTS idx_employee_kasbon_employee_id ON employee_kasbon(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_kasbon_created_at ON employee_kasbon(created_at);

ALTER TABLE employee_kasbon ENABLE ROW LEVEL SECURITY;

-- Super admin: semua akses
CREATE POLICY "Super admin all employee_kasbon" ON employee_kasbon
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Manager: baca/tambah/edit/hapus kasbon outlet sendiri
CREATE POLICY "Manager read employee_kasbon outlet" ON employee_kasbon
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p JOIN employees e ON e.profile_id = p.id WHERE p.id = auth.uid() AND p.role = 'manager' AND e.outlet_id = employee_kasbon.outlet_id)
  );
CREATE POLICY "Manager insert employee_kasbon" ON employee_kasbon
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p JOIN employees e ON e.profile_id = p.id WHERE p.id = auth.uid() AND p.role = 'manager' AND e.outlet_id = employee_kasbon.outlet_id)
  );
CREATE POLICY "Manager update delete employee_kasbon" ON employee_kasbon
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p JOIN employees e ON e.profile_id = p.id WHERE p.id = auth.uid() AND p.role = 'manager' AND e.outlet_id = employee_kasbon.outlet_id)
  );

-- Karyawan: hanya baca kasbon sendiri
CREATE POLICY "Karyawan read own employee_kasbon" ON employee_kasbon
  FOR SELECT USING (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

COMMENT ON TABLE employee_kasbon IS 'Kasbon (pinjaman/uang muka gaji) untuk karyawan';
