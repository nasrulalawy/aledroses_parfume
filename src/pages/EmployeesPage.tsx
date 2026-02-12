import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Employee, CompensationType, EmployeeType } from '@/types/database'
import type { Attendance } from '@/types/database'

type TxnItemRow = {
  product_id: string
  qty: number
  unit_price: number
  discount: number
  total: number
  products?: { id: string; name: string; sku: string; cost: number | null } | null
}

type TxnRow = {
  id: string
  created_at: string
  subtotal: number
  discount: number
  tax: number
  transaction_items?: TxnItemRow[] | null
}

function BarberDetailModal({
  employee,
  outletId,
  onClose,
}: {
  employee: Employee
  outletId: string
  onClose: () => void
}) {
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [attPeriod, setAttPeriod] = useState<'day' | 'month'>('month')
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10))
  const [attMonth, setAttMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)
  const [txns, setTxns] = useState<TxnRow[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])

  const txnSelect = 'id, created_at, subtotal, discount, tax, transaction_items(product_id, qty, unit_price, discount, total, products(id, name, sku, cost))'

  useEffect(() => {
    if (!outletId || !employee.id) return
    setLoading(true)
    const start = period === 'day' ? `${date}T00:00:00` : period === 'month' ? `${month}-01T00:00:00` : `${year}-01-01T00:00:00`
    const end =
      period === 'day'
        ? `${date}T23:59:59`
        : period === 'month'
          ? `${month}-${String(new Date(parseInt(month.slice(0, 4), 10), parseInt(month.slice(5, 7), 10), 0).getDate()).padStart(2, '0')}T23:59:59`
          : `${year}-12-31T23:59:59`
    void (async () => {
      try {
        const { data } = await supabase
          .from('transactions')
          .select(txnSelect)
          .eq('outlet_id', outletId)
          .eq('barber_id', employee.id)
          .eq('status', 'completed')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true })
          .limit(5000)
        setTxns(((data as unknown) as TxnRow[]) ?? [])
      } catch {
        setTxns([])
      } finally {
        setLoading(false)
      }
    })()
  }, [outletId, employee.id, period, date, month, year])

  useEffect(() => {
    if (!employee.id) return
    if (attPeriod === 'day') {
      supabase
        .from('attendances')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('date', attDate)
        .order('check_in')
        .then(({ data }) => setAttendances((data as Attendance[]) ?? []))
    } else {
      supabase
        .from('attendances')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('date', `${attMonth}-01`)
        .lt('date', `${attMonth}-32`)
        .order('date', { ascending: false })
        .then(({ data }) => setAttendances((data as Attendance[]) ?? []))
    }
  }, [employee.id, attPeriod, attDate, attMonth])

  const getBersihTotal = (t: TxnRow) => Number(t.subtotal ?? 0) - Number(t.discount ?? 0) + Number(t.tax ?? 0)
  const getTotalCost = (t: TxnRow) =>
    (t.transaction_items ?? []).reduce((sum, it) => sum + (Number(it.products?.cost ?? 0) * Number(it.qty)), 0)

  const totals = useMemo(() => {
    const total = txns.reduce((s, t) => s + getBersihTotal(t), 0)
    const totalCost = txns.reduce((s, t) => s + getTotalCost(t), 0)
    const profit = total - totalCost
    const pct = employee.profit_share_percent ?? 0
    const bagiHasil = pct ? (profit * pct) / 100 : 0
    return { total, totalCost, profit, bagiHasil, count: txns.length }
  }, [txns, employee.profit_share_percent])

  const grouped = useMemo(() => {
    if (period === 'day') return []
    const byKey: Record<string, { total: number; totalCost: number; count: number }> = {}
    for (const t of txns) {
      const key = period === 'month' ? t.created_at.slice(0, 10) : t.created_at.slice(0, 7)
      if (!byKey[key]) byKey[key] = { total: 0, totalCost: 0, count: 0 }
      byKey[key].total += getBersihTotal(t)
      byKey[key].totalCost += getTotalCost(t)
      byKey[key].count += 1
    }
    return Object.entries(byKey)
      .map(([k, v]) => ({ key: k, ...v, profit: v.total - v.totalCost }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [txns, period])

  const productBreakdown = useMemo(() => {
    const map: Record<string, { name: string; sku: string; qty: number; total: number }> = {}
    for (const t of txns) {
      for (const it of t.transaction_items ?? []) {
        const id = it.product_id
        if (!map[id]) map[id] = { name: it.products?.name ?? '-', sku: it.products?.sku ?? '-', qty: 0, total: 0 }
        map[id].qty += Number(it.qty)
        map[id].total += Number(it.total)
      }
    }
    return Object.entries(map)
      .map(([id, v]) => ({ product_id: id, ...v }))
      .sort((a, b) => b.total - a.total)
  }, [txns])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-xl">Detail Barber: {employee.nama}</h3>
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Bagi hasil: {employee.profit_share_percent != null ? `${employee.profit_share_percent}%` : '-'}
        </p>

        {/* Laporan Pendapatan */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="font-semibold text-lg mb-3">Laporan Pendapatan</h4>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" className={period === 'day' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPeriod('day')}>
              Harian
            </button>
            <button type="button" className={period === 'month' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPeriod('month')}>
              Bulanan
            </button>
            <button type="button" className={period === 'year' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPeriod('year')}>
              Tahunan
            </button>
            {period === 'day' && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-40" />}
            {period === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input w-40" />}
            {period === 'year' && <input type="number" min={2020} max={2030} value={year} onChange={(e) => setYear(e.target.value)} className="input w-24" />}
          </div>
          {loading ? (
            <p className="text-gray-500">Memuat...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="card">
                  <p className="text-xs text-gray-500">Total penjualan</p>
                  <p className="font-bold text-primary-600">Rp {totals.total.toLocaleString('id-ID')}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500">Keuntungan</p>
                  <p className={`font-bold ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rp {totals.profit.toLocaleString('id-ID')}</p>
                </div>
                <div className="card border-l-4 border-l-primary-500">
                  <p className="text-xs text-gray-500">Total bagi hasil</p>
                  <p className="font-bold text-primary-600">Rp {totals.bagiHasil.toLocaleString('id-ID')}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500">Transaksi</p>
                  <p className="font-bold">{totals.count}</p>
                </div>
              </div>
              {grouped.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">{period === 'month' ? 'Tanggal' : 'Bulan'}</th>
                        <th className="text-right py-2">Transaksi</th>
                        <th className="text-right py-2">Penjualan</th>
                        <th className="text-right py-2">Keuntungan</th>
                        <th className="text-right py-2">Bagi hasil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.map((g) => {
                        const pct = employee.profit_share_percent ?? 0
                        const share = pct ? (g.profit * pct) / 100 : 0
                        return (
                          <tr key={g.key} className="border-b">
                            <td className="py-2">{g.key}</td>
                            <td className="py-2 text-right">{g.count}</td>
                            <td className="py-2 text-right">Rp {g.total.toLocaleString('id-ID')}</td>
                            <td className={`py-2 text-right ${g.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rp {g.profit.toLocaleString('id-ID')}</td>
                            <td className="py-2 text-right text-primary-600">Rp {share.toLocaleString('id-ID')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Laporan Absensi */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="font-semibold text-lg mb-3">Laporan Absensi</h4>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" className={attPeriod === 'day' ? 'btn-primary' : 'btn-secondary'} onClick={() => setAttPeriod('day')}>
              Per Hari
            </button>
            <button type="button" className={attPeriod === 'month' ? 'btn-primary' : 'btn-secondary'} onClick={() => setAttPeriod('month')}>
              Per Bulan
            </button>
            {attPeriod === 'day' && <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className="input w-40" />}
            {attPeriod === 'month' && <input type="month" value={attMonth} onChange={(e) => setAttMonth(e.target.value)} className="input w-40" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Tanggal</th>
                  <th className="text-left py-2">Check-in</th>
                  <th className="text-left py-2">Check-out</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendances.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2">{a.date}</td>
                    <td className="py-2">{a.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID') : '-'}</td>
                    <td className="py-2">{a.check_out ? new Date(a.check_out).toLocaleTimeString('id-ID') : '-'}</td>
                    <td className="py-2 capitalize">{a.status}</td>
                  </tr>
                ))}
                {attendances.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-500">
                      Tidak ada data absensi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rincian Produk Terjual */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="font-semibold text-lg mb-3">Rincian Produk Terjual</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Produk</th>
                  <th className="text-left py-2">SKU</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Total (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {productBreakdown.map((p) => (
                  <tr key={p.product_id} className="border-b">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-400">{p.sku}</td>
                    <td className="py-2 text-right tabular-nums">{p.qty}</td>
                    <td className="py-2 text-right tabular-nums">Rp {p.total.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                {productBreakdown.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-500">
                      Belum ada produk terjual
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const COMPENSATION_OPTIONS: { value: CompensationType; label: string }[] = [
  { value: 'gaji', label: 'Gaji' },
  { value: 'bagi_hasil', label: 'Bagi hasil' },
]

const EMPLOYEE_TYPE_OPTIONS: { value: EmployeeType; label: string }[] = [
  { value: 'staff', label: 'Staff (Kasir/Manager)' },
  { value: 'barber', label: 'Barber' },
]

const JABATAN_OPTIONS: { value: string; label: string }[] = [
  { value: 'Manager', label: 'Manager' },
  { value: 'Kasir', label: 'Kasir' },
  { value: 'Barber', label: 'Barber' },
]

export function EmployeesPage() {
  const { profile } = useAuthContext()
  const { outletId, outlets, isSuperAdmin } = useOutlet()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState({ outlet_id: '' as string, nip: '', nama: '', no_telp: '', alamat: '', jabatan: '', gaji: '' as number | '', compensation_type: 'gaji' as CompensationType, profit_share_percent: '' as number | '', employee_type: 'staff' as EmployeeType, is_active: true })
  const [accountModal, setAccountModal] = useState<Employee | null>(null)
  const [accountForm, setAccountForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [showAccountPassword, setShowAccountPassword] = useState(false)
  const [showAccountConfirmPassword, setShowAccountConfirmPassword] = useState(false)
  const [accountSubmitting, setAccountSubmitting] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [linkAccountModal, setLinkAccountModal] = useState<Employee | null>(null)
  const [linkAccountEmail, setLinkAccountEmail] = useState('')
  const [linkAccountError, setLinkAccountError] = useState('')
  const [linkAccountSubmitting, setLinkAccountSubmitting] = useState(false)
  const [detailModal, setDetailModal] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const canEdit = profile?.role === 'super_admin' || profile?.role === 'manager'
  const effectiveOutletId = isSuperAdmin ? (form.outlet_id || outletId) : outletId

  useEffect(() => {
    if (!effectiveOutletId) {
      setEmployees([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchEmployees()
  }, [effectiveOutletId])

  async function fetchEmployees() {
    if (!effectiveOutletId) return
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('outlet_id', effectiveOutletId)
      .order('nama')
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
      compensation_type: form.compensation_type,
      profit_share_percent: form.compensation_type === 'bagi_hasil' && form.profit_share_percent !== '' ? Number(form.profit_share_percent) : null,
      employee_type: form.employee_type,
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
        compensation_type: payload.compensation_type,
        profit_share_percent: payload.profit_share_percent,
        employee_type: payload.employee_type,
        is_active: payload.is_active,
      }).eq('id', editing.id)
    } else {
      await supabase.from('employees').insert(payload)
    }
    setEditing(null)
    setForm({ outlet_id: (isSuperAdmin ? outletId : outletId) ?? '', nip: '', nama: '', no_telp: '', alamat: '', jabatan: '', gaji: '', compensation_type: 'gaji', profit_share_percent: '', employee_type: 'staff', is_active: true })
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
      compensation_type: emp.compensation_type ?? 'gaji',
      profit_share_percent: emp.profit_share_percent != null ? emp.profit_share_percent : '',
      employee_type: emp.employee_type ?? 'staff',
      is_active: emp.is_active,
    })
  }

  async function handleDeleteConfirm() {
    if (!canEdit || !deleteTarget) return
    const { data, error } = await supabase.rpc('delete_employee_cascade', { p_employee_id: deleteTarget.id })
    const res = data as { ok?: boolean; error?: string } | null
    setDeleteTarget(null)
    if (error || !res?.ok) {
      alert(res?.error || error?.message || 'Gagal menghapus karyawan')
      return
    }
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
      // Trigger handle_new_user di DB (migrasi 20240204000020) set employees.profile_id saat user dibuat.
      // RPC link_employee_profile dipanggil sebagai cadangan.
      void supabase.rpc('link_employee_profile', {
        p_employee_id: accountModal.id,
        p_profile_id: newUserId,
      })
      // Langsung update daftar agar kolom Akun tampil "Sudah punya akun"
      setEmployees((prev) =>
        prev.map((e) => (e.id === accountModal.id ? { ...e, profile_id: newUserId } : e))
      )
    }
    setAccountSubmitting(false)
    setAccountModal(null)
    setAccountForm({ email: '', password: '', confirmPassword: '' })
    // Beri waktu sebentar agar trigger/commit di DB selesai sebelum refetch
    await new Promise((r) => setTimeout(r, 400))
    await fetchEmployees()
    alert('Akun berhasil dibuat. Jika konfirmasi email diaktifkan, user harus verifikasi email terlebih dahulu.')
  }

  async function handleLinkAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!linkAccountModal) return
    setLinkAccountError('')
    setLinkAccountSubmitting(true)
    const { data, error } = await supabase.rpc('link_employee_profile_by_email', {
      p_employee_id: linkAccountModal.id,
      p_email: linkAccountEmail.trim(),
    })
    setLinkAccountSubmitting(false)
    const res = data as { ok?: boolean; error?: string } | null
    if (error || !res?.ok) {
      setLinkAccountError(res?.error || error?.message || 'Gagal mengaitkan akun')
      return
    }
    setLinkAccountModal(null)
    setLinkAccountEmail('')
    await fetchEmployees()
    alert('Akun berhasil dikaitkan. User tersebut bisa login dan outlet akan ter-set.')
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
            <label className="block text-sm font-medium mb-1">Tipe karyawan</label>
            <select value={form.employee_type} onChange={(e) => setForm((f) => ({ ...f, employee_type: e.target.value as EmployeeType }))} className="input">
              {EMPLOYEE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Barber: untuk outlet Barbershop, bisa dipilih di POS untuk atribusi penjualan</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe kompensasi</label>
            <select value={form.compensation_type} onChange={(e) => setForm((f) => ({ ...f, compensation_type: e.target.value as CompensationType }))} className="input">
              {COMPENSATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gaji</label>
            <input type="number" min={0} value={form.gaji} onChange={(e) => setForm((f) => ({ ...f, gaji: e.target.value === '' ? '' : Number(e.target.value) }))} className="input" placeholder={form.compensation_type === 'bagi_hasil' ? 'Opsional' : ''} />
            {form.compensation_type === 'bagi_hasil' && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Untuk bagi hasil, isi jika ada dasar/insentif tambahan</p>}
          </div>
          {form.compensation_type === 'bagi_hasil' && (
            <div>
              <label className="block text-sm font-medium mb-1">Persentase bagi hasil (%)</label>
              <input type="number" min={0} max={100} step={0.5} value={form.profit_share_percent} onChange={(e) => setForm((f) => ({ ...f, profit_share_percent: e.target.value === '' ? '' : Number(e.target.value) }))} className="input" placeholder="Contoh: 30" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Persen dari keuntungan penjualan (profit) yang menjadi hak karyawan</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="is_active">Aktif</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editing ? 'Simpan' : 'Tambah'}</button>
            {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ outlet_id: outletId ?? '', nip: '', nama: '', no_telp: '', alamat: '', jabatan: '', gaji: '', compensation_type: 'gaji', profit_share_percent: '', employee_type: 'staff', is_active: true }); }}>Batal</button>}
          </div>
        </form>
      )}
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2">NIP</th>
              <th className="text-left py-2">Nama</th>
              <th className="text-left py-2">Outlet</th>
              <th className="text-left py-2">Tipe</th>
              <th className="text-left py-2">Jabatan</th>
              <th className="text-left py-2">Kompensasi</th>
              <th className="text-right py-2">Bagi hasil %</th>
              <th className="text-right py-2">Gaji</th>
              <th className="py-2">Status</th>
              <th className="py-2">Akun</th>
              <th className="w-40">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2">{e.nip}</td>
                <td className="py-2">{e.nama}</td>
                <td className="py-2">{outlets.find((o) => o.id === e.outlet_id)?.name ?? '-'}</td>
                <td className="py-2">{e.employee_type === 'barber' ? 'Barber' : 'Staff'}</td>
                <td className="py-2">{e.jabatan || '-'}</td>
                <td className="py-2">{e.compensation_type === 'bagi_hasil' ? 'Bagi hasil' : 'Gaji'}</td>
                <td className="py-2 text-right">{e.compensation_type === 'bagi_hasil' && e.profit_share_percent != null ? `${Number(e.profit_share_percent)}%` : '-'}</td>
                <td className="py-2 text-right">{e.gaji != null ? `Rp ${Number(e.gaji).toLocaleString('id-ID')}` : '-'}</td>
                <td className="py-2">{e.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td className="py-2">{e.profile_id ? 'Sudah punya akun' : '-'}</td>
                <td className="py-2">
                  {e.employee_type === 'barber' && (
                    <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => setDetailModal(e)}>
                      Detail
                    </button>
                  )}
                  {canEdit && (
                    <>
                      {canCreateAccount(e) && (
                        <>
                          <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => { setAccountModal(e); setAccountForm({ email: '', password: '', confirmPassword: '' }); setAccountError(''); }}>Buat Akun</button>
                          <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => { setLinkAccountModal(e); setLinkAccountEmail(''); setLinkAccountError(''); }}>Link akun</button>
                        </>
                      )}
                      <button type="button" className="text-primary-600 hover:underline mr-2" onClick={() => startEdit(e)}>Edit</button>
                      <button type="button" className="text-red-600 hover:underline" onClick={() => setDeleteTarget(e)}>Hapus</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailModal && effectiveOutletId && (
        <BarberDetailModal
          employee={detailModal}
          outletId={effectiveOutletId}
          onClose={() => setDetailModal(null)}
        />
      )}
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
                <div className="relative">
                  <input
                    type={showAccountPassword ? 'text' : 'password'}
                    value={accountForm.password}
                    onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))}
                    className="input w-full pr-10"
                    placeholder="Min. 6 karakter"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    title={showAccountPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-label={showAccountPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showAccountPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Konfirmasi Password</label>
                <div className="relative">
                  <input
                    type={showAccountConfirmPassword ? 'text' : 'password'}
                    value={accountForm.confirmPassword}
                    onChange={(e) => setAccountForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    className="input w-full pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountConfirmPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    title={showAccountConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-label={showAccountConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showAccountConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
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
      {linkAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h3 className="font-semibold text-lg">Link ke akun yang sudah ada</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Untuk: {linkAccountModal.nama}. Masukkan email login user yang sudah terdaftar. Setelah itu user tersebut login dan outlet akan ter-set.
            </p>
            <form onSubmit={handleLinkAccount} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email login</label>
                <input
                  type="email"
                  value={linkAccountEmail}
                  onChange={(e) => setLinkAccountEmail(e.target.value)}
                  className="input w-full"
                  placeholder="contoh@email.com"
                  required
                />
              </div>
              {linkAccountError && <p className="text-sm text-red-600">{linkAccountError}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setLinkAccountModal(null); setLinkAccountError(''); }}>Batal</button>
                <button type="submit" className="btn-primary flex-1" disabled={linkAccountSubmitting}>
                  {linkAccountSubmitting ? 'Memproses...' : 'Link akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus karyawan"
        message={deleteTarget ? `Yakin hapus karyawan "${deleteTarget.nama}"? Data terkait (transaksi, shift, absensi, link akun) akan ikut terhapus.` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
