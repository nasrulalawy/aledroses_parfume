-- Seed categories for parfum refill store
INSERT INTO categories (id, name, description) VALUES
  (uuid_generate_v4(), 'Botol', 'Botol parfum refill berbagai ukuran'),
  (uuid_generate_v4(), 'Bibit Parfum', 'Bibit/konsentrat parfum'),
  (uuid_generate_v4(), 'Aksesoris', 'Aksesoris parfum dan kemasan'),
  (uuid_generate_v4(), 'Lainnya', 'Produk lainnya')
ON CONFLICT DO NOTHING;

-- Note: Create first user via Supabase Auth (Sign Up), then run:
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'your@email.com';
