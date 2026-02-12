-- RPC untuk hapus data beserta data terkait (cascade)

-- Hapus outlet dan semua data terkait
CREATE OR REPLACE FUNCTION public.delete_outlet_cascade(p_outlet_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.user_role() <> 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hanya super admin yang boleh menghapus outlet.');
  END IF;

  IF p_outlet_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'outlet_id wajib.');
  END IF;

  -- Urutan: hapus data yang mereferensi dulu
  DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE outlet_id = p_outlet_id);
  DELETE FROM transactions WHERE outlet_id = p_outlet_id;
  DELETE FROM cash_flows WHERE outlet_id = p_outlet_id;
  DELETE FROM stock_movements WHERE outlet_id = p_outlet_id;
  DELETE FROM attendances WHERE outlet_id = p_outlet_id;
  DELETE FROM shifts WHERE outlet_id = p_outlet_id;
  UPDATE profiles SET employee_id = NULL WHERE employee_id IN (SELECT id FROM employees WHERE outlet_id = p_outlet_id);
  DELETE FROM products WHERE outlet_id = p_outlet_id;
  DELETE FROM categories WHERE outlet_id = p_outlet_id;
  DELETE FROM employees WHERE outlet_id = p_outlet_id;
  DELETE FROM outlets WHERE id = p_outlet_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Hapus karyawan dan data terkait (termasuk akun auth jika ada)
CREATE OR REPLACE FUNCTION public.delete_employee_cascade(p_employee_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_outlet UUID;
  auth_user_id UUID;
BEGIN
  IF p_employee_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'employee_id wajib.');
  END IF;

  -- Super admin boleh; manager hanya karyawan outlet sendiri
  IF public.user_role() = 'manager' THEN
    SELECT outlet_id INTO emp_outlet FROM employees WHERE id = p_employee_id;
    IF emp_outlet IS NULL OR emp_outlet <> public.my_outlet_id() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Karyawan bukan dari outlet Anda.');
    END IF;
  ELSIF public.user_role() <> 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Anda tidak punya akses menghapus karyawan.');
  END IF;

  -- Simpan profile_id (auth user id) sebelum hapus
  SELECT profile_id INTO auth_user_id FROM employees WHERE id = p_employee_id;

  -- Update profiles dulu
  UPDATE profiles SET employee_id = NULL WHERE employee_id = p_employee_id;
  -- transaction_items CASCADE dari transactions
  DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE employee_id = p_employee_id OR barber_id = p_employee_id);
  DELETE FROM transactions WHERE employee_id = p_employee_id OR barber_id = p_employee_id;
  DELETE FROM attendances WHERE employee_id = p_employee_id;
  DELETE FROM shifts WHERE employee_id = p_employee_id;
  DELETE FROM employees WHERE id = p_employee_id;

  -- Hapus akun auth (auth.users) jika karyawan punya akun
  IF auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = auth_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Hapus produk (jika belum ada transaksi)
CREATE OR REPLACE FUNCTION public.delete_product_cascade(p_product_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_items BOOLEAN;
  prod_outlet UUID;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'product_id wajib.');
  END IF;

  SELECT outlet_id INTO prod_outlet FROM products WHERE id = p_product_id;
  IF prod_outlet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Produk tidak ditemukan.');
  END IF;
  IF public.user_role() = 'manager' AND prod_outlet <> public.my_outlet_id() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Produk bukan dari outlet Anda.');
  END IF;
  IF public.user_role() NOT IN ('super_admin', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Anda tidak punya akses menghapus produk.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM transaction_items WHERE product_id = p_product_id LIMIT 1) INTO has_items;
  IF has_items THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Produk tidak bisa dihapus karena sudah ada dalam transaksi.');
  END IF;

  DELETE FROM stock_movements WHERE product_id = p_product_id;
  DELETE FROM products WHERE id = p_product_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Hapus kategori (jika belum ada produk)
CREATE OR REPLACE FUNCTION public.delete_category_cascade(p_category_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_count INT;
  cat_outlet UUID;
BEGIN
  IF p_category_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'category_id wajib.');
  END IF;

  SELECT outlet_id INTO cat_outlet FROM categories WHERE id = p_category_id;
  IF cat_outlet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kategori tidak ditemukan.');
  END IF;
  IF public.user_role() = 'manager' AND cat_outlet <> public.my_outlet_id() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kategori bukan dari outlet Anda.');
  END IF;
  IF public.user_role() NOT IN ('super_admin', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Anda tidak punya akses menghapus kategori.');
  END IF;

  SELECT COUNT(*) INTO product_count FROM products WHERE category_id = p_category_id;
  IF product_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pindahkan atau hapus ' || product_count || ' produk ke kategori lain terlebih dahulu.');
  END IF;

  DELETE FROM categories WHERE id = p_category_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_outlet_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_employee_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_product_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_category_cascade(UUID) TO authenticated;
