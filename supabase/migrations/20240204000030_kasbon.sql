-- Fitur kasbon: beli sekarang bayar nanti
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'payment_method_type' AND e.enumlabel = 'kasbon') THEN
    ALTER TYPE payment_method_type ADD VALUE 'kasbon';
  END IF;
END $$;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS kasbon_paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN transactions.customer_name IS 'Nama pelanggan untuk transaksi kasbon';
COMMENT ON COLUMN transactions.kasbon_paid_amount IS 'Jumlah yang sudah dibayar untuk kasbon; lunas jika >= total';
