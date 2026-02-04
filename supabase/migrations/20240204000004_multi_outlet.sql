-- Multi-outlet: tabel outlet + outlet_id pada tabel terkait
-- Super admin bisa tambah outlet; manager/kasir terikat satu outlet; data sepenuhnya terpisah per outlet.

-- 1. Tabel outlets
CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER outlets_updated_at BEFORE UPDATE ON outlets
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- 2. Outlet default (untuk data lama)
INSERT INTO outlets (id, name, code, is_active)
VALUES (uuid_generate_v4(), 'Outlet Utama', 'OUT001', true);

-- 3. Tambah outlet_id ke employees (wajib untuk manager & kasir)
ALTER TABLE employees ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT;
UPDATE employees e SET outlet_id = (SELECT id FROM outlets LIMIT 1) WHERE outlet_id IS NULL;
-- Biarkan nullable untuk backward compat; super_admin bisa punya employee tanpa outlet

-- 4. Tambah outlet_id ke categories
ALTER TABLE categories ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT;
UPDATE categories SET outlet_id = (SELECT id FROM outlets LIMIT 1);
ALTER TABLE categories ALTER COLUMN outlet_id SET NOT NULL;

-- 5. Tambah outlet_id ke products; SKU unik per outlet
ALTER TABLE products ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT;
UPDATE products SET outlet_id = (SELECT id FROM outlets LIMIT 1);
ALTER TABLE products ALTER COLUMN outlet_id SET NOT NULL;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX products_outlet_sku_key ON products (outlet_id, sku);

-- 6. Tambah outlet_id ke cash_flows (untuk entri manual; kalau dari shift bisa dari employee)
ALTER TABLE cash_flows ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT;
UPDATE cash_flows cf SET outlet_id = (
  SELECT e.outlet_id FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE s.id = cf.shift_id LIMIT 1
);
UPDATE cash_flows SET outlet_id = (SELECT id FROM outlets LIMIT 1) WHERE outlet_id IS NULL;
ALTER TABLE cash_flows ALTER COLUMN outlet_id SET NOT NULL;

-- 7. Tambah outlet_id ke transactions (denormalize agar filter per outlet mudah)
ALTER TABLE transactions ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT;
UPDATE transactions t SET outlet_id = (SELECT e.outlet_id FROM employees e WHERE e.id = t.employee_id LIMIT 1);
ALTER TABLE transactions ALTER COLUMN outlet_id SET NOT NULL;
CREATE INDEX idx_transactions_outlet_id ON transactions(outlet_id);

-- 7b. Tambah outlet_id ke shifts (denormalize)
ALTER TABLE shifts ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT;
UPDATE shifts s SET outlet_id = (SELECT e.outlet_id FROM employees e WHERE e.id = s.employee_id LIMIT 1);
ALTER TABLE shifts ALTER COLUMN outlet_id SET NOT NULL;
CREATE INDEX idx_shifts_outlet_id ON shifts(outlet_id);

-- 7c. Tambah outlet_id ke attendances (denormalize)
ALTER TABLE attendances ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE RESTRICT;
UPDATE attendances a SET outlet_id = (SELECT e.outlet_id FROM employees e WHERE e.id = a.employee_id LIMIT 1);
ALTER TABLE attendances ALTER COLUMN outlet_id SET NOT NULL;
CREATE INDEX idx_attendances_outlet_id ON attendances(outlet_id);

-- 8. Helper: outlet_id user saat ini (dari employee). Super_admin = NULL (lihat semua)
CREATE OR REPLACE FUNCTION public.my_outlet_id()
RETURNS UUID AS $$
  SELECT e.outlet_id FROM public.employees e
  JOIN public.profiles p ON p.employee_id = e.id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 9. Enable RLS outlets
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

-- Outlets: super_admin full; manager baca saja outlet sendiri
CREATE POLICY "Super admin all outlets" ON outlets
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Manager read own outlet" ON outlets
  FOR SELECT USING (
    public.user_role() = 'manager' AND id = public.my_outlet_id()
  );
