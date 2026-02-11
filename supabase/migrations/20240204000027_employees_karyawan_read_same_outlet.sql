-- Kasir (karyawan) boleh baca daftar karyawan di outlet yang sama (termasuk barber untuk POS)
CREATE POLICY "Karyawan read employees same outlet" ON employees
  FOR SELECT USING (
    public.user_role() = 'karyawan'
    AND outlet_id = public.my_outlet_id()
  );
