-- Allow new user signup with role and employee_id from metadata (used when super_admin/manager "Buat Akun" for employee).
-- Only 'manager' and 'karyawan' are allowed from metadata; default remains 'karyawan'.
-- Profile is inserted here; employee.profile_id is updated by the client after signUp (RLS allows super_admin/manager to update employees).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_role text;
  meta_employee_id uuid;
  app_role_val app_role;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';
  BEGIN
    meta_employee_id := (NEW.raw_user_meta_data->>'employee_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    meta_employee_id := NULL;
  END;

  IF meta_role IN ('manager', 'karyawan') THEN
    app_role_val := meta_role::app_role;
  ELSE
    app_role_val := 'karyawan';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, employee_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    app_role_val,
    meta_employee_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
