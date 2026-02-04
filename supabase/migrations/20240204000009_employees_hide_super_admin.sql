-- Manager tidak boleh melihat karyawan yang terhubung ke akun super_admin di halaman Karyawan.
-- Fungsi SECURITY DEFINER agar bisa baca role di profiles tanpa rekursi RLS.
CREATE OR REPLACE FUNCTION public.is_super_admin(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = profile_id AND role = 'super_admin');
$$;

-- Manager: baca employees outlet sendiri, kecuali yang profile_id-nya super_admin
DROP POLICY IF EXISTS "Manager read employees outlet" ON employees;
CREATE POLICY "Manager read employees outlet" ON employees
  FOR SELECT USING (
    public.user_role() = 'manager'
    AND outlet_id = public.my_outlet_id()
    AND (profile_id IS NULL OR NOT public.is_super_admin(profile_id))
  );
