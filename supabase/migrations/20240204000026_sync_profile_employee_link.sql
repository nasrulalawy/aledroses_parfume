-- Sync link profile ↔ employee: jika employees.profile_id sudah mengarah ke user ini
-- tapi profiles.employee_id masih null, isi profiles.employee_id agar login dapat outlet.
CREATE OR REPLACE FUNCTION public.sync_my_employee_link()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_id uuid;
BEGIN
  SELECT e.id INTO emp_id
  FROM employees e
  WHERE e.profile_id = auth.uid()
  LIMIT 1;

  IF emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tidak ada data karyawan yang terikat ke akun ini. Minta admin gunakan menu Karyawan → Link akun (isi email Anda).');
  END IF;

  UPDATE public.profiles
  SET employee_id = emp_id
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.sync_my_employee_link() IS 'Isi profiles.employee_id dari employees.profile_id agar outlet ter-load saat login.';

GRANT EXECUTE ON FUNCTION public.sync_my_employee_link() TO authenticated;
