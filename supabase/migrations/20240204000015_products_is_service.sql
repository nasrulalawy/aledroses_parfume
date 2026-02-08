-- Produk jasa: tidak punya stok dan tidak punya HPP
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN products.is_service IS 'Produk jasa tidak memerlukan stok dan HPP (modal dasar)';

-- Barang masuk: tolak jika produk jasa
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
  v_is_service BOOLEAN;
BEGIN
  SELECT stock, COALESCE(cost, 0), COALESCE(is_service, false) INTO v_old_stock, v_old_cost, v_is_service
  FROM products
  WHERE id = p_product_id AND outlet_id = p_outlet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan atau bukan milik outlet ini.';
  END IF;

  IF v_is_service THEN
    RAISE EXCEPTION 'Produk jasa tidak dapat dicatat barang masuk / stok.';
  END IF;

  v_cost := COALESCE(p_unit_cost, 0);
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

-- Kurangi stok: no-op untuk produk jasa (stok tetap 0)
CREATE OR REPLACE FUNCTION decrement_stock(p_id UUID, q NUMERIC)
RETURNS void AS $$
  UPDATE products
  SET stock = GREATEST(0, stock - q)
  WHERE id = p_id AND COALESCE(is_service, false) = false;
$$ LANGUAGE sql SECURITY DEFINER;
