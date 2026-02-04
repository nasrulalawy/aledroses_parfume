-- Hindari rekursi RLS saat login: policy yang pakai user_role()/my_outlet_id() bisa
-- memicu baca profiles lagi → stack overflow / 500.
-- Manager tetap hanya lihat karyawan outlet sendiri lewat RLS employees + filter app.
-- Tidak tambah policy SELECT profiles untuk manager; "Users can read own profile" cukup untuk login.

-- Hapus policy manager yang bikin 500 (jika sudah pernah dijalankan)
DROP POLICY IF EXISTS "Manager read profiles own outlet no super_admin" ON profiles;
