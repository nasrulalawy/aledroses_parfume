-- Fix 403 saat kasir simpan transaksi: pakai helper SECURITY DEFINER agar policy
-- tidak bergantung pada user bisa baca employees di konteks policy.

-- Helper: employee_id user saat ini. Dari profiles.employee_id; kalau NULL, ambil dari employees.profile_id.
CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT employee_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    (SELECT id FROM public.employees WHERE profile_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Pengecekan INSERT transaksi: apakah employee_id yang di-insert boleh dipakai user ini? (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.allow_insert_transaction(p_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT p_employee_id IS NOT NULL AND (
    p_employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    OR p_employee_id = (SELECT id FROM public.employees WHERE profile_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.my_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.allow_insert_transaction(UUID) TO authenticated;

-- Transactions: INSERT pakai fungsi supaya evaluasi pakai definer (baca profiles/employees tanpa kena RLS)
DROP POLICY IF EXISTS "Insert transactions" ON transactions;
CREATE POLICY "Insert transactions" ON transactions
  FOR INSERT WITH CHECK (public.allow_insert_transaction(employee_id));

-- Transaction items: INSERT pakai my_employee_id() supaya konsisten
DROP POLICY IF EXISTS "Insert transaction_items" ON transaction_items;
CREATE POLICY "Insert transaction_items" ON transaction_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
      AND t.employee_id = public.my_employee_id()
    )
  );
