-- Link karyawan ke akun yang sudah ada (by email). Untuk kasir yang sudah punya akun tapi outlet "belum diatur" karena link putus.
CREATE OR REPLACE FUNCTION public.link_employee_profile_by_email(p_employee_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r app_role;
  emp_outlet uuid;
  pid uuid;
BEGIN
  IF p_employee_id IS NULL OR p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'employee_id dan email wajib');
  END IF;

  SELECT id INTO pid FROM public.profiles WHERE email = trim(lower(p_email)) LIMIT 1;
  IF pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Email tidak ditemukan. Pastikan user sudah pernah login atau terdaftar.');
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

  UPDATE employees SET profile_id = pid WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Karyawan tidak ditemukan');
  END IF;

  UPDATE public.profiles SET employee_id = p_employee_id WHERE id = pid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gagal mengaitkan profile.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.link_employee_profile_by_email(uuid, text) IS 'Kaitkan karyawan ke akun yang sudah ada (cari profile by email). Untuk perbaiki "outlet belum diatur" saat link putus.';

GRANT EXECUTE ON FUNCTION public.link_employee_profile_by_email(uuid, text) TO authenticated;
