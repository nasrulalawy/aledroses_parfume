-- Kasir (karyawan) boleh lihat semua transaksi harian outlet, bukan hanya transaksi buatan sendiri
DROP POLICY IF EXISTS "Read transactions outlet" ON transactions;
CREATE POLICY "Read transactions outlet" ON transactions
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() = 'super_admin')
    OR (
      public.user_role() = 'manager'
      AND (
        employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id())
        OR outlet_id = public.my_outlet_id()
      )
    )
    OR (
      public.user_role() = 'karyawan'
      AND outlet_id = public.my_outlet_id()
    )
  );

DROP POLICY IF EXISTS "Read transaction_items outlet" ON transaction_items;
CREATE POLICY "Read transaction_items outlet" ON transaction_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (
        t.employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
        OR public.user_role() = 'super_admin'
        OR (public.user_role() = 'manager' AND (t.outlet_id = public.my_outlet_id()))
        OR (public.user_role() = 'karyawan' AND t.outlet_id = public.my_outlet_id())
      )
    )
  );
