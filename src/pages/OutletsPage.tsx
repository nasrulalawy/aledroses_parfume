import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import type { Outlet, OutletType } from '@/types/database'

const OUTLET_TYPE_OPTIONS: { value: OutletType; label: string }[] = [
  { value: 'parfume', label: 'Parfume' },
  { value: 'barbershop', label: 'Barbershop' },
]

export function OutletsPage() {
  const { profile } = useAuthContext()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [form, setForm] = useState({ name: '', code: '', address: '', outlet_type: 'parfume' as OutletType, is_active: true })

  const isSuperAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchOutlets()
  }, [isSuperAdmin])

  async function fetchOutlets() {
    const { data, error } = await supabase
      .from('outlets')
      .select('id, name, code, address, outlet_type, is_active, created_at, updated_at')
      .order('name')
    if (error?.code === 'PGRST204' || (error?.message && error.message.includes('column'))) {
      const fallback = await supabase.from('outlets').select('id, name').order('name')
      const rows = (fallback.data as Record<string, unknown>[]) ?? []
      setOutlets(rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        code: null,
        address: null,
        outlet_type: 'parfume',
        is_active: true,
        created_at: '',
        updated_at: '',
      })))
    } else {
      setOutlets((data as Outlet[]) ?? [])
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) return
    const fullPayload = {
      name: form.name,
      code: form.code || null,
      address: form.address || null,
      outlet_type: form.outlet_type,
      is_active: form.is_active,
    }
    const minimalPayload = { name: form.name }
    const tryMutate = async (payload: Record<string, unknown>) => {
      if (editing) {
        return supabase.from('outlets').update(payload).eq('id', editing.id)
      }
      return supabase.from('outlets').insert(payload)
    }
    let result = await tryMutate(fullPayload)
    if (result.error?.code === 'PGRST204' || (result.error?.message && result.error.message.includes('column'))) {
      result = await tryMutate(minimalPayload)
    }
    if (result.error) {
      alert(result.error.message || 'Gagal menyimpan outlet')
      return
    }
    setEditing(null)
    setForm({ name: '', code: '', address: '', outlet_type: 'parfume', is_active: true })
    fetchOutlets()
  }

  function startEdit(o: Outlet) {
    setEditing(o)
    setForm({
      name: o.name,
      code: o.code ?? '',
      address: o.address ?? '',
      outlet_type: o.outlet_type ?? 'parfume',
      is_active: o.is_active,
    })
  }

  async function handleDelete(id: string) {
    if (!isSuperAdmin || !confirm('Hapus outlet ini? Data terkait (produk, karyawan, dll) harus dipindah atau akan error.')) return
    await supabase.from('outlets').delete().eq('id', id)
    fetchOutlets()
  }

  if (!isSuperAdmin) {
    return (
      <div className="card">
        <p className="text-gray-600 dark:text-gray-400">Hanya Super Admin yang dapat mengelola outlet.</p>
      </div>
    )
  }

  if (loading) return <div>Memuat...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Outlet</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">Tambah dan kelola outlet. Data tiap outlet sepenuhnya terpisah.</p>

      <form onSubmit={handleSubmit} className="card mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nama outlet</label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kode</label>
          <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="input" placeholder="OUT001" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Alamat</label>
          <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipe outlet</label>
          <select value={form.outlet_type} onChange={(e) => setForm((f) => ({ ...f, outlet_type: e.target.value as OutletType }))} className="input">
            {OUTLET_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Barbershop: wajib pilih barber di POS; penjualan tercatat ke barber</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          <label htmlFor="is_active">Aktif</label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">{editing ? 'Simpan' : 'Tambah outlet'}</button>
          {editing && (
            <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', code: '', address: '', outlet_type: 'parfume', is_active: true }); }}>
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2">Nama</th>
              <th className="text-left py-2">Kode</th>
              <th className="text-left py-2">Tipe</th>
              <th className="text-left py-2">Alamat</th>
              <th className="py-2">Status</th>
              <th className="w-32">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => (
              <tr key={o.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 font-medium">{o.name}</td>
                <td className="py-2">{o.code ?? '-'}</td>
                <td className="py-2">{o.outlet_type === 'barbershop' ? 'Barbershop' : 'Parfume'}</td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{o.address ?? '-'}</td>
                <td className="py-2">{o.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td className="py-2">
                  <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => startEdit(o)}>Edit</button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => handleDelete(o.id)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
