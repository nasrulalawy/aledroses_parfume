import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import type { Attendance, Employee } from '@/types/database'

interface AttendanceWithEmployee extends Attendance {
  employees?: { nama: string }
}

type DayRow = {
  employee_id: string
  nama: string
  attendance: AttendanceWithEmployee | null
}

export function AttendancePage() {
  const { profile } = useAuthContext()
  const { outletId } = useOutlet()
  const [attendances, setAttendances] = useState<AttendanceWithEmployee[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10))
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [view, setView] = useState<'day' | 'month'>('day')
  const [myTodayRecord, setMyTodayRecord] = useState<Attendance | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!profile?.employee_id) return
    supabase.from('attendances').select('*').eq('employee_id', profile.employee_id).eq('date', today).maybeSingle().then(({ data }) => setMyTodayRecord(data as Attendance | null))
  }, [profile?.employee_id, today])

  useEffect(() => {
    if (!outletId) return
    supabase.from('employees').select('id, nama').eq('outlet_id', outletId).eq('is_active', true).order('nama').then(({ data }) => setEmployees((data as Employee[]) ?? []))
  }, [outletId])

  useEffect(() => {
    if (!outletId) return
    if (view === 'day') {
      supabase.from('attendances').select('*, employees(nama)').eq('outlet_id', outletId).eq('date', filterDate).order('check_in').then(({ data }) => setAttendances((data as AttendanceWithEmployee[]) ?? []))
    } else {
      supabase.from('attendances').select('*, employees(nama)').eq('outlet_id', outletId).gte('date', `${filterMonth}-01`).lt('date', `${filterMonth}-32`).order('date', { ascending: false }).then(({ data }) => setAttendances((data as AttendanceWithEmployee[]) ?? []))
    }
    setLoading(false)
  }, [outletId, view, filterDate, filterMonth])

  async function fetchDayAttendances() {
    if (!outletId) return
    const { data } = await supabase.from('attendances').select('*, employees(nama)').eq('outlet_id', outletId).eq('date', filterDate).order('check_in')
    setAttendances((data as AttendanceWithEmployee[]) ?? [])
  }

  async function handleCheckIn(employeeId: string) {
    if (!outletId) return
    setUpdatingId(employeeId)
    const now = new Date().toISOString()
    const { error } = await supabase.from('attendances').upsert(
      { outlet_id: outletId, employee_id: employeeId, date: filterDate, check_in: now, status: 'hadir' },
      { onConflict: 'employee_id,date' }
    )
    setUpdatingId(null)
    if (error) alert(error.message)
    else fetchDayAttendances()
  }

  async function handleCheckOut(employeeId: string) {
    setUpdatingId(employeeId)
    const now = new Date().toISOString()
    const { error } = await supabase.from('attendances').update({ check_out: now }).eq('employee_id', employeeId).eq('date', filterDate)
    setUpdatingId(null)
    if (error) alert(error.message)
    else fetchDayAttendances()
  }

  async function handleSelfCheckIn() {
    if (!profile?.employee_id || !outletId) {
      alert('Anda belum terhubung ke data karyawan.')
      return
    }
    setUpdatingId(profile.employee_id)
    const now = new Date().toISOString()
    const { error } = await supabase.from('attendances').upsert(
      { outlet_id: outletId, employee_id: profile.employee_id, date: today, check_in: now, status: 'hadir' },
      { onConflict: 'employee_id,date' }
    )
    setUpdatingId(null)
    if (error) alert(error.message)
    else {
      supabase.from('attendances').select('*').eq('employee_id', profile.employee_id).eq('date', today).maybeSingle().then(({ data }) => setMyTodayRecord(data as Attendance | null))
      if (filterDate === today) fetchDayAttendances()
    }
  }

  async function handleSelfCheckOut() {
    if (!profile?.employee_id) return
    setUpdatingId(profile.employee_id)
    const now = new Date().toISOString()
    const { error } = await supabase.from('attendances').update({ check_out: now }).eq('employee_id', profile.employee_id).eq('date', today)
    setUpdatingId(null)
    if (error) alert(error.message)
    else {
      supabase.from('attendances').select('*').eq('employee_id', profile.employee_id).eq('date', today).maybeSingle().then(({ data }) => setMyTodayRecord(data as Attendance | null))
      if (filterDate === today) fetchDayAttendances()
    }
  }

  const dayRows: DayRow[] = employees.map((emp) => {
    const att = attendances.find((a) => a.employee_id === emp.id)
    return { employee_id: emp.id, nama: emp.nama, attendance: att ?? null }
  })

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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Absensi</h1>
      {profile?.employee_id && (
        <div className="card mt-4 flex gap-2 flex-wrap items-center">
          <span>Hari ini (diri sendiri):</span>
          {!myTodayRecord?.check_in ? (
            <button type="button" className="btn-primary" onClick={handleSelfCheckIn}>Check-in</button>
          ) : !myTodayRecord?.check_out ? (
            <button type="button" className="btn-secondary" onClick={handleSelfCheckOut}>Check-out</button>
          ) : (
            <span className="text-green-600">Sudah check-in & check-out</span>
          )}
        </div>
      )}
      <div className="card mt-4 flex gap-4 flex-wrap">
        <button type="button" className={view === 'day' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('day')}>Per Hari</button>
        <button type="button" className={view === 'month' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('month')}>Per Bulan</button>
        {view === 'day' && <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="input w-40" />}
        {view === 'month' && <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="input w-40" />}
      </div>
      <div className="card mt-4 overflow-x-auto">
        {view === 'day' ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Tanggal: {filterDate}. Klik Check-in/Check-out untuk mencatat absensi karyawan.</p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-2">Nama</th>
                  <th className="text-left py-2">Check-in</th>
                  <th className="text-left py-2">Check-out</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => {
                  const a = row.attendance
                  const isUpdating = updatingId === row.employee_id
                  return (
                    <tr key={row.employee_id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 font-medium">{row.nama}</td>
                      <td className="py-2">{a?.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID') : '-'}</td>
                      <td className="py-2">{a?.check_out ? new Date(a.check_out).toLocaleTimeString('id-ID') : '-'}</td>
                      <td className="py-2">{a?.status ?? '-'}</td>
                      <td className="py-2">
                        {!a?.check_in ? (
                          <button type="button" className="btn-primary text-sm py-1 px-2" onClick={() => handleCheckIn(row.employee_id)} disabled={isUpdating}>
                            {isUpdating ? '...' : 'Check-in'}
                          </button>
                        ) : !a?.check_out ? (
                          <button type="button" className="btn-secondary text-sm py-1 px-2" onClick={() => handleCheckOut(row.employee_id)} disabled={isUpdating}>
                            {isUpdating ? '...' : 'Check-out'}
                          </button>
                        ) : (
                          <span className="text-green-600 text-sm">Selesai</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-2">Tanggal</th>
                <th className="text-left py-2">Nama</th>
                <th className="text-left py-2">Check-in</th>
                <th className="text-left py-2">Check-out</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2">{a.date}</td>
                  <td className="py-2">{(a as AttendanceWithEmployee).employees?.nama ?? '-'}</td>
                  <td className="py-2">{a.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID') : '-'}</td>
                  <td className="py-2">{a.check_out ? new Date(a.check_out).toLocaleTimeString('id-ID') : '-'}</td>
                  <td className="py-2">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
