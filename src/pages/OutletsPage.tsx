import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import type { Outlet } from '@/types/database'

export function OutletsPage() {
  const { profile } = useAuthContext()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [form, setForm] = useState({ name: '', code: '', address: '', is_active: true })

  const isSuperAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchOutlets()
  }, [isSuperAdmin])

  async function fetchOutlets() {
    const { data } = await supabase.from('outlets').select('*').order('name')
    setOutlets((data as Outlet[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) return
    const payload = {
      name: form.name,
      code: form.code || null,
      address: form.address || null,
      is_active: form.is_active,
    }
    if (editing) {
      await supabase.from('outlets').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('outlets').insert(payload)
    }
    setEditing(null)
    setForm({ name: '', code: '', address: '', is_active: true })
    fetchOutlets()
  }

  function startEdit(o: Outlet) {
    setEditing(o)
    setForm({
      name: o.name,
      code: o.code ?? '',
      address: o.address ?? '',
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
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          <label htmlFor="is_active">Aktif</label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">{editing ? 'Simpan' : 'Tambah outlet'}</button>
          {editing && (
            <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', code: '', address: '', is_active: true }); }}>
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
