-- Pastikan super_admin bisa INSERT/UPDATE/DELETE outlets (FOR ALL USING kadang tidak cukup untuk INSERT)
DROP POLICY IF EXISTS "Super admin all outlets" ON outlets;

CREATE POLICY "Super admin all outlets" ON outlets
  FOR ALL
  USING (public.user_role() = 'super_admin')
  WITH CHECK (public.user_role() = 'super_admin');
