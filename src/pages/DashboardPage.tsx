import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'
import { supabase } from '@/lib/supabase'

export function DashboardPage() {
  const { profile } = useAuthContext()
  const { outletId, isSuperAdmin } = useOutlet()
  const [loading, setLoading] = useState(true)
  const [todaySales, setTodaySales] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [todayCashIn, setTodayCashIn] = useState(0)
  const [todayCashOut, setTodayCashOut] = useState(0)
  const [weekly, setWeekly] = useState<{ date: string; total: number; count: number }[]>([])
  const canSeeCash = profile?.role === 'super_admin' || profile?.role === 'manager'

  useEffect(() => {
    if (!outletId && !isSuperAdmin) return
    if (!outletId) return
    const today = new Date()
    const todayDate = today.toISOString().slice(0, 10)
    const start = `${todayDate}T00:00:00`
    const end = `${todayDate}T23:59:59`

    const weekStartDate = new Date(today)
    weekStartDate.setDate(today.getDate() - 6)
    const weekStart = `${weekStartDate.toISOString().slice(0, 10)}T00:00:00`

    setLoading(true)

    Promise.all([
      supabase
        .from('transactions')
        .select('total, created_at')
        .eq('outlet_id', outletId)
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase
        .from('transactions')
        .select('total, created_at')
        .eq('outlet_id', outletId)
        .eq('status', 'completed')
        .gte('created_at', weekStart)
        .lte('created_at', end),
      canSeeCash
        ? supabase
            .from('cash_flows')
            .select('type, amount, created_at')
            .eq('outlet_id', outletId)
            .gte('created_at', start)
            .lte('created_at', end)
        : Promise.resolve({ data: null as unknown }),
    ])
      .then(([todayRes, weekRes, cashRes]) => {
        const todayList = ((todayRes as { data?: unknown[] }).data ?? []) as {
          total: number
          created_at: string
        }[]
        setTodaySales(todayList.reduce((s, t) => s + Number(t.total), 0))
        setTodayCount(todayList.length)

        const weekList = ((weekRes as { data?: unknown[] }).data ?? []) as {
          total: number
          created_at: string
        }[]

        const byDay: Record<string, { total: number; count: number }> = {}
        for (const t of weekList) {
          const d = t.created_at.slice(0, 10)
          if (!byDay[d]) byDay[d] = { total: 0, count: 0 }
          byDay[d].total += Number(t.total)
          byDay[d].count += 1
        }

        // Fill missing days so chart is stable
        const days: { date: string; total: number; count: number }[] = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStartDate)
          d.setDate(weekStartDate.getDate() + i)
          const key = d.toISOString().slice(0, 10)
          days.push({ date: key, total: byDay[key]?.total ?? 0, count: byDay[key]?.count ?? 0 })
        }
        setWeekly(days)

        if (canSeeCash) {
          const flows = ((cashRes as { data?: unknown[] }).data ?? []) as {
            type: 'in' | 'out'
            amount: number
            created_at: string
          }[]
          setTodayCashIn(flows.filter((f) => f.type === 'in').reduce((s, f) => s + Number(f.amount), 0))
          setTodayCashOut(flows.filter((f) => f.type === 'out').reduce((s, f) => s + Number(f.amount), 0))
        } else {
          setTodayCashIn(0)
          setTodayCashOut(0)
        }
      })
      .finally(() => setLoading(false))
  }, [canSeeCash])

  const avgTicket = useMemo(() => (todayCount > 0 ? todaySales / todayCount : 0), [todayCount, todaySales])
  const maxWeekly = useMemo(() => Math.max(1, ...weekly.map((d) => d.total)), [weekly])

  if (!outletId && !isSuperAdmin) return (
    <div className="card">
      <p className="font-medium text-gray-900 dark:text-white">Outlet belum diatur</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Outlet Anda di-set oleh admin atau manager. Minta mereka buka menu <strong>Karyawan</strong> → pilih nama Anda → <strong>Edit</strong> → pastikan <strong>Outlet</strong> terisi lalu simpan.
      </p>
    </div>
  )
  if (!outletId && isSuperAdmin) return (
    <div className="card">
      <p className="font-medium text-gray-900 dark:text-white">Pilih outlet</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Gunakan dropdown <strong>Outlet</strong> di atas (di header), atau <Link to="/outlets" className="text-primary-600 hover:underline">tambah outlet</Link> terlebih dahulu.
      </p>
    </div>
  )

  const cards = [
    { to: '/pos', label: 'POS', desc: 'Transaksi penjualan' },
    { to: '/reports', label: 'Laporan', desc: 'Harian, bulanan, tahunan' },
    { to: '/cash-flow', label: 'Arus Kas', desc: 'Pemasukan & pengeluaran' },
    { to: '/shifts', label: 'Shift', desc: 'Modal kasir & buka/tutup' },
    { to: '/attendance', label: 'Absensi', desc: 'Check-in / check-out' },
    { to: '/products', label: 'Produk', desc: 'Data produk' },
    { to: '/employees', label: 'Karyawan', desc: 'Data karyawan' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Selamat datang, {profile?.full_name || profile?.email}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">Aledroses Parfume - Toko Parfum Refill</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Penjualan hari ini</p>
          <p className="text-2xl font-bold text-primary-600">
            {loading ? '...' : `Rp ${todaySales.toLocaleString('id-ID')}`}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {loading ? '' : `${todayCount} transaksi • Avg Rp ${Math.round(avgTicket).toLocaleString('id-ID')}`}
          </p>
        </div>

        {canSeeCash ? (
          <>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Arus kas masuk (hari ini)</p>
              <p className="text-2xl font-bold text-green-600">
                {loading ? '...' : `Rp ${todayCashIn.toLocaleString('id-ID')}`}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Arus kas keluar (hari ini)</p>
              <p className="text-2xl font-bold text-red-600">
                {loading ? '...' : `Rp ${todayCashOut.toLocaleString('id-ID')}`}
              </p>
            </div>
          </>
        ) : (
          <div className="card md:col-span-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Ringkasan</p>
            <p className="text-gray-700 dark:text-gray-300 mt-1">
              Gunakan menu di kiri untuk mulai transaksi, absensi, dan lihat laporan.
            </p>
          </div>
        )}
      </div>

      <div className="card mt-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-semibold text-gray-900 dark:text-white">Grafik Penjualan (7 hari terakhir)</h2>
          <Link to="/reports" className="text-primary-600 hover:underline text-sm">Lihat detail laporan</Link>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="text-gray-600 dark:text-gray-400">Memuat grafik...</div>
          ) : (
            <svg viewBox="0 0 700 220" className="w-full h-[220px]">
              {weekly.map((d, i) => {
                const barW = 700 / 7
                const x = i * barW + 18
                const h = Math.round((d.total / maxWeekly) * 140)
                const y = 170 - h
                const label = d.date.slice(5)
                return (
                  <g key={d.date}>
                    <rect x={x} y={y} width={barW - 36} height={h} rx={8} className="fill-primary-600" />
                    <text x={x + (barW - 36) / 2} y={200} textAnchor="middle" className="fill-gray-500 text-[12px]">
                      {label}
                    </text>
                    <text x={x + (barW - 36) / 2} y={y - 6} textAnchor="middle" className="fill-gray-500 text-[11px]">
                      {d.total > 0 ? Math.round(d.total / 1000).toLocaleString('id-ID') + 'k' : ''}
                    </text>
                  </g>
                )
              })}
              <line x1="0" y1="170" x2="700" y2="170" className="stroke-gray-200" />
            </svg>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="card hover:shadow-md transition-shadow block"
          >
            <h3 className="font-semibold text-primary-600">{c.label}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
