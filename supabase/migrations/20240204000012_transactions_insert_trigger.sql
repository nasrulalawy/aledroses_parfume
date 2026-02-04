-- Bypass RLS 403: policy INSERT transactions diganti jadi "authenticated boleh insert",
-- pengecekan employee_id dipindah ke trigger BEFORE INSERT (SECURITY DEFINER) yang bisa baca profiles/employees.

-- 1. Fungsi trigger: tolak insert kalau employee_id bukan milik user ini
CREATE OR REPLACE FUNCTION public.check_transaction_insert_employee()
RETURNS TRIGGER AS $$
DECLARE
  allowed BOOLEAN;
BEGIN
  SELECT (
    NEW.employee_id IS NOT NULL
    AND (
      NEW.employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      OR NEW.employee_id = (SELECT id FROM public.employees WHERE profile_id = auth.uid() LIMIT 1)
    )
  ) INTO allowed;
  IF NOT COALESCE(allowed, FALSE) THEN
    RAISE EXCEPTION 'Transaksi hanya boleh untuk karyawan Anda sendiri. Pastikan akun terhubung ke data karyawan (menu Karyawan → Edit → Outlet).'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Hapus policy INSERT lama, ganti dengan "authenticated boleh insert"
DROP POLICY IF EXISTS "Insert transactions" ON transactions;
CREATE POLICY "Insert transactions" ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS check_transaction_insert_employee_trigger ON transactions;
CREATE TRIGGER check_transaction_insert_employee_trigger
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE PROCEDURE public.check_transaction_insert_employee();
