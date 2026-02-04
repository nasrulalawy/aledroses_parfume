-- RLS: scope semua data per outlet. Super_admin lihat semua; manager/kasir hanya outlet mereka.

-- Employees: super_admin semua; manager hanya outlet sendiri; kasir baca own
DROP POLICY IF EXISTS "Super admin all employees" ON employees;
DROP POLICY IF EXISTS "Manager read employees" ON employees;
DROP POLICY IF EXISTS "Manager insert update employees" ON employees;
DROP POLICY IF EXISTS "Manager update employees" ON employees;
DROP POLICY IF EXISTS "Karyawan read own employee" ON employees;

CREATE POLICY "Super admin all employees" ON employees
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Manager read employees outlet" ON employees
  FOR SELECT USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager insert employees outlet" ON employees
  FOR INSERT WITH CHECK (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager update employees outlet" ON employees
  FOR UPDATE USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Karyawan read own employee" ON employees
  FOR SELECT USING (
    profile_id = auth.uid() OR id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

-- Categories: baca/tulis per outlet
DROP POLICY IF EXISTS "Authenticated read categories" ON categories;
DROP POLICY IF EXISTS "Super admin manager manage categories" ON categories;

CREATE POLICY "Super admin all categories" ON categories
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Manager karyawan read categories outlet" ON categories
  FOR SELECT USING (outlet_id = public.my_outlet_id());

CREATE POLICY "Manager insert categories outlet" ON categories
  FOR INSERT WITH CHECK (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager update delete categories outlet" ON categories
  FOR UPDATE USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager delete categories outlet" ON categories
  FOR DELETE USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

-- Products: sama
DROP POLICY IF EXISTS "Authenticated read products" ON products;
DROP POLICY IF EXISTS "Super admin manager manage products" ON products;

CREATE POLICY "Super admin all products" ON products
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Manager karyawan read products outlet" ON products
  FOR SELECT USING (outlet_id = public.my_outlet_id());

CREATE POLICY "Manager insert products outlet" ON products
  FOR INSERT WITH CHECK (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager update delete products outlet" ON products
  FOR UPDATE USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager delete products outlet" ON products
  FOR DELETE USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

-- Shifts: lewat employee.outlet_id
DROP POLICY IF EXISTS "Read own shifts" ON shifts;
DROP POLICY IF EXISTS "Insert own shift" ON shifts;
DROP POLICY IF EXISTS "Update own shift or by manager" ON shifts;

CREATE POLICY "Read shifts outlet" ON shifts
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() = 'super_admin')
    OR (public.user_role() = 'manager' AND employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id()))
  );

CREATE POLICY "Insert own shift" ON shifts
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Update shifts outlet" ON shifts
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() IN ('super_admin', 'manager') AND employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id()))
  );

-- Transactions: lewat employee
DROP POLICY IF EXISTS "Read transactions" ON transactions;
DROP POLICY IF EXISTS "Insert transactions" ON transactions;
DROP POLICY IF EXISTS "Update transactions manager only" ON transactions;

CREATE POLICY "Read transactions outlet" ON transactions
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() = 'super_admin')
    OR (public.user_role() = 'manager' AND employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id()))
  );

CREATE POLICY "Insert transactions" ON transactions
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Update transactions manager" ON transactions
  FOR UPDATE USING (public.user_role() IN ('super_admin', 'manager'));

-- Transaction items: ikut transaction
DROP POLICY IF EXISTS "Read transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Insert transaction_items" ON transaction_items;

CREATE POLICY "Read transaction_items outlet" ON transaction_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN employees e ON e.id = t.employee_id
      WHERE t.id = transaction_items.transaction_id
      AND (t.employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
           OR public.user_role() = 'super_admin'
           OR (public.user_role() = 'manager' AND e.outlet_id = public.my_outlet_id()))
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

-- Attendances: lewat employee
DROP POLICY IF EXISTS "Read attendances" ON attendances;
DROP POLICY IF EXISTS "Insert own attendance" ON attendances;
DROP POLICY IF EXISTS "Update attendances" ON attendances;

CREATE POLICY "Read attendances outlet" ON attendances
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() = 'super_admin')
    OR (public.user_role() = 'manager' AND employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id()))
  );

CREATE POLICY "Insert own attendance" ON attendances
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Update attendances outlet" ON attendances
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() IN ('super_admin', 'manager') AND employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id()))
  );

-- Cash flows: langsung outlet_id
DROP POLICY IF EXISTS "Read cash_flows" ON cash_flows;
DROP POLICY IF EXISTS "Super admin manager update delete cash_flows" ON cash_flows;
DROP POLICY IF EXISTS "Super admin manager delete cash_flows" ON cash_flows;
DROP POLICY IF EXISTS "Authenticated insert cash_flows" ON cash_flows;

CREATE POLICY "Super admin all cash_flows" ON cash_flows
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Manager karyawan read cash_flows outlet" ON cash_flows
  FOR SELECT USING (outlet_id = public.my_outlet_id());

CREATE POLICY "Manager karyawan insert cash_flows outlet" ON cash_flows
  FOR INSERT WITH CHECK (outlet_id = public.my_outlet_id());

CREATE POLICY "Manager update delete cash_flows outlet" ON cash_flows
  FOR UPDATE USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager delete cash_flows outlet" ON cash_flows
  FOR DELETE USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());
