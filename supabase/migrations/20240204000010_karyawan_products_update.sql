-- Kasir (karyawan) harus bisa update stok produk saat transaksi POS (pengurangan stok).
-- Saat ini hanya manager yang punya policy UPDATE; karyawan tidak, sehingga menyimpan transaksi gagal.

CREATE POLICY "Karyawan update products outlet" ON products
  FOR UPDATE
  USING (outlet_id = public.my_outlet_id());
