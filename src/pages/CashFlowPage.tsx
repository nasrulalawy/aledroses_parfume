import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import type { CashFlow, CashFlowCategory } from '@/types/database'

const CATEGORIES: { value: CashFlowCategory; label: string }[] = [
  { value: 'penjualan', label: 'Penjualan' },
  { value: 'modal_awal', label: 'Modal Awal' },
  { value: 'pembelian', label: 'Pembelian' },
  { value: 'gaji', label: 'Gaji' },
  { value: 'operasional', label: 'Operasional' },
  { value: 'lainnya', label: 'Lainnya' },
]

export function CashFlowPage() {
  const { profile } = useAuthContext()
  const { outletId, isSuperAdmin } = useOutlet()
  const [flows, setFlows] = useState<CashFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'in' as 'in' | 'out', category: 'lainnya' as CashFlowCategory, amount: '', description: '' })
  const canAdd = profile?.role === 'super_admin' || profile?.role === 'manager'

  useEffect(() => {
    if (!outletId && !isSuperAdmin) return
    if (!outletId) return
    fetchFlows()
  }, [outletId, fromDate, toDate, isSuperAdmin])

  async function fetchFlows() {
    if (!outletId) return
    const { data } = await supabase
      .from('cash_flows')
      .select('*')
      .eq('outlet_id', outletId)
      .gte('created_at', fromDate)
      .lte('created_at', toDate + 'T23:59:59')
      .order('created_at', { ascending: false })
    setFlows((data as CashFlow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!outletId) return
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      alert('Nominal harus lebih dari 0')
      return
    }
    await supabase.from('cash_flows').insert({
      outlet_id: outletId,
      type: form.type,
      category: form.category,
      amount,
      description: form.description || null,
    })
    setShowForm(false)
    setForm({ type: 'in', category: 'lainnya', amount: '', description: '' })
    fetchFlows()
  }

  const totalIn = flows.filter((f) => f.type === 'in').reduce((s, f) => s + Number(f.amount), 0)
  const totalOut = flows.filter((f) => f.type === 'out').reduce((s, f) => s + Number(f.amount), 0)
  const balance = totalIn - totalOut

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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Arus Kas</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Pemasukan</p>
          <p className="text-xl font-bold text-green-600">Rp {totalIn.toLocaleString('id-ID')}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Pengeluaran</p>
          <p className="text-xl font-bold text-red-600">Rp {totalOut.toLocaleString('id-ID')}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Saldo</p>
          <p className="text-xl font-bold">Rp {balance.toLocaleString('id-ID')}</p>
        </div>
      </div>
      <div className="card mt-4 flex gap-4 flex-wrap items-center">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input w-40" />
        <span>s/d</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input w-40" />
        {canAdd && (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>Tambah Pemasukan/Pengeluaran</button>
        )}
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="card mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipe</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'in' | 'out' }))} className="input">
              <option value="in">Pemasukan</option>
              <option value="out">Pengeluaran</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategori</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CashFlowCategory }))} className="input">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nominal</label>
            <input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Keterangan</label>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Simpan</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
          </div>
        </form>
      )}
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2">Tanggal</th>
              <th className="text-left py-2">Tipe</th>
              <th className="text-left py-2">Kategori</th>
              <th className="text-right py-2">Nominal</th>
              <th className="text-left py-2">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2">{new Date(f.created_at).toLocaleString('id-ID')}</td>
                <td className="py-2">{f.type === 'in' ? 'Masuk' : 'Keluar'}</td>
                <td className="py-2">{CATEGORIES.find((c) => c.value === f.category)?.label ?? f.category}</td>
                <td className={`py-2 text-right ${f.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                  {f.type === 'in' ? '+' : '-'} Rp {Number(f.amount).toLocaleString('id-ID')}
                </td>
                <td className="py-2">{f.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
