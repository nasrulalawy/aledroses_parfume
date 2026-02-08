import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOutlet } from '@/contexts/OutletContext'
import type { Product } from '@/types/database'

type MovementRow = {
  id: string
  outlet_id: string
  product_id: string
  type: 'in' | 'out'
  quantity: number
  unit_cost: number | null
  notes: string | null
  created_at: string
  created_by: string | null
  products: { name: string; sku: string } | null
}

export function StockPage() {
  const { outletId } = useOutlet()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ product_id: '', quantity: '', unit_cost: '', notes: '' })
  const [productSearch, setProductSearch] = useState('')
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const productInputRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  const filteredProducts = useMemo(() => {
    const onlyBarang = products.filter((p) => !p.is_service)
    const q = productSearch.trim().toLowerCase()
    if (!q) return onlyBarang
    return onlyBarang.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    )
  }, [products, productSearch])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (productInputRef.current && !productInputRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!outletId) return
    Promise.all([fetchProducts(), fetchMovements()]).finally(() => setLoading(false))
  }, [outletId])

  async function fetchProducts() {
    if (!outletId) return
    const { data } = await supabase.from('products').select('*').eq('outlet_id', outletId).eq('is_active', true).order('name')
    setProducts((data as Product[]) ?? [])
  }

  async function fetchMovements() {
    if (!outletId) return
    const { data } = await supabase
      .from('stock_movements')
      .select('id, outlet_id, product_id, type, quantity, unit_cost, notes, created_at, created_by, products(name, sku)')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false })
      .limit(100)
    setMovements((data as unknown as MovementRow[]) ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!outletId) return
    const qty = Number(form.quantity)
    if (!form.product_id || qty <= 0) {
      setError('Pilih produk dan isi jumlah yang valid.')
      return
    }
    setSubmitting(true)
    const { error: rpcError } = await supabase.rpc('record_stock_in', {
      p_outlet_id: outletId,
      p_product_id: form.product_id,
      p_quantity: qty,
      p_unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      p_notes: form.notes || null,
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setForm({ product_id: '', quantity: '', unit_cost: '', notes: '' })
    setProductSearch('')
    await Promise.all([fetchProducts(), fetchMovements()])
  }

  function selectProduct(p: Product) {
    setForm((f) => ({ ...f, product_id: p.id }))
    setProductSearch(`${p.name} (${p.sku})`)
    setProductDropdownOpen(false)
  }

  const selectedProduct = form.product_id ? products.find((p) => p.id === form.product_id) : null

  if (!outletId) return (
    <div className="card">
      <p className="font-medium text-gray-900 dark:text-white">Outlet belum diatur</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Pilih outlet di dropdown header (super admin) atau minta admin mengaitkan karyawan ke outlet.
      </p>
    </div>
  )
  if (loading) return <div>Memuat...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stok / Barang Masuk</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">
        Catat barang masuk. HPP produk dihitung otomatis dengan <strong>metode rata-rata</strong> (weighted average).
      </p>

      <form onSubmit={handleSubmit} className="card mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative" ref={productInputRef}>
          <label className="block text-sm font-medium mb-1">Produk</label>
          <input
            type="text"
            value={productDropdownOpen ? productSearch : (selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : productSearch)}
            onChange={(e) => {
              setProductSearch(e.target.value)
              setForm((f) => ({ ...f, product_id: '' }))
              setProductDropdownOpen(true)
            }}
            onFocus={() => setProductDropdownOpen(true)}
            className="input"
            placeholder="Cari nama atau SKU..."
            autoComplete="off"
          />
          {productDropdownOpen && (
            <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
              {filteredProducts.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Tidak ada produk</li>
              ) : (
                filteredProducts.map((p) => (
                  <li
                    key={p.id}
                    role="option"
                    tabIndex={0}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 focus:outline-none"
                    onClick={() => selectProduct(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectProduct(p)
                      }
                    }}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-500 dark:text-gray-400"> ({p.sku})</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">— stok: {p.stock}</span>
                  </li>
                ))
              )}
            </ul>
          )}
          <input type="hidden" name="product_id" value={form.product_id} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Jumlah masuk</label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            className="input"
            placeholder="Qty"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Harga beli per unit (opsional)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.unit_cost}
            onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
            className="input"
            placeholder="Untuk hitung HPP rata-rata"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Catatan</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input"
            placeholder="Opsional"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Catat Barang Masuk'}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="card mt-6">
        <h3 className="font-semibold text-gray-900 dark:text-white">Riwayat Barang Masuk</h3>
        <div className="overflow-x-auto mt-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-2">Waktu</th>
                <th className="text-left py-2">Produk</th>
                <th className="text-right py-2">Jumlah</th>
                <th className="text-right py-2">Harga beli/unit</th>
                <th className="text-left py-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-gray-500">Belum ada data barang masuk.</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 text-sm">{new Date(m.created_at).toLocaleString('id-ID')}</td>
                    <td className="py-2">{m.products?.name ?? '-'} <span className="text-gray-500">({m.products?.sku ?? '-'})</span></td>
                    <td className="py-2 text-right font-medium">+{Number(m.quantity).toLocaleString('id-ID')}</td>
                    <td className="py-2 text-right">{m.unit_cost != null ? `Rp ${Number(m.unit_cost).toLocaleString('id-ID')}` : '-'}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-400">{m.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
