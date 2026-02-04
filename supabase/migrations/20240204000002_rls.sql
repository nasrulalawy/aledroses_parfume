-- Helper: get current user's role from profiles
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flows ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read own profile; super_admin can read/update all
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile name" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admin can read all profiles" ON profiles
  FOR SELECT USING (public.user_role() = 'super_admin');

CREATE POLICY "Super admin can update all profiles" ON profiles
  FOR UPDATE USING (public.user_role() = 'super_admin');

-- Employees: super_admin and manager full access; karyawan read own
CREATE POLICY "Super admin all employees" ON employees
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Manager read employees" ON employees
  FOR SELECT USING (public.user_role() = 'manager');

CREATE POLICY "Manager insert update employees" ON employees
  FOR INSERT WITH CHECK (public.user_role() = 'manager');
CREATE POLICY "Manager update employees" ON employees
  FOR UPDATE USING (public.user_role() = 'manager');

CREATE POLICY "Karyawan read own employee" ON employees
  FOR SELECT USING (
    profile_id = auth.uid() OR id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

-- Categories: all authenticated can read; super_admin and manager can write
CREATE POLICY "Authenticated read categories" ON categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manager manage categories" ON categories
  FOR ALL USING (public.user_role() IN ('super_admin', 'manager'));

-- Products: same as categories
CREATE POLICY "Authenticated read products" ON products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manager manage products" ON products
  FOR ALL USING (public.user_role() IN ('super_admin', 'manager'));

-- Shifts: own shifts or super_admin/manager
CREATE POLICY "Read own shifts" ON shifts
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR public.user_role() IN ('super_admin', 'manager')
  );

CREATE POLICY "Insert own shift" ON shifts
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Update own shift or by manager" ON shifts
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR public.user_role() IN ('super_admin', 'manager')
  );

-- Transactions: employee who created, or manager/super_admin
CREATE POLICY "Read transactions" ON transactions
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR public.user_role() IN ('super_admin', 'manager')
  );

CREATE POLICY "Insert transactions" ON transactions
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Update transactions manager only" ON transactions
  FOR UPDATE USING (public.user_role() IN ('super_admin', 'manager'));

-- Transaction items: follow transaction access
CREATE POLICY "Read transaction_items" ON transaction_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (t.employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
           OR public.user_role() IN ('super_admin', 'manager'))
    )
  );

CREATE POLICY "Insert transaction_items" ON transaction_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
      AND t.employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    )
  );

-- Attendances: own or manager/super_admin
CREATE POLICY "Read attendances" ON attendances
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR public.user_role() IN ('super_admin', 'manager')
  );

CREATE POLICY "Insert own attendance" ON attendances
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Update attendances" ON attendances
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR public.user_role() IN ('super_admin', 'manager')
  );

-- Cash flows: super_admin and manager full; karyawan read only
CREATE POLICY "Read cash_flows" ON cash_flows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manager update delete cash_flows" ON cash_flows
  FOR UPDATE USING (public.user_role() IN ('super_admin', 'manager'));

CREATE POLICY "Super admin manager delete cash_flows" ON cash_flows
  FOR DELETE USING (public.user_role() IN ('super_admin', 'manager'));

-- Insert: all authenticated (POS creates penjualan; manager/super_admin add manual)
CREATE POLICY "Authenticated insert cash_flows" ON cash_flows
  FOR INSERT TO authenticated WITH CHECK (true);
