-- Kasir (karyawan) boleh hapus transaksi outlet sendiri via RPC delete_transaction_cascade
-- Perbaiki: handle NULL my_outlet_id() dengan pesan error yang jelas
-- Tambah policy DELETE untuk karyawan (RPC pakai SECURITY DEFINER, tapi policy berguna untuk konsistensi)

-- Policy DELETE transactions: karyawan boleh hapus transaksi outlet sendiri
DROP POLICY IF EXISTS "Delete transactions outlet" ON transactions;
CREATE POLICY "Delete transactions outlet" ON transactions
  FOR DELETE USING (
    public.user_role() = 'super_admin'
    OR (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id())
    OR (public.user_role() = 'karyawan' AND outlet_id = public.my_outlet_id())
  );

-- RPC pakai DEFINER agar bisa hapus cash_flows (karyawan tidak punya policy DELETE cash_flows)
CREATE OR REPLACE FUNCTION public.delete_transaction_cascade(p_transaction_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  txn_outlet UUID;
  my_outlet UUID;
BEGIN
  IF p_transaction_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'transaction_id wajib.');
  END IF;

  SELECT outlet_id INTO txn_outlet FROM transactions WHERE id = p_transaction_id;
  IF txn_outlet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transaksi tidak ditemukan.');
  END IF;

  -- Super admin boleh semua
  IF public.user_role() = 'super_admin' THEN
    NULL; -- lanjut ke delete
  -- Manager & kasir: hanya transaksi outlet sendiri
  ELSIF public.user_role() IN ('manager', 'karyawan') THEN
    my_outlet := public.my_outlet_id();
    IF my_outlet IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Outlet Anda belum diatur. Hubungi admin untuk mengaitkan karyawan ke outlet.');
    END IF;
    IF txn_outlet <> my_outlet THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Transaksi bukan dari outlet Anda.');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Anda tidak punya akses menghapus transaksi.');
  END IF;

  -- Hapus cash_flows yang mengacu ke transaksi ini (termasuk tip)
  DELETE FROM cash_flows WHERE reference_type = 'transaction' AND reference_id = p_transaction_id;
  -- transaction_items CASCADE saat hapus transactions
  DELETE FROM transactions WHERE id = p_transaction_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
