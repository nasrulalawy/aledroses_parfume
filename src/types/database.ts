export type Role = 'super_admin' | 'manager' | 'karyawan'

export interface Outlet {
  id: string
  name: string
  code: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  employee_id: string | null
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  profile_id: string | null
  outlet_id: string
  nip: string
  nama: string
  no_telp: string | null
  alamat: string | null
  jabatan: string | null
  gaji: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  outlet_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  outlet_id: string
  sku: string
  name: string
  category_id: string
  unit: string
  price: number
  cost: number | null
  stock: number
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type StockMovementType = 'in' | 'out'

export interface StockMovement {
  id: string
  outlet_id: string
  product_id: string
  type: StockMovementType
  quantity: number
  unit_cost: number | null
  notes: string | null
  created_at: string
  created_by: string | null
}

export type PaymentMethod = 'cash' | 'transfer' | 'qris' | 'other'

export interface Transaction {
  id: string
  outlet_id: string
  transaction_number: string
  employee_id: string
  shift_id: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  payment_method: PaymentMethod
  cash_received: number | null
  change: number | null
  status: 'completed' | 'cancelled' | 'refunded'
  notes: string | null
  created_at: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  product_id: string
  qty: number
  unit_price: number
  discount: number
  total: number
}

export interface Shift {
  id: string
  outlet_id: string
  employee_id: string
  date: string
  open_cash: number
  close_cash: number | null
  expected_cash: number | null
  discrepancy: number | null
  opened_at: string
  closed_at: string | null
  status: 'open' | 'closed'
}

export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alfa'

export interface Attendance {
  id: string
  outlet_id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type CashFlowType = 'in' | 'out'
export type CashFlowCategory =
  | 'penjualan'
  | 'modal_awal'
  | 'pembelian'
  | 'gaji'
  | 'operasional'
  | 'lainnya'

export interface CashFlow {
  id: string
  outlet_id: string
  shift_id: string | null
  type: CashFlowType
  category: CashFlowCategory
  amount: number
  description: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

// Cart & POS
export interface CartItem {
  product: Product
  qty: number
  unit_price: number
  discount: number
}
