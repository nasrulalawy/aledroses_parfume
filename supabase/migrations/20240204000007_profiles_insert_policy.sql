-- Allow trigger to insert new profile when user is created in auth.users.
-- Policy must NOT reference auth schema (auth service session may not have SELECT on auth.users → 500).
-- Trigger runs in auth session (supabase_auth_admin); that role needs INSERT grant + RLS policy.
REVOKE INSERT ON public.profiles FROM anon;
REVOKE INSERT ON public.profiles FROM authenticated;

GRANT INSERT ON public.profiles TO supabase_auth_admin;

DROP POLICY IF EXISTS "Allow insert profile for new auth user" ON profiles;

CREATE POLICY "Allow insert profile for new auth user" ON profiles
  FOR INSERT
  WITH CHECK (true);
