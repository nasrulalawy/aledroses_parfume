-- Kasir (karyawan) boleh baca, tambah, dan edit absensi semua karyawan/capster di outlet sendiri

DROP POLICY IF EXISTS "Read attendances outlet" ON attendances;
CREATE POLICY "Read attendances outlet" ON attendances
  FOR SELECT USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() = 'super_admin')
    OR (public.user_role() = 'manager' AND employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id()))
    OR (public.user_role() = 'karyawan' AND outlet_id = public.my_outlet_id())
  );

DROP POLICY IF EXISTS "Insert own attendance" ON attendances;
CREATE POLICY "Insert attendance outlet" ON attendances
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() = 'super_admin')
    OR (public.user_role() IN ('manager', 'karyawan') AND outlet_id = public.my_outlet_id() AND employee_id IN (SELECT id FROM employees WHERE outlet_id = public.my_outlet_id()))
  );

DROP POLICY IF EXISTS "Update attendances outlet" ON attendances;
CREATE POLICY "Update attendances outlet" ON attendances
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM employees WHERE profile_id = auth.uid())
    OR (public.user_role() = 'super_admin')
    OR (public.user_role() IN ('manager', 'karyawan') AND outlet_id = public.my_outlet_id())
  );
