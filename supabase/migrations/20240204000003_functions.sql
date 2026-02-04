-- Next transaction number
CREATE OR REPLACE FUNCTION next_transaction_number()
RETURNS TEXT AS $$
  SELECT 'TRX-' || LPAD(nextval('transaction_number_seq')::text, 6, '0');
$$ LANGUAGE sql;

-- Decrement product stock (for POS)
CREATE OR REPLACE FUNCTION decrement_stock(p_id UUID, q NUMERIC)
RETURNS void AS $$
  UPDATE products SET stock = GREATEST(0, stock - q) WHERE id = p_id;
$$ LANGUAGE sql SECURITY DEFINER;
