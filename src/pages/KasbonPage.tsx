import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import type { Employee, EmployeeKasbon } from '@/types/database'

type KasbonWithEmployee = EmployeeKasbon & { employees?: { nama: string } | null }

export function KasbonPage() {
  const { profile } = useAuthContext()
  const { outletId, isSuperAdmin } = useOutlet()
  const [list, setList] = useState<KasbonWithEmployee[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employee_id: '', amount: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const canAdd = profile?.role === 'super_admin' || profile?.role === 'manager' || profile?.role === 'karyawan'

  useEffect(() => {
    if (!outletId && !isSuperAdmin) return
    if (!outletId) return
    fetchKasbon()
    fetchEmployees()
  }, [outletId, isSuperAdmin])

  async function fetchKasbon() {
    if (!outletId) return
    const { data } = await supabase
      .from('employee_kasbon')
      .select('id, outlet_id, employee_id, amount, notes, created_at, employees(nama)')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false })
    setList((data as KasbonWithEmployee[]) ?? [])
    setLoading(false)
  }

  async function fetchEmployees() {
    if (!outletId) return
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('is_active', true)
      .order('nama')
    setEmployees((data as Employee[]) ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!outletId) return
    const amount = Number(form.amount.replace(/\D/g, ''))
    if (!amount || amount <= 0) {
      alert('Nominal harus lebih dari 0')
      return
    }
    if (!form.employee_id) {
      alert('Pilih karyawan terlebih dahulu')
      return
    }
    setSubmitting(true)
    try {
      const { data: inserted, error: kasbonErr } = await supabase
        .from('employee_kasbon')
        .insert({
          outlet_id: outletId,
          employee_id: form.employee_id,
          amount,
          notes: form.notes.trim() || null,
        })
        .select('id')
        .single()
      if (kasbonErr) throw kasbonErr

      const emp = employees.find((e) => e.id === form.employee_id)
      await supabase.from('cash_flows').insert({
        outlet_id: outletId,
        type: 'out',
        category: 'kasbon_karyawan',
        amount,
        description: `Kasbon - ${emp?.nama ?? '-'}`,
        reference_type: 'employee_kasbon',
        reference_id: inserted?.id ?? null,
      })

      setShowForm(false)
      setForm({ employee_id: '', amount: '', notes: '' })
      fetchKasbon()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan kasbon')
    } finally {
      setSubmitting(false)
    }
  }

  const totalKasbon = list.reduce((s, k) => s + Number(k.amount), 0)
  const byEmployee = list.reduce((acc, k) => {
    const id = k.employee_id
    acc[id] = (acc[id] ?? 0) + Number(k.amount)
    return acc
  }, {} as Record<string, number>)

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
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kasbon Karyawan</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Pinjaman/uang muka gaji untuk karyawan. Akan dipotong saat pembayaran gaji.
            </p>
          </div>
          {canAdd && (
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              Tambah Kasbon
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">Total Kasbon (seluruh outlet)</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">Rp {totalKasbon.toLocaleString('id-ID')}</p>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="mt-4 text-gray-500 dark:text-gray-400">Belum ada kasbon tercatat.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2">Tanggal</th>
                  <th className="text-left py-2 px-2">Karyawan</th>
                  <th className="text-right py-2 px-2">Nominal</th>
                  <th className="text-left py-2 px-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {list.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                      {new Date(k.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-3 px-2 font-medium">{k.employees?.nama ?? '-'}</td>
                    <td className="py-3 px-2 text-right tabular-nums">Rp {Number(k.amount).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{k.notes ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {Object.keys(byEmployee).length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white">Rekap per Karyawan</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(byEmployee).map(([empId, total]) => {
              const emp = employees.find((e) => e.id === empId)
              return (
                <div key={empId} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span className="font-medium">{emp?.nama ?? '-'}</span>
                  <span className="tabular-nums text-amber-600 dark:text-amber-400">Rp {total.toLocaleString('id-ID')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card max-w-md">
          <h3 className="font-semibold text-gray-900 dark:text-white">Tambah Kasbon</h3>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Karyawan *</label>
              <select
                value={form.employee_id}
                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                className="input mt-1"
                required
              >
                <option value="">Pilih karyawan</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nominal (Rp) *</label>
              <input
                type="text"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                className="input mt-1"
                placeholder="0"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Keterangan</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="input mt-1"
                placeholder="Opsional"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowForm(false); setForm({ employee_id: '', amount: '', notes: '' }); }}
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
