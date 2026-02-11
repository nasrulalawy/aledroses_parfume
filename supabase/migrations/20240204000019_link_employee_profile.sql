-- Agar "Buat Akun" kasir/barber selalu bisa mengaitkan profile_id ke employees
-- tanpa terhalang RLS (termasuk kasir barbershop).
-- Client panggil RPC ini setelah signUp; fungsi jalan dengan SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.link_employee_profile(p_employee_id uuid, p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r app_role;
  emp_outlet uuid;
BEGIN
  IF p_employee_id IS NULL OR p_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'employee_id dan profile_id wajib');
  END IF;

  r := public.user_role();
  IF r IS NULL OR (r <> 'super_admin' AND r <> 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hanya super admin atau manager yang boleh mengaitkan akun');
  END IF;

  IF r = 'manager' THEN
    SELECT e.outlet_id INTO emp_outlet FROM employees e WHERE e.id = p_employee_id;
    IF emp_outlet IS NULL OR emp_outlet <> public.my_outlet_id() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Karyawan bukan dari outlet Anda');
    END IF;
  END IF;

  UPDATE employees SET profile_id = p_profile_id WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Karyawan tidak ditemukan');
  END IF;

  -- Juga set profiles.employee_id agar login user langsung terkait ke karyawan & outlet
  UPDATE public.profiles SET employee_id = p_employee_id WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gagal mengaitkan profile ke karyawan. Pastikan migrasi RLS profiles sudah dijalankan.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.link_employee_profile(uuid, uuid) IS 'Dipanggil client setelah signUp untuk mengaitkan auth user ke data karyawan; bypass RLS.';

GRANT EXECUTE ON FUNCTION public.link_employee_profile(uuid, uuid) TO authenticated;

-- Supaya manager bisa update profiles.employee_id (user yang login nanti baca profile → dapat employee_id → dapat outlet)
DROP POLICY IF EXISTS "Manager can set profile employee_id for own outlet" ON profiles;
CREATE POLICY "Manager can set profile employee_id for own outlet" ON profiles
  FOR UPDATE
  USING (public.user_role() = 'manager')
  WITH CHECK (
    employee_id IS NOT NULL
    AND (SELECT outlet_id FROM public.employees WHERE id = employee_id LIMIT 1) = public.my_outlet_id()
  );
