-- Fix: Manager harus bisa baca transaksi dari outlet sendiri lewat outlet_id,
-- bukan hanya lewat employee_id. Menangani kasus karyawan outlet_id NULL atau inkonsistensi.
-- Laporan transaksi outlet barbershop akan tampil benar.

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
  );

-- Konsistensi: transaction_items ikut aturan yang sama
DROP POLICY IF EXISTS "Read transaction_items outlet" ON transaction_items;
CREATE POLICY "Read transaction_items outlet" ON transaction_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN employees e ON e.id = t.employee_id
      WHERE t.id = transaction_items.transaction_id
      AND (
        t.employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
        OR public.user_role() = 'super_admin'
        OR (public.user_role() = 'manager' AND (e.outlet_id = public.my_outlet_id() OR t.outlet_id = public.my_outlet_id()))
      )
    )
  );
