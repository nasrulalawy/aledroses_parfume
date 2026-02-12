import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Category } from '@/types/database'

export function CategoriesPage() {
  const { profile } = useAuthContext()
  const { outletId } = useOutlet()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const canEdit = profile?.role === 'super_admin' || profile?.role === 'manager'

  useEffect(() => {
    if (!outletId) return
    fetchCategories()
  }, [outletId])

  async function fetchCategories() {
    if (!outletId) return
    const { data, error } = await supabase.from('categories').select('*').eq('outlet_id', outletId).order('name')
    if (!error) setCategories((data as Category[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!outletId) return
    if (editing) {
      await supabase.from('categories').update({ name: form.name, description: form.description || null }).eq('id', editing.id)
    } else {
      await supabase.from('categories').insert({ outlet_id: outletId, name: form.name, description: form.description || null })
    }
    setEditing(null)
    setForm({ name: '', description: '' })
    fetchCategories()
  }

  function startEdit(c: Category) {
    setEditing(c)
    setForm({ name: c.name, description: c.description || '' })
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const { data, error } = await supabase.rpc('delete_category_cascade', { p_category_id: deleteTarget.id })
    const res = data as { ok?: boolean; error?: string } | null
    setDeleteTarget(null)
    if (error || !res?.ok) {
      alert(res?.error || error?.message || 'Gagal menghapus kategori')
      return
    }
    fetchCategories()
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kategori</h1>
      <form onSubmit={handleSubmit} className="card mt-4 flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Nama</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input"
            required
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Deskripsi</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary">{editing ? 'Simpan' : 'Tambah'}</button>
        {editing && (
          <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', description: '' }); }}>
            Batal
          </button>
        )}
      </form>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2">Nama</th>
              <th className="text-left py-2">Deskripsi</th>
              <th className="w-32">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2">{c.name}</td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{c.description || '-'}</td>
                <td className="py-2">
                  {canEdit && (
                    <>
                      <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => startEdit(c)}>Edit</button>
                      <button type="button" className="text-red-600 hover:underline" onClick={() => setDeleteTarget(c)}>Hapus</button>
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
        title="Hapus kategori"
        message={deleteTarget ? `Yakin hapus kategori "${deleteTarget.name}"? Kategori yang masih punya produk tidak bisa dihapus.` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
