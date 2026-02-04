import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import type { Employee } from '@/types/database'

const JABATAN_OPTIONS: { value: string; label: string }[] = [
  { value: 'Manager', label: 'Manager' },
  { value: 'Kasir', label: 'Kasir' },
]

export function EmployeesPage() {
  const { profile } = useAuthContext()
  const { outletId, outlets, isSuperAdmin } = useOutlet()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState({ outlet_id: '' as string, nip: '', nama: '', no_telp: '', alamat: '', jabatan: '', gaji: '' as number | '', is_active: true })
  const [accountModal, setAccountModal] = useState<Employee | null>(null)
  const [accountForm, setAccountForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [accountSubmitting, setAccountSubmitting] = useState(false)
  const [accountError, setAccountError] = useState('')
  const canEdit = profile?.role === 'super_admin' || profile?.role === 'manager'
  const effectiveOutletId = isSuperAdmin ? (form.outlet_id || outletId) : outletId

  useEffect(() => {
    if (!effectiveOutletId) return
    fetchEmployees()
  }, [effectiveOutletId])

  async function fetchEmployees() {
    if (!effectiveOutletId) return
    const { data } = await supabase.from('employees').select('*').eq('outlet_id', effectiveOutletId).order('nama')
    setEmployees((data as Employee[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    const outId = isSuperAdmin ? form.outlet_id : outletId
    if (!outId) return
    const payload = {
      outlet_id: outId,
      nip: form.nip,
      nama: form.nama,
      no_telp: form.no_telp || null,
      alamat: form.alamat || null,
      jabatan: form.jabatan || null,
      gaji: form.gaji !== '' ? Number(form.gaji) : null,
      is_active: form.is_active,
      profile_id: null,
    }
    if (editing) {
      await supabase.from('employees').update({
        outlet_id: outId,
        nip: payload.nip,
        nama: payload.nama,
        no_telp: payload.no_telp,
        alamat: payload.alamat,
        jabatan: payload.jabatan,
        gaji: payload.gaji,
        is_active: payload.is_active,
      }).eq('id', editing.id)
    } else {
      await supabase.from('employees').insert(payload)
    }
    setEditing(null)
    setForm({ outlet_id: (isSuperAdmin ? outletId : outletId) ?? '', nip: '', nama: '', no_telp: '', alamat: '', jabatan: '', gaji: '', is_active: true })
    fetchEmployees()
  }

  function startEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      outlet_id: emp.outlet_id,
      nip: emp.nip,
      nama: emp.nama,
      no_telp: emp.no_telp || '',
      alamat: emp.alamat || '',
      jabatan: emp.jabatan || '',
      gaji: emp.gaji ?? '',
      is_active: emp.is_active,
    })
  }

  async function handleDelete(id: string) {
    if (!canEdit || !confirm('Hapus karyawan ini?')) return
    await supabase.from('employees').delete().eq('id', id)
    fetchEmployees()
  }

  function canCreateAccount(emp: Employee): boolean {
    if (emp.profile_id) return false
    if (profile?.role === 'super_admin') return true
    if (profile?.role === 'manager' && emp.outlet_id === outletId) {
      return (emp.jabatan?.toLowerCase() !== 'manager')
    }
    return false
  }

  /** Kalau karyawan belum punya outlet, manager tidak bisa update profile_id (RLS); Buat Akun akan gagal mengaitkan. */
  function needsOutletForAccount(emp: Employee): boolean {
    return Boolean(
      (profile?.role === 'manager' && !emp.outlet_id) || (profile?.role === 'manager' && outletId && emp.outlet_id !== outletId)
    )
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!accountModal) return
    setAccountError('')
    if (accountForm.password !== accountForm.confirmPassword) {
      setAccountError('Password dan konfirmasi tidak sama.')
      return
    }
    if (accountForm.password.length < 6) {
      setAccountError('Password minimal 6 karakter.')
      return
    }
    const role = accountModal.jabatan?.toLowerCase() === 'manager' ? 'manager' : 'karyawan'
    if (profile?.role === 'manager' && role === 'manager') {
      setAccountError('Manager hanya dapat membuat akun kasir (karyawan).')
      return
    }
    setAccountSubmitting(true)
    setAccountError('')
    const { data, error } = await supabase.auth.signUp({
      email: accountForm.email,
      password: accountForm.password,
      options: {
        data: {
          full_name: accountModal.nama,
          role,
          employee_id: accountModal.id,
        },
      },
    })
    if (error) {
      setAccountSubmitting(false)
      setAccountError(error.message)
      return
    }
    const newUserId = data?.user?.id
    if (newUserId) {
      const { error: updateErr } = await supabase
        .from('employees')
        .update({ profile_id: newUserId })
        .eq('id', accountModal.id)
      if (updateErr) {
        setAccountSubmitting(false)
        setAccountError(
          `Akun user berhasil dibuat, tetapi gagal mengaitkan ke data karyawan: ${updateErr.message}. ` +
            'Pastikan karyawan ini sudah memiliki Outlet (Edit karyawan → pilih Outlet → Simpan), lalu coba Buat Akun lagi.'
        )
        return
      }
    }
    setAccountSubmitting(false)
    setAccountModal(null)
    setAccountForm({ email: '', password: '', confirmPassword: '' })
    fetchEmployees()
    alert('Akun berhasil dibuat. Jika konfirmasi email diaktifkan, user harus verifikasi email terlebih dahulu.')
  }

  if (!outletId && !isSuperAdmin) return (
    <div className="card">
      <p className="font-medium text-gray-900 dark:text-white">Outlet belum diatur</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Untuk karyawan/kasir, outlet di-set oleh admin atau manager. Minta mereka buka <strong>Karyawan</strong> → pilih Anda → <strong>Edit</strong> → isi/ubah <strong>Outlet</strong> lalu simpan.
      </p>
    </div>
  )
  if (loading) return <div>Memuat...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Karyawan</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">Super admin: tambah manager per outlet. Manager: tambah kasir untuk outlet Anda.</p>
      {canEdit && (
        <form onSubmit={handleSubmit} className="card mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Outlet</label>
            <select
              value={form.outlet_id || (profile?.role === 'manager' ? outletId ?? '' : '')}
              onChange={(e) => setForm((f) => ({ ...f, outlet_id: e.target.value }))}
              className="input"
              required
            >
              <option value="">Pilih outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {profile?.role === 'manager' && outlets.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Outlet Anda belum ter-load. Refresh halaman.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">NIP</label>
            <input type="text" value={form.nip} onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value }))} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama</label>
            <input type="text" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">No. Telp</label>
            <input type="text" value={form.no_telp} onChange={(e) => setForm((f) => ({ ...f, no_telp: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Alamat</label>
            <input type="text" value={form.alamat} onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jabatan</label>
            <select value={form.jabatan} onChange={(e) => setForm((f) => ({ ...f, jabatan: e.target.value }))} className="input" required>
              <option value="">Pilih jabatan</option>
              {JABATAN_OPTIONS.map((j) => (
                <option key={j.value} value={j.value}>{j.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gaji</label>
            <input type="number" min={0} value={form.gaji} onChange={(e) => setForm((f) => ({ ...f, gaji: e.target.value === '' ? '' : Number(e.target.value) }))} className="input" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="is_active">Aktif</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editing ? 'Simpan' : 'Tambah'}</button>
            {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ outlet_id: outletId ?? '', nip: '', nama: '', no_telp: '', alamat: '', jabatan: '', gaji: '', is_active: true }); }}>Batal</button>}
          </div>
        </form>
      )}
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2">NIP</th>
              <th className="text-left py-2">Nama</th>
              <th className="text-left py-2">Jabatan</th>
              <th className="text-right py-2">Gaji</th>
              <th className="py-2">Status</th>
              <th className="py-2">Akun</th>
              {canEdit && <th className="w-32">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2">{e.nip}</td>
                <td className="py-2">{e.nama}</td>
                <td className="py-2">{e.jabatan || '-'}</td>
                <td className="py-2 text-right">{e.gaji != null ? `Rp ${Number(e.gaji).toLocaleString('id-ID')}` : '-'}</td>
                <td className="py-2">{e.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td className="py-2">{e.profile_id ? 'Sudah punya akun' : '-'}</td>
                {canEdit && (
                  <td className="py-2">
                    {canCreateAccount(e) && (
                      <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => { setAccountModal(e); setAccountForm({ email: '', password: '', confirmPassword: '' }); setAccountError(''); }}>Buat Akun</button>
                    )}
                    <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => startEdit(e)}>Edit</button>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => handleDelete(e.id)}>Hapus</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {accountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h3 className="font-semibold text-lg">Buat Akun Login</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Untuk: {accountModal.nama} ({accountModal.jabatan || 'Karyawan'})
            </p>
            {needsOutletForAccount(accountModal) && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                <strong>Penting:</strong> Karyawan ini belum punya Outlet atau outlet-nya beda. Tanpa Outlet yang benar, akun tidak bisa dikaitkan. Tutup modal ini, lalu <strong>Edit</strong> karyawan → pilih <strong>Outlet</strong> → Simpan. Setelah itu buat akun lagi.
              </div>
            )}
            <form onSubmit={handleCreateAccount} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm((f) => ({ ...f, email: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))}
                  className="input w-full"
                  placeholder="Min. 6 karakter"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Konfirmasi Password</label>
                <input
                  type="password"
                  value={accountForm.confirmPassword}
                  onChange={(e) => setAccountForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>
              {accountError && <p className="text-sm text-red-600">{accountError}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setAccountModal(null); setAccountError(''); }}>Batal</button>
                <button type="submit" className="btn-primary flex-1" disabled={accountSubmitting}>
                  {accountSubmitting ? 'Memproses...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
