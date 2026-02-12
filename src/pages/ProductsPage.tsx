import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Product, Category } from '@/types/database'

export function ProductsPage() {
  const { profile } = useAuthContext()
  const { outletId } = useOutlet()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Product | null>(null)
  const [formHighlight, setFormHighlight] = useState(false)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formCardRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState({
    sku: '', name: '', category_id: '', unit: 'pcs', price: 0, cost: 0, stock: 0, is_service: false, is_active: true,
  })
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const canEdit = profile?.role === 'super_admin' || profile?.role === 'manager'

  useEffect(() => {
    if (!outletId) return
    Promise.all([
      supabase.from('products').select('*').eq('outlet_id', outletId).order('name'),
      supabase.from('categories').select('*').eq('outlet_id', outletId).order('name'),
    ]).then(([pRes, cRes]) => {
      if (!pRes.error) setProducts((pRes.data as Product[]) ?? [])
      if (!cRes.error) setCategories((cRes.data as Category[]) ?? [])
      setLoading(false)
    })
  }, [outletId])

  async function fetchProducts() {
    if (!outletId) return
    const { data } = await supabase.from('products').select('*').eq('outlet_id', outletId).order('name')
    if (data) setProducts(data as Product[])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!outletId) return
    const payload = {
      outlet_id: outletId,
      sku: form.sku,
      name: form.name,
      category_id: form.category_id,
      unit: form.unit,
      price: Number(form.price),
      cost: form.is_service ? null : (form.cost ? Number(form.cost) : null),
      stock: form.is_service ? 0 : Number(form.stock),
      is_service: form.is_service,
      is_active: form.is_active,
    }
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('products').insert(payload)
    }
    setEditing(null)
    setForm({ sku: '', name: '', category_id: '', unit: 'pcs', price: 0, cost: 0, stock: 0, is_service: false, is_active: true })
    fetchProducts()
  }

  function startEdit(p: Product) {
    setEditing(p)
    setForm({
      sku: p.sku, name: p.name, category_id: p.category_id, unit: p.unit,
      price: p.price, cost: p.cost ?? 0, stock: p.stock, is_service: p.is_service ?? false, is_active: p.is_active,
    })
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    setFormHighlight(true)
    highlightTimeoutRef.current = setTimeout(() => {
      setFormHighlight(false)
      highlightTimeoutRef.current = null
    }, 1200)
  }

  useEffect(() => () => { if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current) }, [])

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const { data, error } = await supabase.rpc('delete_product_cascade', { p_product_id: deleteTarget.id })
    const res = data as { ok?: boolean; error?: string } | null
    setDeleteTarget(null)
    if (error || !res?.ok) {
      alert(res?.error || error?.message || 'Gagal menghapus produk')
      return
    }
    fetchProducts()
  }

  if (!outletId) return (
    <div className="card">
      <p className="font-medium text-gray-900 dark:text-white">Outlet belum diatur</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Super admin: pilih outlet di dropdown di header. Karyawan/manager: minta admin mengaitkan karyawan ke outlet di menu Karyawan → Edit.
      </p>
    </div>
  )
  if (loading) return <div>Memuat...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produk</h1>
      <form ref={formCardRef} onSubmit={handleSubmit} className={`card mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${formHighlight ? 'animate-form-highlight' : ''}`}>
        <div>
          <label className="block text-sm font-medium mb-1">SKU</label>
          <input type="text" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nama</label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kategori</label>
          <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))} className="input" required>
            <option value="">Pilih</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Satuan</label>
          <input type="text" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Harga jual</label>
          <input type="number" min={0} step={0.01} value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))} className="input" required />
        </div>
        {!form.is_service && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">HPP (Harga Pokok Penjualan)</label>
              <input type="number" min={0} step={0.01} value={form.cost || ''} onChange={(e) => setForm((f) => ({ ...f, cost: Number(e.target.value) || 0 }))} className="input" placeholder="Dasar perhitungan keuntungan" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dasar perhitungan keuntungan per unit</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stok</label>
              <input type="number" min={0} value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) || 0 }))} className="input" />
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_service" checked={form.is_service} onChange={(e) => setForm((f) => ({ ...f, is_service: e.target.checked }))} />
          <label htmlFor="is_service">Produk jasa (tanpa stok &amp; HPP)</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          <label htmlFor="is_active">Aktif</label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">{editing ? 'Simpan' : 'Tambah'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ sku: '', name: '', category_id: '', unit: 'pcs', price: 0, cost: 0, stock: 0, is_service: false, is_active: true }); }}>Batal</button>}
        </div>
      </form>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2">SKU</th>
              <th className="text-left py-2">Nama</th>
              <th className="text-left py-2">Kategori</th>
              <th className="text-center py-2">Tipe</th>
              <th className="text-right py-2">Harga jual</th>
              <th className="text-right py-2">HPP</th>
              <th className="text-right py-2">Stok</th>
              <th className="w-32">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2">{p.sku}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">{categories.find((c) => c.id === p.category_id)?.name ?? '-'}</td>
                <td className="py-2 text-center">{p.is_service ? 'Jasa' : 'Barang'}</td>
                <td className="py-2 text-right">Rp {Number(p.price).toLocaleString('id-ID')}</td>
                <td className="py-2 text-right">{p.is_service ? '-' : (p.cost != null ? `Rp ${Number(p.cost).toLocaleString('id-ID')}` : '-')}</td>
                <td className="py-2 text-right">{p.is_service ? '-' : p.stock}</td>
                <td className="py-2">
                  {canEdit && (
                    <>
                      <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => startEdit(p)}>Edit</button>
                      <button type="button" className="text-red-600 hover:underline" onClick={() => setDeleteTarget(p)}>Hapus</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus produk"
        message={deleteTarget ? `Yakin hapus produk "${deleteTarget.name}"? Data stok masuk akan ikut terhapus. Produk yang sudah ada di transaksi tidak bisa dihapus.` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
