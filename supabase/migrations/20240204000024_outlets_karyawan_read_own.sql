-- Karyawan/kasir boleh baca outlet tempat mereka ditugaskan (agar embed outlets(...) saat fetch employee tidak null)
CREATE POLICY "Karyawan read own outlet" ON outlets
  FOR SELECT USING (
    public.user_role() = 'karyawan'
    AND id IN (
      SELECT e.outlet_id FROM employees e
      WHERE e.outlet_id IS NOT NULL
        AND (e.profile_id = auth.uid() OR e.id = (SELECT employee_id FROM profiles WHERE id = auth.uid() LIMIT 1))
    )
  );
