-- 1. Pelanggan bayar lebih (QRIS/transfer) → kelebihan = tip untuk barber/capster
-- 2. Capster/karyawan tarik tunai (karena terima QRIS/transfer ke rekening pribadi)

-- Transaksi: kolom untuk overpayment & tip
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tip_recipient_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN transactions.amount_paid IS 'Jumlah yang benar-benar dibayar pelanggan (untuk QRIS/transfer); jika > total maka selisih = tip';
COMMENT ON COLUMN transactions.tip_amount IS 'Kelebihan pembayaran yang diambil capster sebagai tip (cash keluar dari kas)';
COMMENT ON COLUMN transactions.tip_recipient_employee_id IS 'Karyawan/barber yang menerima tip';

-- Cash flow: kategori baru
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'cash_flow_category' AND e.enumlabel = 'tip') THEN
    ALTER TYPE cash_flow_category ADD VALUE 'tip';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'cash_flow_category' AND e.enumlabel = 'tarik_tunai') THEN
    ALTER TYPE cash_flow_category ADD VALUE 'tarik_tunai';
  END IF;
END $$;

-- Cash flows: kolom employee_id untuk tarik tunai (siapa yang menarik)
ALTER TABLE cash_flows ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN cash_flows.employee_id IS 'Untuk tarik_tunai: karyawan yang menarik tunai dari kas';
