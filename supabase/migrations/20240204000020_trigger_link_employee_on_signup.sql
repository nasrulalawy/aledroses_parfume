-- Kaitkan employees.profile_id langsung di trigger saat user dibuat (SECURITY DEFINER),
-- sehingga tidak bergantung pada RLS atau RPC client. Berlaku untuk semua outlet termasuk barbershop.

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

  -- Langsung set employees.profile_id di sini (SECURITY DEFINER = tidak kena RLS)
  IF meta_employee_id IS NOT NULL THEN
    UPDATE public.employees SET profile_id = NEW.id WHERE id = meta_employee_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
