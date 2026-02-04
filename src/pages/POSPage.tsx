import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import { usePOSStore } from '@/stores/posStore'
import type { Product, Category } from '@/types/database'

export function POSPage() {
  const { profile } = useAuthContext()
  const { outletId } = useOutlet()
  const { cart, globalDiscount, taxRate, addItem, removeItem, updateQty, setGlobalDiscount, setTaxRate, clearCart, getItemsSubtotal, getSubtotal, getTotal } = usePOSStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filterCat, setFilterCat] = useState<string>('')
  const [search, setSearch] = useState('')
  const [payModal, setPayModal] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash')
  const [processing, setProcessing] = useState(false)
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null)

  useEffect(() => {
    if (!outletId) return
    supabase.from('categories').select('*').eq('outlet_id', outletId).order('name').then(({ data }) => setCategories((data as Category[]) ?? []))
    supabase.from('products').select('*').eq('outlet_id', outletId).eq('is_active', true).order('name').then(({ data }) => setProducts((data as Product[]) ?? []))
    if (profile?.employee_id) {
      const today = new Date().toISOString().slice(0, 10)
      supabase.from('shifts').select('id').eq('employee_id', profile.employee_id).eq('date', today).eq('status', 'open').maybeSingle().then(({ data }) => setCurrentShiftId(data?.id ?? null))
    }
  }, [outletId, profile?.employee_id])

  const filtered = products.filter((p) => (filterCat ? p.category_id === filterCat : true) && (search ? p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) : true))

  async function generateTransactionNumber(): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('next_transaction_number')
      if (!error && data && typeof data === 'string') return data
    } catch {
      // ignore and fallback below
    }
    const res = await supabase.from('transactions').select('transaction_number').order('created_at', { ascending: false }).limit(1).maybeSingle()
    const last = (res.data as { transaction_number?: string } | null)?.transaction_number
    const num = last ? parseInt(last.replace(/\D/g, ''), 10) + 1 : 1
    return `TRX-${String(num).padStart(6, '0')}`
  }

  const hasOpenShift = !!currentShiftId
  const mustHaveShift = !!profile?.employee_id
  const canTransact = !mustHaveShift || hasOpenShift

  async function handlePayment() {
    if (!profile?.employee_id) {
      alert('Anda belum terhubung ke data karyawan. Hubungi admin.')
      return
    }
    if (!currentShiftId) {
      alert('Buka shift terlebih dahulu di menu Shift sebelum melakukan transaksi.')
      return
    }
    const total = getTotal()
    if (total <= 0 || cart.length === 0) {
      alert('Keranjang kosong.')
      return
    }
    if (paymentMethod === 'cash' && (Number(cashReceived) || 0) < total) {
      alert('Uang diterima kurang dari total.')
      return
    }
    setProcessing(true)
    const transactionNumber = await generateTransactionNumber()
    const itemsSubtotal = getItemsSubtotal()
    const afterDiscount = getSubtotal()
    const tax = (afterDiscount * taxRate) / 100
    const cashVal = paymentMethod === 'cash' ? Number(cashReceived) : null
    const changeVal = paymentMethod === 'cash' && cashVal ? cashVal - total : null

    if (!outletId) {
      alert('Outlet tidak tersedia.')
      setProcessing(false)
      return
    }

    try {
      // 1. Simpan transaksi
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .insert({
          outlet_id: outletId,
          transaction_number: transactionNumber,
          employee_id: profile.employee_id,
          shift_id: currentShiftId,
          subtotal: itemsSubtotal,
          discount: globalDiscount,
          tax,
          total,
          payment_method: paymentMethod,
          cash_received: cashVal,
          change: changeVal,
          status: 'completed',
        })
        .select('id')
        .single()

      if (txnErr) {
        throw new Error(`1. Simpan transaksi: ${txnErr.message}`)
      }
      if (!txn) {
        throw new Error('1. Simpan transaksi: tidak dapat ID transaksi')
      }

      // 2. Simpan item transaksi
      const items = cart.map((c) => ({
        transaction_id: txn.id,
        product_id: c.product.id,
        qty: c.qty,
        unit_price: c.unit_price,
        discount: c.discount,
        total: c.qty * c.unit_price - c.discount,
      }))
      const { error: itemsErr } = await supabase.from('transaction_items').insert(items)
      if (itemsErr) {
        throw new Error(`2. Simpan item transaksi: ${itemsErr.message}`)
      }

      // 3. Catat arus kas (penjualan)
      if (paymentMethod === 'cash' || paymentMethod === 'transfer' || paymentMethod === 'qris') {
        const { error: cashErr } = await supabase.from('cash_flows').insert({
          outlet_id: outletId,
          shift_id: currentShiftId,
          type: 'in',
          category: 'penjualan',
          amount: total,
          description: `Penjualan ${transactionNumber}`,
          reference_type: 'transaction',
          reference_id: txn.id,
        })
        if (cashErr) {
          throw new Error(`3. Catat arus kas: ${cashErr.message}. Pastikan karyawan punya Outlet (menu Karyawan → Edit → Outlet).`)
        }
      }

      // 4. Kurangi stok produk (pakai RPC SECURITY DEFINER agar kasir tidak kena RLS)
      for (const c of cart) {
        const { error: stockErr } = await supabase.rpc('decrement_stock', {
          p_id: c.product.id,
          q: c.qty,
        })
        if (stockErr) {
          throw new Error(`4. Update stok (${c.product.name}): ${stockErr.message}`)
        }
      }

      clearCart()
      setPayModal(false)
      setCashReceived('')
      alert(`Transaksi ${transactionNumber} berhasil.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan transaksi'
      alert(msg)
    } finally {
      setProcessing(false)
    }
  }

  const total = getTotal()
  const change = paymentMethod === 'cash' && Number(cashReceived) >= total ? Number(cashReceived) - total : 0

  if (!outletId) return (
    <div className="card">
      <p className="font-medium text-gray-900 dark:text-white">Outlet belum diatur</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Untuk kasir/karyawan: outlet di-set oleh admin/manager di menu <strong>Karyawan</strong> → Edit data Anda → isi <strong>Outlet</strong>. Untuk super admin: pilih outlet di dropdown di header.
      </p>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">POS</h1>
      {mustHaveShift && !hasOpenShift && (
        <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="font-medium text-amber-800 dark:text-amber-200">Shift belum dibuka</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Anda harus buka shift terlebih dahulu sebelum bisa melakukan transaksi. Buka menu <Link to="/shifts" className="underline font-medium">Shift</Link> → klik <strong>Buka Shift</strong> → isi modal kasir lalu simpan.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 card">
          <div className="flex gap-2 flex-wrap mb-4">
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input flex-1 min-w-[200px]"
            />
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="input w-40">
              <option value="">Semua kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addItem(p)}
                className="card text-left hover:ring-2 hover:ring-primary-500"
              >
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-sm text-gray-600">Rp {Number(p.price).toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500">Stok: {p.stock}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Keranjang</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {cart.map((c) => (
              <div key={c.product.id} className="flex justify-between items-center text-sm border-b pb-2">
                <div>
                  <p className="font-medium">{c.product.name}</p>
                  <p>Rp {Number(c.unit_price).toLocaleString('id-ID')} x {c.qty}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300" onClick={() => updateQty(c.product.id, c.qty - 1)}>-</button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={c.qty}
                    onChange={(e) => updateQty(c.product.id, Number(e.target.value) || 0)}
                    className="input w-16 text-center"
                    inputMode="numeric"
                  />
                  <button type="button" className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300" onClick={() => updateQty(c.product.id, c.qty + 1)}>+</button>
                  <button type="button" className="text-red-600 ml-1" onClick={() => removeItem(c.product.id)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span>Diskon global</span>
              <input type="number" min={0} value={globalDiscount} onChange={(e) => setGlobalDiscount(Number(e.target.value) || 0)} className="input w-24 text-right" />
            </div>
            <div className="flex justify-between">
              <span>Pajak (%)</span>
              <input type="number" min={0} step={0.1} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} className="input w-24 text-right" />
            </div>
            <div className="text-lg font-bold flex justify-between pt-2 border-t">
              <span>Total</span>
              <span>Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setPayModal(true)}
            disabled={cart.length === 0 || !canTransact}
            title={!canTransact ? 'Buka shift terlebih dahulu' : undefined}
          >
            {!canTransact ? 'Buka shift dulu' : 'Bayar'}
          </button>
        </div>
      </div>

      {payModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full">
            <h3 className="font-semibold text-lg">Pembayaran</h3>
            <div className="mt-2">
              <label className="block text-sm">Metode</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'transfer' | 'qris')} className="input">
                <option value="cash">Tunai</option>
                <option value="transfer">Transfer</option>
                <option value="qris">QRIS</option>
              </select>
            </div>
            {paymentMethod === 'cash' && (
              <>
                <div className="mt-2">
                  <label className="block text-sm">Uang diterima</label>
                  <input type="number" min={0} value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="input" />
                </div>
                {Number(cashReceived) >= total && <p className="mt-2 text-green-600">Kembalian: Rp {change.toLocaleString('id-ID')}</p>}
              </>
            )}
            <p className="mt-2 font-medium">Total: Rp {total.toLocaleString('id-ID')}</p>
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn-secondary flex-1" onClick={() => { setPayModal(false); setCashReceived(''); }}>Batal</button>
              <button type="button" className="btn-primary flex-1" onClick={handlePayment} disabled={processing}>Selesai</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
