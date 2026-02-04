-- Stok: barang masuk dengan HPP metode rata-rata (weighted average)
CREATE TYPE stock_movement_type AS ENUM ('in', 'out');

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  type stock_movement_type NOT NULL DEFAULT 'in',
  quantity NUMERIC(15,2) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(15,2) CHECK (unit_cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_stock_movements_outlet_id ON stock_movements(outlet_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

COMMENT ON COLUMN stock_movements.unit_cost IS 'Harga beli per unit batch ini; dipakai untuk hitung HPP rata-rata';

-- Barang masuk: tambah stok + update HPP (weighted average) atomik
CREATE OR REPLACE FUNCTION public.record_stock_in(
  p_outlet_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement_id UUID;
  v_old_stock NUMERIC;
  v_old_cost NUMERIC;
  v_new_stock NUMERIC;
  v_new_cost NUMERIC;
  v_cost NUMERIC;
BEGIN
  v_cost := COALESCE(p_unit_cost, 0);

  SELECT stock, COALESCE(cost, 0) INTO v_old_stock, v_old_cost
  FROM products
  WHERE id = p_product_id AND outlet_id = p_outlet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan atau bukan milik outlet ini.';
  END IF;

  v_new_stock := v_old_stock + p_quantity;
  IF v_new_stock <= 0 THEN
    v_new_cost := v_cost;
  ELSE
    v_new_cost := (v_old_cost * v_old_stock + v_cost * p_quantity) / v_new_stock;
  END IF;

  INSERT INTO stock_movements (outlet_id, product_id, type, quantity, unit_cost, notes, created_by)
  VALUES (p_outlet_id, p_product_id, 'in', p_quantity, NULLIF(p_unit_cost, 0), p_notes, auth.uid())
  RETURNING id INTO v_movement_id;

  UPDATE products
  SET stock = v_new_stock, cost = v_new_cost, updated_at = NOW()
  WHERE id = p_product_id;

  RETURN v_movement_id;
END;
$$;

-- RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin all stock_movements" ON stock_movements
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Manager read insert stock_movements outlet" ON stock_movements
  FOR SELECT USING (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

CREATE POLICY "Manager insert stock_movements outlet" ON stock_movements
  FOR INSERT WITH CHECK (public.user_role() = 'manager' AND outlet_id = public.my_outlet_id());

-- Karyawan tidak mengelola barang masuk (hanya manager/super_admin)
GRANT EXECUTE ON FUNCTION public.record_stock_in(UUID, UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;
