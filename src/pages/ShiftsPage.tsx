import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import type { Shift } from '@/types/database'

interface ShiftWithEmployee extends Shift {
  employees?: { nama: string }
}

export function ShiftsPage() {
  const { profile } = useAuthContext()
  const { outletId } = useOutlet()
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState<Shift | null>(null)
  const [openCash, setOpenCash] = useState('')
  const [closeCash, setCloseCash] = useState('')
  const [myOpenShift, setMyOpenShift] = useState<Shift | null>(null)

  useEffect(() => {
    if (!outletId) return
    fetchShifts()
    if (profile?.employee_id) fetchMyOpenShift()
  }, [outletId, profile?.employee_id])

  async function fetchShifts() {
    if (!outletId) return
    const { data } = await supabase.from('shifts').select('*, employees(nama)').eq('outlet_id', outletId).order('date', { ascending: false }).limit(50)
    setShifts((data as ShiftWithEmployee[]) ?? [])
    setLoading(false)
  }

  async function fetchMyOpenShift() {
    if (!profile?.employee_id) return
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('shifts').select('*').eq('employee_id', profile.employee_id).eq('date', today).eq('status', 'open').maybeSingle()
    setMyOpenShift(data as Shift | null)
  }

  async function handleOpenShift() {
    if (!profile?.employee_id) {
      alert('Anda belum terhubung ke data karyawan.')
      return
    }
    if (!outletId) {
      alert('Outlet tidak tersedia.')
      return
    }
    const amount = Number(openCash) || 0
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('shifts').insert({
      outlet_id: outletId,
      employee_id: profile.employee_id,
      date: today,
      open_cash: amount,
      status: 'open',
    })
    if (error) {
      alert(error.message)
      return
    }
    await supabase.from('cash_flows').insert({
      outlet_id: outletId,
      type: 'in',
      category: 'modal_awal',
      amount,
      description: 'Modal awal kasir',
    })
    setOpenModal(false)
    setOpenCash('')
    fetchShifts()
    fetchMyOpenShift()
  }

  async function handleCloseShift() {
    if (!closeModal) return
    const counted = Number(closeCash)
    if (isNaN(counted) || counted < 0) {
      alert('Masukkan jumlah uang di laci.')
      return
    }
    const { data: sales } = await supabase.from('transactions').select('total, payment_method').eq('shift_id', closeModal.id).eq('status', 'completed')
    const cashSales = (sales ?? []).filter((t: { payment_method: string }) => t.payment_method === 'cash').reduce((s: number, t: { total: number }) => s + Number(t.total), 0)
    const { data: outflows } = await supabase.from('cash_flows').select('amount').eq('shift_id', closeModal.id).eq('type', 'out')
    const totalOut = (outflows ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0)
    const expected = Number(closeModal.open_cash) + cashSales - totalOut
    const discrepancy = counted - expected

    const { error } = await supabase.from('shifts').update({
      close_cash: counted,
      expected_cash: expected,
      discrepancy,
      closed_at: new Date().toISOString(),
      status: 'closed',
    }).eq('id', closeModal.id)

    if (error) {
      alert(error.message)
      return
    }
    setCloseModal(null)
    setCloseCash('')
    fetchShifts()
    fetchMyOpenShift()
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shift & Modal Kasir</h1>
      {myOpenShift ? (
        <div className="card mt-4 inline-block">
          <p className="text-green-600 font-medium">Shift Anda hari ini terbuka.</p>
          <p>Modal awal: Rp {Number(myOpenShift.open_cash).toLocaleString('id-ID')}</p>
          <button type="button" className="btn-primary mt-2" onClick={() => { setCloseModal(myOpenShift); setCloseCash(''); }}>
            Tutup Shift
          </button>
        </div>
      ) : profile?.employee_id ? (
        <button type="button" className="btn-primary mt-4" onClick={() => setOpenModal(true)}>
          Buka Shift (Modal Awal)
        </button>
      ) : (
        <p className="mt-4 text-gray-600">Hubungkan akun ke data karyawan untuk buka shift.</p>
      )}

      {openModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full">
            <h3 className="font-semibold text-lg">Modal Awal Kasir</h3>
            <input
              type="number"
              min={0}
              placeholder="Jumlah uang modal"
              value={openCash}
              onChange={(e) => setOpenCash(e.target.value)}
              className="input mt-2"
            />
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn-secondary flex-1" onClick={() => { setOpenModal(false); setOpenCash(''); }}>Batal</button>
              <button type="button" className="btn-primary flex-1" onClick={handleOpenShift}>Buka Shift</button>
            </div>
          </div>
        </div>
      )}

      {closeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full">
            <h3 className="font-semibold text-lg">Tutup Shift</h3>
            <p className="text-sm text-gray-600 mt-1">Masukkan jumlah uang yang ada di laci saat ini.</p>
            <input
              type="number"
              min={0}
              placeholder="Uang di laci"
              value={closeCash}
              onChange={(e) => setCloseCash(e.target.value)}
              className="input mt-2"
            />
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn-secondary flex-1" onClick={() => { setCloseModal(null); setCloseCash(''); }}>Batal</button>
              <button type="button" className="btn-primary flex-1" onClick={handleCloseShift}>Simpan & Tutup</button>
            </div>
          </div>
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2">Tanggal</th>
              <th className="text-left py-2">Kasir</th>
              <th className="text-right py-2">Modal</th>
              <th className="text-right py-2">Tutup</th>
              <th className="text-right py-2">Selisih</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2">{s.date}</td>
                <td className="py-2">{(s as ShiftWithEmployee).employees?.nama ?? '-'}</td>
                <td className="py-2 text-right">Rp {Number(s.open_cash).toLocaleString('id-ID')}</td>
                <td className="py-2 text-right">{s.close_cash != null ? `Rp ${Number(s.close_cash).toLocaleString('id-ID')}` : '-'}</td>
                <td className="py-2 text-right">{s.discrepancy != null ? `Rp ${Number(s.discrepancy).toLocaleString('id-ID')}` : '-'}</td>
                <td className="py-2"><span className={s.status === 'open' ? 'text-green-600' : 'text-gray-500'}>{s.status === 'open' ? 'Aktif' : 'Tutup'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
