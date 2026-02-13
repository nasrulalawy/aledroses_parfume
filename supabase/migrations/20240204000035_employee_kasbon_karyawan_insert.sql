-- Kasir (karyawan) boleh baca dan tambah kasbon karyawan di outlet sendiri

DROP POLICY IF EXISTS "Karyawan read own employee_kasbon" ON employee_kasbon;
CREATE POLICY "Karyawan read employee_kasbon outlet" ON employee_kasbon
  FOR SELECT USING (
    outlet_id = (SELECT outlet_id FROM employees WHERE profile_id = auth.uid())
  );

CREATE POLICY "Karyawan insert employee_kasbon outlet" ON employee_kasbon
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p JOIN employees e ON e.profile_id = p.id WHERE p.id = auth.uid() AND p.role = 'karyawan' AND e.outlet_id = employee_kasbon.outlet_id)
  );
