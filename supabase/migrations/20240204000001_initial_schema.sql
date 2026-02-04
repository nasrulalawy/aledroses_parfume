-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE app_role AS ENUM ('super_admin', 'manager', 'karyawan');
CREATE TYPE payment_method_type AS ENUM ('cash', 'transfer', 'qris', 'other');
CREATE TYPE attendance_status_type AS ENUM ('hadir', 'izin', 'sakit', 'alfa');
CREATE TYPE cash_flow_type AS ENUM ('in', 'out');
CREATE TYPE cash_flow_category AS ENUM ('penjualan', 'modal_awal', 'pembelian', 'gaji', 'operasional', 'lainnya');
CREATE TYPE transaction_status_type AS ENUM ('completed', 'cancelled', 'refunded');
CREATE TYPE shift_status_type AS ENUM ('open', 'closed');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'karyawan',
  employee_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employees (must exist before profiles.employee_id FK; we add FK after)
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nip TEXT NOT NULL,
  nama TEXT NOT NULL,
  no_telp TEXT,
  alamat TEXT,
  jabatan TEXT,
  gaji NUMERIC(15,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_employee
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  price NUMERIC(15,2) NOT NULL CHECK (price >= 0),
  cost NUMERIC(15,2) CHECK (cost >= 0),
  stock NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shifts (for modal kasir)
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  open_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
  close_cash NUMERIC(15,2),
  expected_cash NUMERIC(15,2),
  discrepancy NUMERIC(15,2),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status shift_status_type NOT NULL DEFAULT 'open',
  UNIQUE(employee_id, date)
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method payment_method_type NOT NULL,
  cash_received NUMERIC(15,2),
  change NUMERIC(15,2),
  status transaction_status_type NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX idx_transactions_shift_id ON transactions(shift_id);

-- Transaction items
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty NUMERIC(15,2) NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(15,2) NOT NULL,
  discount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL
);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);

-- Attendances
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status attendance_status_type NOT NULL DEFAULT 'hadir',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE INDEX idx_attendances_employee_date ON attendances(employee_id, date);

-- Cash flows
CREATE TABLE cash_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  type cash_flow_type NOT NULL,
  category cash_flow_category NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_flows_created_at ON cash_flows(created_at);
CREATE INDEX idx_cash_flows_shift_id ON cash_flows(shift_id);

-- Transaction number sequence
CREATE SEQUENCE transaction_number_seq START 1;

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER attendances_updated_at BEFORE UPDATE ON attendances
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Trigger: create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'karyawan');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
